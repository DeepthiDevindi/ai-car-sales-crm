'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { HealthDashboard } from '@/components/health-dashboard';
import { LogoutButton } from '@/components/logout-button';
import { apiRequest } from '@/lib/api/client';
import type { AuthMeResponse } from '@/lib/api/auth';

type Branch = {
  id: string;
  name: string;
  code: string;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  status: 'ACTIVE' | 'INACTIVE';
};

type StaffMember = {
  membershipId: string;
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  membershipStatus: 'ACTIVE' | 'INACTIVE' | 'INVITED';
  branchId: string | null;
  availability: Record<string, Array<{ start: string; end: string }>> | null;
  roles: Array<{ id: string; key: string; name: string }>;
};

type Dealership = {
  id: string;
  name: string;
  contactEmail: string | null;
  contactPhone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;
  openingHours: Record<string, Array<{ start: string; end: string }>> | null;
};

type Role = {
  id: string;
  key: string;
  name: string;
  requiresMfa: boolean;
  permissions: Array<{ permission: { key: string; name: string } }>;
};

type Invitation = {
  id: string;
  email: string;
  status: 'PENDING' | 'EXPIRED' | 'ACCEPTED' | 'REVOKED';
  expiresAt: string;
  role: { id: string; key: string; name: string };
};

type DashboardTab = 'overview' | 'dealership' | 'branches' | 'employees' | 'invitations' | 'roles';
type LeadImpact = { id: string; title: string; status: string };

function getAffectedLeads(value: unknown): LeadImpact[] {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('affectedActiveLeads' in value) ||
    !Array.isArray(value.affectedActiveLeads)
  ) {
    return [];
  }
  return value.affectedActiveLeads.filter(
    (lead): lead is LeadImpact =>
      typeof lead === 'object' &&
      lead !== null &&
      'id' in lead &&
      typeof lead.id === 'string' &&
      'title' in lead &&
      typeof lead.title === 'string' &&
      'status' in lead &&
      typeof lead.status === 'string',
  );
}

