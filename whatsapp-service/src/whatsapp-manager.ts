import { spawn, ChildProcess } from 'child_process';
import type { Event } from '@shared/schema.mssql';
import { format } from 'date-fns';
import path from 'path';
import { rm, mkdir } from 'fs/promises';
import { existsSync } from 'fs';

/**
 * WhatsApp Session States
 */
enum SessionState {
  IDLE = 'IDLE',                         // No session, not attempting connection
  STARTING = 'STARTING',                  // Spawning mudslide process
  QR_READY = 'QR_READY',                 // QR code available for scanning
  AWAITING_PAIRING = 'AWAITING_PAIRING', // QR scanned, waiting for phone pairing
  SYNCING = 'SYNCING',                   // Waiting for "connection: open" event
  VALIDATING = 'VALIDATING',             // Polling session with "mudslide me"
  AUTHENTICATED = 'AUTHENTICATED',        // Successfully authenticated
  ERROR = 'ERROR',                        // Error state
  SHUTTING_DOWN = 'SHUTTING_DOWN'        // Logging out / cleaning up
}

interface QueuedOperation<T> {
  execute: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  timeout: number;
  timeoutId?: NodeJS.Timeout;
}

/**
 * WhatsApp Session Manager
 * 
 * Centralized manager for all WhatsApp/mudslide interactions.
 * Maintains a single session and serializes all operations through a queue.
 */
class WhatsAppSessionManager {
  private state: SessionState = SessionState.IDLE;
  private readonly cacheDir: string;
  private operationQueue: QueuedOperation<any>[] = [];
  private processingQueue: boolean = false;
  private loginProcess: ChildProcess | null = null;
  
  // Login mutex to prevent concurrent login/auth operations
  private loginMutex: boolean = false;
  private loginMutexQueue: Array<() => void> = [];
  
  // Session stability flag
  private sessionUnstable: boolean = false;
  
  // QR code caching
  private cachedQRCode: string | null = null;
  private qrCodeExpiry: number = 0;
  private readonly QR_CACHE_TTL = 60000; // 60 seconds
  
  // Authentication state
  private authenticated: boolean = false;
  private lastAuthCheck: number = 0;
  private readonly AUTH_CHECK_CACHE_TTL = 5000; // 5 seconds
  
  // Chat list caching
  private cachedChats: any[] | null = null;
  private chatsExpiry: number = 0;
  private readonly CHATS_CACHE_TTL = 180000; // 3 minutes
  
  constructor() {
    this.cacheDir = path.join(process.cwd(), '.mudslide-cache');
    console.log('[WhatsApp Manager] Initialized with cache directory:', this.cacheDir);
  }
  
  /**
   * Acquire login mutex - ensures only one login/auth operation at a time
   */
  private async acquireLoginMutex(): Promise<void> {
    if (!this.loginMutex) {
      this.loginMutex = true;
      console.log('[WhatsApp Mutex] Login mutex acquired');
      return;
    }
    
    // Wait for mutex to be released
    console.log('[WhatsApp Mutex] Waiting for login mutex...');
    return new Promise<void>((resolve) => {
      this.loginMutexQueue.push(resolve);
    });
  }
  
  /**
   * Release login mutex - allows next waiting operation to proceed
   */
  private releaseLoginMutex(): void {
    const next = this.loginMutexQueue.shift();
    if (next) {
      console.log('[WhatsApp Mutex] Login mutex passed to next waiter');
      next();
    } else {
      this.loginMutex = false;
      console.log('[WhatsApp Mutex] Login mutex released');
    }
  }
  
  /**
   * Invalidate all caches - called when session becomes unstable
   */
  private invalidateAllCaches(): void {
    console.log('[WhatsApp Manager] Invalidating all caches');
    this.cachedQRCode = null;
    this.qrCodeExpiry = 0;
    this.lastAuthCheck = 0;
    this.authenticated = false;
    this.cachedChats = null;
    this.chatsExpiry = 0;
  }
  
  /**
   * Get current session state
   */
  getState(): SessionState {
    return this.state;
  }
  
