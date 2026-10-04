import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, HashRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
// Fonts are bundled with the app (no Google Fonts request), so it also works offline.
import "@fontsource/plus-jakarta-sans/latin-400.css";
import "@fontsource/plus-jakarta-sans/latin-500.css";
import "@fontsource/plus-jakarta-sans/latin-600.css";
import "@fontsource/plus-jakarta-sans/latin-700.css";
import "@fontsource/plus-jakarta-sans/latin-800.css";
import "@fontsource/noto-sans-armenian/armenian-400.css";
import "@fontsource/noto-sans-armenian/armenian-500.css";
import "@fontsource/noto-sans-armenian/armenian-600.css";
import "@fontsource/noto-sans-armenian/armenian-700.css";
import "@fontsource/noto-sans/cyrillic-400.css";
import "@fontsource/noto-sans/cyrillic-500.css";
import "@fontsource/noto-sans/cyrillic-600.css";
import "@fontsource/noto-sans/cyrillic-700.css";
import "@/presentation/i18n";
import "@/presentation/styles/index.css";
import App from "@/presentation/App";
import { AuthProvider } from "@/presentation/providers/auth";
import { ServicesProvider } from "@/presentation/providers/services";
import { createServices } from "@/composition-root";

// Composition root: build the application once and hand it to the UI.
const services = createServices();

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 } } });
// The single-file demo build is served from an arbitrary path, so it uses hash routing.
const Router = import.meta.env.MODE === "singlefile" ? HashRouter : BrowserRouter;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ServicesProvider services={services}>
      <QueryClientProvider client={queryClient}>
        <Router>
          <AuthProvider>
            <App />
            <Toaster position="top-center" richColors closeButton />
          </AuthProvider>
        </Router>
      </QueryClientProvider>
    </ServicesProvider>
  </React.StrictMode>,
);
