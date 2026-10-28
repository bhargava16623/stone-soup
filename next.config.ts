import type { NextConfig } from "next";

// Pin the project root: a stray lockfile in the home folder otherwise confuses root detection.
const root = import.meta.dirname;

const nextConfig: NextConfig = {
  outputFileTracingRoot: root,
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    root,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
