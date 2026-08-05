import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initErrorMonitor } from "@/lib/errorMonitor";
import { installHttp402Interceptor } from "@/lib/http402";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { HelmetProvider } from "react-helmet-async";
import { adminSync } from "./lib/adminSync";
import { realtimeSync } from "./lib/realtimeSync";
import { reportWebVitals } from "./lib/performance";

initErrorMonitor();
installHttp402Interceptor();
adminSync.initialize();
realtimeSync.initialize();
reportWebVitals();

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <ErrorBoundary>
    <App />
  </ErrorBoundary>
  </HelmetProvider>,
);
