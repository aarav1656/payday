import path from "node:path";
import type { NextConfig } from "next";

// The server modules live one level up in ../src and use Node 24 native .ts imports.
// Turbopack only resolves inside its root, so the root is the repo, not web/.
const repoRoot = path.join(import.meta.dirname, "..");

const nextConfig: NextConfig = {
  // Vercel traces server files from the repo root so ../src and the root package.json ("type":"module") ship with the functions.
  outputFileTracingRoot: repoRoot,
  outputFileTracingIncludes: {
    "/**/*": ["../src/**/*", "../package.json"],
  },
  turbopack: {
    root: repoRoot,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
