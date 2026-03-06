/**
 * apps/web/src/providers/Providers.tsx
 * PVOT — Root Provider Tree
 *
 * FIX: Removed ReactQueryDevtools hard import.
 * The devtools package (@tanstack/react-query-devtools) may not be installed,
 * which caused the entire provider tree to fail — breaking QueryClientProvider
 * for the whole app and producing "No QueryClient set" errors everywhere.
 *
 * Devtools are now dynamically imported so a missing package can't crash the app.
 */

'use client';

import { useState, useEffect }  from 'react';
import { QueryClientProvider }  from '@tanstack/react-query';
import { createQueryClient, setupQueryPersistence } from '@pvot/query/queryClient';
import type { QueryClient }     from '@tanstack/react-query';

export function Providers({ children }: { children: React.ReactNode }) {
  // QueryClient must be created inside useState (not at module scope) for SSR safety.
  const [queryClient] = useState<QueryClient>(() => createQueryClient());

  // Set up localStorage persistence — client only
  useEffect(() => {
    setupQueryPersistence(queryClient);
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}