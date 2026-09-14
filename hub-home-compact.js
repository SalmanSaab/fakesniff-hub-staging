/* Codex — Home presentation only. Claude's update module still owns the two
 * live roots, requests, drafts and corrections. The inline reader contains
 * the ORIGINAL feed, not cloned controls. Previews derive text from its rendered
 * .hu-day/.hu-item contract; they never fetch data or invent report summaries.
 * MutationObserver follows internal retries, corrections and language changes.
 */
import { t } from "./hub-i18n.js";

export function createCompactHomeUpdates({ feed, previews, readButton, readShortcut, reader, composer, closeReader, closeComposer, writeButton, fallbackButton, Observer = globalThis.MutationObserver }) {
  const doc = feed.ownerDocument;
  let enabled = false;
  let canPost = false;
  let returnTo = null;
  let hasReports = false;

  function syncExpanded() {
    const reading = !reader.hidden;
    for (const button of [readButton, readShortcut, closeReader, ...previews.querySelectorAll('.home-report-preview')]) {
      button?.setAttribute("aria-expanded", String(reading));
    }
    for (const button of [writeButton, closeComposer]) button.setAttribute("aria-expanded", String(!composer.hidden));
    // The original feed owns feedback while expanded. Do not announce its
    // copied status/alert or show the same reports twice on the page.
    previews.hidden = reading;
    readButton.hidden = !hasReports || reading;
  }

  function node(tag, className, text) {
    const el = doc.createElement(tag);
    el.className = className;
    el.textContent = text;
    return el;
  }

  function closePanels({ restore = true } = {}) {
    const wasOpen = !reader.hidden || !composer.hidden;
    reader.hidden = true;
    composer.hidden = true;
    syncExpanded();
    if (restore && wasOpen) restoreOpener();
  }

  function openReader(card) {
    if (!enabled) return;
    closePanels({ restore: false });
    returnTo = doc.activeElement;
    reader.hidden = false;
    syncExpanded();
    // Focus follows the report brought into view, not a collapse button that
    // may be above it. A temporary tabindex does not add every report to Tab.
    const target = card?.isConnected ? card : feed.querySelector(".hu-item") || closeReader;
    if (target !== closeReader) target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: "start" });
  }

  function openComposer() {
    if (!enabled || !canPost) return false;
    // One expansion at a time, without unmounting either root or discarding a
    // parked draft/correction. Capture still reveals the form before startEdit.
    closePanels({ restore: false });
    returnTo = writeButton;
    composer.hidden = false;
    syncExpanded();
    composer.scrollIntoView({ block: "start" });
    return true;
  }

  function restoreOpener() {
    if (!enabled) return;
    const target = [returnTo, readButton, fallbackButton].find((el) => {
      if (!el?.isConnected) return false;
      for (let ancestor = el; ancestor; ancestor = ancestor.parentElement) if (ancestor.hidden) return false;
      return true;
    });
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: "nearest" });
  }

  function render() {
    previews.replaceChildren();
    const rows = [...feed.querySelectorAll(".hu-item")];
    const failure = feed.querySelector('[role="alert"]');
    hasReports = enabled && !failure && rows.length > 0;
    syncExpanded();
    if (!enabled) return;
    if (failure || !rows.length) {
      const status = node("p", "home-report-status", failure?.textContent || feed.textContent);
      status.setAttribute("role", failure ? "alert" : "status");
      previews.append(status);
      const retry = feed.querySelector(".hu-retry");
      if (retry) {
        const button = node("button", "secondary-button", retry.textContent);
        button.type = "button";
        button.addEventListener("click", () => retry.click());
        previews.append(button);
      }
      return;
    }
    readButton.textContent = t("home.read_loaded_updates", { n: rows.length });
    let day = "";
    let count = 0;
    for (const child of feed.children) {
      if (child.classList.contains("hu-day")) day = child.textContent;
      if (!child.classList.contains("hu-item") || count >= 2) continue;
      count += 1;
      const button = node("button", "home-report-preview", "");
      button.type = "button";
      button.setAttribute("aria-controls", reader.id);
      button.setAttribute("aria-expanded", String(!reader.hidden));
      const author = child.querySelector(".hu-who")?.textContent || "";
      const time = child.querySelector(".hu-when")?.textContent || "";
      const edited = child.querySelector(".hu-edited")?.textContent || "";
      button.append(node("strong", "home-report-author", author));
      button.append(node("span", "home-report-meta", [day, time, edited].filter(Boolean).join(" · ")));
      const line = child.querySelector(".hu-line");
      const label = line?.querySelector(".hu-line-label")?.textContent || "";
      const value = line?.querySelector(".hu-line-text")?.textContent || "";
      const excerpt = value.length > 150 ? `${value.slice(0, 150)}…` : value;
      button.append(node("span", "home-report-excerpt", `${label}: ${excerpt}`));
      button.append(node("span", "home-report-open", t("home.read_full_update")));
      button.addEventListener("click", () => openReader(child));
      previews.append(button);
    }
  }

  const observer = new Observer(render);
  observer.observe(feed, { childList: true, subtree: true, characterData: true });
  readButton.addEventListener("click", () => openReader());
  closeReader.addEventListener("click", () => closePanels());
  closeComposer.addEventListener("click", () => closePanels());
  feed.addEventListener("click", (event) => {
    const edit = event.target.closest(".hu-edit");
    if (edit && feed.contains(edit) && !edit.disabled) openComposer();
  }, true);

  return Object.freeze({
    openComposer, openReader, closePanels, render,
    setState(status, ctx) {
      enabled = status !== "idle";
      canPost = ["member", "admin", "owner"].includes(ctx?.member?.role);
      if (!enabled) {
        closePanels({ restore: false });
        returnTo = null;
      } else if (!canPost && !composer.hidden) closePanels({ restore: false });
      render(); // synchronous clearing on identity teardown, before observer delivery
    },
  });
}
