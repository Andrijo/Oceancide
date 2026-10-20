import js from "@eslint/js"
import prettier from "eslint-config-prettier"
import tseslint from "typescript-eslint"

export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**", "coverage/**"],
  },
  {
    files: ["**/*.ts"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    rules: {
      // TypeScript ya detecta imports y variables sin usar (noUnusedLocals).
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "error",
      eqeqeq: ["error", "smart"],
    },
  },
  {
    files: ["**/*.js", "**/*.mjs"],
    extends: [js.configs.recommended],
    languageOptions: {
      sourceType: "module",
    },
  },
  prettier,
)
