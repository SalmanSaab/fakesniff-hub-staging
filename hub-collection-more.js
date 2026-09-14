/* Codex — shell-owned presentation adapter. Module owners retain all data,
 * filtering, selection, timers and editing. Footers are outside their lists.
 * Observe original child output, not our hidden attributes. Decisions replaces
 * its whole root on language changes; rediscover it and retain the budget.
 */
import { createListMore } from "./hub-list-more.js";
import { t, onLanguageChange } from "./hub-i18n.js";

export const COLLECTIONS = Object.freeze([
  { id: "home-week-list", row: ".home-work-item", size: 5 },
  { id: "home-attention-list", row: ".home-work-item", size: 5 },
  { id: "ilab-ideas", row: ".ilab-card", size: 6, filters: "#ilab-filters .on", attr: ["data-s", "data-r"] },
  // Only the module's rendered window: it currently drops matches beyond 150
  // of 400 fetched. This adapter cannot recover them or call it the archive.
  { id: "ilab-triggers", row: ".ilab-trig", size: 10, filters: "#ilab-tfilters .on", attr: ["data-t"], search: "#ilab-tsearch", note: "common.raw_window" },
  { id: "ilab-activity", row: ".ilab-act", size: 10 },
  { id: "lb-grid", row: ".lb-cardwrap", size: 6, filters: "#lb-filters .on", attr: ["data-c"], search: "#lb-search", selected: ".lb-select:checked" },
  { id: "dc-list", row: ".dc-card", size: 6, filters: "#dc-filters .on", attr: ["data-topic"], search: "#dc-search" }
]);

export function observeCollectionMore(root, Observer = globalThis.MutationObserver) {
  const entries = new Map();
  function reconcile() {
    for (const spec of COLLECTIONS) {
      const list = root.querySelector(`#${spec.id}`);
      let entry = entries.get(spec.id);
      if (!list) {
        if (entry) { entry.more.destroy(); entry.footer.remove(); entries.delete(spec.id); }
        continue;
      }
      const key = JSON.stringify([
        spec.filters ? [...root.querySelectorAll(spec.filters)].map(el => spec.attr.map(attr => el.getAttribute(attr))) : [],
        spec.search ? root.querySelector(spec.search)?.value.trim().toLowerCase() : ""
      ]);
      if (entry?.list !== list) {
        // Only language changes replace this module root in-place. Its search
        // input currently resets even though its private query does not; don't
        // let that pre-existing UI mismatch collapse the already-open list.
        // Identity teardown resets budgets separately before clearing roots.
        const limit = entry ? entry.more.getLimit() : spec.size;
        if (entry) { entry.more.destroy(); entry.footer.remove(); }
        const footer = root.ownerDocument.createElement("div");
        footer.className = "collection-more";
        const status = root.ownerDocument.createElement("span");
        status.className = "collection-more-count";
        const note = root.ownerDocument.createElement("small");
        note.className = "collection-more-note";
        note.hidden = !spec.note;
        const button = root.ownerDocument.createElement("button");
        button.className = "secondary-button";
        button.type = "button";
        button.setAttribute("aria-controls", spec.id);
        footer.append(status, button, note);
        list.after(footer);
        const more = createListMore({ list, button, status, initial: spec.size, limit,
          rows: () => [...list.children].filter(row => row.matches(spec.row)),
          keepVisible: row => Boolean(spec.selected && row.querySelector(spec.selected)),
          label: n => t("common.show_more", { n }),
          countLabel: (n, total) => t("common.loaded_shown", { n, total })
        });
        entry = { list, more, footer, note, key };
        entries.set(spec.id, entry);
      }
      if (entry.key !== key) { entry.key = key; entry.more.reset(); }
      if (spec.note && entry.note.textContent !== t(spec.note)) entry.note.textContent = t(spec.note);
      entry.more.render();
    }
  }
  const observer = new Observer(records => {
    if (records.some(record => !record.target.closest?.(".collection-more"))) reconcile();
  });
  observer.observe(root, { childList: true, subtree: true, characterData: true });
  const stopLanguage = onLanguageChange(reconcile);
  reconcile();
  return Object.freeze({ reconcile,
    reset() { for (const entry of entries.values()) entry.more.reset(); },
    destroy() {
      observer.disconnect(); stopLanguage();
      for (const entry of entries.values()) { entry.more.destroy(); entry.footer.remove(); }
      entries.clear();
    }
  });
}
