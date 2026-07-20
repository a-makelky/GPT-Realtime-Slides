import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: {
    sourcemap: false,
    rollupOptions: {
      input: {
        presenter: resolve(import.meta.dirname, "index.html"),
        present: resolve(import.meta.dirname, "present.html"),
        slides: resolve(import.meta.dirname, "slides.html"),
      },
    },
  },
});
