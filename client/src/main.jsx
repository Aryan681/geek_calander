import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import "./styles.css";
import { App } from "./app/App";
const client = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60000, retry: 1, refetchOnWindowFocus: false },
  },
});
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