  /**
   * Check if authenticated (with caching to avoid frequent checks)
   */
  async isAuthenticated(): Promise<boolean> {
    // Acquire login mutex to prevent concurrent auth checks during login
    await this.acquireLoginMutex();
    
    try {
      // Check if session is unstable
      if (this.sessionUnstable) {
        console.log('[WhatsApp Auth] Session is unstable - returning false');
        return false;
      }
      
      // Use cached result if recent
      const now = Date.now();
      if (now - this.lastAuthCheck < this.AUTH_CHECK_CACHE_TTL) {
        return this.authenticated;
      }
      
      // Queue the auth check operation
      const result = await this.enqueueOperation(async () => {
        return new Promise<boolean>((resolve) => {
          console.log('[WhatsApp Auth] Starting authentication check...');
          const process = spawn('npx', ['mudslide', '--cache', this.cacheDir, 'me'], {
            timeout: 10000
          });
          
          let stdout = '';
          let stderr = '';
          
          process.stdout.on('data', (data) => {
            const chunk = data.toString();
            console.log('[WhatsApp Auth] stdout:', chunk);
            stdout += chunk;
          });
          
          process.stderr.on('data', (data) => {
            const chunk = data.toString();
            console.log('[WhatsApp Auth] stderr:', chunk);
            stderr += chunk;
          });
          
          process.on('close', async (code) => {
            const hasUserData = stdout.includes('@') || stdout.includes('Phone:');
            const notLoggedIn = stderr.toLowerCase().includes('not logged in');
            const deviceDisconnected = stderr.toLowerCase().includes('device was disconnected') || 
                                      stderr.toLowerCase().includes('connection closed') ||
                                      stdout.toLowerCase().includes('device was disconnected');
            const isAuth = code === 0 && hasUserData && !notLoggedIn && !deviceDisconnected;
            
            // Detect stale session that needs cleanup
            // Case 1: Device was explicitly disconnected
            if (deviceDisconnected && !notLoggedIn) {
              console.warn('[WhatsApp Auth] ⚠️ Stale session detected - device was disconnected from WhatsApp');
              console.log('[WhatsApp Auth] Queueing stale session cleanup...');
              
              // FIXED: Queue the cleanup instead of fire-and-forget
              // This ensures filesystem operations complete before next mudslide call
              this.clearStaleSession().catch(err => {
                console.error('[WhatsApp Auth] Failed to clear stale session:', err);
              });
            }
            // Case 2: Exit code 0 but no user data (session files exist but invalid server-side)
            else if (code === 0 && !hasUserData && !notLoggedIn) {
              console.warn('[WhatsApp Auth] ⚠️ Stale session detected - cache files exist but session is invalid (no user data returned)');
              console.log('[WhatsApp Auth] Queueing stale session cleanup...');
              
              // FIXED: Queue the cleanup instead of fire-and-forget
              this.clearStaleSession().catch(err => {
                console.error('[WhatsApp Auth] Failed to clear stale session:', err);
              });
            }
            
            this.authenticated = isAuth;
            this.lastAuthCheck = Date.now();
            
            if (isAuth) {
              this.state = SessionState.AUTHENTICATED;
              // Clear unstable flag on successful auth
              this.sessionUnstable = false;
            } else if (this.state === SessionState.AUTHENTICATED) {
              // Was authenticated, now not - transition to IDLE
              this.state = SessionState.IDLE;
            }
            
            console.log('[WhatsApp Auth] Auth check result:', isAuth ? 'AUTHENTICATED' : 'NOT AUTHENTICATED', '(code:', code + ')');
            resolve(isAuth);
          });
          
          process.on('error', (err) => {
            console.error('[WhatsApp Auth] Process error:', err);
            this.authenticated = false;
            this.lastAuthCheck = Date.now();
            this.sessionUnstable = true;
            this.invalidateAllCaches();
            resolve(false);
          });
        });
      }, 15000); // 15 second timeout
      
      return result;
    } finally {
      // Always release mutex
      this.releaseLoginMutex();
    }
  }
  
  /**
   * Ensure authenticated - verifies auth immediately after acquiring queue slot
   * Retries once with forced cache refresh if auth fails
   * 
   * FIXED: Called inside queued operations to catch mid-operation disconnects
   */
  private async ensureAuthenticated(retryOnFail: boolean = true): Promise<void> {
    console.log('[WhatsApp Auth] Ensuring authentication before operation...');
    
    // Check if session is unstable
    if (this.sessionUnstable) {
      throw new Error('Session is unstable - please re-authenticate');
    }
    
    // First check with cache
    let isAuth = await this.isAuthenticated();
    
    if (!isAuth && retryOnFail) {
      console.log('[WhatsApp Auth] Not authenticated, forcing cache refresh and retrying...');
      // Force cache refresh and retry
      this.lastAuthCheck = 0;
      isAuth = await this.isAuthenticated();
    }
    
    if (!isAuth) {
      throw new Error('Not authenticated - please login first');
    }
    
    console.log('[WhatsApp Auth] ✓ Authentication verified');
  }
  
