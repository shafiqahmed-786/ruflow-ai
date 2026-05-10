// frontend/lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge }               from "tailwind-merge";

/**
 * Merge Tailwind classes safely.
 *
 * - clsx handles conditional / array / object class syntax
 * - twMerge resolves Tailwind conflicts (later classes win)
 *
 * Usage:
 *   cn("px-4 py-2", isActive && "bg-accent", className)
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}