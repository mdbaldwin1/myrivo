"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import * as React from "react";
import { DayPicker, type DayPickerProps, useDayPicker } from "react-day-picker";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type CalendarProps = DayPickerProps;

function CalendarMonthCaption(props: React.HTMLAttributes<HTMLDivElement>) {
  const { children, className, ...rest } = props;
  const { previousMonth, nextMonth, goToMonth, labels } = useDayPicker();

  return (
    <div {...rest} className={cn("mx-auto flex h-8 w-[12rem] items-center justify-between gap-2", className)}>
      <button
        type="button"
        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-7 w-7 bg-transparent p-0 opacity-80 hover:opacity-100")}
        aria-label={labels.labelPrevious(previousMonth)}
        onClick={() => {
          if (previousMonth) {
            goToMonth(previousMonth);
          }
        }}
        disabled={!previousMonth}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <div className="min-w-0 flex-1 text-center text-sm font-medium">{children}</div>

      <button
        type="button"
        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-7 w-7 bg-transparent p-0 opacity-80 hover:opacity-100")}
        aria-label={labels.labelNext(nextMonth)}
        onClick={() => {
          if (nextMonth) {
            goToMonth(nextMonth);
          }
        }}
        disabled={!nextMonth}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

export function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      hideNavigation
      className={cn("p-3", className)}
      classNames={{
        root: "w-fit",
        months: "flex flex-col space-y-4",
        month: "space-y-4",
        month_caption: "flex justify-center",
        caption_label: "text-sm font-medium",
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday: "w-9 rounded-md py-1 text-center text-[0.8rem] font-normal text-muted-foreground",
        weeks: "mt-2 flex flex-col gap-1",
        week: "flex w-full",
        day: "h-9 w-9 p-0 text-center text-sm",
        day_button: cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-9 w-9 rounded-md p-0 font-normal"),
        selected:
          "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button:hover]:bg-primary [&>button:hover]:text-primary-foreground [&>button:focus]:bg-primary [&>button:focus]:text-primary-foreground",
        today: "[&>button]:bg-muted [&>button]:text-foreground",
        outside: "text-muted-foreground opacity-50",
        disabled: "text-muted-foreground opacity-50",
        range_middle: "[&>button]:bg-muted [&>button]:text-foreground",
        hidden: "invisible",
        ...classNames
      }}
      components={{
        MonthCaption: CalendarMonthCaption
      }}
      {...props}
    />
  );
}
