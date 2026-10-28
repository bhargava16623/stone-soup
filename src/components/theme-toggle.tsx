"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

type Theme = "system" | "light" | "dark";
const ORDER: Theme[] = ["system", "light", "dark"];
const LABEL: Record<Theme, string> = { system: "Theme: match system", light: "Theme: light", dark: "Theme: dark" };
const EVENT = "themechange";

function read(): Theme {
  const t = document.documentElement.dataset.theme;
  return t === "light" || t === "dark" ? t : "system";
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const theme = useSyncExternalStore(subscribe, read, () => "system" as Theme);

  function next() {
    const t = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
    if (t === "system") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = t;
    try {
      if (t === "system") localStorage.removeItem("theme");
      else localStorage.setItem("theme", t);
    } catch {
      // Storage can be unavailable (private mode); the choice still applies for this visit.
    }
    window.dispatchEvent(new Event(EVENT));
  }

  const Icon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;
  return (
    <button
      type="button"
      onClick={next}
      aria-label={`${LABEL[theme]}. Click to change.`}
      title={LABEL[theme]}
      className={`rounded-full p-2 text-muted transition hover:bg-accent-soft hover:text-accent ${className}`}
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}
