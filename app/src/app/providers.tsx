"use client";

import { ReactNode, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  ThemeProvider,
  ToastProvider,
  IconProvider,
  LayoutProvider,
  Toaster,
  useToast,
} from "@once-ui-system/core";

function ToasterMount() {
  const { toasts, removeToast } = useToast();
  return <Toaster toasts={toasts} removeToast={removeToast} />;
}

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <ThemeProvider theme="dark" brand="violet" accent="cyan">
      <LayoutProvider>
        <IconProvider>
          <ToastProvider>
            <QueryClientProvider client={client}>
              {children}
              <ToasterMount />
            </QueryClientProvider>
          </ToastProvider>
        </IconProvider>
      </LayoutProvider>
    </ThemeProvider>
  );
}
