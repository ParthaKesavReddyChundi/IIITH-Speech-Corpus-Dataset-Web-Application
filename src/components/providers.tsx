"use client";

/**
 * Providers — wraps the entire app in required context providers.
 *
 * Included:
 * - QueryClientProvider (React Query) for data fetching/caching
 * - Sentry error boundary for client-side error capture
 *
 * Design decision: Sentry DSN is optional (can be blank in .env.local
 * for local development) — this keeps local dev noise-free.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  // Create a stable QueryClient instance per component tree
  // (singleton pattern for client-side, fresh per SSR request)
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Sentence lists and other static data: cache for 5 minutes
            staleTime: 5 * 60 * 1000,
            // Retry 2 times on network failure before surfacing error
            retry: 2,
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30_000),
          },
          mutations: {
            retry: 0, // Mutations (uploads, submissions) must not auto-retry without explicit user action
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
