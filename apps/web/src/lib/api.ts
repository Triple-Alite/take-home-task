import { getAuth } from 'firebase/auth';
import { getFirebaseAuth } from './firebase';

export interface Company {
  id: string;
  name: string;
  userCount: number;
  productCount: number;
  percentage: number;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyImage {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface SessionProfile { uid: string; role: 'owner' | 'collaborator' }

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const auth = getFirebaseAuth();
  const user = auth ? getAuth(auth.app).currentUser : null;
  if (!user) throw new Error('Your session has expired. Sign in again.');
  const token = await user.getIdToken();
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${token}` }
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { message?: string | string[] };
    const message = Array.isArray(payload.message) ? payload.message.join(', ') : payload.message;
    throw new Error(message ?? `Request failed (${response.status})`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function apiFile(path: string, init: RequestInit = {}): Promise<Response> {
  const auth = getFirebaseAuth();
  const user = auth ? getAuth(auth.app).currentUser : null;
  if (!user) throw new Error('Your session has expired. Sign in again.');
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${await user.getIdToken()}` }
  });
  if (!response.ok) throw new Error('Could not load the private image');
  return response;
}

export function socketBase(): string {
  return process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:4000';
}
