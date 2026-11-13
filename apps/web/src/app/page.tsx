import React from 'react';
import { HealthDashboard } from '@/components/health-dashboard';

export default function Page() {
  return (
    <main className="page-shell">
      <div className="page-card">
        <header className="hero">
          <p className="eyebrow">AI Car Sales Assistant & CRM Platform</p>
          <h1>Development Environment</h1>
        </header>

        <HealthDashboard />
      </div>
    </main>
  );
}
