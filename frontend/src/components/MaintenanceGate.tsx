'use client';

import dynamic from 'next/dynamic';
import { useMaintenance } from '@/lib/maintenance';
import { useAuth } from '@/lib/store';

// Lazy-loaded: the maintenance page (and its animations) ship in a separate chunk
// that normal users never download.
const MaintenancePage = dynamic(() => import('./MaintenancePage'), { ssr: false });

/**
 * Single source of truth for route protection. Renders the maintenance page for
 * everyone EXCEPT admins while maintenance is on; otherwise renders the app.
 * No per-page logic needed — just wrap the tree once.
 */
export default function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const { loading, maintenanceMode } = useMaintenance();
  const user = useAuth((s) => s.user);

  // Render the app until we positively know maintenance is on (avoids any delay
  // in the common case). Admins always pass through.
  if (!loading && maintenanceMode && user?.role !== 'admin') {
    return <MaintenancePage />;
  }
  return <>{children}</>;
}
