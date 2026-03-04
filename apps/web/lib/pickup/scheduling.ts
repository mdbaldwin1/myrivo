export type PickupHoursRange = {
  opensAt: string;
  closesAt: string;
};

export type PickupAvailabilityInput = {
  now: Date;
  leadTimeHours: number;
  slotIntervalMinutes: number;
  timezone: string;
  dayHours: Record<number, PickupHoursRange[]>;
  blackoutWindows: Array<{ startsAt: Date; endsAt: Date }>;
  maxSlots?: number;
};

export type PickupSlot = {
  startsAt: string;
  endsAt: string;
};

function isWithinBlackout(slotStart: Date, slotEnd: Date, blackoutWindows: Array<{ startsAt: Date; endsAt: Date }>) {
  return blackoutWindows.some((window) => slotStart < window.endsAt && slotEnd > window.startsAt);
}

function parseTimeParts(timeValue: string) {
  const [hourRaw, minuteRaw] = timeValue.split(":");
  const hour = Number.parseInt(hourRaw ?? "", 10);
  const minute = Number.parseInt(minuteRaw ?? "", 10);

  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new Error(`Invalid time value: ${timeValue}`);
  }

  return { hour, minute };
}

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function buildPickupSlots(input: PickupAvailabilityInput): PickupSlot[] {
  const interval = Math.max(15, input.slotIntervalMinutes);
  const maxSlots = Math.max(1, input.maxSlots ?? 30);
  const leadBoundary = new Date(input.now.getTime() + Math.max(0, input.leadTimeHours) * 60 * 60 * 1000);
  const slots: PickupSlot[] = [];

  for (let dayOffset = 0; dayOffset < 30 && slots.length < maxSlots; dayOffset += 1) {
    const dayStart = startOfDay(new Date(input.now.getTime() + dayOffset * 24 * 60 * 60 * 1000));
    const dayOfWeek = dayStart.getDay();
    const ranges = input.dayHours[dayOfWeek] ?? [];

    for (const range of ranges) {
      const open = parseTimeParts(range.opensAt);
      const close = parseTimeParts(range.closesAt);
      const openAt = new Date(dayStart);
      openAt.setHours(open.hour, open.minute, 0, 0);
      const closeAt = new Date(dayStart);
      closeAt.setHours(close.hour, close.minute, 0, 0);

      for (let cursor = new Date(openAt); cursor < closeAt && slots.length < maxSlots; cursor = new Date(cursor.getTime() + interval * 60 * 1000)) {
        const slotEnd = new Date(cursor.getTime() + interval * 60 * 1000);

        if (slotEnd > closeAt) {
          continue;
        }

        if (cursor < leadBoundary) {
          continue;
        }

        if (isWithinBlackout(cursor, slotEnd, input.blackoutWindows)) {
          continue;
        }

        slots.push({
          startsAt: cursor.toISOString(),
          endsAt: slotEnd.toISOString()
        });
      }
    }
  }

  return slots;
}
