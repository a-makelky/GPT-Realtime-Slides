import { audienceConfig } from "../shared/audience-config.js";
import {
  AudienceError,
  createAudienceService,
  readJsonBody,
} from "./audience-core.js";

export function serviceFor(context) {
  if (!context.env?.DB) throw new AudienceError(503, "database_unavailable", "Audience input is unavailable.");
  return createAudienceService({
    db: context.env.DB,
    eventId: context.env.EVENT_ID || audienceConfig.deckId,
    privacyThreshold: audienceConfig.privacyThreshold,
  });
}

export async function handleJson(context, operation, { cacheable = false } = {}) {
  const requestId = crypto.randomUUID();
  try {
    const payload = await operation();
    const body = JSON.stringify(payload);
    const headers = responseHeaders(requestId, cacheable);
    if (cacheable && payload.version) {
      const etag = `"${payload.version}"`;
      headers.set("ETag", etag);
      if (context.request.headers.get("if-none-match") === etag) {
        return new Response(null, { status: 304, headers });
      }
    }
    return new Response(body, { status: 200, headers });
  } catch (error) {
    const known = error instanceof AudienceError;
    const status = known ? error.status : 500;
    const code = known ? error.code : "internal_error";
    const message = known ? error.message : "The audience service could not complete the request.";
    return new Response(JSON.stringify({ ok: false, error: { code, message }, requestId }), {
      status,
      headers: responseHeaders(requestId, false),
    });
  }
}

export async function requestPayload(context) {
  assertSameOrigin(context.request);
  return readJsonBody(context.request);
}

export function methodNotAllowed(allowed) {
  return new Response(JSON.stringify({
    ok: false,
    error: { code: "method_not_allowed", message: `Use ${allowed.join(" or ")} for this endpoint.` },
  }), {
    status: 405,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      Allow: allowed.join(", "),
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function assertSameOrigin(request) {
  const requestOrigin = new URL(request.url).origin;
  const origin = request.headers.get("origin");
  if (!origin || origin !== requestOrigin) {
    throw new AudienceError(403, "origin_not_allowed", "An exact same-origin request is required.");
  }
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") {
    throw new AudienceError(403, "origin_not_allowed", "An exact same-origin request is required.");
  }
}

function responseHeaders(requestId, cacheable) {
  return new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": cacheable ? "public, max-age=0, must-revalidate" : "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Request-Id": requestId,
  });
}