export function DealershipDashboard({ session }: { session: AuthMeResponse }) {
  const membership =
    session.memberships.find((item) => item.isPrimary) ?? session.memberships[0];
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [dealership, setDealership] = useState<Dealership | null>(null);
  const [settings, setSettings] = useState<{ timezone: string; currency: string; brandingName: string | null } | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<Record<string, string>>({});
  const [selectedBranches, setSelectedBranches] = useState<Record<string, string>>({});
  const [affectedLeads, setAffectedLeads] = useState<LeadImpact[]>([]);

  const permissions = useMemo(
    () => new Set(membership.permissions),
    [membership.permissions],
  );
  const can = useCallback((permission: string) => permissions.has(permission), [permissions]);

  const request = useCallback(
    <T,>(path: string, init?: RequestInit) => {
      const headers = new Headers(init?.headers ?? {});
      if (init?.method && init.method !== 'GET') {
        headers.set('x-csrf-token', session.csrfToken);
      }
      return apiRequest<T>(path, { ...init, headers });
    },
    [session.csrfToken],
  );

  const refresh = useCallback(async () => {
    const jobs: Promise<void>[] = [];
    if (can('dealership.read')) {
      jobs.push(
        request<Dealership>('/dealerships/current').then(setDealership),
        request<typeof settings>('/dealerships/current/settings').then(setSettings),
      );
    }
    if (can('branches.read')) {
      jobs.push(
        request<{ items: Branch[] }>('/branches?page=1&pageSize=100').then(({ items }) =>
          setBranches(items),
        ),
      );
    }
    if (can('staff.read')) {
      jobs.push(
        request<{ items: StaffMember[] }>('/users/staff?page=1&pageSize=100').then(
          ({ items }) => setStaff(items),
        ),
      );
    }
    if (can('roles.read')) {
      jobs.push(request<Role[]>('/users/roles').then(setRoles));
    }
    if (can('invitations.read')) {
      jobs.push(request<Invitation[]>('/users/staff/invitations').then(setInvitations));
    }
    try {
      await Promise.all(jobs);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Dashboard data could not be loaded.');
    }
  }, [can, request]);

  useEffect(() => {
    async function loadDashboard() {
      await refresh();
    }

    void loadDashboard();
  }, [refresh]);

  async function submit(
    event: FormEvent<HTMLFormElement>,
    path: string,
    method: 'POST' | 'PATCH' | 'PUT',
    body: unknown,
    successMessage: string,
  ): Promise<boolean> {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      await request(path, { method, body: JSON.stringify(body) });
      setNotice(successMessage);
      await refresh();
      return true;
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'The change could not be saved.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function runAction(action: () => Promise<unknown>, successMessage: string) {
    setBusy(true);
    setNotice(null);
    setError(null);
    setAffectedLeads([]);
    try {
      const result = await action();
      setAffectedLeads(getAffectedLeads(result));
      setNotice(successMessage);
      await refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'The action could not be completed.');
    } finally {
      setBusy(false);
    }
  }

  const displayName =
    [session.user.firstName, session.user.lastName].filter(Boolean).join(' ') ||
    session.user.email;

  return (
    <main className="page-shell dashboard-shell">
      <div className="page-card dashboard-card">
        <header className="hero dashboard-hero">
          <div>
            <p className="eyebrow">AI Car Sales Assistant &amp; CRM Platform</p>
            <h1>{membership.dealershipName}</h1>
            <p className="signed-in">Signed in as {displayName}</p>
          </div>
          <LogoutButton csrfToken={session.csrfToken} />
        </header>

        <nav className="dashboard-nav" aria-label="Dealership administration">
          {([
            ['overview', 'Overview', true],
            ['dealership', 'Dealership', can('dealership.read')],
            ['branches', 'Branches', can('branches.read')],
            ['employees', 'Employees', can('staff.read')],
            ['invitations', 'Invitations', can('invitations.read')],
            ['roles', 'Roles', can('roles.read')],
          ] as const)
            .filter(([, , visible]) => visible)
            .map(([tab, label]) => (
              <button
                key={tab}
                type="button"
                className={activeTab === tab ? 'dashboard-tab active' : 'dashboard-tab'}
                aria-current={activeTab === tab ? 'page' : undefined}
                onClick={() => setActiveTab(tab)}
              >
                {label}
              </button>
            ))}
        </nav>

        {notice ? <p className="dashboard-notice" role="status">{notice}</p> : null}
        {error ? <p className="dashboard-error" role="alert">{error}</p> : null}
        {affectedLeads.length > 0 ? (
          <section className="dashboard-error" aria-label="Active lead assignment review">
            <strong>These active lead assignments need an administrator&apos;s reassignment decision.</strong>
            <ul>{affectedLeads.map((lead) => <li key={lead.id}>{lead.title} ({lead.status})</li>)}</ul>
          </section>
        ) : null}

        {activeTab === 'overview' ? (
          <section className="dashboard-section">
            <div className="dashboard-summary">
              <article><span>Branches</span><strong>{branches.length}</strong></article>
              <article><span>Employees</span><strong>{staff.length}</strong></article>
              <article><span>Pending invitations</span><strong>{invitations.filter(({ status }) => status === 'PENDING').length}</strong></article>
            </div>
            <HealthDashboard />
          </section>
        ) : null}

        {activeTab === 'dealership' && dealership ? (
          <section className="dashboard-section">
            <h2>Dealership profile</h2>
            {can('dealership.update') ? (
              <form className="admin-form" onSubmit={(event) => {
                const form = new FormData(event.currentTarget);
                let openingHours: unknown;
                const openingHoursText = form.get('openingHours');
                try {
                  openingHours =
                    typeof openingHoursText === 'string' && openingHoursText.trim()
                      ? JSON.parse(openingHoursText)
                      : null;
                } catch {
                  event.preventDefault();
                  setError('Opening hours must be valid JSON using weekday keys and HH:mm time ranges.');
                  return;
                }
                void submit(event, '/dealerships/current', 'PATCH', {
                  name: form.get('name'),
                  contactEmail: form.get('contactEmail') || null,
                  contactPhone: form.get('contactPhone') || null,
                  addressLine1: form.get('addressLine1') || null,
                  addressLine2: form.get('addressLine2') || null,
                  city: form.get('city') || null,
                  state: form.get('state') || null,
                  country: form.get('country') || null,
                  postalCode: form.get('postalCode') || null,
                  openingHours,
                }, 'Dealership profile saved.');
              }}>
                <label>Dealership name<input name="name" defaultValue={dealership.name} required /></label>
                <label>Contact email<input name="contactEmail" type="email" defaultValue={dealership.contactEmail ?? ''} /></label>
                <label>Contact phone<input name="contactPhone" defaultValue={dealership.contactPhone ?? ''} /></label>
                <label>Address line 1<input name="addressLine1" defaultValue={dealership.addressLine1 ?? ''} /></label>
                <label>Address line 2<input name="addressLine2" defaultValue={dealership.addressLine2 ?? ''} /></label>
                <label>City<input name="city" defaultValue={dealership.city ?? ''} /></label>
                <label>State / province<input name="state" defaultValue={dealership.state ?? ''} /></label>
                <label>Country<input name="country" defaultValue={dealership.country ?? ''} /></label>
                <label>Postal code<input name="postalCode" defaultValue={dealership.postalCode ?? ''} /></label>
                <label className="wide-field">Opening hours (weekly schedule JSON)
                  <textarea
                    name="openingHours"
                    rows={6}
                    defaultValue={JSON.stringify(dealership.openingHours ?? {}, null, 2)}
                    aria-label="Dealership opening hours"
                  />
                </label>
                <small className="wide-field">Use weekday keys and non-overlapping local HH:mm ranges. Use an empty object when closed all week.</small>
                <button className="primary-button" disabled={busy}>Save profile</button>
              </form>
            ) : (
              <p>{dealership.contactEmail ?? 'No contact email provided'}</p>
            )}
            {can('dealership.settings.update') ? (
              <>
                <h2>Regional settings</h2>
                <form className="admin-form" onSubmit={(event) => {
                  const form = new FormData(event.currentTarget);
                  void submit(event, '/dealerships/current/settings', 'PATCH', {
                    timezone: form.get('timezone'),
                    currency: form.get('currency'),
                    brandingName: form.get('brandingName') || null,
                  }, 'Regional settings saved.');
                }}>
                  <label>Timezone<input name="timezone" defaultValue={settings?.timezone ?? 'UTC'} required /></label>
                  <label>Currency<input name="currency" defaultValue={settings?.currency ?? 'USD'} maxLength={3} required /></label>
                  <label>Branding name<input name="brandingName" defaultValue={settings?.brandingName ?? ''} /></label>
                  <button className="primary-button" disabled={busy}>Save settings</button>
                </form>
              </>
            ) : null}
          </section>
        ) : null}

        {activeTab === 'branches' ? (
          <section className="dashboard-section">
            <div className="section-title"><h2>Branches</h2><span>{branches.length} total</span></div>
            {can('branches.manage') ? (
              <form className="admin-form compact-form" onSubmit={(event) => {
                const form = new FormData(event.currentTarget);
                const currentForm = event.currentTarget;
                void submit(event, '/branches', 'POST', {
                  name: form.get('name'),
                  code: form.get('code'),
                  addressLine1: form.get('addressLine1') || null,
                  city: form.get('city') || null,
                  state: form.get('state') || null,
                  postalCode: form.get('postalCode') || null,
                  country: form.get('country') || null,
                }, 'Branch created.').then((saved) => {
                  if (saved) currentForm.reset();
                });
              }}>
                <label>Name<input name="name" required maxLength={160} /></label>
                <label>Code<input name="code" required maxLength={32} /></label>
                <label>Address<input name="addressLine1" maxLength={200} /></label>
                <label>City<input name="city" maxLength={120} /></label>
                <label>State / province<input name="state" maxLength={120} /></label>
                <label>Postal code<input name="postalCode" maxLength={32} /></label>
                <label>Country<input name="country" maxLength={120} /></label>
                <button className="primary-button" disabled={busy}>Add branch</button>
              </form>
            ) : null}
            <div className="table-wrap">
              <table><thead><tr><th>Name</th><th>Code</th><th>Address</th><th>City</th><th>Status</th>{can('branches.manage') ? <th>Actions</th> : null}</tr></thead>
                <tbody>{branches.map((branch) => <tr key={branch.id}>
                  <td>{branch.name}</td><td>{branch.code}</td><td>{branch.addressLine1 ?? '—'}</td><td>{branch.city ?? '—'}</td><td>{branch.status}</td>
                  {can('branches.manage') ? <td className="table-actions">
                    <details>
                      <summary>Edit details</summary>
                      <form className="admin-form compact-form" onSubmit={(event) => {
                        const form = new FormData(event.currentTarget);
                        void submit(event, `/branches/${branch.id}`, 'PATCH', {
                          name: form.get('name'),
                          code: form.get('code'),
                          addressLine1: form.get('addressLine1') || null,
                          city: form.get('city') || null,
                          state: form.get('state') || null,
                          postalCode: form.get('postalCode') || null,
                          country: form.get('country') || null,
                        }, 'Branch details saved.');
                      }}>
                        <label>Name<input name="name" defaultValue={branch.name} required maxLength={160} /></label>
                        <label>Code<input name="code" defaultValue={branch.code} required maxLength={32} /></label>
                        <label>Address<input name="addressLine1" defaultValue={branch.addressLine1 ?? ''} maxLength={200} /></label>
                        <label>City<input name="city" defaultValue={branch.city ?? ''} maxLength={120} /></label>
                        <label>State / province<input name="state" defaultValue={branch.state ?? ''} maxLength={120} /></label>
                        <label>Postal code<input name="postalCode" defaultValue={branch.postalCode ?? ''} maxLength={32} /></label>
                        <label>Country<input name="country" defaultValue={branch.country ?? ''} maxLength={120} /></label>
                        <button className="table-action" disabled={busy}>Save details</button>
                      </form>
                    </details>
                    <button className="table-action" disabled={busy} onClick={() => void runAction(
                      () => request(`/branches/${branch.id}`, { method: 'PATCH', body: JSON.stringify({ status: branch.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' }) }),
                      'Branch status updated.',
                    )}>{branch.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}</button>
                  </td> : null}
                </tr>)}</tbody>
              </table>
            </div>
          </section>
        ) : null}

        {activeTab === 'employees' ? (
          <section className="dashboard-section">
            <div className="section-title"><h2>Employees</h2><span>{staff.length} total</span></div>
            {can('staff.invite') ? (
              <form className="admin-form compact-form" onSubmit={(event) => {
                const form = new FormData(event.currentTarget);
                const currentForm = event.currentTarget;
                void submit(event, '/users/staff/invitations', 'POST', {
                  email: form.get('email'),
                  roleId: form.get('roleId'),
                  branchId: form.get('branchId') || undefined,
                }, 'Invitation created. Email delivery is not configured in this environment.').then((saved) => {
                  if (saved) currentForm.reset();
                });
              }}>
                <label>Email<input name="email" type="email" required /></label>
                <label>Role<select name="roleId" required defaultValue=""><option value="" disabled>Select role</option>{roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label>
                <label>Branch<select name="branchId" defaultValue=""><option value="">No branch</option>{branches.filter(({ status }) => status === 'ACTIVE').map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
                <button className="primary-button" disabled={busy}>Invite employee</button>
              </form>
            ) : null}
            <div className="table-wrap">
              <table><thead><tr><th>Employee</th><th>Email</th><th>Role</th><th>Branch</th><th>Status</th><th>Availability</th>{can('staff.assign_roles') ? <th>Role assignment</th> : null}{can('staff.manage') ? <><th>Branch assignment</th><th>Action</th></> : null}</tr></thead>
                <tbody>{staff.map((employee) => <tr key={employee.membershipId}>
                  <td>{[employee.firstName, employee.lastName].filter(Boolean).join(' ') || '—'}</td>
                  <td>{employee.email}</td>
                  <td>{employee.roles.map(({ name }) => name).join(', ') || '—'}</td>
                  <td>{branches.find(({ id }) => id === employee.branchId)?.name ?? 'Unassigned'}</td>
                  <td>{employee.membershipStatus}</td>
                  <td>{can('staff.manage') ? (
                    <details>
                      <summary>{employee.availability ? 'Edit schedule' : 'Set schedule'}</summary>
                      <form className="availability-form" onSubmit={(event) => {
                        const raw = new FormData(event.currentTarget).get('availability');
                        let availability: unknown;
                        try {
                          availability = typeof raw === 'string' && raw.trim() ? JSON.parse(raw) : null;
                        } catch {
                          event.preventDefault();
                          setError('Availability must be valid JSON using weekday keys and HH:mm time ranges.');
                          return;
                        }
                        void submit(event, `/users/staff/${employee.membershipId}`, 'PATCH', { availability }, 'Employee availability saved.');
                      }}>
                        <label>Weekly availability (JSON)
                          <textarea
                            name="availability"
                            rows={5}
                            defaultValue={JSON.stringify(employee.availability ?? {}, null, 2)}
                            aria-label={`Weekly availability for ${employee.email}`}
                          />
                        </label>
                        <small>Use weekday keys and non-overlapping local HH:mm ranges.</small>
                        <button className="table-action" disabled={busy}>Save schedule</button>
                      </form>
                    </details>
                  ) : employee.availability ? JSON.stringify(employee.availability) : 'Not set'}</td>
                  {can('staff.assign_roles') ? <td>
                    <select
                      aria-label={`Role for ${employee.email}`}
                      value={selectedRoles[employee.membershipId] ?? employee.roles[0]?.id ?? ''}
                      onChange={(event) => setSelectedRoles((current) => ({ ...current, [employee.membershipId]: event.target.value }))}
                    >
                      {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
                    </select>
                    <button className="table-action" disabled={busy || !roles.length || (
                      employee.userId === session.user.id &&
                      roles.find(({ id }) => id === (selectedRoles[employee.membershipId] ?? employee.roles[0]?.id))?.requiresMfa === true
                    )} onClick={() => {
                      const roleId = selectedRoles[employee.membershipId] ?? employee.roles[0]?.id;
                      if (roleId) void runAction(
                        () => request(`/users/staff/${employee.membershipId}/roles`, { method: 'PUT', body: JSON.stringify({ roleId }) }),
                        'Employee role updated. Their active sessions were revoked.',
                      );
                    }}>Save role</button>
                  </td> : null}
                  {can('staff.manage') ? <td>
                    <select
                      aria-label={`Branch for ${employee.email}`}
                      value={selectedBranches[employee.membershipId] ?? employee.branchId ?? ''}
                      onChange={(event) => setSelectedBranches((current) => ({ ...current, [employee.membershipId]: event.target.value }))}
                    >
                      <option value="">No branch</option>
                      {branches.filter(({ status }) => status === 'ACTIVE').map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                    </select>
                    <button className="table-action" disabled={busy} onClick={() => void runAction(
                      () => request(`/users/staff/${employee.membershipId}/branch`, {
                        method: 'PATCH',
                        body: JSON.stringify({ branchId: selectedBranches[employee.membershipId] ?? employee.branchId ?? null }),
                      }),
                      'Employee branch assignment updated. Their active sessions were revoked.',
                    )}>Save branch</button>
                  </td> : null}
                  {can('staff.manage') ? <td>
                    {employee.membershipStatus === 'ACTIVE' ? (
                      <button className="table-action danger-action" disabled={busy} onClick={() => void runAction(
                        () => request(`/users/staff/${employee.membershipId}/deactivate`, { method: 'PATCH' }),
                        'Employee deactivated. Review any active lead assignments before reassigning them.',
                      )}>Deactivate</button>
                    ) : (
                      <button className="table-action" disabled={busy} onClick={() => void runAction(
                        () => request(`/users/staff/${employee.membershipId}/activate`, { method: 'PATCH' }),
                        'Employee activated.',
                      )}>Activate</button>
                    )}
                  </td> : null}
                </tr>)}</tbody>
              </table>
            </div>
          </section>
        ) : null}

        {activeTab === 'invitations' ? (
          <section className="dashboard-section">
            <h2>Invitations</h2>
            <div className="table-wrap">
              <table><thead><tr><th>Email</th><th>Role</th><th>Status</th><th>Expires</th>{can('invitations.manage') ? <th>Actions</th> : null}</tr></thead>
                <tbody>{invitations.map((invitation) => <tr key={invitation.id}>
                  <td>{invitation.email}</td><td>{invitation.role.name}</td><td>{invitation.status}</td><td>{new Date(invitation.expiresAt).toLocaleDateString()}</td>
                  {can('invitations.manage') ? <td className="table-actions">
                    {invitation.status === 'PENDING' || invitation.status === 'EXPIRED' ? <button className="table-action" disabled={busy} onClick={() => void runAction(
                      () => request(`/users/staff/invitations/${invitation.id}/resend`, { method: 'POST' }),
                      'Invitation resend requested. Email delivery is not configured in this environment.',
                    )}>Resend</button> : null}
                    {invitation.status === 'PENDING' ? <button className="table-action danger-action" disabled={busy} onClick={() => void runAction(
                      () => request(`/users/staff/invitations/${invitation.id}/revoke`, { method: 'PATCH' }),
                      'Invitation revoked.',
                    )}>Revoke</button> : null}
                  </td> : null}
                </tr>)}</tbody>
              </table>
            </div>
          </section>
        ) : null}

        {activeTab === 'roles' ? (
          <section className="dashboard-section">
            <h2>Dealership roles</h2>
            <div className="role-grid">{roles.map((role) => (
              <article className="role-card" key={role.id}>
                <div><h3>{role.name}</h3>{role.requiresMfa ? <span className="pill neutral">MFA required</span> : null}</div>
                <p>{role.key}</p>
                <ul>{role.permissions.map(({ permission }) => <li key={permission.key}>{permission.name}</li>)}</ul>
              </article>
            ))}</div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