  /**
   * Clear stale session files without full logout
   * FIXED: Now queued to ensure filesystem operations complete before next mudslide call
   */
  private async clearStaleSession(): Promise<void> {
    // Queue the cleanup operation to ensure it completes before other operations
    await this.enqueueOperation(async () => {
      try {
        console.log('[WhatsApp Manager] Clearing stale session files...');
        
        // Kill any running login process first
        if (this.loginProcess) {
          console.log('[WhatsApp Manager] Killing active login process during cleanup...');
          this.loginProcess.kill();
          this.loginProcess = null;
        }
        
        // Remove cache directory
        if (existsSync(this.cacheDir)) {
          await rm(this.cacheDir, { recursive: true, force: true });
          await mkdir(this.cacheDir, { recursive: true, mode: 0o700 });
          console.log('[WhatsApp Manager] ✓ Stale session cleared');
        }
        
        // Invalidate ALL caches
        this.invalidateAllCaches();
        
        // Reset state
        this.state = SessionState.IDLE;
        this.sessionUnstable = true; // Mark session as unstable until fresh auth succeeds
        
        console.log('[WhatsApp Manager] ✓ All caches invalidated, session marked unstable');
      } catch (error: any) {
        console.error('[WhatsApp Manager] Failed to clear stale session:', error);
        this.sessionUnstable = true;
        this.invalidateAllCaches();
        throw error;
      }
    }, 20000); // 20 second timeout for filesystem operations
  }
  
