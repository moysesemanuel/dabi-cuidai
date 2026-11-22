/**
 * "iPhone · Safari", "Android · Chrome", "Mac · Firefox": o suficiente para a família reconhecer cada celular
 * na lista de aparelhos conectados. Não guarda o user-agent inteiro.
 */
export function describeDevice(userAgent: string | null | undefined): string | null {
  const ua = userAgent ?? "";
  if (!ua) return null;
  const system = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua) || (/Macintosh/.test(ua) && /Mobile\//.test(ua))
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /CrOS/.test(ua)
          ? "Chromebook"
          : /Windows/.test(ua)
            ? "Windows"
            : /Macintosh|Mac OS X/.test(ua)
              ? "Mac"
              : /Linux/.test(ua)
                ? "Linux"
                : null;
  const browser = /EdgA?\/|EdgiOS/.test(ua)
    ? "Edge"
    : /SamsungBrowser/.test(ua)
      ? "Samsung Internet"
      : /Firefox|FxiOS/.test(ua)
        ? "Firefox"
        : /OPR\/|Opera/.test(ua)
          ? "Opera"
          : /Chrome|CriOS/.test(ua)
            ? "Chrome"
            : /Safari/.test(ua)
              ? "Safari"
              : null;
  const parts = [system, browser].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}
