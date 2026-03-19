"use client";

import { format } from "date-fns";
import { CalendarDays, Clock3, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type DateTimePickerProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
};

function toLocalDateTimeValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function parseLocalDateTimeValue(value: string) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function withTime(date: Date, timeValue: string) {
  const [hours, minutes] = timeValue.split(":").map((part) => Number.parseInt(part, 10));
  const next = new Date(date);
  next.setHours(hours || 0, minutes || 0, 0, 0);
  return next;
}

const TIME_OPTIONS = Array.from({ length: 96 }, (_, index) => {
  const hours = Math.floor(index / 4);
  const minutes = (index % 4) * 15;
  const date = new Date(2000, 0, 1, hours, minutes);
  const value = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  return {
    value,
    label: format(date, "h:mm a")
  };
});

export function DateTimePicker({ value, onChange, placeholder = "Pick a date and time", className, disabled = false }: DateTimePickerProps) {
  const [open, setOpen] = useState(false);
  const selectedDate = useMemo(() => parseLocalDateTimeValue(value), [value]);
  const selectedTime = selectedDate ? format(selectedDate, "HH:mm") : "09:00";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn("h-10 w-full justify-between bg-background px-3 text-left font-normal", !selectedDate && "text-muted-foreground", className)}
          disabled={disabled}
        >
          <span className="flex min-w-0 items-center gap-2">
            <CalendarDays className="h-4 w-4 shrink-0" />
            <span className="truncate">{selectedDate ? format(selectedDate, "PPP 'at' p") : placeholder}</span>
          </span>
          <Clock3 className="h-4 w-4 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="border-b border-border/70 p-3">
          <Calendar
            mode="single"
            selected={selectedDate ?? undefined}
            onSelect={(nextDate) => {
              if (!nextDate) {
                return;
              }

              const baseline = selectedDate ?? new Date();
              const merged = new Date(nextDate);
              merged.setHours(baseline.getHours(), baseline.getMinutes(), 0, 0);
              onChange(toLocalDateTimeValue(merged));
            }}
            initialFocus
          />
        </div>

        <div className="space-y-3 p-3">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Time</p>
            <Select
              value={selectedTime}
              onChange={(event) => {
                const baseline = selectedDate ?? new Date();
                onChange(toLocalDateTimeValue(withTime(baseline, event.target.value)));
              }}
            >
              {TIME_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              <X className="mr-1.5 h-4 w-4" />
              Clear
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const now = new Date();
                onChange(toLocalDateTimeValue(now));
                setOpen(false);
              }}
            >
              Use now
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
