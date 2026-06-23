import { describe, it, expect } from "vitest";
import { generateAvailableSlots } from "./slots";

const date = "2026-07-01"; // future date — tempoMarcar buffer is irrelevant
const morning = { start: "08:00:00", end: "12:00:00" };
const afternoon = { start: "13:00:00", end: "18:00:00" };

describe("generateAvailableSlots — boundary cases", () => {
  it("includes the 30-min slot starting exactly when an existing appointment ends (14:00 + 30min → 14:30 free)", () => {
    const slots = generateAvailableSlots({
      date,
      requestedDuration: 30,
      windows: [morning, afternoon],
      appointments: [{ data: `${date}T14:00:00`, duration: 30 }],
      tempoMarcar: 60,
      now: new Date(`${date}T08:00:00`),
    });

    expect(slots).toContain("14:30");
    // The conflicting slot itself must NOT be available
    expect(slots).not.toContain("14:00");
    // Slots before/after the conflict remain available
    expect(slots).toContain("13:30");
    expect(slots).toContain("15:00");
  });

  it("includes a slot whose start equals now + tempoMarcar exactly", () => {
    // now = 13:30, tempoMarcar = 60 → minAllowed = 14:30 → 14:30 must be allowed
    const slots = generateAvailableSlots({
      date,
      requestedDuration: 30,
      windows: [afternoon],
      appointments: [],
      tempoMarcar: 60,
      now: new Date(`${date}T13:30:00`),
    });

    expect(slots[0]).toBe("14:30");
    expect(slots).toContain("15:00");
  });

  it("blocks slots that genuinely overlap an existing appointment", () => {
    // Existing 14:00 with 60min → 14:00 and 14:30 must both be blocked; 15:00 free
    const slots = generateAvailableSlots({
      date,
      requestedDuration: 30,
      windows: [afternoon],
      appointments: [{ data: `${date}T14:00:00`, duration: 60 }],
      tempoMarcar: 0,
      now: new Date(`${date}T00:00:00`),
    });

    expect(slots).not.toContain("14:00");
    expect(slots).not.toContain("14:30");
    expect(slots).toContain("15:00");
  });

  it("respects working-window end (slot must fit entirely inside the window)", () => {
    const slots = generateAvailableSlots({
      date,
      requestedDuration: 30,
      windows: [{ start: "17:00:00", end: "18:00:00" }],
      appointments: [],
      tempoMarcar: 0,
      now: new Date(`${date}T00:00:00`),
    });
    expect(slots).toEqual(["17:00", "17:30"]);
  });
});
