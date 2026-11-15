import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthMeResponse } from '@/lib/api/auth';
import { DealershipDashboard } from './dealership-dashboard';

const { mockApiRequest } = vi.hoisted(() => ({
  mockApiRequest: vi.fn(),
}));

vi.mock('@/lib/api/client', () => ({ apiRequest: mockApiRequest }));
vi.mock('@/components/health-dashboard', () => ({ HealthDashboard: () => null }));
vi.mock('@/components/logout-button', () => ({ LogoutButton: () => null }));

const session: AuthMeResponse = {
  user: {
    id: 'user-1',
    email: 'admin@example.test',
    firstName: 'Dealer',
    lastName: 'Admin',
  },
  csrfToken: 'csrf-token',
  memberships: [
    {
      id: 'membership-1',
      dealershipId: 'dealer-1',
      dealershipName: 'Northstar Motors',
      branchId: null,
      isPrimary: true,
      permissions: [
        'dealership.read',
        'dealership.update',
        'dealership.settings.update',
        'branches.read',
        'branches.manage',
      ],
      roles: [],
    },
  ],
};

const branch = {
  id: 'branch-1',
  name: 'Central',
  code: 'CENTRAL',
  addressLine1: null,
  city: 'Colombo',
  state: null,
  postalCode: null,
  country: null,
  status: 'ACTIVE',
};

describe('DealershipDashboard administration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiRequest.mockImplementation((path: string) => {
      if (path === '/dealerships/current') {
        return Promise.resolve({
          id: 'dealer-1',
          name: 'Northstar Motors',
          contactEmail: null,
          contactPhone: null,
          addressLine1: null,
          addressLine2: null,
          city: null,
          state: null,
          country: null,
          postalCode: null,
          openingHours: null,
        });
      }
      if (path === '/dealerships/current/settings') {
        return Promise.resolve({ timezone: 'UTC', currency: 'USD', brandingName: null });
      }
      if (path.startsWith('/branches?')) return Promise.resolve({ items: [branch] });
      return Promise.resolve({});
    });
  });

  it('saves the validated weekly opening-hours value through the dealership profile API', async () => {
    render(<DealershipDashboard session={session} />);
    fireEvent.click(screen.getByRole('button', { name: 'Dealership' }));

    const openingHoursField = await screen.findByRole('textbox', {
      name: 'Dealership opening hours',
    });
    const openingHours = {
      monday: [{ start: '09:00', end: '17:00' }],
    };
    fireEvent.change(openingHoursField, {
      target: { value: JSON.stringify(openingHours) },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));

    await waitFor(() => {
      expect(mockApiRequest).toHaveBeenCalledWith(
        '/dealerships/current',
        expect.objectContaining({
          method: 'PATCH',
          body: expect.stringContaining('"openingHours":{"monday":[{"start":"09:00","end":"17:00"}]}'),
        }),
      );
    });
  });

  it('updates branch contact details using the branch-scoped endpoint', async () => {
    render(<DealershipDashboard session={session} />);
    fireEvent.click(screen.getByRole('button', { name: 'Branches' }));
    await screen.findByText('Central');
    fireEvent.click(screen.getByText('Edit details'));
    fireEvent.change(screen.getAllByRole('textbox', { name: 'Name' })[1], {
      target: { value: 'Harbour' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save details' }));

    await waitFor(() => {
      expect(mockApiRequest).toHaveBeenCalledWith(
        '/branches/branch-1',
        expect.objectContaining({
          method: 'PATCH',
          body: expect.stringContaining('"name":"Harbour"'),
        }),
      );
    });
  });
});
