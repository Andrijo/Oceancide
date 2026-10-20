import { defineConfig, mergeConfig } from "vitest/config"
import viteConfig from "./vite.config.ts"

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "node",
      include: ["src/**/*.test.ts"],
      coverage: {
        provider: "v8",
        reporter: ["text", "html"],
        // Fase 0: solo la lógica pura. Game/UI entrarán cuando se extraigan
        // sus sistemas en la fase 1.
        include: [
          "src/core/MetaState.ts",
          "src/core/rng.ts",
          "src/events/EventEffects.ts",
          "src/events/EventPool.ts",
          "src/cards/CardManager.ts",
          "src/tycoon/UpgradeManager.ts",
          "src/tycoon/Upgrades.ts",
        ],
        exclude: ["**/*.test.ts"],
        thresholds: {
          statements: 90,
          branches: 80,
          functions: 90,
          lines: 90,
        },
      },
    },
  }),
)
