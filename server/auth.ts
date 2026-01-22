import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";
import { getAuthService } from "./auth-service";
import { 
  setupKeycloakAuth, 
  getUserFromKeycloakToken, 
  getKeycloakInstance,
  isAuthenticated as keycloakIsAuthenticated,
  isSuperAdmin as keycloakIsSuperAdmin,
  isAdminOrSuperAdmin as keycloakIsAdminOrSuperAdmin,
} from "./keycloak-auth";

declare global {
  namespace Express {
    interface User extends SelectUser {
      keycloakGroups?: string[];
      keycloakRoles?: string[];
    }
  }
}

export const authService = getAuthService();
let keycloakInstance: any = null;

/**
 * Authenticate user with Keycloak using Resource Owner Password Credentials flow
 * This allows the traditional username/password form to work with Keycloak
 */
async function authenticateWithKeycloak(username: string, password: string): Promise<SelectUser | null> {
  try {
    const baseUrl = process.env.KEYCLOAK_URL || 'http://localhost:8080';
    const realm = process.env.KEYCLOAK_REALM || 'ecssr-events';
    const clientId = process.env.KEYCLOAK_CLIENT_ID || 'ecssr-events-app';
    const clientSecret = process.env.KEYCLOAK_CLIENT_SECRET || '';

    // Request token from Keycloak using password grant
    const tokenUrl = `${baseUrl}/realms/${realm}/protocol/openid-connect/token`;
    
    const params = new URLSearchParams({
      grant_type: 'password',
      client_id: clientId,
      client_secret: clientSecret,
      username: username,
      password: password,
      scope: 'openid profile email',
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log('[Auth] Keycloak token request failed:', response.status, errorText);
      return null;
    }

    const tokenData = await response.json();
    
    // Decode the access token to get user info
    const tokenParts = tokenData.access_token.split('.');
    const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
    
    // Create a grant-like object for getUserFromKeycloakToken
    const grant = {
      access_token: {
        content: payload,
        token: tokenData.access_token,
      },
    };

    // Use existing Keycloak user extraction logic
    const user = await getUserFromKeycloakToken(grant);
    
    if (user) {
      console.log(`[Auth] Keycloak authentication successful for: ${username}`);
    }
    
    return user;
  } catch (error) {
    console.error('[Auth] Keycloak authentication error:', error);
    return null;
  }
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      httpOnly: true,
      // In Docker behind nginx proxy, we use HTTP internally but may have HTTPS externally
      // Only set secure to true if explicitly in production AND not in Docker
      secure: process.env.NODE_ENV === "production" && !process.env.DOCKER_CONTAINER,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      sameSite: "lax", // Allow cookies to be sent with top-level navigations
    },
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  
  // Initialize Keycloak if configured
  keycloakInstance = setupKeycloakAuth(app, storage.sessionStore);
  const keycloakEnabled = !!keycloakInstance;
  
  if (keycloakEnabled) {
    console.log('[Auth] Keycloak authentication enabled');
    
    // Add middleware to extract user from Keycloak token
    app.use(async (req: Request, res: Response, next: NextFunction) => {
      if ((req as any).kauth?.grant) {
        try {
          const user = await getUserFromKeycloakToken((req as any).kauth.grant);
          if (user) {
            req.user = user;
          }
        } catch (error) {
          console.error('[Auth] Error extracting user from Keycloak token:', error);
        }
      }
      next();
    });
  } else {
    console.log('[Auth] Keycloak not configured, using local authentication only');
  }
  
  // Initialize Passport for local authentication (backward compatibility)
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        // If Keycloak is enabled, try Keycloak authentication first
        if (keycloakEnabled) {
          try {
            const keycloakUser = await authenticateWithKeycloak(username, password);
            if (keycloakUser) {
              return done(null, keycloakUser);
            }
          } catch (keycloakError) {
            console.log('[Auth] Keycloak authentication failed, falling back to local:', keycloakError);
          }
        }
        
        // Fallback to local authentication
        const user = await authService.authenticate(username, password);
        if (!user) {
          return done(null, false, { message: "Invalid username or password" });
        }
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: any, done) => {
    try {
      // Convert session id to number (sessions serialize as strings)
      const numericId = typeof id === 'number' ? id : Number(id);
      if (!Number.isFinite(numericId)) {
        console.error('[Auth] Invalid session ID format:', id);
        return done(null, false);
      }
      
      const user = await storage.getUser(numericId);
      if (!user) {
        console.warn('[Auth] User not found for session ID:', numericId);
        return done(null, false);
      }
      done(null, user);
    } catch (error) {
      // Log unexpected errors for diagnosis
      console.error('[Auth] Error deserializing user:', error);
      // Bubble up genuine DB errors instead of masking as 401
      done(error);
    }
  });

  // Note: Public registration has been removed for security.
  // Only the default admin (from ADMIN_USERNAME/ADMIN_PASSWORD env vars) can log in.
  // Authenticated admins can create additional admin users via /api/admin/create-user

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", async (err: any, user: SelectUser | false, info: any) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).send(info?.message || "Invalid credentials");
      }
      
      req.login(user, async (err) => {
        if (err) return next(err);
        
        // Update lastLoginAt for department accounts (formerly stakeholder)
        if (user.role === 'department' || user.role === 'stakeholder' || user.role === 'department_admin') {
          try {
            await storage.updateDepartmentAccountLastLogin(user.id);
          } catch (error) {
            console.error('Failed to update department last login:', error);
          }
        }
        
        // Return user without password
        const { password, ...userWithoutPassword } = user;
        res.status(200).json(userWithoutPassword);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

    app.get("/api/user", async (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.sendStatus(401);
    }
    // Return user without password
    const { password, ...userWithoutPassword } = req.user;
    
    // Add departmentId if user has a department account (regardless of role)
    let departmentId: number | null = null;
    try {
      const account = await storage.getDepartmentAccountByUserId(req.user.id);
      if (account) {
        departmentId = account.departmentId;
      }
    } catch (error) {
      // User doesn't have a department account, that's ok
    }
    
    res.json({ ...userWithoutPassword, departmentId });
  });

  // Change current user's password
  app.post("/api/user/change-password", async (req, res, next) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.sendStatus(401);
    }

    try {
      const { currentPassword, newPassword } = req.body;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: "Current password and new password are required" });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ error: "New password must be at least 6 characters" });
      }

      // Verify current password by attempting authentication
      const user = await authService.authenticate(req.user.username, currentPassword);
      if (!user) {
        return res.status(401).json({ error: "Current password is incorrect" });
      }

      // Update password
      await authService.updateUserPassword(user.id, newPassword);

      res.json({ message: "Password changed successfully" });
    } catch (error) {
      next(error);
    }
  });

  // Create new admin user (requires superadmin role)
  app.post("/api/admin/create-user", async (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.sendStatus(401);
    }

    // Only superadmins can create users
    if (req.user?.role !== 'superadmin') {
      return res.status(403).json({ error: "Only superadmins can create users" });
    }

    try {
      const { username, password, role } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required" });
      }

      if (username.length < 3) {
        return res.status(400).json({ error: "Username must be at least 3 characters" });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
      }

      // Validate role if provided, default to 'admin'
      const userRole = role || 'admin';
      if (!['admin', 'superadmin', 'department_admin', 'department'].includes(userRole)) {
        return res.status(400).json({ error: "Role must be 'admin', 'superadmin', 'department_admin', or 'department'" });
      }

      const existingUser = await authService.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ error: "Username already exists" });
      }

      const user = await authService.createUser({
        username,
        password,
        role: userRole,
      });

      // Return user without password
      const { password: _, ...userWithoutPassword } = user;
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      next(error);
    }
  });
}

