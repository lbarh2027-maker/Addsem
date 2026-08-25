import { defineConfig } from "vite";

export default defineConfig({
  base: "/addsem/",
  build: {
    rollupOptions: {
      output: {
        format: "iife",
        entryFileNames: "bundle.js",
      },
    },
  },
});
