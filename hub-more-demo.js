/* No database, identity, storage or writes. Invented content lives only on this
 * labelled demonstration page; the reveal mechanism is the Hub's actual one. */
import { createListMore } from "./hub-list-more.js";

const more = createListMore({
  list: document.getElementById("sample-updates"),
  button: document.getElementById("sample-more"),
  status: document.getElementById("sample-count"),
  initial: 2,
  label: n => `Meer updates (${n})`,
  countLabel: (n, total) => `${n} van ${total} voorbeeldupdates`
});
more.render();
