import express, { type Express } from "express";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { webDirectory } from "./paths";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.disable("x-powered-by");
// Same-origin browser client; no public mutation or collector-trigger endpoint.
app.use("/api", router);
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Unknown API route" });
});

// Production serves UI + API from one origin. Vite proxies /api in development.
if (process.env.NODE_ENV === "production" && existsSync(webDirectory)) {
  app.use(express.static(fileURLToPath(webDirectory), { index: false }));
  app.get(["/", "/directory", "/analysis", "/sources"], (_req, res) => {
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(fileURLToPath(new URL("index.html", webDirectory)));
  });
}

export default app;
