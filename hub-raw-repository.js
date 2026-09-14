import { rawQuery } from "./hub-raw-model.js?v=2026091401";

/* Authenticated, GET-only, workspace-scoped transport. No standalone fallback,
 * audit blobs, arbitrary URLs or write capability. A disposed mount is final. */
export function createRawRepository(ctx, fetcher = fetch) {
  if (typeof ctx.getAccessToken !== "function") throw new Error("Sign-in required");
  let disposed = false;
  const controllers = new Set();
  function current() { if (disposed) throw new DOMException("Closed", "AbortError"); }
  async function read(options = {}) {
    current();
    const controller = new AbortController();
    controllers.add(controller);
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const token = await ctx.getAccessToken();
      current(); controller.signal.throwIfAborted();
      if (!token) throw new Error("Sign-in required");
      const response = await fetcher(rawQuery(ctx, options), {
        method: "GET", redirect: "error", signal: controller.signal,
        headers: { apikey: ctx.anonKey, Authorization: `Bearer ${token}`, Prefer: "count=exact" }
      });
      current(); controller.signal.throwIfAborted();
      if (!response.ok) { const error = new Error("Read failed"); error.status = response.status; throw error; }
      const body = await response.text();
      current(); controller.signal.throwIfAborted();
      if (body.length > 4000000) throw new Error("Unexpected response");
      const rows = JSON.parse(body);
      const count = response.headers.get("content-range")?.match(/\/(\d+)$/);
      if (!count || !Array.isArray(rows) || rows.length > 1000 || rows.some(r => !r || !Number.isSafeInteger(r.id))) throw new Error("Unexpected response");
      if (options.mode !== "boundary" && rows.some(r => ![r.category, r.source].every(v => v == null || typeof v === "string") ||
        (options.mode !== "facets" && (typeof r.title !== "string" || (r.url != null && typeof r.url !== "string") || (r.found_at != null && !Number.isFinite(Date.parse(r.found_at))))))) throw new Error("Unexpected fields");
      // Re-check the shell's bound identity after all asynchronous work.
      await ctx.getAccessToken(); current(); controller.signal.throwIfAborted();
      return { rows, total: Number(count[1]), checkedAt: new Date().toISOString() };
    } finally { clearTimeout(timeout); controllers.delete(controller); }
  }
  async function facets() {
    const boundary = await read({ mode: "boundary" });
    const ceiling = boundary.rows[0]?.id || 0;
    const categories = new Set(), sources = new Set();
    let offset = 0, total = Infinity;
    while (offset < total) {
      if (offset >= 50000) throw new Error("Too many filters");
      const result = await read({ mode: "facets", ceiling, offset });
      total = result.total;
      if (!result.rows.length && offset < total) throw new Error("Incomplete filters");
      for (const row of result.rows) { if (row.category) categories.add(row.category); if (row.source) sources.add(row.source); }
      offset += result.rows.length;
    }
    return { categories: [...categories].sort(), sources: [...sources].sort() };
  }
  return { read, facets, destroy() { disposed = true; for (const c of controllers) c.abort(); controllers.clear(); } };
}
