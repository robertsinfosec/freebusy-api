import { describe, expect, it } from "vitest";
import { redactUrl, sanitizeLogMessage, readLimitedText } from "../src/logging";

const textResponse = (body: BodyInit, headers: Record<string, string> = {}) => new Response(body, { headers });

const streamResponse = (size: number) => {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(size).fill(97));
      controller.close();
    },
  });
  return new Response(stream);
};

describe("security helpers", () => {
  it("redacts URLs to origin only", () => {
    const input = "https://example.com/secret/path?token=supersecret#fragment";
    const redacted = redactUrl(input);
    expect(redacted).toBe("https://example.com");
  });

  it("sanitizes and truncates log messages", () => {
    const noisy = "line1\nline2\t" + "x".repeat(500);
    const cleaned = sanitizeLogMessage(noisy, 50);
    expect(cleaned).not.toMatch(/\n|\t|\r|\0/);
    expect(cleaned.length).toBeLessThanOrEqual(50);
  });

  it("rejects when declared content-length exceeds limit", async () => {
    const res = textResponse("ok", { "content-length": "2000" });
    await expect(readLimitedText(res, 1000)).rejects.toThrow("upstream_too_large");
  });

  it("rejects when streamed body exceeds limit without content-length", async () => {
    const res = streamResponse(1200);
    await expect(readLimitedText(res, 1000)).rejects.toThrow("upstream_too_large");
  });

  it("reads when body is within limit", async () => {
    const res = textResponse("hello", { "content-length": "5" });
    const text = await readLimitedText(res, 1000);
    expect(text).toBe("hello");
  });
});
