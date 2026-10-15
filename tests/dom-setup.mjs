import { Window } from "happy-dom";
import * as nodeModule from "node:module";
import { resolve } from "./runtime-loader.mjs";
if (nodeModule.registerHooks) nodeModule.registerHooks({ resolve });
else nodeModule.register("./runtime-loader.mjs", import.meta.url);
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
