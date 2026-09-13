/* Codex — 13 Sep: the sticky header includes a wrapping staging warning.
 * Measure its real height so errors and focused content stay below it. No
 * workspace data, listeners on forms, or dependency on authentication. */
export function observeHubChrome(header, root, Observer = globalThis.ResizeObserver) {
  if (!header || !root || typeof Observer !== "function") return () => {};
  function measure() {
    const height = Math.ceil(header.getBoundingClientRect().height);
    if (Number.isFinite(height) && height > 0) {
      root.style.setProperty("--hub-chrome-height", `${height}px`);
    }
  }
  const observer = new Observer(measure);
  observer.observe(header);
  measure();
  return () => observer.disconnect();
}
