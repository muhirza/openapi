import { ReactNode } from 'react';

interface DashboardCardProps {
  children: ReactNode;
  className?: string;
}

export function DashboardCard({
  children,
  className = '',
}: DashboardCardProps) {
  return (
    <section
      className={`bg-surface rounded-surface border border-line ${className}`}
    >
      {children}
    </section>
  );
}
