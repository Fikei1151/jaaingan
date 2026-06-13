"use client";

import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { MenuItem, Popover } from "./popover";

export interface SelectOption {
  value: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
}

/**
 * Central, reusable select/dropdown — Notion-styled, animated (via Popover).
 *
 *   <Select value={role} options={ROLE_OPTIONS} onChange={setRole} />
 */
export function Select({
  value,
  options,
  onChange,
  align = "left",
  className,
  panelClassName = "min-w-[160px]",
}: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  align?: "left" | "right";
  className?: string;
  panelClassName?: string;
}) {
  const current = options.find((o) => o.value === value);

  return (
    <Popover
      align={align}
      panelClassName={panelClassName}
      trigger={({ open, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          className={cn(
            "flex items-center gap-1.5 rounded-md border border-line bg-bg px-2 py-1 text-sm transition-colors hover:bg-fill",
            className,
          )}
        >
          {current?.icon}
          <span className="min-w-0 flex-1 truncate text-left">
            {current?.label ?? "เลือก"}
          </span>
          <ChevronDown
            size={14}
            className={cn(
              "shrink-0 text-ink-faint transition-transform",
              open && "rotate-180",
            )}
          />
        </button>
      )}
    >
      {({ close }) => (
        <div>
          {options.map((o) => (
            <MenuItem
              key={o.value}
              active={o.value === value}
              onClick={() => {
                onChange(o.value);
                close();
              }}
            >
              {o.icon}
              <span className="min-w-0 flex-1 truncate">{o.label}</span>
              {o.value === value && <Check size={14} className="text-accent" />}
            </MenuItem>
          ))}
        </div>
      )}
    </Popover>
  );
}
