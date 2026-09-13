/* Codex — Home presentation only. Claude's update module still owns the two
 * live roots, requests, drafts and corrections. The reading dialog contains
 * the ORIGINAL feed, not cloned controls. Previews derive text from its rendered
 * .hu-day/.hu-item contract; they never fetch data or invent report summaries.
 * MutationObserver follows internal retries, corrections and language changes.
 */
import { t } from "./hub-i18n.js";

export function createCompactHomeUpdates({ feed, previews, readButton, reader, composer, closeReader, closeComposer, writeButton, fallbackButton, Observer = globalThis.MutationObserver }) {
  const doc = feed.ownerDocument;
  let enabled = false;
  let canPost = false;
  let returnTo = null;
  let restoreFocus = true;

  function node(tag, className, text) {
    const el = doc.createElement(tag);
    el.className = className;
    el.textContent = text;
    return el;
  }

  function closePanels({ restore = true } = {}) {
    restoreFocus = restore;
    if (reader.open) reader.close();
    if (composer.open) composer.close();
  }

  function openReader(card) {
    if (!enabled) return;
    returnTo = doc.activeElement;
    restoreFocus = true;
    if (!reader.open) reader.showModal();
    closeReader.focus({ preventScroll: true });
    if (card?.isConnected) card.scrollIntoView({ block: "start" });
    else reader.scrollTop = 0;
  }

  function openComposer() {
    if (!enabled || !canPost) return false;
    // close events are queued: do not let the reader steal focus back from
    // the correction field after its own synchronous handler has focused it.
    if (reader.open) reader.close();
    returnTo = writeButton;
    restoreFocus = true;
    if (!composer.open) composer.showModal();
    composer.scrollTop = 0;
    return true;
  }

  function restore() {
    if (!restoreFocus || !enabled || reader.open || composer.open) return;
    const target = [returnTo, readButton, fallbackButton].find((el) => el?.isConnected && !el.hidden);
    target?.focus({ preventScroll: true });
  }

  function render() {
    previews.replaceChildren();
    readButton.hidden = true;
    if (!enabled) return;
    const rows = [...feed.querySelectorAll(".hu-item")];
    const failure = feed.querySelector('[role="alert"]');
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
    readButton.hidden = false;
    let day = "";
    let count = 0;
    for (const child of feed.children) {
      if (child.classList.contains("hu-day")) day = child.textContent;
      if (!child.classList.contains("hu-item") || count >= 2) continue;
      count += 1;
      const button = node("button", "home-report-preview", "");
      button.type = "button";
      button.setAttribute("aria-haspopup", "dialog");
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
  closeReader.addEventListener("click", () => reader.close());
  closeComposer.addEventListener("click", () => composer.close());
  reader.addEventListener("close", restore);
  composer.addEventListener("close", restore);
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
      } else if (!canPost && composer.open) composer.close();
      render(); // synchronous clearing on identity teardown, before observer delivery
    },
  });
}
