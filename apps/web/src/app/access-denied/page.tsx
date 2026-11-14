import Link from 'next/link';

export default function AccessDeniedPage() {
  return (
    <main className="page-shell">
      <section className="auth-card">
        <p className="eyebrow">AI Car Sales Assistant & CRM Platform</p>
        <h1>Dealership access required</h1>
        <p>Your account does not currently have an active dealership membership.</p>
        <p className="auth-links"><Link href="/login">Return to sign in</Link></p>
      </section>
    </main>
  );
}