  /**
   * Get QR code for login (with caching)
   * 
   * CRITICAL: This method keeps the mudslide login process alive after returning the QR code.
   * The process must continue running to allow the phone to complete pairing.
   * 
   * FIXED: Uses login mutex and unified timeout management to prevent race conditions
   */
  async getQRCode(): Promise<string> {
    // Return cached QR if still valid
    const now = Date.now();
    if (this.cachedQRCode && now < this.qrCodeExpiry) {
      console.log('[WhatsApp Login] Returning cached QR code');
      return this.cachedQRCode;
    }
    
    // DON'T call isAuthenticated() here - just check cached value
    // If authenticated flag is already true, throw error
    if (this.authenticated) {
      throw new Error('Already authenticated');
    }
    
    // Acquire login mutex to prevent concurrent login attempts
    await this.acquireLoginMutex();
    
    try {
      // Double-check authentication after acquiring mutex (using cached flag)
      if (this.authenticated) {
        throw new Error('Already authenticated');
      }
      
      // Kill any existing login process before starting a new one
      if (this.loginProcess) {
        console.log('[WhatsApp Login] Killing existing login process before starting new one');
        this.loginProcess.kill();
        this.loginProcess = null;
      }
      
      // Queue the QR code generation
      const qrCode = await this.enqueueOperation(async () => {
        this.state = SessionState.STARTING;
        console.log('[WhatsApp Login] Starting mudslide login process...');
        
        return new Promise<string>((resolve, reject) => {
          // Spawn the login process and store it
          this.loginProcess = spawn('npx', ['mudslide', '--cache', this.cacheDir, 'login']);
          const process = this.loginProcess;
          
          let output = '';
          let hasResolvedQR = false;
          let hasSeenLoggedIn = false;
          let exitKeypressSent = false;
          let processKilled = false;
          let qrCheckInterval: NodeJS.Timeout | null = null;
          let qrTimeoutId: NodeJS.Timeout | null = null;
          let syncTimeoutId: NodeJS.Timeout | null = null;
          
          // Cleanup function to prevent double-kill and double-resolve
          const cleanup = (clearTimers: boolean = true) => {
            if (clearTimers) {
              if (qrCheckInterval) {
                clearInterval(qrCheckInterval);
                qrCheckInterval = null;
              }
              if (qrTimeoutId) {
                clearTimeout(qrTimeoutId);
                qrTimeoutId = null;
              }
              if (syncTimeoutId) {
                clearTimeout(syncTimeoutId);
                syncTimeoutId = null;
              }
            }
          };
          
          // Kill process safely (only once)
          const killProcess = () => {
            if (!processKilled && this.loginProcess === process) {
              processKilled = true;
              process.kill();
              this.loginProcess = null;
              console.log('[WhatsApp Login] Process killed');
            }
          };
          
          // Comprehensive stdout logging
          if (process.stdout) {
            process.stdout.on('data', (data) => {
              const chunk = data.toString();
              console.log('[WhatsApp Login] stdout:', chunk);
              output += chunk;
              
              // Track when we see "Logged in" message
              if (!hasSeenLoggedIn && chunk.includes('Logged in')) {
                hasSeenLoggedIn = true;
                this.state = SessionState.SYNCING;
                console.log('[WhatsApp Login] ✓ Logged in detected');
                console.log('[WhatsApp Login] ⏳ Waiting 20 seconds for WhatsApp to complete full session sync...');
                console.log('[WhatsApp Login] ⚠️  Do NOT close this or refresh - session sync in progress');
                
                // FIXED: Wait 20 seconds for complete sync (tied to outer timeout management)
                syncTimeoutId = setTimeout(() => {
                  if (!exitKeypressSent && process.stdin && !processKilled) {
                    exitKeypressSent = true;
                    this.state = SessionState.VALIDATING;
                    console.log('[WhatsApp Login] ✓ 20 second sync complete - sending exit keypress...');
                    process.stdin.write('\n');
                  }
                  syncTimeoutId = null;
                }, 20000); // 20 second wait after "Logged in"
              }
            });
          }
          
          // Comprehensive stderr logging
          if (process.stderr) {
            process.stderr.on('data', (data) => {
              const chunk = data.toString();
              console.log('[WhatsApp Login] stderr:', chunk);
              // Only log errors that aren't npm warnings
              if (chunk.toLowerCase().includes('error') && !chunk.includes('npm warn')) {
                console.error('[WhatsApp Login] Error detected:', chunk);
              }
            });
          }
          
          // Poll for QR code patterns
          qrCheckInterval = setInterval(() => {
            // Check if we have QR code characters and sufficient output
            if (!hasResolvedQR && /[█▄▀▐▌]/.test(output) && output.length > 100) {
              cleanup(false); // Clear QR check interval but keep timeout
              hasResolvedQR = true;
              
              // Set state to AWAITING_PAIRING
              this.state = SessionState.AWAITING_PAIRING;
              this.cachedQRCode = output;
              this.qrCodeExpiry = Date.now() + this.QR_CACHE_TTL;
              
              console.log('[WhatsApp Login] QR code detected! State: AWAITING_PAIRING');
              console.log('[WhatsApp Login] Process will continue running for pairing...');
              
              // Return the QR code to frontend, but DON'T kill the process
              resolve(output);
            }
          }, 500);
          
          // Listen for process completion (after QR is scanned and pairing completes)
          process.on('close', async (code) => {
            console.log('[WhatsApp Login] Process exited with code:', code);
            cleanup();
            
            // Clear the login process reference
            if (this.loginProcess === process) {
              this.loginProcess = null;
            }
            
            // If QR was returned, check authentication status
            if (hasResolvedQR) {
              console.log('[WhatsApp Login] Pairing process completed, checking authentication...');
              
              // Force a fresh auth check (bypass cache)
              this.lastAuthCheck = 0;
              const isAuth = await this.isAuthenticated();
              
              if (isAuth) {
                console.log('[WhatsApp Login] ✓ Successfully authenticated after pairing!');
                this.state = SessionState.AUTHENTICATED;
                this.sessionUnstable = false;
              } else {
                console.log('[WhatsApp Login] ✗ Pairing completed but not authenticated');
                this.state = SessionState.IDLE;
              }
            } else {
              // Process exited before QR was detected - this is an error
              this.state = SessionState.ERROR;
              this.sessionUnstable = true;
              if (!hasResolvedQR) {
                reject(new Error('Process exited before QR code was generated'));
              }
            }
          });
          
          // Handle process errors
          process.on('error', (error) => {
            console.error('[WhatsApp Login] Process error:', error);
            cleanup();
            
            // Clear the login process reference
            if (this.loginProcess === process) {
              this.loginProcess = null;
            }
            
            this.state = SessionState.ERROR;
            this.sessionUnstable = true;
            if (!hasResolvedQR) {
              reject(new Error(`Failed to spawn mudslide: ${error.message}`));
            }
          });
          
          // FIXED: Unified timeout for QR code generation (120 seconds)
          qrTimeoutId = setTimeout(() => {
            if (!hasResolvedQR) {
              console.error('[WhatsApp Login] Timeout waiting for QR code (120s)');
              cleanup();
              
              // Kill the process only if we haven't gotten the QR yet
              killProcess();
              
              if (output.length > 0) {
                // Return whatever output we have
                this.state = SessionState.AWAITING_PAIRING;
                this.cachedQRCode = output;
                this.qrCodeExpiry = Date.now() + this.QR_CACHE_TTL;
                hasResolvedQR = true;
                resolve(output);
              } else {
                this.state = SessionState.ERROR;
                this.sessionUnstable = true;
                reject(new Error('Timeout waiting for QR code'));
              }
            }
            qrTimeoutId = null;
          }, 120000); // 120 seconds = 2 minutes
        });
      }, 125000); // 125 second timeout (slightly more than the inner timeout)
      
      return qrCode;
    } finally {
      // Always release mutex
      this.releaseLoginMutex();
    }
  }
  
