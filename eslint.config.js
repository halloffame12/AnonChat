import globals from "globals";
import tseslint from "typescript-eslint";

export default [
  { files: ["**/*.{ts,tsx}"] },
  { ignores: ["dist/**", "node_modules/**", "server/**"] },
  { languageOptions: { globals: globals.browser } },
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
];
