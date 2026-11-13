import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Page from './page';

const { mockHealth } = vi.hoisted(() => ({
  mockHealth: {
    status: 'ok',
    services: {
      database: 'up',
      redis: 'up',
    },
    timestamp: '2026-01-01T00:00:00.000Z',
  },
}));

vi.mock('@/lib/api/health', () => ({
  getHealthStatus: vi.fn().mockResolvedValue(mockHealth),
}));

describe('Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the development environment heading and connection cards', async () => {
    render(<Page />);

    expect(screen.getByText('AI Car Sales Assistant & CRM Platform')).toBeInTheDocument();
    expect(screen.getByText('Development Environment')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getAllByText('Connected').length).toBeGreaterThan(0);
    });
  });
});
