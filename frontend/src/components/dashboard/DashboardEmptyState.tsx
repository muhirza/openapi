import { ReactNode } from 'react';

interface DashboardEmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function DashboardEmptyState({
  title,
  description,
  action,
}: DashboardEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      <p className="text-sm font-semibold text-ink-2">{title}</p>
      {description && (
        <p className="max-w-md text-sm text-ink-3">{description}</p>
      )}
      {action}
    </div>
  );
}
