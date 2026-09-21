export function formatDate(iso: string): string {
  // iso: YYYY-MM-DD
  if (!iso) return "";
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  const [y, m, d] = parts;
  const months = [
    "gen", "feb", "mar", "apr", "mag", "giu",
    "lug", "ago", "set", "ott", "nov", "dic",
  ];
  const mi = parseInt(m, 10) - 1;
  return `${parseInt(d, 10)} ${months[mi] ?? m} ${y}`;
}

export function formatDateRange(start: string, end: string): string {
  if (!end || start === end) return formatDate(start);
  return `${formatDate(start)} → ${formatDate(end)}`;
}

export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "ora";
  if (min < 60) return `${min} min fa`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h fa`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days} g fa`;
  const dt = new Date(iso);
  return dt.toLocaleDateString("it-IT", { day: "numeric", month: "short" });
}
