import { createHash } from "node:crypto";
import { createServer } from "node:http";

const apiKey = process.env.OPENAI_API_KEY;
const port = Number(process.env.PORT || 8787);
const allowedOrigins = new Set(["http://127.0.0.1:4173", "http://localhost:4173"]);

if (!apiKey) {
  console.error("OPENAI_API_KEY is required in the server environment. It is never sent to the browser.");
  process.exit(1);
}

createServer(async (request, response) => {
  const origin = request.headers.origin || "";
  if (request.method !== "POST" || request.url !== "/api/realtime/client-secret") return send(response, 404, { error: "Not found" });
  if (!allowedOrigins.has(origin)) return send(response, 403, { error: "Origin not allowed" });

  const safetyId = createHash("sha256").update("gpt-realtime-slides-local-preview").digest("hex");
  try {
    const upstream = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "OpenAI-Safety-Identifier": safetyId,
      },
      body: JSON.stringify({ session: { type: "realtime", model: "gpt-realtime-2.1", output_modalities: ["text"] } }),
    });
    const payload = await upstream.text();
    response.writeHead(upstream.status, cors(origin, { "Content-Type": upstream.headers.get("content-type") || "application/json", "Cache-Control": "no-store" }));
    response.end(payload);
  } catch {
    send(response, 502, { error: "Could not create a Realtime client secret" }, origin);
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`Realtime token server listening on http://127.0.0.1:${port}`);
});

function send(response, status, payload, origin = "") {
  response.writeHead(status, cors(origin, { "Content-Type": "application/json", "Cache-Control": "no-store" }));
  response.end(JSON.stringify(payload));
}

function cors(origin, headers = {}) {
  return origin && allowedOrigins.has(origin) ? { ...headers, "Access-Control-Allow-Origin": origin, Vary: "Origin" } : headers;
}
