export function getBrowserCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;

  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return document.cookie.match(
    new RegExp(`(?:^|;\\s*)${escapedName}=([^;]*)`, "u"),
  )?.[1];
}
