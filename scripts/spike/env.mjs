// Minimal .env loader so the spikes run on any Node version without dependencies.
import { readFileSync } from "node:fs";

try {
  for (const line of readFileSync(new URL("../../.env", import.meta.url), "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*([^#]*?)\s*(#.*)?$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {
  console.error("No .env found — copy .env.example to .env and fill it in.");
  process.exit(1);
}

export function need(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing ${name} in .env`);
    process.exit(1);
  }
  return v;
}
