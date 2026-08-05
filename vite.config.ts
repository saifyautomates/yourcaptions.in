import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

/**
 * Recommended HTTP security headers. Applied by Vite's dev + preview servers
 * and mirrored as <meta> tags in index.html so the same policy applies when
 * the app is served by static hosts that don't set custom headers.
 *
 * Verified by scripts/verify-security-headers.mjs — keep the CSP directives
 * here in sync with that script and index.html.
 */
const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.gpteng.co https://checkout.razorpay.com https://*.razorpay.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com https://cdn.gpteng.co",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: https:",
    "connect-src 'self' blob: https://*.supabase.co wss://*.supabase.co https://api.razorpay.com https://lumberjack.razorpay.com https://fonts.googleapis.com https://fonts.gstatic.com",
    "frame-src 'self' https://*.razorpay.com https://checkout.razorpay.com https://www.youtube.com https://www.youtube-nocookie.com",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join("; "),
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy":
    "camera=(self), microphone=(self), geolocation=(), payment=(self), fullscreen=(self), autoplay=(self)",
  "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
  "Cross-Origin-Resource-Policy": "cross-origin",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
};

const securityHeadersPlugin = (): PluginOption => ({
  name: "security-headers",
  configureServer(server) {
    server.middlewares.use((_req, res, next) => {
      for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);
      next();
    });
  },
  configurePreviewServer(server) {
    server.middlewares.use((_req, res, next) => {
      for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);
      next();
    });
  },
});

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "0.0.0.0",
    port: 3000,
    allowedHosts: "all",
  },
  plugins: [
    react(),
    securityHeadersPlugin(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  build: {
    target: "es2020",
    cssCodeSplit: true,
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          // Only place the actual React packages in the React chunk.
          // The previous broad substring check also caught packages like
          // @floating-ui/react-dom, which made the React chunk import the
          // vendor chunk while vendor imported React. In production this
          // circular chunk graph could evaluate vendor first and crash with
          // `Cannot read properties of undefined (reading 'createContext')`,
          // leaving the hosted preview as a black screen.
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return "react";
          if (id.includes("react-router")) return "router";
          if (id.includes("@radix-ui")) return "radix";
          if (id.includes("framer-motion")) return "motion";
          if (id.includes("@supabase")) return "supabase";
          if (id.includes("@tanstack")) return "query";
          if (id.includes("lucide-react")) return "icons";
          if (id.includes("recharts") || id.includes("d3-") || id.includes("victory-vendor")) return "charts";
          if (id.includes("react-hook-form") || id.includes("@hookform")) return "forms";
          if (id.includes("/zod/")) return "zod";
          if (id.includes("date-fns")) return "date-fns";
          if (id.includes("dompurify") || id.includes("marked")) return "sanitize";
          if (id.includes("sonner") || id.includes("cmdk") || id.includes("vaul") || id.includes("embla")) return "ui-extras";
          // Heavy media/export deps — kept out of the initial vendor chunk so
          // they only ship when the user opens Export / Quick Export.
          if (id.includes("mp4box") || id.includes("@ffmpeg") || id.includes("mp4-muxer") || id.includes("webm-muxer")) return "export-media";
          return "vendor";
        },
      },
    },
  },
}));
