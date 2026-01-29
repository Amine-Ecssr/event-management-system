import { storage } from "./storage";
import { authService } from "./auth";
import { log } from "./vite";
import { startScraperScheduler } from "./scraperScheduler";

/**
 * Bootstrap the default admin user from environment variables.
 * This function ensures that there is always at least one superadmin user
 * who can log in to the system.
 * 
 * Environment Variables Required:
 * - ADMIN_USERNAME: The username for the default admin
 * - ADMIN_PASSWORD: The password for the default admin
 * 
 * This function will:
 * 1. Check if ADMIN_USERNAME and ADMIN_PASSWORD are set
 * 2. If not set, log a critical error and exit (fail fast)
 * 3. If set, check if a user with that username already exists
 * 4. If the user exists, UPDATE their password and role to superadmin (force overwrite)
 * 5. If the user doesn't exist, CREATE the superadmin user
 * 
 * This ensures the environment variables are always the source of truth
 * and prevents lockouts due to role changes.
 */
export async function bootstrapDefaultAdmin(): Promise<void> {
  const adminUsername = process.env.ADMIN_USERNAME;
  const adminPassword = process.env.ADMIN_PASSWORD;

  // Fail fast if credentials are not provided
  if (!adminUsername || !adminPassword) {
    console.error('CRITICAL ERROR: ADMIN_USERNAME and ADMIN_PASSWORD environment variables must be set');
    console.error('Cannot start application without default admin credentials');
    process.exit(1);
  }

  try {
    // Trim whitespace from password (in case env var has trailing newline/space)
    const trimmedPassword = adminPassword.trim();
    console.log(`[Bootstrap] Admin password length after trim: ${trimmedPassword.length} chars`);
    const hashedPassword = await authService.hashPassword(trimmedPassword);
    
    // Check if admin user already exists
    const existingUser = await storage.getUserByUsername(adminUsername);
    
    if (existingUser) {
      // User exists - force update password and role to ensure they're a superadmin
      await storage.updateUserPassword(existingUser.id, hashedPassword);
      
      // Also ensure role is superadmin (prevents lockouts)
      if (existingUser.role !== 'superadmin') {
        await storage.updateUserRole(existingUser.id, 'superadmin');
        log(`Updated user '${adminUsername}' role from '${existingUser.role}' to 'superadmin'`);
      }
      
      log(`Default superadmin user '${adminUsername}' credentials updated from environment variables`);
      return;
    }

    // User doesn't exist - create the default superadmin user
    await storage.createUser({
      username: adminUsername,
      password: hashedPassword,
      role: 'superadmin',
    });

    log(`Default superadmin user '${adminUsername}' created successfully`);
  } catch (error) {
    console.error('Failed to bootstrap default admin user:', error);
    process.exit(1);
  }
}

/**
 * Start automated background services
 */
export async function startBackgroundServices(): Promise<void> {
  log('Starting background services...');
  
  // Start weekly scraper for Abu Dhabi events
  //-- startScraperScheduler();
  
  // Warm up WhatsApp session if it exists
  await warmupWhatsAppSession();
  
  log('Background services started successfully');
}

/**
 * Warm up WhatsApp session on startup
 * Checks if session exists and is valid, logs status
 * This ensures existing sessions are ready to use immediately
 */
async function warmupWhatsAppSession(): Promise<void> {
  try {
    const { whatsappService } = await import('./whatsapp-client');
    
    log('[WhatsApp] Checking for existing session...');
    const isAuth = await whatsappService.isAuthenticated();
    
    if (isAuth) {
      log('[WhatsApp] ✓ Session found and validated - WhatsApp is ready');
    } else {
      log('[WhatsApp] No valid session found - authentication required');
    }
  } catch (error) {
    log('[WhatsApp] Session warmup check failed (non-critical):', (error as Error).message);
  }
}
