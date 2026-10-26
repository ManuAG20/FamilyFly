export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const date = parseIsoDate(value);
  return !Number.isNaN(date.getTime()) && toIsoDate(date) === value;
}

export function parseIsoDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(value: string, days: number): string {
  const date = parseIsoDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return toIsoDate(date);
}

export function enumerateDateWindow(center: string, radius: number): string[] {
  const dates: string[] = [];
  for (let offset = -radius; offset <= radius; offset += 1) {
    dates.push(addDays(center, offset));
  }
  return dates;
}

export function todayIso(): string {
  return toIsoDate(new Date());
}

export function formatDate(
  value: string,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" },
): string {
  return new Intl.DateTimeFormat("es-ES", { ...options, timeZone: "UTC" }).format(
    parseIsoDate(value),
  );
}

export function formatDateShort(value: string): string {
  return formatDate(value, { weekday: "short", day: "numeric", month: "short" });
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(date);
}

export function formatTime(iso: string): string {
  const localTime = iso.match(/T(\d{2}:\d{2})/)?.[1];
  if (localTime) return localTime;

  const date = new Date(iso);
  return new Intl.DateTimeFormat("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "UTC",
  }).format(date);
}

export function formatDuration(totalMinutes: number): string {
  const minutes = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  if (rest === 0) return `${hours} h`;
  return `${hours} h ${rest} min`;
}

export function formatDataAge(hours: number): string {
  if (hours < 1) return "hace menos de 1 h";
  if (hours < 24) return `hace ${Math.round(hours)} h`;
  const days = Math.round(hours / 24);
  return `hace ${days} ${days === 1 ? "día" : "días"}`;
}

export function buildIsoDateTime(date: string, minutesFromMidnight: number): string {
  const value = parseIsoDate(date);
  value.setUTCMinutes(value.getUTCMinutes() + minutesFromMidnight);
  return value.toISOString();
}
