export function baseHeaders(): Headers {
  const headers = new Headers();
  headers.set("Cache-Control", "no-store");
  headers.set("X-Robots-Tag", "noindex");
  headers.set("Content-Security-Policy", "default-src 'none'");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Permissions-Policy", "geolocation=(),microphone=(),camera=()");
  headers.set("Vary", "Origin");
  return headers;
}

export function applyCors(headers: Headers, origin: string | null, allowedOrigins: Set<string>): boolean {
  if (!origin) return true;
  if (!allowedOrigins.has(origin)) return false;
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Methods", "GET,OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  headers.set("Access-Control-Max-Age", "600");
  return true;
}

export function jsonResponse(
  request: Request,
  body: unknown,
  status = 200,
  allowedOrigins?: Set<string>
): Response {
  const origin = request.headers.get("Origin");
  const headers = baseHeaders();
  headers.set("Content-Type", "application/json");

  if (allowedOrigins) {
    const allowed = applyCors(headers, origin, allowedOrigins);
    if (origin && !allowed) {
      return new Response(JSON.stringify({ error: "forbidden_origin" }), { status: 403, headers });
    }
  }

  return new Response(JSON.stringify(body), { status, headers });
}

export function optionsResponse(request: Request, allowedOrigins?: Set<string>): Response {
  const origin = request.headers.get("Origin");
  const headers = baseHeaders();

  if (allowedOrigins) {
    const allowed = applyCors(headers, origin, allowedOrigins);
    if (!allowed) {
      return new Response(null, { status: 403, headers });
    }
  }

  headers.set("Content-Length", "0");
  return new Response(null, { status: 204, headers });
}
