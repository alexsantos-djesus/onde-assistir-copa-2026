export function formatHora(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatData(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

export function countdown(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "começou";
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (h >= 24) {
    const d = Math.floor(h / 24);
    return `em ${d}d ${h % 24}h`;
  }
  if (h > 0) return `em ${h}h ${m}min`;
  return `em ${m}min`;
}

export function flagEmoji(code: string | null | undefined): string {
  if (!code) return "🏳️";
  const c = code.trim().toUpperCase();
  if (c.length !== 2) return code;
  return String.fromCodePoint(...[...c].map((x) => 0x1f1a5 + x.charCodeAt(0)));
}
