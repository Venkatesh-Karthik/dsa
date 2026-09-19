/**
 * Vite Dev & Preview Server Plugin for AI Teaching Backend
 *
 * Mounts the /api/ai/teach endpoint directly into the Vite development and preview servers,
 * providing zero-CORS, unified-origin API execution for the Excalidraw frontend.
 */

import {
  handleTeachingRequest,
  handleProviderInfoRequest,
  handleVoiceSynthesisRequest,
  handleVoiceHealthRequest,
  logStartupConfiguration,
} from "./server-handler";

import type { Plugin, Connect } from "vite";
import type { TeachingProvider } from "./teaching-provider";

export interface AITeachingPluginOptions {
  provider?: TeachingProvider;
}

export function aiTeachingBackendPlugin(
  options?: AITeachingPluginOptions,
): Plugin {
  if (typeof process !== "undefined") {
    process.on("unhandledRejection", (reason) => {
      // eslint-disable-next-line no-console
      console.error("[COGNORA][UNHANDLED_REJECTION]", reason);
    });
    process.on("uncaughtException", (err) => {
      // eslint-disable-next-line no-console
      console.error("[COGNORA][UNCAUGHT_EXCEPTION]", err);
    });
  }

  const middleware: Connect.NextHandleFunction = (req, res, next) => {
    const url = req.url ? req.url.split("?")[0] : "";
    if (url === "/api/ai/teach") {
      handleTeachingRequest(req, res, { provider: options?.provider }).catch(
        (err) => {
          // eslint-disable-next-line no-console
          console.error("[ai-teaching-backend] Unhandled error:", err);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Internal server error." }));
          }
        },
      );
      return;
    }

    if (url === "/api/ai/provider-info") {
      handleProviderInfoRequest(req, res, { provider: options?.provider });
      return;
    }

    if (url === "/api/voice/synthesize" || url === "/api/ai/voice/synthesize") {
      handleVoiceSynthesisRequest(req, res).catch((err) => {
        // eslint-disable-next-line no-console
        console.error("[ai-teaching-backend] Voice synthesis error:", err);
        if (!res.headersSent) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Internal server error." }));
        }
      });
      return;
    }

    if (url === "/api/voice/health" || url === "/api/ai/voice/health") {
      handleVoiceHealthRequest(req, res).catch((err) => {
        // eslint-disable-next-line no-console
        console.error("[ai-teaching-backend] Voice health error:", err);
        if (!res.headersSent) {
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ status: "unavailable", modelReady: false }));
        }
      });
      return;
    }

    next();
  };

  return {
    name: "ai-teaching-backend",
    configureServer(server) {
      logStartupConfiguration();
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      logStartupConfiguration();
      server.middlewares.use(middleware);
    },
  };
}
