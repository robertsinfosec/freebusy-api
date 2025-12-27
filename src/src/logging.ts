export function redactUrl(secretUrl: string): string {
  try {
    const url = new URL(secretUrl);
    // Log origin only; drop path/query/fragment to avoid leaking secrets.
    return url.origin;
  } catch {
    return "<invalid-url>";
  }
}

export function sanitizeLogMessage(input: unknown, max = 200): string {
  if (typeof input !== "string") return "<non-string>";
  // Remove control chars and truncate to avoid leaking upstream content or secrets.
  const cleaned = input.replace(/[\r\n\t\0]/g, " ").slice(0, max);
  return cleaned;
}

export async function readLimitedText(res: Response, limit: number): Promise<string> {
  const lenHeader = res.headers.get("content-length");
  if (lenHeader) {
    const declared = Number(lenHeader);
    if (Number.isFinite(declared) && declared > limit) {
      throw new Error("upstream_too_large");
    }
  }

  if (!res.body) {
    return "";
  }

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      received += value.byteLength;
      if (received > limit) {
        reader.cancel("payload_too_large");
        throw new Error("upstream_too_large");
      }
      chunks.push(value);
    }
  }

  const decoder = new TextDecoder();
  return decoder.decode(concatChunks(chunks));
}

function concatChunks(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, c) => sum + c.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}
