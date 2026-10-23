'use client';

import { onAuthStateChanged, User } from 'firebase/auth';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ApiRequestError, apiRequest, SessionProfile } from '@/lib/api';
import { getFirebaseAuth } from '@/lib/firebase';
import { Workspace } from './Workspace';

type DashboardRole = SessionProfile['role'];

export function DashboardRoute({ role }: { role: DashboardRole }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<SessionProfile | null>(null);
  const [message, setMessage] = useState('Checking your workspace access…');
  const [loading, setLoading] = useState(true);
  const auth = getFirebaseAuth();

  useEffect(() => {
    if (!auth) {
      setMessage('Firebase sign-in is not configured.');
      setLoading(false);
      return;
    }

    let active = true;
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!active) return;
      setUser(currentUser);
      setProfile(null);

      if (!currentUser) {
        setMessage('Sign in to open your workspace.');
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const currentProfile = await apiRequest<SessionProfile>('/auth/me');
        if (!active) return;
        setProfile(currentProfile);
        setMessage(currentProfile.role === role
          ? ''
          : 'This dashboard is not assigned to your account. Open your assigned dashboard instead.');
      } catch (error) {
        if (!active) return;
        setMessage(error instanceof ApiRequestError && error.status === 401
          ? 'Your account is not authorized for this workspace.'
          : error instanceof Error ? error.message : 'Could not verify workspace access.');
      } finally {
        if (active) setLoading(false);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [auth, role]);

  if (loading) return <main className="auth-shell"><div className="auth-loading" role="status">{message}</div></main>;
  if (user && profile?.role === role) return <Workspace user={user} profile={profile} />;

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="auth-form-wrap">
          <p className="eyebrow">WORKSPACE ACCESS</p>
          <h2>Access required.</h2>
          <p className="login-error" role="alert">{message}</p>
          <Link className="primary-button login-button" href={user && profile ? profile.role === 'USER_A' ? '/dashboard/owner' : '/dashboard/collaborator' : '/login'}>
            {user && profile ? 'Open assigned dashboard' : 'Go to sign in'}<span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
