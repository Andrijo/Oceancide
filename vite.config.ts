import { defineConfig } from "vite"
import path from "path"

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@core": path.resolve(__dirname, "src/core"),
      "@world": path.resolve(__dirname, "src/world"),
      "@entities": path.resolve(__dirname, "src/entities"),
      "@ui": path.resolve(__dirname, "src/ui"),
      "@cards": path.resolve(__dirname, "src/cards"),
      "@tycoon": path.resolve(__dirname, "src/tycoon"),
      "@events": path.resolve(__dirname, "src/events"),
      "@relics": path.resolve(__dirname, "src/relics"),
      "@drones": path.resolve(__dirname, "src/drones"),
      "@bosses": path.resolve(__dirname, "src/bosses"),
    },
  },
})
