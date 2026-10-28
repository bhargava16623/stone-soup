// Resolves the app's "@/..." import alias for scripts run directly with Node.
export async function resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) return next(new URL(`../src/${specifier.slice(2)}`, import.meta.url).href, context);
  return next(specifier, context);
}
