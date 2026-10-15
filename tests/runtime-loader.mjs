export function resolve(specifier, context, nextResolve) {
  return nextResolve(
    specifier === "next/image" ? "vinext/shims/image" : specifier,
    context,
  );
}
