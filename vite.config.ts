import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" && process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) => m.cartographer()),
          await import("@replit/vite-plugin-dev-banner").then((m) => m.devBanner()),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
    cssCodeSplit: true,
    target: "esnext",
    minify: "esbuild",
    // Assets larger than 10KB as separate files (not inlined)
    assetsInlineLimit: 10240,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // React core - smallest first-load bundle
          if (id.includes("node_modules/react/") || id.includes("node_modules/react-dom/")) {
            return "vendor-react";
          }
          // Routing + data fetching
          if (id.includes("node_modules/wouter") || id.includes("node_modules/@tanstack/react-query")) {
            return "vendor-routing";
          }
          // Animation library - hefty, load separately
          if (id.includes("node_modules/framer-motion")) {
            return "vendor-motion";
          }
          // Icons
          if (id.includes("node_modules/lucide-react")) {
            return "vendor-icons";
          }
          // Radix UI components
          if (id.includes("node_modules/@radix-ui")) {
            return "vendor-radix";
          }
          // Charts library - only needed on profile page
          if (id.includes("node_modules/recharts") || id.includes("node_modules/d3-")) {
            return "vendor-charts";
          }
          // Socket.io
          if (id.includes("node_modules/socket.io-client")) {
            return "vendor-socket";
          }
          // Everything else in node_modules
          if (id.includes("node_modules")) {
            return "vendor-misc";
          }
        },
      },
    },
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
