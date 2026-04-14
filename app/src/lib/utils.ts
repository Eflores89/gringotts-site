import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * onChange handler for <Input type="number"> fields bound to react-hook-form
 * with a numeric zod schema. Sends a number to the form (or `fallback` when
 * the input is empty/NaN — default 0 for required fields, "" for optional).
 */
export function numericOnChange(
  onChange: (v: number | "") => void,
  fallback: number | "" = 0,
) {
  return (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.valueAsNumber;
    onChange(Number.isNaN(v) ? fallback : v);
  };
}
