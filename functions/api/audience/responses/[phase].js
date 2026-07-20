import { handleJson, methodNotAllowed, requestPayload, serviceFor } from "../../../../server/audience-pages.js";

export async function onRequest(context) {
  if (context.request.method !== "PUT") return methodNotAllowed(["PUT"]);
  return handleJson(context, async () => ({
    ok: true,
    ...await serviceFor(context).replacePhaseResponse(
      String(context.params.phase || ""),
      await requestPayload(context),
    ),
  }));
}
