/* Codex — shared, deterministic globe geometry from the reviewed private
 * prototype. Position is navigation, never similarity or provenance. */
export function hash(value) {
  let n = 2166136261;
  for (const c of String(value)) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
  return n >>> 0;
}
function unit(id, salt) {
  let n = hash(`${salt}:${id}`);
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
  n = Math.imul(n ^ (n >>> 15), 0x846ca68b);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
export function globePoint(item) {
  const y = unit(item.id, "height") * 2 - 1;
  const angle = unit(item.id, "longitude") * Math.PI * 2;
  const ring = Math.sqrt(1 - y * y);
  return { item, x: ring * Math.cos(angle), y, z: ring * Math.sin(angle) };
}
export function projectPoint(node, camera, width, height) {
  const x = node.x * Math.cos(camera.yaw) + node.z * Math.sin(camera.yaw);
  const z = -node.x * Math.sin(camera.yaw) + node.z * Math.cos(camera.yaw);
  const p = { x, y: node.y * Math.cos(camera.pitch) - z * Math.sin(camera.pitch), z: node.y * Math.sin(camera.pitch) + z * Math.cos(camera.pitch) };
  const radius = Math.max(1, Math.min(width, height) * .38) * camera.k;
  const perspective = 3.2 / (3.2 - p.z * .6);
  const depth = Math.max(0, Math.min(1, (p.z + 1) / 2));
  return { x: width / 2 + p.x * radius * perspective, y: height / 2 + p.y * radius * perspective,
    depth: p.z, radius: (2.5 + (p.z + 1) * 1.9) * Math.min(1.65, Math.sqrt(camera.k)), opacity: .7 + .3 * depth };
}
export const zoomScale = (k, factor) => Math.max(.55, Math.min(3.8, k * factor));
const palette = Object.freeze({ music: "#547241", film: "#7b3f35", news: "#9b6c21", art: "#456d83", tech: "#374b56", icons: "#9181aa", youth: "#b89566", social: "#a85469", tv: "#347c6b" });
export const categoryColor = category => palette[category] || Object.values(palette)[hash(category) % 9];
export function safeLink(value) {
  try { const u = new URL(value); return ["https:", "http:"].includes(u.protocol) ? u.href : ""; } catch { return ""; }
}
export const RAW_FIELDS = "id,title,url,source,category,found_at";
const quoted = value => '"' + value.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
export function rawQuery(ctx, { mode = "recent", q = "", category = "", source = "", offset = 0, ceiling = null } = {}) {
  if (!["recent", "search", "facets", "boundary"].includes(mode)) throw new Error("Invalid read");
  if (![q, category, source].every(v => typeof v === "string" && v.length <= 160 && !v.includes("\0"))) throw new Error("Invalid filter");
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 1000000) throw new Error("Invalid page");
  if (!/^[a-f0-9-]{36}$/i.test(ctx.workspaceId || "")) throw new Error("Workspace required");
  const url = new URL(ctx.restUrl.replace(/\/$/, "") + "/triggers");
  if (url.protocol !== "https:") throw new Error("Secure Hub transport required");
  url.searchParams.set("workspace_id", `eq.${ctx.workspaceId}`);
  url.searchParams.set("select", mode === "boundary" ? "id" : mode === "facets" ? "id,category,source" : RAW_FIELDS);
  url.searchParams.set("order", mode === "boundary" ? "id.desc" : mode === "facets" ? "id.asc" : "found_at.desc.nullslast,id.desc");
  url.searchParams.set("limit", mode === "boundary" ? "1" : mode === "recent" ? "500" : mode === "facets" ? "1000" : "60");
  url.searchParams.set("offset", String(offset));
  if (ceiling !== null) {
    if (!Number.isSafeInteger(ceiling) || ceiling < 0) throw new Error("Invalid boundary");
    url.searchParams.set("id", `lte.${ceiling}`);
  }
  if (mode === "search") {
    if (q.trim()) url.searchParams.set("or", "(" + ["title", "source", "category"].map(f => `${f}.imatch.${quoted("***=" + q.trim())}`).join(",") + ")");
    const filters = [];
    if (category) filters.push(`category.eq.${quoted(category)}`);
    if (source) filters.push(`source.eq.${quoted(source)}`);
    if (filters.length) url.searchParams.set("and", "(" + filters.join(",") + ")");
  }
  return url;
}
