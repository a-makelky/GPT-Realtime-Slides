const JSON_HEADERS = Object.freeze({ Accept: "application/json", "Content-Type": "application/json" });

export class AudienceApiClient {
  constructor({ basePath = "/api/audience", fetchImpl = globalThis.fetch } = {}) {
    this.basePath = basePath.replace(/\/$/u, "");
    this.fetchImpl = fetchImpl;
  }

  createSession() {
    return this.#request("/session", { method: "POST", body: {} });
  }

  recoverSession(recoveryCode) {
    return this.#request("/recover", { method: "POST", body: { recoveryCode } });
  }

  submitPhase({ phase, attendeeId, answers }) {
    if (!/^(entrance|exit)$/u.test(phase)) throw new Error("Unsupported audience phase.");
    return this.#request(`/responses/${phase}`, { method: "PUT", body: { attendeeId, answers } });
  }

  async #request(route, { method, body }) {
    let response;
    try {
      response = await this.fetchImpl(`${this.basePath}${route}`, {
        method,
        headers: JSON_HEADERS,
        body: JSON.stringify(body),
        credentials: "omit",
      });
    } catch {
      throw new Error("Audience input is unavailable right now. The presentation still works normally.");
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error?.message || payload.error || "Audience input could not be saved.");
    return payload;
  }
}
