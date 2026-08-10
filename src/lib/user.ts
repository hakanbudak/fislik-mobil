/** Two-letter avatar initials from a full name, e.g. "Ayşe Yıldırım" -> "AY".
 *  Ported from fislik-web/src/lib/user.ts. */
export function initials(fullName: string): string {
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
