'use client';

import { DashboardShell } from '../../components/DashboardShell';
import { DashboardOverview } from '../../components/dashboard/DashboardOverview';

export default function HomePage() {
  return (
    <DashboardShell>
      <DashboardOverview />
    </DashboardShell>
  );
}
