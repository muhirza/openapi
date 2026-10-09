'use client';

import { DashboardShell } from '../../../components/DashboardShell';
import { CredentialForm } from '../../../components/CredentialForm';

export default function ConfigPage() {
  return (
    <DashboardShell>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">API Configuration</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage credentials for all provider APIs. Each service requires its own
            API ID and Secret issued by your provider.
          </p>
        </div>
        <CredentialForm />
      </div>
    </DashboardShell>
  );
}