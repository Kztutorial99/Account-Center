const { defineConfig } = require("vite");
const react = require("@vitejs/plugin-react");
const dataHandler = require("./api/data");
const loginHandler = require("./api/admin/login");
const usersHandler = require("./api/admin/users");

function jsonResponse(res) {
  return {
    status(code) {
      res.statusCode = code;
      return this;
    },
    setHeader(name, value) {
      res.setHeader(name, value);
    },
    json(payload) {
      if (!res.getHeader("Content-Type")) res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(payload));
    },
  };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function apiDevMiddleware() {
  return {
    name: "codexa-api-dev",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url || "/", "http://localhost");
        const handlers = {
          "/api/data": dataHandler,
          "/api/admin/login": loginHandler,
          "/api/admin/users": usersHandler,
        };
        const handler = handlers[url.pathname];
        if (!handler) return next();

        try {
          const body = ["GET", "HEAD"].includes(req.method) ? "" : await readBody(req);
          req.body = body;
          req.query = Object.fromEntries(url.searchParams.entries());
          await handler(req, jsonResponse(res));
        } catch (error) {
          console.error("Local API request failed", error);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Local API request failed" }));
          }
        }
      });
    },
  };
}

module.exports = defineConfig({
  plugins: [react(), apiDevMiddleware()],
  server: {
    host: "0.0.0.0",
    port: 5000,
    strictPort: true,
    allowedHosts: true,
  },
});