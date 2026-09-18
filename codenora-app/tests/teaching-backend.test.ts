import { EventEmitter } from "events";

import { describe, it, expect, vi } from "vitest";

import { MockTeachingProvider } from "../ai/backend/mock-provider";
import { handleTeachingRequest } from "../ai/backend/server-handler";

import type { IncomingMessage, ServerResponse } from "http";

function createMockReqRes(options: { method: string; body?: unknown }) {
  const req = new EventEmitter() as unknown as IncomingMessage & {
    method: string;
    destroy: () => void;
  };
  req.method = options.method;
  req.destroy = vi.fn();

  let responseBody = "";
  const headers: Record<string, string> = {};

  const res = {
    statusCode: 200,
    headersSent: false,
    setHeader: vi.fn((key: string, val: string) => {
      headers[key.toLowerCase()] = val;
    }),
    end: vi.fn((chunk?: string | Buffer) => {
      if (chunk) {
        responseBody += chunk.toString();
      }
      res.headersSent = true;
    }),
  } as unknown as ServerResponse & {
    statusCode: number;
    headersSent: boolean;
    getResponseBody: () => string;
    getResponseJson: () => Record<string, unknown>;
    headers: Record<string, string>;
  };

  res.getResponseBody = () => responseBody;
  res.getResponseJson = () => JSON.parse(responseBody);
  res.headers = headers;

  // Emit request data asynchronously to mimic stream
  setTimeout(() => {
    if (options.body !== undefined) {
      const payload =
        typeof options.body === "string"
          ? options.body
          : JSON.stringify(options.body);
      req.emit("data", Buffer.from(payload));
    }
    req.emit("end");
  }, 5);

  return { req, res };
}

describe("Teaching Backend Service", () => {
  describe("MockTeachingProvider", () => {
    const provider = new MockTeachingProvider({ simulateDelayMs: 0 });

    it("has provider metadata", () => {
      expect(provider.id).toBe("mock");
      expect(provider.name).toBe("Local Mock Provider");
      expect(provider.isConfigured()).toBe(true);
    });

    it("generates Binary Search explanation with visual actions", async () => {
      const res = await provider.generateTeachingResponse({
        prompt: "How does binary search work?",
      });
      expect(res.topic).toBe("Binary Search");
      expect(res.visual_actions.length).toBeGreaterThan(0);
      expect(res.message).toContain("Binary search finds");
    });

    it("generates Stack explanation with visual actions", async () => {
      const res = await provider.generateTeachingResponse({
        prompt: "Show me a stack",
      });
      expect(res.topic).toBe("Stack");
      expect(res.visual_actions.length).toBeGreaterThan(0);
      expect(res.message).toContain("LIFO");
    });

    it("generates generic concept explanation for unfamiliar prompts", async () => {
      const res = await provider.generateTeachingResponse({
        prompt: "unrelated topics",
      });
      expect(res.topic).toBe("unrelated topics");
      expect(res.visual_actions.length).toBeGreaterThan(0);
      expect(res.message).toContain("visual conceptual breakdown");
    });
  });

  describe("handleTeachingRequest", () => {
    const provider = new MockTeachingProvider({ simulateDelayMs: 0 });

    it("rejects non-POST methods with 405 Method Not Allowed", async () => {
      const { req, res } = createMockReqRes({ method: "GET" });
      await handleTeachingRequest(req, res, { provider });

      expect(res.statusCode).toBe(405);
      expect(res.headers.allow).toBe("POST");
      const body = res.getResponseJson();
      expect(body.error).toContain("Method Not Allowed");
    });

    it("rejects requests with malformed JSON body with 400 Bad Request", async () => {
      const { req, res } = createMockReqRes({
        method: "POST",
        body: "{ not valid json ...",
      });
      await handleTeachingRequest(req, res, { provider });

      expect(res.statusCode).toBe(400);
      const body = res.getResponseJson();
      expect(body.error).toContain("Malformed JSON");
    });

    it("rejects requests with empty prompt with 400 Bad Request", async () => {
      const { req, res } = createMockReqRes({
        method: "POST",
        body: { prompt: "" },
      });
      await handleTeachingRequest(req, res, { provider });

      expect(res.statusCode).toBe(400);
      const body = res.getResponseJson();
      expect(body.error).toContain("Invalid teaching request");
    });

    it("processes valid POST request and returns 200 with validated TeachingResponse", async () => {
      const { req, res } = createMockReqRes({
        method: "POST",
        body: { prompt: "Explain binary search" },
      });
      await handleTeachingRequest(req, res, { provider });

      expect(res.statusCode).toBe(200);
      expect(res.headers["content-type"]).toBe("application/json");

      const body = res.getResponseJson();
      expect(body.topic).toBe("Binary Search");
      expect(typeof body.message).toBe("string");
      expect(Array.isArray(body.visual_actions)).toBe(true);
      expect((body.visual_actions as unknown[]).length).toBeGreaterThan(0);
    });

    it("handles provider failure gracefully with 500 Internal Server Error", async () => {
      const failingProvider = {
        id: "failing",
        name: "Failing Provider",
        isConfigured: () => true,
        generateTeachingResponse: vi
          .fn()
          .mockRejectedValue(new Error("API rate limited")),
      };

      const { req, res } = createMockReqRes({
        method: "POST",
        body: { prompt: "Explain graphs" },
      });
      await handleTeachingRequest(req, res, { provider: failingProvider });

      expect(res.statusCode).toBe(500);
      const body = res.getResponseJson();
      expect(body.error).toBe("API rate limited");
    });

    it("returns 502 SCHEMA_ERROR on provider schema failure without silent fallback", async () => {
      const invalidSchemaProvider = {
        id: "nvidia",
        name: "NVIDIA Nemotron",
        isConfigured: () => true,
        generateTeachingResponse: vi.fn().mockResolvedValue({
          topic: "",
          message: "Invalid",
          visual_actions: "not-an-array",
        } as unknown as any),
      };

      const { req, res } = createMockReqRes({
        method: "POST",
        body: { prompt: "Explain TCP Three-Way Handshake" },
      });
      await handleTeachingRequest(req, res, {
        provider: invalidSchemaProvider as any,
      });

      expect(res.statusCode).toBe(502);
      const body = res.getResponseJson();
      expect(body.code).toBe("SCHEMA_ERROR");
      // MUST NOT have returned 200 (recovered)
      expect(res.statusCode).not.toBe(200);
    });

    it("returns 502 NVIDIA_EMPTY_COMPLETION when provider throws empty completion without silent fallback", async () => {
      const { NvidiaEmptyCompletionError } = await import(
        "../ai/backend/provider-errors"
      );
      const emptyProvider = {
        id: "nvidia",
        name: "NVIDIA Nemotron",
        isConfigured: () => true,
        generateTeachingResponse: vi
          .fn()
          .mockRejectedValue(
            new NvidiaEmptyCompletionError(
              "NVIDIA NIM returned empty completion content.",
            ),
          ),
      };

      const { req, res } = createMockReqRes({
        method: "POST",
        body: { prompt: "Explain TCP Three-Way Handshake" },
      });
      await handleTeachingRequest(req, res, {
        provider: emptyProvider as any,
      });

      expect(res.statusCode).toBe(502);
      const body = res.getResponseJson();
      expect(body.code).toBe("NVIDIA_EMPTY_COMPLETION");
      expect(body.error).toContain("empty completion content");
      // MUST NOT have synthesized a fallback or returned 200
      expect(res.statusCode).not.toBe(200);
    });
  });
});
