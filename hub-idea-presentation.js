/* Codex — presentation bridge for Claude's unchanged Idea Lab renderer.
 * renderIdeas currently prints its safeEnum canonical status in .status.
 * Do not guess from idea text, category, translated labels or arbitrary values.
 * An unknown label stays neutral. No model access, network or write handling.
 * Replace this narrow DOM contract with owner-emitted data-status when available.
 */
export function ideaPresentationStatus(label) {
  const codes = {
    new: "new", interesting: "interesting", "needs work": "needs_work",
    develop: "develop", rejected: "rejected", "in production": "in_production"
  };
  return Object.hasOwn(codes, label) ? codes[label] : "unknown";
}

export function observeIdeaPresentation(root, Observer = globalThis.MutationObserver) {
  function reconcile() {
    for (const card of root.querySelectorAll(".ilab-card")) {
      const label = card.querySelector(".ilab-tag.status")?.textContent.trim();
      card.dataset.uiIdeaStatus = ideaPresentationStatus(label);
      // The existing module attaches click handlers to div cards. Give the same
      // detail action keyboard access; don't add a second click/save handler.
      card.setAttribute("role", "button");
      card.tabIndex = 0;
    }
  }
  function onKey(event) {
    const card = event.target;
    if (card.matches?.(".ilab-card") && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      if (!event.repeat) card.click();
    }
  }
  const observer = new Observer(reconcile);
  observer.observe(root, { childList: true, subtree: true, characterData: true });
  root.addEventListener("keydown", onKey);
  reconcile();
  return { reconcile, destroy() { observer.disconnect(); root.removeEventListener("keydown", onKey); } };
}
