'use client';

import React, { useEffect, useState } from 'react';
import type { HealthResponse } from '@ai-car-sales-crm/shared-types';
import { getHealthStatus } from '@/lib/api/health';

function getStatusTone(value: 'up' | 'down' | 'error' | 'loading' | 'unknown') {
  switch (value) {
    case 'up':
      return 'good';
    case 'down':
    case 'error':
      return 'bad';
    case 'loading':
    default:
      return 'neutral';
  }
}

export function HealthDashboard() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadHealth() {
      try {
        setLoading(true);
        const response = await getHealthStatus();
        if (!controller.signal.aborted) {
          setHealth(response);
          setError(null);
        }
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(loadError instanceof Error ? loadError.message : 'Backend connection failed.');
          setHealth(null);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadHealth();
    return () => controller.abort();
  }, []);

  const apiStatus = health?.status === 'ok' ? 'Connected' : loading ? 'Loading' : error ? 'Disconnected' : 'Disconnected';
  const databaseStatus = health?.services.database ?? 'down';
  const redisStatus = health?.services.redis ?? 'down';

  return (
    <section className="status-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Development environment</p>
          <h2>Connection status</h2>
        </div>
        {loading ? (
          <span className={`pill neutral`}>Loading</span>
        ) : (
          <span className={`pill ${getStatusTone(health?.status === 'ok' ? 'up' : 'error')}`}>
            {apiStatus}
          </span>
        )}
      </div>

      <div className="service-grid">
        <article className="service-card">
          <div className="service-head">
            <span>Backend API</span>
            <span className={`dot ${health?.status === 'ok' ? 'good' : loading ? 'neutral' : 'bad'}`} />
          </div>
          <strong>{loading ? 'Checking…' : health?.status === 'ok' ? 'Connected' : 'Unavailable'}</strong>
        </article>

        <article className="service-card">
          <div className="service-head">
            <span>PostgreSQL</span>
            <span className={`dot ${databaseStatus === 'up' ? 'good' : 'bad'}`} />
          </div>
          <strong>{databaseStatus === 'up' ? 'Connected' : 'Unavailable'}</strong>
        </article>

        <article className="service-card">
          <div className="service-head">
            <span>Redis</span>
            <span className={`dot ${redisStatus === 'up' ? 'good' : 'bad'}`} />
          </div>
          <strong>{redisStatus === 'up' ? 'Connected' : 'Unavailable'}</strong>
        </article>
      </div>

      <div className="status-details">
        {error ? (
          <div className="error-box">
            <strong>Connection error</strong>
            <p>{error}</p>
          </div>
        ) : health ? (
          <div className="success-box">
            <strong>Health check response</strong>
            <pre>{JSON.stringify(health, null, 2)}</pre>
          </div>
        ) : (
          <div className="neutral-box">
            <strong>Waiting for backend</strong>
            <p>The platform is polling the API health endpoint.</p>
          </div>
        )}
      </div>

      {!loading && error ? (
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="retry-button"
        >
          Retry connection
        </button>
      ) : null}
    </section>
  );
}
