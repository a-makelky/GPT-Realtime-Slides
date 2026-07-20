import { handleJson, methodNotAllowed, serviceFor } from "../../../server/audience-pages.js";

export async function onRequest(context) {
  if (context.request.method !== "GET") return methodNotAllowed(["GET"]);
  return handleJson(context, () => serviceFor(context).getAggregates(), { cacheable: true });
}
