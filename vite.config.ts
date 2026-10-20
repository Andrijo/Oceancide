import { defineConfig } from "vite"
import path from "path"

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@core": path.resolve(import.meta.dirname, "src/core"),
      "@world": path.resolve(import.meta.dirname, "src/world"),
      "@entities": path.resolve(import.meta.dirname, "src/entities"),
      "@ui": path.resolve(import.meta.dirname, "src/ui"),
      "@cards": path.resolve(import.meta.dirname, "src/cards"),
      "@tycoon": path.resolve(import.meta.dirname, "src/tycoon"),
      "@events": path.resolve(import.meta.dirname, "src/events"),
    },
  },
})
