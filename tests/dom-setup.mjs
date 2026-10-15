import { Window } from "happy-dom";
const window = new Window({ url: "http://127.0.0.1:5189/" });
for (const key of [
  "window",
  "document",
  "navigator",
  "HTMLElement",
  "HTMLTextAreaElement",
  "HTMLInputElement",
  "HTMLDialogElement",
  "Node",
  "Event",
  "MouseEvent",
  "KeyboardEvent",
  "MutationObserver",
  "getComputedStyle",
  "location",
  "localStorage",
  "sessionStorage",
]) {
  Object.defineProperty(globalThis, key, {
    value:
      typeof window[key] === "function" && key === "getComputedStyle"
        ? window[key].bind(window)
        : window[key],
    configurable: true,
    writable: true,
  });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
