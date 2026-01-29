import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";
import { getAuthService } from "./auth-service";

declare global {
  namespace Express {
    interface User extends SelectUser {
      keycloakGroups?: string[];
      keycloakRoles?: string[];
    }
  }
}

export const authService = getAuthService();

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
  // Initialize Passport for local authentication (backward compatibility)
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
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

      // Validate role if provided, default to 'employee'
      const userRole = role || 'employee';
      const validRoles = ['superadmin', 'admin', 'department', 'department_admin', 'events_lead', 'division_head', 'employee', 'viewer'];
      if (!validRoles.includes(userRole)) {
        return res.status(400).json({ 
          error: `Role must be one of: ${validRoles.join(', ')}` 
        });
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
  // Fallback to local Passport authentication
  if (!req.isAuthenticated()) {
    return res.sendStatus(401);
  }
  next();
}

// Middleware to check if user is a superadmin
export function isSuperAdmin(req: any, res: any, next: any) {
  // Check authentication first
  const isAuth =  req.isAuthenticated();
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
  const isAuth = req.isAuthenticated();
  if (!isAuth) {
    return res.sendStatus(401);
  }
  
  if (req.user?.role !== 'admin' && req.user?.role !== 'superadmin') {
    return res.status(403).json({ error: "This action requires admin or superadmin privileges" });
  }
  next();
}

// Middleware to check if user is events_lead or higher
export function isEventsLeadOrHigher(req: any, res: any, next: any) {
  if (!req.isAuthenticated()) {
    return res.sendStatus(401);
  }
  
  const allowedRoles = ['superadmin', 'admin', 'division_head', 'events_lead'];
  if (!allowedRoles.includes(req.user?.role)) {
    return res.status(403).json({ 
      error: "This action requires events lead privileges or higher" 
    });
  }
  next();
}

// Middleware to check if user is division_head or higher
export function isDivisionHeadOrHigher(req: any, res: any, next: any) {
  if (!req.isAuthenticated()) {
    return res.sendStatus(401);
  }
  
  const allowedRoles = ['superadmin', 'admin', 'division_head'];
  if (!allowedRoles.includes(req.user?.role)) {
    return res.status(403).json({ 
      error: "This action requires division head privileges or higher" 
    });
  }
  next();
}

// Middleware to check if user is employee or higher (excludes viewer)
export function isEmployeeOrHigher(req: any, res: any, next: any) {
  if (!req.isAuthenticated()) {
    return res.sendStatus(401);
  }
  
  if (req.user?.role === 'viewer') {
    return res.status(403).json({ 
      error: "Viewers cannot perform this action" 
    });
  }
  next();
}

// Middleware to check if user is NOT a viewer (anyone except viewer can perform action)
export function isNotViewer(req: any, res: any, next: any) {
  if (!req.isAuthenticated()) {
    return res.sendStatus(401);
  }
  
  if (req.user?.role === 'viewer') {
    return res.status(403).json({ 
      error: "Viewers have read-only access" 
    });
  }
  next();
}
