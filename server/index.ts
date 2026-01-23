import "./config/loadEnv";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { startReminderScheduler } from "./reminderScheduler";
import { bootstrapDefaultAdmin } from "./bootstrap";
import { initializeElasticsearch } from "./elasticsearch";
import { cronService } from "./services/cron.service";

const app = express();

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Bootstrap default admin before setting up routes
  await bootstrapDefaultAdmin();
  
  // Initialize Elasticsearch connection (if enabled)
  await initializeElasticsearch();
  
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else if (!process.env.DOCKER_CONTAINER) {
    // Only serve static files if not in a Docker container
    // In microservices architecture, the client container serves the frontend
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5050 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5050', 10);
  server.listen(port, "0.0.0.0", () => {
    log(`Server is running on port ::: ${port} ::::`);
  });

  // Start the reminder scheduler
  startReminderScheduler();
  
  // Start Keycloak sync scheduler (if configured)
  const { startKeycloakSyncScheduler } = await import("./keycloakSyncScheduler");
  startKeycloakSyncScheduler();
  
  // Start partnership inactivity scheduler
  const { startPartnershipInactivityScheduler } = await import("./partnershipInactivityScheduler");
  startPartnershipInactivityScheduler();
  
  // Start background services (scraper scheduler, etc.)
  const { startBackgroundServices } = await import("./bootstrap");
  startBackgroundServices();
  
  // Initialize Elasticsearch cron jobs (sync, optimization, cleanup)
  cronService.initialize();
  
  // Graceful shutdown handler
  const shutdown = () => {
    log('Shutting down gracefully...');
    cronService.stop();
    server.close(() => {
      log('Server closed');
      process.exit(0);
    });
  };
  
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
})();
