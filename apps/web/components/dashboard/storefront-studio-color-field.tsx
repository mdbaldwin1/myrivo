"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";

type StorefrontStudioColorFieldProps = {
  id?: string;
  "aria-describedby"?: string;
  value: string;
  fallback: string;
  onChange: (value: string) => void;
};

function normalizeHex(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const hex = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  return /^#([0-9a-fA-F]{6})$/.test(hex) ? hex.toUpperCase() : null;
}

export function StorefrontStudioColorField({ id, "aria-describedby": ariaDescribedBy, value, fallback, onChange }: StorefrontStudioColorFieldProps) {
  const [textValue, setTextValue] = useState(value);

  useEffect(() => {
    setTextValue(value);
  }, [value]);

  function commitTextValue() {
    const normalized = normalizeHex(textValue);
    if (!normalized || normalized === value) {
      setTextValue(value);
      return;
    }

    onChange(normalized);
  }

  return (
    <div className="flex items-center gap-3">
      <Input
        type="color"
        aria-label="Color swatch"
        aria-describedby={ariaDescribedBy}
        value={normalizeHex(value) ?? fallback}
        onChange={(event) => onChange(event.target.value.toUpperCase())}
        className="h-10 w-14 shrink-0 cursor-pointer p-1"
      />
      <Input
        id={id}
        aria-describedby={ariaDescribedBy}
        className="flex-1"
        value={textValue}
        onChange={(event) => setTextValue(event.target.value)}
        onBlur={commitTextValue}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commitTextValue();
          }

          if (event.key === "Escape") {
            event.preventDefault();
            setTextValue(value);
          }
        }}
      />
    </div>
  );
}