  /**
   * Logout and clear credentials completely
   * This safely removes ALL mudslide credentials from disk
   * 
   * FIXED: Uses invalidateAllCaches() for proper cleanup
   */
  async logout(): Promise<void> {
    await this.enqueueOperation(async () => {
      this.state = SessionState.SHUTTING_DOWN;
      console.log('[WhatsApp Manager] Starting logout process...');
      
      return new Promise<void>(async (resolve, reject) => {
        try {
          // Step 1: Kill any running login process
          if (this.loginProcess) {
            console.log('[WhatsApp Manager] Killing active login process...');
            this.loginProcess.kill();
            this.loginProcess = null;
          }
          
          // Step 2: Call mudslide logout command
          const logoutProcess = spawn('npx', ['mudslide', '--cache', this.cacheDir, 'logout'], {
            timeout: 10000
          });
          
          await new Promise<void>((resolveLogout, rejectLogout) => {
            logoutProcess.on('close', (code) => {
              console.log('[WhatsApp Manager] Mudslide logout command completed with code:', code);
              resolveLogout();
            });
            
            logoutProcess.on('error', (error) => {
              console.warn('[WhatsApp Manager] Mudslide logout command error (will continue cleanup):', error);
              resolveLogout(); // Continue with cleanup even if command fails
            });
          });
          
          // Step 3: Completely remove the cache directory to ensure NO credentials remain
          console.log('[WhatsApp Manager] Removing cache directory:', this.cacheDir);
          if (existsSync(this.cacheDir)) {
            await rm(this.cacheDir, { recursive: true, force: true });
            console.log('[WhatsApp Manager] Cache directory removed successfully');
          }
          
          // Step 4: Recreate empty cache directory with restricted permissions (0o700 = owner-only)
          await mkdir(this.cacheDir, { recursive: true, mode: 0o700 });
          console.log('[WhatsApp Manager] Clean cache directory created with secure permissions (0o700)');
          
          // Step 5: Invalidate ALL caches and reset state
          this.invalidateAllCaches();
          this.state = SessionState.IDLE;
          this.sessionUnstable = false; // Logout resets unstable flag
          
          console.log('[WhatsApp Manager] Logout complete - all credentials and caches safely cleared');
          resolve();
        } catch (error: any) {
          // Even on error, try to reset state
          if (this.loginProcess) {
            this.loginProcess.kill();
            this.loginProcess = null;
          }
          
          // Invalidate all caches
          this.invalidateAllCaches();
          this.state = SessionState.IDLE;
          this.sessionUnstable = false;
          
          console.error('[WhatsApp Manager] Logout error:', error);
          reject(new Error(`Failed to logout: ${error.message}`));
        }
      });
    }, 20000); // Increased timeout for directory operations
  }
  
  /**
   * Send a WhatsApp message
   * 
   * FIXED: Re-verifies auth INSIDE queued execution to catch mid-operation disconnects
   */
  async sendMessage(recipient: string, message: string): Promise<void> {
    await this.enqueueOperation(async () => {
      // FIXED: Ensure authenticated INSIDE the queued execution
      // This catches auth issues that occur after queue slot is acquired
      await this.ensureAuthenticated();
      
      return new Promise<void>((resolve, reject) => {
        console.log('[WhatsApp Send] Sending message to:', recipient);
        const process = spawn('npx', [
          'mudslide',
          '--cache',
          this.cacheDir,
          'send',
          recipient,
          message
        ], {
          timeout: 30000
        });
        
        let stdout = '';
        let stderr = '';
        
        process.stdout.on('data', (data) => {
          const chunk = data.toString();
          console.log('[WhatsApp Send] stdout:', chunk);
          stdout += chunk;
        });
        
        process.stderr.on('data', (data) => {
          const chunk = data.toString();
          console.log('[WhatsApp Send] stderr:', chunk);
          stderr += chunk;
        });
        
        process.on('close', (code) => {
          // Detect auth errors in stderr
          const authError = stderr.toLowerCase().includes('not logged in') ||
                          stderr.toLowerCase().includes('device was disconnected') ||
                          stderr.toLowerCase().includes('connection closed');
          
          if (code === 0) {
            console.log(`[WhatsApp Send] ✓ Message sent successfully to ${recipient}`);
            resolve();
          } else if (authError) {
            console.error(`[WhatsApp Send] ✗ Authentication error detected:`, stderr);
            this.sessionUnstable = true;
            this.invalidateAllCaches();
            reject(new Error('Authentication lost - please re-authenticate'));
          } else {
            console.error(`[WhatsApp Send] ✗ Failed to send message (code ${code}):`, stderr);
            reject(new Error(`Failed to send WhatsApp message: ${stderr || 'Unknown error'}`));
          }
        });
        
        process.on('error', (error) => {
          console.error(`[WhatsApp Send] Process error:`, error);
          reject(new Error(`Failed to send WhatsApp message: ${error.message}`));
        });
      });
    }, 35000); // 35 second timeout
  }
  
