"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { Theme } from "@/constants";
import {
  applyTheme,
  getServerTheme,
  getTheme,
  subscribeToTheme,
} from "@/lib/theme";

/**
 * Light/dark switch. The theme itself is applied before paint by the inline
 * script in the document head; this subscribes to the resulting `data-theme`
 * attribute so the icon always reflects the real value rather than a second
 * copy of it held in React state.
 */
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeToTheme, getTheme, getServerTheme);

  const isDark = theme === Theme.Dark;
  const next = isDark ? Theme.Light : Theme.Dark;

  return (
    <button
      type="button"
      onClick={() => applyTheme(next)}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-raised hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {isDark ? (
        <Moon className="size-[18px]" strokeWidth={1.75} aria-hidden />
      ) : (
        <Sun className="size-[18px]" strokeWidth={1.75} aria-hidden />
      )}
    </button>
  );
}
