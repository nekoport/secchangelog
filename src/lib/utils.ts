import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Format a Date to local `YYYY-MM-DDTHH:mm` for <input type="datetime-local">.
// Uses local getters so the value matches the user's timezone (WIB), avoiding
// the UTC drift that happened with toISOString().
export function toDatetimeLocalValue(date: Date | string): string {
  const d = new Date(date);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// WIB = UTC+7 (fixed offset, no DST). Convert a Date to WIB wall-clock parts
// using UTC getters after shifting the offset, so exports are timezone-consistent
// with the UI (which renders in the browser's local time, i.e. Asia/Jakarta).
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function wibParts(d: Date) {
  const w = new Date(d.getTime() + WIB_OFFSET_MS);
  return {
    year: w.getUTCFullYear(),
    month: w.getUTCMonth(),
    day: w.getUTCDate(),
    hours: w.getUTCHours(),
    minutes: w.getUTCMinutes(),
    seconds: w.getUTCSeconds(),
  };
}

// e.g. "2026-08-10 14:09:13 WIB"
export function formatWibDateTime(d: Date): string {
  const p = wibParts(d);
  return `${p.year}-${pad2(p.month + 1)}-${pad2(p.day)} ${pad2(p.hours)}:${pad2(p.minutes)}:${pad2(p.seconds)} WIB`;
}

// e.g. "2026-08-10"
export function formatWibDate(d: Date): string {
  const p = wibParts(d);
  return `${p.year}-${pad2(p.month + 1)}-${pad2(p.day)}`;
}
