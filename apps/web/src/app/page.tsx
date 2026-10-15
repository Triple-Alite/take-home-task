'use client';

import { FormEvent, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, User } from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase';
import { apiRequest, SessionProfile } from '@/lib/api';
import { Workspace } from '@/components/Workspace';

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<SessionProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const auth = getFirebaseAuth();

  useEffect(() => {
    if (!auth) { setLoading(false); return; }
    return onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setProfile(null);
      if (!currentUser) { setLoading(false); return; }
      setLoading(true);
      try {
        const session = await apiRequest<SessionProfile>('/auth/me');
        setProfile(session);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'This account is not authorized.');
        await signOut(auth);
      } finally {
        setLoading(false);
      }
    });
  }, [auth]);

  async function login(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!auth) return;
    setBusy(true);
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch {
      setError('Sign-in failed. Check your email and password, then try again.');
    } finally {
      setBusy(false);
    }
  }

  if (user && profile) return <Workspace user={user} profile={profile} />;
  if (loading) return <main className="auth-shell"><div className="auth-loading" role="status">Connecting to your workspace…</div></main>;

  return (
    <main className="auth-shell">
      <section className="auth-art" aria-label="Company Desk">
        <a className="brand brand-light" href="/" aria-label="Company Desk home"><span className="brand-mark">C</span><span>company<br />desk<span className="brand-period">.</span></span></a>
        <div className="art-copy"><p className="eyebrow">A SMALLER DISTANCE BETWEEN TEAMS</p><h1>One company.<br /><em>Two perspectives.</em></h1><p>Shared information, private by design.</p></div>
        <div className="art-index"><span>01</span><span className="art-index-line" /><span>COLLABORATION WORKSPACE</span></div>
        <div className="art-stamp" aria-hidden="true">C<span>·</span>D</div>
      </section>
      <section className="auth-panel">
        <div className="auth-form-wrap">
          <p className="eyebrow">SECURE SIGN IN</p>
          <h2>Welcome back.</h2>
          <p className="auth-intro">Sign in with your individual workspace account.</p>
          <form className="login-form" onSubmit={login}>
            <label className="field"><span>Email address</span><input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
            <label className="field"><span>Password</span><input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
            {error && <p className="login-error" role="alert">{error}</p>}
            {!auth && <p className="config-note" role="status">Firebase sign-in is not configured. Add the required `NEXT_PUBLIC_FIREBASE_*` values to continue.</p>}
            <button className="primary-button login-button" type="submit" disabled={busy || !auth}>{busy ? 'Signing in…' : 'Sign in'}<span aria-hidden="true">→</span></button>
          </form>
          <p className="auth-footnote">Access is limited to the two accounts configured for this workspace.</p>
        </div>
        <div className="auth-panel-mark" aria-hidden="true">PRIVATE BY DESIGN <span>·</span> 256-BIT TRANSPORT</div>
      </section>
    </main>
  );
}
