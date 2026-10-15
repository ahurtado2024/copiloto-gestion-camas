/* Utilidades de tiempo — formato operativo es-CL */

export function minutesBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 60000);
}

export function hoursBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / 3600000;
}

/** "hace 12 min", "hace 3 h", "hace 2 d" */
export function ago(from: Date | null | undefined, now: Date = new Date()): string {
  if (!from) return "—";
  const mins = Math.max(0, Math.round((now.getTime() - from.getTime()) / 60000));
  if (mins < 1) return "recién";
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours} h${mins % 60 >= 30 ? "½" : ""}`.replace("½", "");
  const days = Math.floor(hours / 24);
  return `hace ${days} d`;
}

/** duración humana: "3 h 12 min", "45 min", "1 d 2 h" */
export function duration(mins: number | null | undefined): string {
  if (mins === null || mins === undefined || Number.isNaN(mins)) return "—";
  const m = Math.max(0, Math.round(mins));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ${String(m % 60).padStart(2, "0")} min`.replace(" 00 min", "");
  const d = Math.floor(h / 24);
  return `${d} d ${h % 24} h`;
}

/** "14:05" */
export function hhmm(d: Date | null | undefined): string {
  if (!d) return "—";
  return d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", hour12: false });
}

/** "12 oct · 14:05" */
export function dayTime(d: Date | null | undefined): string {
  if (!d) return "—";
  const day = d.toLocaleDateString("es-CL", { day: "numeric", month: "short" }).replace(".", "");
  return `${day} · ${hhmm(d)}`;
}

/** "lunes 12 de octubre" */
export function longDate(d: Date): string {
  return d.toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" });
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function addMinutes(d: Date, mins: number): Date {
  return new Date(d.getTime() + mins * 60000);
}

export function addHours(d: Date, hours: number): Date {
  return new Date(d.getTime() + hours * 3600000);
}

/** minutos restantes hasta una fecha (negativo si ya pasó) */
export function minutesUntil(d: Date, now: Date = new Date()): number {
  return Math.round((d.getTime() - now.getTime()) / 60000);
}
