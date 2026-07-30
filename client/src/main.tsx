import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App";
import { AppErrorBoundary } from "@/components/layout/error-boundary";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <AppErrorBoundary scope="root">
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </AppErrorBoundary>
);