  /**
   * List all available groups (with caching and in-memory filtering)
   * Uses mudslide's 'groups' command to retrieve WhatsApp group chats
   * 
   * FIXED: Re-verifies auth INSIDE queued execution to catch mid-operation disconnects
   */
  async listChats(query?: string): Promise<Array<{ id: string; name: string; type: string }>> {
    // Check cache first - regardless of query
    const now = Date.now();
    if (this.cachedChats && now < this.chatsExpiry) {
      console.log('[WhatsApp Chats] Cache hit - filtering in memory');
      // Filter cached results in memory
      if (query) {
        const filtered = this.cachedChats.filter(chat => 
          chat.name.toLowerCase().includes(query.toLowerCase())
        );
        console.log(`[WhatsApp Chats] Filtered ${filtered.length} from ${this.cachedChats.length} cached chats matching "${query}"`);
        return filtered;
      }
      console.log(`[WhatsApp Chats] Returning ${this.cachedChats.length} cached chats`);
      return this.cachedChats;
    }
    
    console.log('[WhatsApp Chats] Cache miss - fetching fresh chat list...');
    
    // Queue the list chats operation
    const chats = await this.enqueueOperation(async () => {
      // FIXED: Ensure authenticated INSIDE the queued execution
      // This catches auth issues that occur after queue slot is acquired
      await this.ensureAuthenticated();
      
      return new Promise<Array<{ id: string; name: string; type: string }>>((resolve, reject) => {
        const process = spawn('npx', [
          'mudslide',
          '--cache',
          this.cacheDir,
          'groups'
        ], {
          timeout: 30000
        });
        
        let stdout = '';
        let stderr = '';
        
        process.stdout.on('data', (data) => {
          const chunk = data.toString();
          console.log('[WhatsApp Chats] stdout:', chunk);
          stdout += chunk;
        });
        
        process.stderr.on('data', (data) => {
          const chunk = data.toString();
          console.log('[WhatsApp Chats] stderr:', chunk);
          stderr += chunk;
        });
        
        process.on('close', (code) => {
          // Detect auth errors in stderr
          const authError = stderr.toLowerCase().includes('not logged in') ||
                          stderr.toLowerCase().includes('device was disconnected') ||
                          stderr.toLowerCase().includes('connection closed');
          
          if (authError) {
            console.error(`[WhatsApp Chats] ✗ Authentication error detected:`, stderr);
            this.sessionUnstable = true;
            this.invalidateAllCaches();
            reject(new Error('Authentication lost - please re-authenticate'));
            return;
          }
          
          if (code === 0) {
            try {
              // Try JSON parsing first (preferred)
              let chatList: Array<{ id: string; name: string; type: string }> = [];
              
              try {
                const jsonData = JSON.parse(stdout);
                // Handle array of chats
                if (Array.isArray(jsonData)) {
                  chatList = jsonData.map((chat: any) => ({
                    id: chat.id || chat.jid || '',
                    name: chat.name || chat.title || chat.subject || chat.id || 'Unknown',
                    type: (chat.id || chat.jid || '').includes('@g.us') ? 'group' : 'individual'
                  }));
                }
                // Handle single chat object
                else if (jsonData && typeof jsonData === 'object' && (jsonData.id || jsonData.jid)) {
                  chatList.push({
                    id: jsonData.id || jsonData.jid || '',
                    name: jsonData.name || jsonData.title || jsonData.subject || jsonData.id || 'Unknown',
                    type: (jsonData.id || jsonData.jid || '').includes('@g.us') ? 'group' : 'individual'
                  });
                }
              } catch (jsonError) {
                // Fallback to text parsing if JSON fails
                console.log('[WhatsApp Chats] JSON parsing failed, falling back to text parsing');
                const lines = stdout.trim().split('\n').filter(line => line.trim());
                
                for (const line of lines) {
                  // Try to extract JSON from line first
                  try {
                    const jsonMatch = line.match(/\{.*\}/);
                    if (jsonMatch) {
                      const chatObj = JSON.parse(jsonMatch[0]);
                      if (chatObj.id || chatObj.jid) {
                        chatList.push({
                          id: chatObj.id || chatObj.jid || '',
                          name: chatObj.name || chatObj.title || chatObj.subject || chatObj.id || 'Unknown',
                          type: (chatObj.id || chatObj.jid || '').includes('@g.us') ? 'group' : 'individual'
                        });
                        continue;
                      }
                    }
                  } catch (e) {
                    // JSON extraction failed, continue with text parsing
                  }
                  
                  // Format: "Chat Name (ID: chat_id@type.us)" or similar
                  const match = line.match(/(.+?)\s*\(ID:\s*(.+?)\)/);
                  if (match) {
                    const name = match[1].trim();
                    const id = match[2].trim();
                    const type = id.includes('@g.us') ? 'group' : 'individual';
                    chatList.push({ id, name, type });
                  } else if (line.includes('@')) {
                    // Fallback: extract ID from line and clean it
                    const idMatch = line.match(/([0-9]+@[a-z]+\.us)/);
                    if (idMatch) {
                      const id = idMatch[1];
                      const name = line.replace(/[{}",:]/g, '').replace(id, '').replace(/id/gi, '').replace(/subject/gi, '').trim() || id;
                      const type = id.includes('@g.us') ? 'group' : 'individual';
                      chatList.push({ id, name, type });
                    }
                  }
                }
              }
              
              // Cache the full results
              this.cachedChats = chatList;
              this.chatsExpiry = Date.now() + this.CHATS_CACHE_TTL;
              console.log(`[WhatsApp Chats] Cached ${chatList.length} chats`);
              
              // Filter by query if provided
              if (query) {
                const filtered = chatList.filter(chat => 
                  chat.name.toLowerCase().includes(query.toLowerCase())
                );
                console.log(`[WhatsApp Chats] Found ${filtered.length} chats matching "${query}"`);
                resolve(filtered);
              } else {
                console.log(`[WhatsApp Chats] Listed ${chatList.length} chats`);
                resolve(chatList);
              }
            } catch (error) {
              console.error('[WhatsApp Chats] Failed to parse chat list:', error);
              reject(new Error('Failed to parse chat list'));
            }
          } else {
            console.error(`[WhatsApp Chats] Failed to list chats (code ${code}):`, stderr);
            reject(new Error(`Failed to list chats: ${stderr || 'Unknown error'}`));
          }
        });
        
        process.on('error', (error) => {
          console.error(`[WhatsApp Chats] Process error:`, error);
          reject(new Error(`Failed to list chats: ${error.message}`));
        });
      });
    }, 35000); // 35 second timeout
    
    return chats;
  }
  
  /**
   * Enqueue an operation to be executed serially
   */
  private async enqueueOperation<T>(
    operation: () => Promise<T>,
    timeout: number = 30000
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const queuedOp: QueuedOperation<T> = {
        execute: operation,
        resolve,
        reject,
        timeout
      };
      
      this.operationQueue.push(queuedOp);
      
      // Always trigger processing - processQueue handles concurrent calls
      this.processQueue();
    });
  }
  
