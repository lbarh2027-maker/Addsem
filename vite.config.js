import { defineConfig } from "vite";

export default defineConfig({
  base: "/Addsem/",
  build: {
    rollupOptions: {
      output: {
        format: "iife",
        entryFileNames: "bundle.js",
      },
    },
  },
});
