export function formatDateId(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}
export function parseDateId(value: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!m) return "";
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return d.getFullYear() === Number(m[3]) && d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[1]) ? `${m[3]}-${m[2]}-${m[1]}` : "";
}
export function combineDateTimeId(dateValue: string, timeValue: string): string {
  const isoDate = parseDateId(dateValue);
  if (!isoDate || !/^([01]\d|2[0-3]):[0-5]\d$/.test(timeValue)) return "";
  return `${isoDate}T${timeValue}`;
}
