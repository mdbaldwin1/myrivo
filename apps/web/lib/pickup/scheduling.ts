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

const formatterCache = new Map<string, Intl.DateTimeFormat>();
const offsetFormatterCache = new Map<string, Intl.DateTimeFormat>();

function getPartsFormatter(timezone: string) {
  const cached = formatterCache.get(timezone);
  if (cached) {
    return cached;
  }

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short"
  });
  formatterCache.set(timezone, formatter);
  return formatter;
}

function getOffsetFormatter(timezone: string) {
  const cached = offsetFormatterCache.get(timezone);
  if (cached) {
    return cached;
  }

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    timeZoneName: "shortOffset",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
  offsetFormatterCache.set(timezone, formatter);
  return formatter;
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

function getTimezoneOffsetMinutes(date: Date, timezone: string) {
  const formatter = getOffsetFormatter(timezone);
  const parts = formatter.formatToParts(date);
  const offsetPart = parts.find((part) => part.type === "timeZoneName")?.value ?? "GMT+0";
  const normalized = offsetPart.replace("GMT", "").trim();

  if (!normalized || normalized === "+0" || normalized === "+00" || normalized === "+00:00" || normalized === "0") {
    return 0;
  }

  const sign = normalized.startsWith("-") ? -1 : 1;
  const unsigned = normalized.replace(/^[-+]/, "");
  const [hoursRaw, minutesRaw] = unsigned.split(":");
  const hours = Number.parseInt(hoursRaw ?? "0", 10);
  const minutes = Number.parseInt(minutesRaw ?? "0", 10);

  return sign * (hours * 60 + minutes);
}

function getDateTimePartsInTimezone(date: Date, timezone: string) {
  const formatter = getPartsFormatter(timezone);
  const parts = formatter.formatToParts(date);

  const mapped = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const weekday = mapped.weekday as string;
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6
  };

  return {
    year: Number.parseInt(mapped.year ?? "0", 10),
    month: Number.parseInt(mapped.month ?? "0", 10),
    day: Number.parseInt(mapped.day ?? "0", 10),
    hour: Number.parseInt(mapped.hour ?? "0", 10),
    minute: Number.parseInt(mapped.minute ?? "0", 10),
    second: Number.parseInt(mapped.second ?? "0", 10),
    weekday: weekdayMap[weekday] ?? 0
  };
}

function zonedDateTimeToUtc(dateParts: { year: number; month: number; day: number; hour: number; minute: number }, timezone: string) {
  const utcGuess = new Date(Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day, dateParts.hour, dateParts.minute, 0, 0));
  const offset = getTimezoneOffsetMinutes(utcGuess, timezone);
  const resolved = new Date(utcGuess.getTime() - offset * 60_000);

  // One correction pass for DST boundary transitions.
  const secondOffset = getTimezoneOffsetMinutes(resolved, timezone);
  if (secondOffset !== offset) {
    return new Date(utcGuess.getTime() - secondOffset * 60_000);
  }

  return resolved;
}

function isWithinBlackout(slotStart: Date, slotEnd: Date, blackoutWindows: Array<{ startsAt: Date; endsAt: Date }>) {
  return blackoutWindows.some((window) => slotStart < window.endsAt && slotEnd > window.startsAt);
}

function addDaysInTimezone(base: { year: number; month: number; day: number }, days: number) {
  const utc = new Date(Date.UTC(base.year, base.month - 1, base.day + days, 0, 0, 0, 0));
  return {
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate()
  };
}

export function buildPickupSlots(input: PickupAvailabilityInput): PickupSlot[] {
  const interval = Math.max(15, input.slotIntervalMinutes);
  const maxSlots = Math.max(1, input.maxSlots ?? 30);
  const leadBoundary = new Date(input.now.getTime() + Math.max(0, input.leadTimeHours) * 60 * 60 * 1000);
  const timezone = input.timezone || "UTC";
  const nowLocal = getDateTimePartsInTimezone(input.now, timezone);
  const startLocalDate = { year: nowLocal.year, month: nowLocal.month, day: nowLocal.day };
  const slots: PickupSlot[] = [];

  for (let dayOffset = 0; dayOffset < 30 && slots.length < maxSlots; dayOffset += 1) {
    const localDate = addDaysInTimezone(startLocalDate, dayOffset);
    const middayUtc = zonedDateTimeToUtc({ ...localDate, hour: 12, minute: 0 }, timezone);
    const dayOfWeek = getDateTimePartsInTimezone(middayUtc, timezone).weekday;
    const ranges = input.dayHours[dayOfWeek] ?? [];

    for (const range of ranges) {
      const open = parseTimeParts(range.opensAt);
      const close = parseTimeParts(range.closesAt);
      const openAt = zonedDateTimeToUtc({ ...localDate, hour: open.hour, minute: open.minute }, timezone);
      const closeAt = zonedDateTimeToUtc({ ...localDate, hour: close.hour, minute: close.minute }, timezone);

      for (let cursor = new Date(openAt); cursor < closeAt && slots.length < maxSlots; cursor = new Date(cursor.getTime() + interval * 60_000)) {
        const slotEnd = new Date(cursor.getTime() + interval * 60_000);

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
