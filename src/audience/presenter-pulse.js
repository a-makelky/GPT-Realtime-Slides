import { audienceConfig } from "../../shared/audience-config.js";

export class AudienceAggregatePoller {
  constructor({ endpoint = audienceConfig.aggregatePath, intervalMs = audienceConfig.pollIntervalMs, fetchImpl = globalThis.fetch, onUpdate = () => {} } = {}) {
    this.endpoint = endpoint;
    this.intervalMs = intervalMs;
    this.fetchImpl = fetchImpl;
    this.onUpdate = onUpdate;
    this.etag = "";
    this.timer = null;
    this.active = false;
  }

  start() {
    if (this.active) return;
    this.active = true;
    this.onUpdate({ status: "loading", data: null });
    void this.#poll();
  }

  stop() {
    this.active = false;
    clearTimeout(this.timer);
    this.timer = null;
  }

  async #poll() {
    if (!this.active) return;
    try {
      const headers = { Accept: "application/json" };
      if (this.etag) headers["If-None-Match"] = this.etag;
      const response = await this.fetchImpl(this.endpoint, { headers, credentials: "omit", cache: "no-store" });
      if (response.status !== 304) {
        if (!response.ok) throw new Error(`Audience endpoint returned ${response.status}.`);
        this.etag = response.headers.get("etag") || "";
        this.onUpdate({ status: "ready", data: await response.json() });
      }
    } catch {
      this.onUpdate({ status: "error", data: null });
    } finally {
      if (this.active) this.timer = setTimeout(() => void this.#poll(), this.intervalMs);
    }
  }
}
