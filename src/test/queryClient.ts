import { QueryClient } from "@tanstack/react-query";

/**
 * A QueryClient for tests that mount a QueryClientProvider.
 *
 * Both queries and mutations extend TanStack Query's Removable, whose
 * scheduleGc() sets a plain (never-unref'd) setTimeout — default gcTime:
 * 5 minutes — the moment a cache entry loses its last observer. React
 * Native Testing Library's afterEach unmounts the tree, which triggers
 * that timer for every query AND every mutation that ran, and since it's
 * never cleared, it keeps the Jest worker alive ("A worker process has
 * failed to exit gracefully" / "Jest did not exit one second after the
 * test run has completed"). Setting gcTime: 0 on both queries and
 * mutations makes cache entries garbage-collect on the next tick instead
 * of scheduling a real timer, so no test file using this helper can
 * reintroduce the leak — omitting either one leaves it half-fixed.
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        gcTime: 0,
      },
    },
  });
}
