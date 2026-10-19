/** Only allow same-origin, absolute paths in ?next=. Blocks //evil.example. */
export function safeNextPath(value) {
  if (typeof value !== "string") return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}
