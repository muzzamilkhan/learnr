import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Agent worktrees: a whole second checkout of this repo lives under here, so
    // without it `eslint .` reports another branch's code as this one's.
    ".claude/**",
    // Generated output: the Prisma client, and any build directory - thousands
    // of lines nobody wrote and nobody should lint.
    "**/dist/**",
    "**/src/generated/**",
  ]),
]);

export default eslintConfig;
