import { currentLanguage, onLanguageChange } from "./hub-i18n.js";
import { createRawRepository } from "./hub-raw-repository.js?v=2026091401";
import { globePoint, projectPoint, categoryColor, safeLink, zoomScale } from "./hub-raw-model.js?v=2026091401";

export function rawExplorerActive({ sectionActive, rawVisible, documentVisible, editorOpen }) {
  return sectionActive && rawVisible && documentVisible && !editorOpen;
}

/* Shell-owned companion to the unchanged owner module. Its original DOM and
 * write handlers stay intact in an explicitly labelled disclosure. No synthetic
 * clicks, private-state access or duplicated idea-writing implementation. */
export function attachRawExplorer(root, ctx) {
  const tab = root.querySelector("#ilab-tab-triggers");
  if (!tab) return { destroy() {} };
  const repo = createRawRepository(ctx);
  const host = document.createElement("section");
  host.className = "raw-explorer";
  host.innerHTML = `<form class="raw-toolbar" role="search">
    <label class="raw-search"><span data-copy="search"></span><input type="search" maxlength="160" name="query" autocomplete="off"></label>
    <label><span data-copy="category"></span><select name="category"></select></label>
    <label><span data-copy="source"></span><select name="source"></select></label>
    <button type="submit" data-copy="find"></button><button type="button" data-action="clear" data-copy="clear"></button>
  </form>
  <div class="raw-heading"><div><h3 data-copy="heading"></h3><p class="raw-scope" role="status"></p></div><button type="button" data-action="refresh"></button></div>
  <div class="raw-error" role="status" hidden></div>
  <div class="raw-view-controls"><button type="button" data-action="globe" data-copy="globe" aria-pressed="true"></button><button type="button" data-action="list" data-copy="list" aria-pressed="false"></button>
    <details class="raw-key"><summary data-copy="legend"></summary><p data-copy="depth"></p><ul></ul></details></div>
  <div class="raw-layout"><div class="raw-results"><div class="raw-map">
    <svg class="raw-field" tabindex="0" role="group"><g></g></svg>
    <div class="raw-controls"><button type="button" data-action="out">−</button><output>100%</output><button type="button" data-action="in">+</button><button type="button" data-action="fit" data-copy="fit"></button><button type="button" data-action="spin"></button></div>
    <p class="raw-help" data-copy="help"></p><div class="raw-hover" role="tooltip" hidden></div>
  </div><div class="raw-list" hidden></div><div class="raw-pages" hidden><button type="button" data-action="previous" data-copy="previous"></button><span></span><button type="button" data-action="next" data-copy="next"></button></div></div>
  <aside class="raw-preview" hidden><button type="button" data-action="close" data-copy="close"></button><p class="raw-preview-meta"></p><h4 tabindex="-1"></h4><p class="raw-preview-date"></p><a target="_blank" rel="noopener noreferrer" data-copy="open"></a><p data-copy="previewNote"></p></aside></div>
  <p class="raw-position" data-copy="position"></p>`;
  const tools = document.createElement("details"); tools.className = "raw-original-tools";
  const summary = document.createElement("summary"); tools.append(summary);
  for (const child of [...tab.childNodes]) tools.append(child);
  tab.append(host, tools);
  const $ = selector => host.querySelector(selector);
  const fields = { q: $("[name=query]"), category: $("[name=category]"), source: $("[name=source]") };
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let disposed = false, active = false, initialized = false, busy = false, sequence = 0;
  let rows = [], recent = [], total = 0, selected = null, focusId = null, facets = null;
  let searching = false, offset = 0, ceiling = null, mode = "globe", pending = 0, failed = false, facetFailed = false, listLimit = 60;
  let committedQuery = { q: "", category: "", source: "" };
  let newIds = new Set(), returnScroll = null;
  let camera = { yaw: .35, pitch: -.15, k: 1 }, recentCamera = null;
  let frame = null, lastFrame = 0, pollBusy = false, spin = !motion.matches, drag = null, moved = false;
  const pointers = new Map(); let pinch = 0;
  let nodes = [];
  const NS = "http://www.w3.org/2000/svg";
  const copy = (en, nl) => currentLanguage() === "nl" ? nl : en;
  const labels = {
    search: ["Search the whole archive", "Zoek in het hele archief"], category: ["Category", "Categorie"], source: ["Source", "Bron"], find: ["Search", "Zoeken"], clear: ["Clear", "Wissen"],
    heading: ["Explore raw material", "Grondstof verkennen"], globe: ["Globe", "Bol"], list: ["List", "Lijst"], legend: ["What do the colours mean?", "Wat betekenen de kleuren?"],
    depth: ["Colour shows category. Smaller dots are farther away, not less important.", "Kleur toont de categorie. Kleinere punten zijn verder weg, niet minder belangrijk."],
    fit: ["Whole globe", "Hele bol"], help: ["Drag to rotate · pinch or use + / − to zoom", "Sleep om te draaien · knijp of gebruik + / − om te zoomen"],
    previous: ["Previous", "Vorige"], next: ["Next", "Volgende"], close: ["Close preview", "Voorbeeld sluiten"], open: ["Open source ↗", "Open bron ↗"],
    previewNote: ["Browsing does not create an idea. The original list and idea-writing tools remain below.", "Rondkijken maakt geen idee aan. De oorspronkelijke lijst en schrijfgereedschappen staan hieronder."],
    position: ["Each dot is collected material. Its position does not claim a relationship to other stories. A ring marks a new arrival since your previous load.", "Elk punt is verzameld materiaal. De plek zegt niets over een verband met andere verhalen. Een ring markeert een nieuw materiaal sinds de vorige lading."]
  };
  const cat = value => ({music: copy("Music", "Muziek"), film: "Film", news: copy("News", "Nieuws"), art: copy("Art", "Kunst"), tech: copy("Technology", "Technologie"), icons: copy("Icons", "Iconen"), youth: copy("Youth culture", "Jongerencultuur"), social: "Social", tv: copy("Television", "Televisie")}[value] || value || copy("Uncategorised", "Zonder categorie"));
  function element(tag, text, className = "") { const e = document.createElement(tag); e.textContent = text; if (className) e.className = className; return e; }
  function svg(tag, attrs) { const e = document.createElementNS(NS, tag); for (const [k,v] of Object.entries(attrs)) e.setAttribute(k, v); return e; }
  function translate() {
    for (const e of host.querySelectorAll("[data-copy]")) e.textContent = copy(...labels[e.dataset.copy]);
    fields.q.placeholder = copy("Title, source or category", "Titel, bron of categorie");
    $(".raw-field").setAttribute("aria-label", copy("Material globe. Arrow keys rotate; plus and minus zoom. The list shows the same results.", "Materialenbol. Pijltjestoetsen draaien; plus en min zoomen. De lijst toont dezelfde resultaten."));
    $("[data-action=in]").setAttribute("aria-label", copy("Zoom in", "Inzoomen"));
    $("[data-action=out]").setAttribute("aria-label", copy("Zoom out", "Uitzoomen"));
    summary.textContent = copy("Original list & idea-writing tools (separate filters)", "Oorspronkelijke lijst & ideeën schrijven (eigen filters)");
    renderFilters(); render();
  }
  function renderFilters() {
    for (const [key, values] of [["category", facets?.categories || []], ["source", facets?.sources || []]]) {
      const select = fields[key], previous = select.value;
      select.replaceChildren(new Option(copy("All", "Alle"), ""), ...values.map(v => new Option(key === "category" ? cat(v) : v, v)));
      if (previous && !values.includes(previous)) select.add(new Option(previous, previous));
      select.value = previous;
    }
  }
  const queryValues = () => ({ q: fields.q.value.trim(), category: fields.category.value, source: fields.source.value });
  const queryChanged = () => Object.entries(queryValues()).some(([key, value]) => value !== committedQuery[key]);
  function status() {
    $(".raw-scope").textContent = busy ? copy("Checking material…", "Materialen controleren…") : failed ? copy("Could not refresh. Any shown material is the last loaded collection.", "Vernieuwen is niet gelukt. Getoonde materialen zijn de laatst geladen verzameling.") :
      searching ? `${total} ${copy("archive matches", "resultaten in het archief")} · ${rows.length ? offset + 1 : 0}–${offset + rows.length}` : `${rows.length} ${copy("newest materials · not the whole archive", "nieuwste materialen · niet het hele archief")}`;
    if (!busy && !failed && queryChanged()) $(".raw-scope").textContent += copy(" · Press Search to apply changes.", " · Druk op Zoeken om wijzigingen toe te passen.");
    host.setAttribute("aria-busy", String(busy));
    const error = $(".raw-error"); error.hidden = !facetFailed;
    error.textContent = copy("Archive filters could not load. Text search is available; Refresh retries the filters.", "Archieffilters konden niet laden. Vrij zoeken blijft beschikbaar; Vernieuwen probeert opnieuw.");
    $("[data-action=refresh]").textContent = pending ? `${pending} ${copy("new · load", "nieuw · laden")}` : copy("Refresh", "Vernieuwen");
    $("[data-action=refresh]").disabled = busy;
    $("[data-action=previous]").disabled = busy || queryChanged() || offset === 0;
    $("[data-action=next]").disabled = busy || queryChanged() || offset + rows.length >= total;
    $(".raw-pages").hidden = !searching;
    $(".raw-pages span").textContent = `${rows.length ? offset + 1 : 0}–${offset + rows.length} / ${total}`;
  }
  function render() {
    const world = $(".raw-field g"); world.replaceChildren(); nodes = [];
    for (const item of rows) {
      const point = globePoint(item);
      const g = svg("g", {role:"button", tabindex:"-1", "data-raw-id":item.id, "aria-label":`${item.title} · ${cat(item.category)}`});
      const dot = svg("circle", {fill:categoryColor(item.category), r:5, class:"raw-dot"});
      if (newIds.has(item.id)) g.append(svg("circle", {r:11, fill:"none", stroke:categoryColor(item.category), "stroke-width":2}));
      g.append(svg("circle", {r:12, fill:"transparent"}), dot);
      g.addEventListener("keydown", e => { if (["Enter", " "].includes(e.key)) { e.preventDefault(); e.stopPropagation(); open(item); } });
      g.addEventListener("focus", () => { focusId = item.id; spin = false; hover(item); draw(); syncMotion(); });
      g.addEventListener("blur", () => { focusId = null; $(".raw-hover").hidden = true; });
      g.addEventListener("pointerenter", e => { if (e.pointerType !== "touch" && !drag) { spin = false; hover(item); syncMotion(); } });
      g.addEventListener("pointerleave", () => { $(".raw-hover").hidden = true; });
      nodes.push({point,g,dot}); world.append(g);
    }
    const list = $(".raw-list"); list.replaceChildren();
    if (!rows.length) list.append(element("p", copy("No material found.", "Geen materiaal gevonden.")));
    for (const item of rows.slice(0, listLimit)) { const b = element("button", "", "raw-row"); b.type = "button"; b.dataset.rawId = item.id; b.append(element("strong", item.title), element("span", `${cat(item.category)} · ${item.source || copy("Unknown source", "Bron onbekend")}`)); b.onclick = () => open(item); list.append(b); }
    if (rows.length > listLimit) { const more = element("button", `${copy("Show more", "Toon meer")} (${rows.length-listLimit})`); more.type="button"; more.dataset.action="more"; list.append(more); }
    const counts = new Map(); for (const item of rows) counts.set(item.category || "", (counts.get(item.category || "") || 0) + 1);
    const legend = $(".raw-key ul"); legend.replaceChildren();
    for (const [category, count] of counts) { const li = element("li", ""); const icon = svg("svg", {viewBox:"0 0 16 16", "aria-hidden":"true"}); icon.append(svg("circle", {cx:8,cy:8,r:5,fill:categoryColor(category)})); li.append(icon, element("span", `${cat(category)} · ${count}`)); legend.append(li); }
    $(".raw-map").hidden = mode !== "globe"; list.hidden = mode !== "list";
    for (const v of ["globe","list"]) $(`[data-action=${v}]`).setAttribute("aria-pressed", String(v === mode));
    if (selected) preview(); status(); draw(); syncMotion();
  }
  function hover(item) { const box = $(".raw-hover"); box.textContent = `${cat(item.category)} · ${item.title}`; box.hidden = false; }
  function preview() {
    $(".raw-preview").hidden = !selected; if (!selected) return;
    $(".raw-preview h4").textContent = selected.title;
    $(".raw-preview-meta").textContent = `${cat(selected.category)} · ${selected.source || copy("Unknown source", "Bron onbekend")}`;
    $(".raw-preview-date").textContent = selected.found_at ? `${copy("Collected", "Verzameld")}: ${new Date(selected.found_at).toLocaleDateString(currentLanguage() === "nl" ? "nl-NL" : "en-GB")}` : copy("Collection date unknown", "Verzameldatum onbekend");
    const link = $(".raw-preview a"), url = safeLink(selected.url); link.hidden = !url; if (url) link.href = url; else link.removeAttribute("href");
  }
  function open(item) {
    if (!selected) returnScroll = {left:window.scrollX,top:window.scrollY};
    selected = item; spin = false; preview(); $(".raw-hover").hidden = true; syncMotion();
    $(".raw-preview h4").focus({preventScroll:true});
    if (window.matchMedia("(max-width: 900px)").matches) $(".raw-preview").scrollIntoView({block:"start",behavior:"instant"});
  }
  function close() {
    const id = selected?.id; selected = null; preview();
    let target = mode === "list" ? [...$(".raw-list").children].find(e=>e.dataset.rawId === String(id)) : nodes.find(n=>n.point.item.id===id)?.g;
    if (target?.getAttribute("aria-hidden") === "true") target = null;
    (target || $(mode === "list" ? "[data-action=list]" : ".raw-field")).focus({preventScroll:true});
    if (returnScroll) window.scrollTo({...returnScroll,behavior:"instant"}); returnScroll=null;
  }
  function draw() {
    if (disposed || !active || mode !== "globe") return;
    const r = $(".raw-field").getBoundingClientRect(); if (!r.width || !r.height) return;
    for (const {point,g,dot} of nodes) {
      const p = projectPoint(point,camera,r.width,r.height);
      g.setAttribute("transform", `translate(${p.x},${p.y})`); g.setAttribute("opacity",p.opacity);
      const available = p.depth >= 0 && p.x >= 12 && p.x <= r.width - 12 && p.y >= 12 && p.y <= r.height - 12;
      g.setAttribute("tabindex", available || focusId === point.item.id ? "0" : "-1");
      g.setAttribute("aria-hidden", String(!available && focusId !== point.item.id)); g.setAttribute("pointer-events", available ? "auto" : "none");
      dot.setAttribute("r", p.radius + (selected?.id === point.item.id ? 3 : 0));
    }
    $(".raw-controls output").textContent = `${Math.round(camera.k * 100)}%`;
  }
  function syncMotion() {
    const running = active && spin && !motion.matches && !selected && focusId === null && !busy && rows.length > 0 && mode === "globe";
    $("[data-action=spin]").textContent = running ? copy("Pause", "Pauzeer") : copy("Rotate", "Draaien");
    $("[data-action=spin]").setAttribute("aria-pressed", String(!!running));
    $("[data-action=spin]").disabled = motion.matches || !!selected;
    if (!running) { if (frame !== null) cancelAnimationFrame(frame); frame = null; lastFrame = 0; return; }
    if (frame === null) frame = requestAnimationFrame(animate);
  }
  function animate(time) { frame = null; if (!lastFrame || time - lastFrame >= 40) { camera.yaw += Math.min(60, lastFrame ? time-lastFrame : 0) * .00007; lastFrame = time; draw(); } syncMotion(); }
  function zoom(factor) { spin = false; camera.k = zoomScale(camera.k,factor); draw(); syncMotion(); }
  async function load(reset = true, requestedOffset = offset) {
    const mine = ++sequence; busy = true; failed = false; status(); syncMotion();
    const query = reset ? queryValues() : {...committedQuery};
    const search = !!(query.q || query.category || query.source);
    const nextOffset = reset ? 0 : requestedOffset;
    let nextCeiling = reset ? null : ceiling;
    try {
      if (search && nextCeiling === null) { const boundary = await repo.read({mode:"boundary"}); if (disposed || mine !== sequence) return; nextCeiling = boundary.rows[0]?.id || 0; }
      const result = await repo.read({mode: search ? "search":"recent",...query,offset:nextOffset,ceiling:search?nextCeiling:null});
      if (disposed || mine !== sequence) return;
      if (search && !searching) recentCamera = {...camera};
      if (!search) { const known = new Set(recent.map(r=>r.id)); newIds = new Set(recent.length ? result.rows.filter(r=>!known.has(r.id)).map(r=>r.id) : []); recent = result.rows; pending = 0; if (searching && recentCamera) camera = recentCamera; }
      else newIds = new Set();
      rows = result.rows; total = result.total; searching = search; offset = nextOffset; ceiling = nextCeiling; committedQuery = query; listLimit=60; selected = null; returnScroll=null; focusId = null; preview();
    } catch { if (!disposed && mine === sequence) failed = true; }
    finally { if (!disposed && mine === sequence) { busy = false; render(); } }
  }
  async function loadFacets() { try { const result = await repo.facets(); if (disposed) return; facets = result; facetFailed = false; renderFilters(); } catch { if (!disposed) facetFailed = true; } if (!disposed) status(); }
  async function poll() { if (!active || pollBusy || busy || disposed || searching) return; const mine = sequence; pollBusy = true; try { const result = await repo.read(); if (!disposed && active && !searching && mine === sequence) { const known = new Set(recent.map(r=>r.id)); pending = result.rows.filter(r=>!known.has(r.id)).length; status(); } } catch { /* Explicit refresh reports failures; a failed arrival probe does not replace data. */ } finally { pollBusy = false; } }
  function syncActive() {
    if (disposed) return;
    active = rawExplorerActive({sectionActive:root.classList.contains("is-active"),rawVisible:!tab.hidden,documentVisible:!document.hidden,editorOpen:!!root.querySelector("#ilab-detail.open")});
    if (active && !initialized) { initialized = true; void load(); void loadFacets(); }
    if (!active) { for (const id of pointers.keys()) if (field.hasPointerCapture(id)) field.releasePointerCapture(id); pointers.clear(); drag = null; $(".raw-hover").hidden = true; }
    draw(); syncMotion();
  }
  $("form").addEventListener("submit", e=>{e.preventDefault(); void load();});
  fields.q.addEventListener("input", status);
  for (const key of ["category","source"]) fields[key].addEventListener("change",()=>void load());
  host.addEventListener("click", e=>{
    const action = e.target.closest("[data-action]")?.dataset.action; if (!action) return;
    if (action === "clear") { Object.values(fields).forEach(f=>{f.value="";}); void load(); }
    else if (action === "refresh") { void load(); if (facetFailed) void loadFacets(); }
    else if (action === "more") { const firstNew=listLimit; listLimit+=60; render(); $(".raw-list").children[firstNew]?.focus({preventScroll:true}); }
    else if (["globe","list"].includes(action)) { mode=action; render(); }
    else if (action === "close") close();
    else if (action === "in" || action === "out") zoom(action === "in" ? 1.2 : 1/1.2);
    else if (action === "fit") { camera={...camera,k:1}; draw(); }
    else if (action === "spin") { spin=!spin; syncMotion(); }
    else if (!busy && !queryChanged() && (action === "previous" || action === "next")) { void load(false,Math.max(0,offset+(action === "next"?60:-60))); }
  });
  const field = $(".raw-field");
  field.addEventListener("keydown",e=>{if (!["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","+","-","="].includes(e.key)) return; e.preventDefault(); spin=false; if (["+","-","="].includes(e.key)) zoom(e.key==="-"?1/1.2:1.2); else { camera.yaw+=(e.key==="ArrowLeft"?-.14:e.key==="ArrowRight"?.14:0); camera.pitch=Math.max(-Math.PI/2,Math.min(Math.PI/2,camera.pitch+(e.key==="ArrowUp"?.14:e.key==="ArrowDown"?-.14:0))); draw(); syncMotion(); }});
  let pressedId = null, pressStart = null;
  field.addEventListener("pointerdown",e=>{spin=false; moved=false; pressedId=e.target.closest("[data-raw-id]")?.getAttribute("data-raw-id") || null; pressStart={x:e.clientX,y:e.clientY}; drag={...pressStart}; pointers.set(e.pointerId,{...pressStart}); if (pointers.size===2) { const [a,b]=[...pointers.values()]; pinch=Math.hypot(a.x-b.x,a.y-b.y); moved=true; pressedId=null; } field.setPointerCapture(e.pointerId); syncMotion();});
  field.addEventListener("pointermove",e=>{if (!pointers.has(e.pointerId)) return; pointers.set(e.pointerId,{x:e.clientX,y:e.clientY}); if (pointers.size===2) { const [a,b]=[...pointers.values()], d=Math.hypot(a.x-b.x,a.y-b.y); if (pinch>0) camera.k=zoomScale(camera.k,d/pinch); pinch=d; moved=true; } else if (drag) { const dx=e.clientX-drag.x,dy=e.clientY-drag.y; if (Math.hypot(e.clientX-pressStart.x,e.clientY-pressStart.y)>5) moved=true; camera.yaw+=dx*.006; camera.pitch=Math.max(-Math.PI/2,Math.min(Math.PI/2,camera.pitch-dy*.006)); } drag={x:e.clientX,y:e.clientY}; draw();});
  function release(e) { pointers.delete(e.pointerId); if (field.hasPointerCapture(e.pointerId)) field.releasePointerCapture(e.pointerId); if (!pointers.size) { drag=null; if (!moved && e.type === "pointerup") { const item=rows.find(r=>String(r.id)===pressedId); if(item)open(item); } pressedId=null; pressStart=null; } else { drag={...[...pointers.values()][0]}; } }
  field.addEventListener("pointerup",release); field.addEventListener("pointercancel",release);
  field.addEventListener("wheel",e=>{if(e.ctrlKey){e.preventDefault();zoom(Math.exp(-e.deltaY*.006));}},{passive:false});
  let observer = null, resize = null, timer = null, offLanguage = () => {};
  const lifecycle = {destroy(){disposed=true;sequence++;repo.destroy();clearInterval(timer);if(frame!==null)cancelAnimationFrame(frame);if(observer)observer.disconnect();if(resize)resize.disconnect();document.removeEventListener("visibilitychange",syncActive);motion.removeEventListener("change",syncMotion);offLanguage();for(const id of pointers.keys())if(field.hasPointerCapture(id))field.releasePointerCapture(id);host.remove();summary.remove();tools.replaceWith(...tools.childNodes);}};
  try {
    observer = new MutationObserver(syncActive); observer.observe(root,{attributes:true,attributeFilter:["class"]}); observer.observe(tab,{attributes:true,attributeFilter:["hidden"]});
    const editor=root.querySelector("#ilab-detail"); if(editor) observer.observe(editor,{attributes:true,attributeFilter:["class"]});
    resize = new ResizeObserver(()=>draw()); resize.observe(field);
    timer=setInterval(()=>void poll(),60000);
    document.addEventListener("visibilitychange",syncActive); motion.addEventListener("change",syncMotion);
    offLanguage=onLanguageChange(translate);
    translate(); syncActive();
  } catch (error) { lifecycle.destroy(); throw error; }
  return lifecycle;
}
