/**
 * apps/web/src/app/page.tsx
 * PVOT — Root redirect
 *
 * Immediately redirects to the dashboard.
 * Auth middleware (middleware.ts) handles unauthenticated redirects to /login.
 */

import { redirect } from 'next/navigation';

export default function RootPage() {
  redirect('/dashboard');
}
