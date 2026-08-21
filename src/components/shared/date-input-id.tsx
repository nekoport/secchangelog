"use client";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { formatDateId, parseDateId, combineDateTimeId } from "@/lib/security/date-input";

export function DateInputId({ value, onChange, id, className, ...props }: { value: string; onChange: (iso: string) => void; id?: string; className?: string; [key: string]: unknown }) {
  const [draft, setDraft] = useState(() => formatDateId(value)); const [invalid, setInvalid] = useState(false);
  // External resets (for example clearing filters) must update the draft; keystrokes remain local until commit.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setDraft(formatDateId(value)); setInvalid(false); }, [value]);
  function commit() { const parsed = parseDateId(draft); if (parsed || !draft) { setInvalid(false); onChange(parsed); } else { setDraft(formatDateId(value)); setInvalid(true); } }
  return <Input {...props} id={id} className={className} type="text" inputMode="numeric" placeholder="dd/MM/yyyy" value={draft} onChange={(e) => { setDraft(e.target.value); setInvalid(false); }} onBlur={commit} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } }} aria-invalid={invalid} aria-label={props["aria-label"] as string || "Tanggal (dd/MM/yyyy)"} />;
}

export function DateTimeInputId({ value, onChange, id, className, ...props }: { value: string; onChange: (iso: string) => void; id?: string; className?: string; [key: string]: unknown }) {
  const [dateDraft, setDateDraft] = useState(() => formatDateId(value ? value.slice(0, 10) : ""));
  const [timeDraft, setTimeDraft] = useState(() => value ? value.slice(11, 16) : "");
  const [timeInvalid, setTimeInvalid] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setDateDraft(formatDateId(value ? value.slice(0, 10) : "")); setTimeDraft(value ? value.slice(11, 16) : ""); setTimeInvalid(false); }, [value]);
  function commit(nextDate = dateDraft, nextTime = timeDraft) { const next = combineDateTimeId(nextDate, nextTime); if (next) { setTimeInvalid(false); onChange(next); return; } setTimeDraft(value ? value.slice(11, 16) : ""); setTimeInvalid(true); }
  return <div className="grid grid-cols-[1fr_auto] gap-2"><DateInputId value={parseDateId(dateDraft)} onChange={(iso) => { const nextDate = formatDateId(iso); setDateDraft(nextDate); commit(nextDate, timeDraft); }} aria-label="Tanggal implementasi (dd/MM/yyyy)" /><Input {...props} id={id} className={className} type="text" inputMode="numeric" placeholder="HH:mm" value={timeDraft} onChange={(e) => { setTimeDraft(e.target.value); setTimeInvalid(false); }} onBlur={() => commit(dateDraft, timeDraft)} aria-invalid={timeInvalid} aria-label="Waktu implementasi (HH:mm)" /></div>;
}