  /**
   * Process queued operations one at a time
   */
  private async processQueue(): Promise<void> {
    // Exit if already processing - the running instance will drain the queue
    if (this.processingQueue) {
      return;
    }
    
    // Exit if nothing to process
    if (this.operationQueue.length === 0) {
      return;
    }
    
    this.processingQueue = true;
    
    try {
      // Continue processing until queue is empty
      while (this.operationQueue.length > 0) {
        const operation = this.operationQueue.shift()!;
        
        try {
          // Set up timeout
          const timeoutPromise = new Promise<never>((_, reject) => {
            operation.timeoutId = setTimeout(() => {
              reject(new Error(`Operation timed out after ${operation.timeout}ms`));
            }, operation.timeout);
          });
          
          // Race between operation and timeout
          const result = await Promise.race([
            operation.execute(),
            timeoutPromise
          ]);
          
          // Clear timeout and resolve
          if (operation.timeoutId) {
            clearTimeout(operation.timeoutId);
          }
          operation.resolve(result);
        } catch (error) {
          // Clear timeout and reject
          if (operation.timeoutId) {
            clearTimeout(operation.timeoutId);
          }
          operation.reject(error instanceof Error ? error : new Error(String(error)));
        }
        
        // Small delay between operations to avoid overwhelming mudslide
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } finally {
      // Always reset processing flag
      this.processingQueue = false;
      
      // Check if more operations were added while we were finishing
      if (this.operationQueue.length > 0) {
        // Recursively trigger processing for remaining operations
        this.processQueue();
      }
    }
  }
}

/**
 * WhatsApp Service (thin facade over session manager)
 */
class WhatsAppService {
  private manager: WhatsAppSessionManager;
  
  constructor() {
    this.manager = sessionManager;
  }
  
  /**
   * Check if WhatsApp is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    return this.manager.isAuthenticated();
  }
  
  /**
   * Get QR code for login
   */
  async getQRCode(): Promise<string> {
    return this.manager.getQRCode();
  }
  
  /**
   * Logout and clear credentials
   */
  async logout(): Promise<void> {
    return this.manager.logout();
  }
  
  /**
   * List all available chats
   */
  async listChats(query?: string): Promise<Array<{ id: string; name: string; type: string }>> {
    return this.manager.listChats(query);
  }
  
