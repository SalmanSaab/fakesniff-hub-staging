/* Codex — Home presentation only. Claude's module owns the original feed,
 * requests, drafts and corrections. Show more reveals those SAME report nodes
 * below the first two; no copied previews, second reader or close control.
 * MutationObserver follows refresh/correction/language output, not attributes
 * changed here. Navigation never folds a list someone has already expanded.
 */
import { t } from "./hub-i18n.js";

export function createCompactHomeUpdates({ feed, readButton, composer, writeButton, fallbackButton, Observer = globalThis.MutationObserver }) {
  let enabled = false;
  let canPost = false;
  let expanded = false;

  function render() {
    const rows = [...feed.querySelectorAll(".hu-item")];
    let count = 0;
    let day = null;
    for (const child of feed.children) {
      if (child.classList.contains("hu-day")) {
        day = child;
        day.hidden = true;
      }
      if (!child.classList.contains("hu-item")) continue;
      child.hidden = !enabled || (!expanded && count >= 2);
      count += 1;
      if (!child.hidden && day) day.hidden = false;
    }
    const remaining = Math.max(0, rows.length - 2);
    readButton.hidden = !enabled || expanded || !remaining;
    readButton.textContent = t("home.show_more_updates", { n: remaining });
    readButton.setAttribute("aria-expanded", String(expanded));
    writeButton.setAttribute("aria-expanded", String(!composer.hidden));
  }

  function showMore() {
    if (!enabled) return;
    const next = [...feed.querySelectorAll(".hu-item")].find(row => row.hidden);
    expanded = true;
    // Transfer focus before removing the button. No scrollIntoView: the first
    // two reports stay exactly where the person was reading them.
    if (next) {
      next.hidden = false;
      next.setAttribute("tabindex", "-1");
      next.focus({ preventScroll: true });
    }
    render();
  }

  function openReader() {
    if (!enabled) return;
    // The viewer shortcut navigates to the existing list, never another reader.
    const target = feed.querySelector(".hu-item") || fallbackButton;
    target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: "start" });
  }

  function openComposer() {
    if (!enabled || !canPost) return false;
    composer.hidden = false;
    writeButton.setAttribute("aria-expanded", "true");
    // Correction capture still reveals before the original module focuses.
    // Reading stays expanded independently; no panel switch or draft reset.
    return true;
  }

  function closeComposer({ restore = true } = {}) {
    const wasOpen = !composer.hidden;
    composer.hidden = true;
    writeButton.setAttribute("aria-expanded", "false");
    if (restore && wasOpen && enabled) writeButton.focus({ preventScroll: true });
  }

  const observer = new Observer(render);
  observer.observe(feed, { childList: true, subtree: true, characterData: true });
  readButton.addEventListener("click", showMore);
  feed.addEventListener("click", (event) => {
    const edit = event.target.closest(".hu-edit");
    if (edit && feed.contains(edit) && !edit.disabled) openComposer();
  }, true);

  return Object.freeze({
    openComposer, closeComposer, openReader, render,
    setState(status, ctx) {
      enabled = status !== "idle";
      canPost = ["member", "admin", "owner"].includes(ctx?.member?.role);
      if (!enabled) expanded = false;
      if (!enabled || !canPost) closeComposer({ restore: false });
      render(); // reset presentation synchronously on identity teardown
    },
  });
}
