import express, { type Request, Response, NextFunction } from "express";
import path from "path";
import { fileURLToPath } from 'url';
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ✅ Serve files from client/public
console.log("Setting up static middleware...");
app.use(express.static(path.join(__dirname, "..", "client", "public")));
console.log("Static middleware setup complete");


// ✅ Log the static path
console.log("Static path:", path.join(__dirname, "..", "client", "public"));


(async () => {
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
  } else {
    serveStatic(app);
  }

  // Use PORT environment variable (Azure provides this) or fallback to 5000
  const port = process.env.PORT || 5000;
  const host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1';
  
  console.log('[DEBUG] Server startup configuration:', {
    port: port,
    host: host,
    NODE_ENV: process.env.NODE_ENV,
    PORT_ENV: process.env.PORT
  });
  
  server.listen(Number(port), host, () => {
    log(`Serving on http://${host}:${port}`);
    console.log('[DEBUG] Server successfully started and listening');
  });
  
  // Add error handling for the server
  server.on('error', (error) => {
    console.error('[ERROR] Server error:', error);
  });
  
})();