  /**
   * Send a WhatsApp message
   */
  async sendMessage(recipient: string, message: string): Promise<void> {
    return this.manager.sendMessage(recipient, message);
  }
  
  /**
   * Send event notification
   */
  async sendEventNotification(event: Event, recipient: string, prefix?: string): Promise<void> {
    const message = this.formatEventMessage(event, prefix);
    await this.sendMessage(recipient, message);
  }
  
  /**
   * Send event notification with stakeholder information
   */
  async sendEventNotificationWithStakeholders(
    event: Event,
    recipient: string,
    stakeholders: Array<{
      stakeholder: any;
      selectedRequirements: any[];
      customRequirements: string;
    }>,
    prefix?: string
  ): Promise<void> {
    const message = this.formatEventMessageWithStakeholders(event, stakeholders, prefix);
    await this.sendMessage(recipient, message);
  }
  
  /**
   * Format event into WhatsApp message
   */
  private formatEventMessage(event: Event, prefix?: string): string {
    const startDate = format(new Date(event.startDate), 'MMM dd, yyyy');
    const endDate = format(new Date(event.endDate), 'MMM dd, yyyy');
    
    let message = prefix ? `${prefix}\n\n` : '';
    message += `📅 *New Event Added*\n\n`;
    message += `*${event.name}*\n\n`;
    
    if (event.description) {
      message += `${event.description}\n\n`;
    }
    
    message += `📆 *Date:* ${startDate}`;
    if (startDate !== endDate) {
      message += ` - ${endDate}`;
    }
    message += `\n`;
    
    if (event.location) {
      message += `📍 *Location:* ${event.location}\n`;
    }
    
    if (event.organizers) {
      message += `👥 *Organizers:* ${event.organizers}\n`;
    }
    
    if (event.category) {
      message += `🏷️ *Category:* ${event.category}\n`;
    }
    
    message += `🌍 *Type:* ${event.eventType === 'international' ? 'International' : 'Local'}\n`;
    
    if (event.expectedAttendance) {
      message += `👥 *Expected Attendance:* ${event.expectedAttendance}\n`;
    }
    
    if (event.url) {
      message += `\n🔗 ${event.url}`;
    }
    
    return message;
  }
  
  /**
   * Format event with stakeholder information into WhatsApp message
   */
  private formatEventMessageWithStakeholders(
    event: Event,
    stakeholders: Array<{
      stakeholder: any;
      selectedRequirements: any[];
      customRequirements: string;
    }>,
    prefix?: string
  ): string {
    const startDate = format(new Date(event.startDate), 'MMM dd, yyyy');
    const endDate = format(new Date(event.endDate), 'MMM dd, yyyy');
    
    let message = prefix ? `${prefix}\n\n` : '';
    message += `📅 *New Event Added*\n\n`;
    message += `*${event.name}*\n\n`;
    
    if (event.description) {
      message += `${event.description}\n\n`;
    }
    
    message += `📆 *Date:* ${startDate}`;
    if (startDate !== endDate) {
      message += ` - ${endDate}`;
    }
    message += `\n`;
    
    if (event.location) {
      message += `📍 *Location:* ${event.location}\n`;
    }
    
    if (event.organizers) {
      message += `👥 *Organizers:* ${event.organizers}\n`;
    }
    
    if (event.category) {
      message += `🏷️ *Category:* ${event.category}\n`;
    }
    
    message += `🌍 *Type:* ${event.eventType === 'international' ? 'International' : 'Local'}\n`;
    
    if (event.expectedAttendance) {
      message += `👥 *Expected Attendance:* ${event.expectedAttendance}\n`;
    }
    
    if (event.url) {
      message += `🔗 *More Info:* ${event.url}\n`;
    }
    
    // Add stakeholder assignments
    if (stakeholders && stakeholders.length > 0) {
      message += `\n━━━━━━━━━━━━━━━━\n`;
      message += `*📋 Stakeholder Assignments*\n\n`;
      
      stakeholders.forEach((assignment, index) => {
        const { stakeholder, selectedRequirements, customRequirements } = assignment;
        
        message += `${index + 1}. *${stakeholder.name}*\n`;
        
        if (selectedRequirements && selectedRequirements.length > 0) {
          message += `   Requirements:\n`;
          selectedRequirements.forEach(req => {
            message += `   • ${req.title}\n`;
          });
        }
        
        if (customRequirements && customRequirements.trim()) {
          message += `   Custom: ${customRequirements}\n`;
        }
        
        message += `\n`;
      });
    }
    
    return message;
  }
}

// Export singleton instances
const sessionManager = new WhatsAppSessionManager();
export const whatsappService = new WhatsAppService();
export const whatsappManager = whatsappService; // Alias for consistency
