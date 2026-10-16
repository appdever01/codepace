export function resolve(specifier, context, nextResolve) {
  return nextResolve(specifier === "next/image" ? new URL("./runtime-image.mjs", import.meta.url).href : specifier, context);
}
