import { getAuth } from 'firebase/auth';
import { getFirebaseAuth } from './firebase';

export interface Company {
  id: string;
  companyName: string;
  numberOfUsers: number;
  numberOfProducts: number;
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

export interface PaginatedImages {
  items: CompanyImage[];
  page: number;
  limit: number;
  total: number;
}

export interface SessionProfile {
  id: string;
  email: string;
  role: 'USER_A' | 'USER_B';
  isActive: boolean;
}

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

export class ApiRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

function errorMessage(payload: unknown, fallback: string): string {
  if (typeof payload !== 'object' || payload === null || !('message' in payload)) return fallback;
  const message = payload.message;
  if (typeof message === 'string') return message;
  if (Array.isArray(message) && message.every((part) => typeof part === 'string')) return message.join(', ');
  return fallback;
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const auth = getFirebaseAuth();
  const user = auth ? getAuth(auth.app).currentUser : null;
  if (!user) throw new Error('Your session has expired. Sign in again.');
  const token = await user.getIdToken();
  const response = await fetch(`${apiBase}/v1${path}`, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${token}` }
  });
  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => ({}));
    throw new ApiRequestError(errorMessage(payload, `Request failed (${response.status})`), response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function apiUpload<T>(
  path: string,
  body: FormData,
  onProgress: (percentage: number) => void
): Promise<T> {
  const auth = getFirebaseAuth();
  const user = auth ? getAuth(auth.app).currentUser : null;
  if (!user) throw new Error('Your session has expired. Sign in again.');
  const token = await user.getIdToken();

  return new Promise<T>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', `${apiBase}/v1${path}`);
    request.setRequestHeader('Authorization', `Bearer ${token}`);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onerror = () => reject(new Error('Upload request failed. Check your connection and try again.'));
    request.onabort = () => reject(new Error('Upload was cancelled.'));
    request.onload = () => {
      let payload: unknown;
      try {
        payload = JSON.parse(request.responseText);
      } catch {
        reject(new Error(`Upload failed (${request.status})`));
        return;
      }
      if (request.status < 200 || request.status >= 300) {
        reject(new ApiRequestError(errorMessage(payload, `Upload failed (${request.status})`), request.status));
        return;
      }
      resolve(payload as T);
    };
    request.send(body);
  });
}

export async function apiFile(path: string, init: RequestInit = {}): Promise<Response> {
  const auth = getFirebaseAuth();
  const user = auth ? getAuth(auth.app).currentUser : null;
  if (!user) throw new Error('Your session has expired. Sign in again.');
  const token = await user.getIdToken();
  const response = await fetch(`${apiBase}/v1${path}`, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${token}` }
  });
  if (!response.ok) throw new Error('Could not load the private image');
  return response;
}

export function socketBase(): string {
  return process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:4000';
}
