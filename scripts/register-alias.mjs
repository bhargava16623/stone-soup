// Usage: node --import ./scripts/register-alias.mjs <script.ts>
import { register } from "node:module";

register("./alias-hooks.mjs", import.meta.url);
