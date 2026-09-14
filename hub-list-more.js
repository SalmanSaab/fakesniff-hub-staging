/* Codex — presentation only: reveal the next original rows in normal flow.
 * Never fetch, clone, replace, reorder, scroll, or claim backend pagination.
 * Call render after the owner renders, and reset on identity/filter changes.
 */
export function createListMore({ list, button, rows = () => [...list.children],
  initial = 6, step = initial, limit = initial, enabled = () => true,
  keepVisible = () => false, label, status, countLabel, afterRender = () => {} }) {
  let budget = limit;
  let visible = 0;
  function render() {
    const items = rows();
    // A selected Lookbook card must not become "not shown" merely because a
    // presentation budget hid it. The module owns filter exclusion separately.
    const lastPinned = items.reduce((last, row, index) => keepVisible(row) ? index : last, -1);
    budget = Math.max(budget, lastPinned + 1);
    visible = enabled() ? Math.min(budget, items.length) : 0;
    items.forEach((row, index) => { row.hidden = index >= visible; });
    const next = Math.min(step, items.length - visible);
    button.hidden = !enabled() || next === 0;
    const copy = label(next);
    if (button.textContent !== copy) button.textContent = copy;
    button.setAttribute("aria-expanded", String(visible > initial));
    if (status) {
      status.hidden = items.length <= initial || !enabled();
      const count = countLabel(visible, items.length);
      if (status.textContent !== count) status.textContent = count;
    }
    afterRender(items);
    return { visible, total: items.length };
  }
  function showMore() {
    if (!enabled()) return;
    const next = rows().find(row => row.hidden);
    if (!next) return;
    budget = visible + step;
    render();
    // Native focus continuity without moving the reader's viewport. This also
    // works on the final batch, when the More button disappears.
    next.setAttribute("tabindex", "-1");
    next.focus({ preventScroll: true });
  }
  button.addEventListener("click", showMore);
  return Object.freeze({ render, showMore,
    reset() { budget = initial; render(); },
    getLimit: () => budget,
    destroy() {
      button.removeEventListener("click", showMore);
      rows().forEach(row => { row.hidden = false; });
    }
  });
}
