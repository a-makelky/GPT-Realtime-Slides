import { handleJson, methodNotAllowed, requestPayload, serviceFor } from "../../../server/audience-pages.js";

export async function onRequest(context) {
  if (context.request.method !== "POST") return methodNotAllowed(["POST"]);
  return handleJson(context, async () => ({
    ok: true,
    ...await serviceFor(context).createSession(await requestPayload(context)),
  }));
}