// Middleware to check if user is authenticated (Keycloak or local)
export function isAuthenticated(req: any, res: any, next: any) {
  // Check Keycloak authentication first
  if (keycloakInstance && req.kauth?.grant) {
    return next();
  }
  
  // Fallback to local Passport authentication
  if (!req.isAuthenticated()) {
    return res.sendStatus(401);
  }
  next();
}

// Middleware to check if user is a superadmin
export function isSuperAdmin(req: any, res: any, next: any) {
  // Check authentication first
  const isAuth = (keycloakInstance && req.kauth?.grant) || req.isAuthenticated();
  if (!isAuth) {
    return res.sendStatus(401);
  }
  
  if (req.user?.role !== 'superadmin') {
    return res.status(403).json({ error: "This action requires superadmin privileges" });
  }
  next();
}

// Middleware to check if user is admin or superadmin (blocks department users)
export function isAdminOrSuperAdmin(req: any, res: any, next: any) {
  // Check authentication first
  const isAuth = (keycloakInstance && req.kauth?.grant) || req.isAuthenticated();
  if (!isAuth) {
    return res.sendStatus(401);
  }
  
  if (req.user?.role !== 'admin' && req.user?.role !== 'superadmin') {
    return res.status(403).json({ error: "This action requires admin or superadmin privileges" });
  }
  next();
}
