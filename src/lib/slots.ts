import { addMinutes, format, parseISO } from "date-fns";

export type SlotAppointment = {
  /** ISO datetime string (e.g. "2026-06-23T14:00:00") */
  data: string;
  /** Total duration of the appointment, in minutes */
  duration: number;
};

export type SlotWindow = {
  /** "HH:mm" or "HH:mm:ss" */
  start: string;
  /** "HH:mm" or "HH:mm:ss" */
  end: string;
};

export type GenerateSlotsParams = {
  /** "yyyy-MM-dd" */
  date: string;
  /** Duration of the service being booked, in minutes */
  requestedDuration: number;
  /** Working windows in the day (morning, afternoon, etc.) */
  windows: SlotWindow[];
  /** Existing appointments for the colaborador on that date */
  appointments: SlotAppointment[];
  /** Minimum advance time from `now` (in minutes) — slot start must be >= now + this */
  tempoMarcar: number;
  /** Slot stride in minutes (default 30) */
  step?: number;
  /** Reference "now" — defaults to new Date(). Override in tests. */
  now?: Date;
};

/**
 * Returns the list of available "HH:mm" slots for the requested service.
 *
 * Boundary rules (important):
 * - A slot whose start equals `now + tempoMarcar` is allowed (inclusive).
 * - A slot whose start equals an existing appointment's end is allowed
 *   (overlap uses strict `<` / `>`, so touching boundaries don't conflict).
 */
export function generateAvailableSlots({
  date,
  requestedDuration,
  windows,
  appointments,
  tempoMarcar,
  step = 30,
  now = new Date(),
}: GenerateSlotsParams): string[] {
  if (!date || requestedDuration <= 0 || windows.length === 0) return [];

  const minAllowed = addMinutes(now, tempoMarcar).getTime();

  const parsedAppts = appointments.map((a) => {
    const start = parseISO(a.data);
    return { start, end: addMinutes(start, a.duration) };
  });

  const overlaps = (slotStart: Date) => {
    const slotEnd = addMinutes(slotStart, requestedDuration);
    return parsedAppts.some(
      ({ start, end }) => slotStart < end && slotEnd > start,
    );
  };

  const result: string[] = [];
  for (const w of windows) {
    if (!w.start || !w.end) continue;
    let curr = parseISO(`${date}T${w.start}`);
    const windowEnd = parseISO(`${date}T${w.end}`);
    while (addMinutes(curr, requestedDuration) <= windowEnd) {
      if (curr.getTime() >= minAllowed && !overlaps(curr)) {
        result.push(format(curr, "HH:mm"));
      }
      curr = addMinutes(curr, step);
    }
  }
  return result;
}
