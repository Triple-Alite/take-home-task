import { Injectable, UnauthorizedException } from '@nestjs/common';
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

@Injectable()
export class FirebaseAuthService {
  async verifyIdToken(idToken: string): Promise<{ uid: string }> {
    try {
      const app = getApps()[0] ?? initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        credential: this.credential()
      });
      const decoded = await getAuth(app).verifyIdToken(idToken, true);
      const ownerUid = process.env.APP_OWNER_UID;
      const collaboratorUid = process.env.APP_COLLABORATOR_UID;
      if (!ownerUid || !collaboratorUid || ownerUid === collaboratorUid) {
        throw new Error('Role identities are not configured');
      }
      if (decoded.uid !== ownerUid && decoded.uid !== collaboratorUid) {
        throw new Error('Identity is not authorized for this application');
      }
      return { uid: decoded.uid };
    } catch {
      throw new UnauthorizedException('A valid authorized Firebase ID token is required');
    }
  }

  roleFor(uid: string): 'owner' | 'collaborator' {
    if (uid === process.env.APP_OWNER_UID && process.env.APP_OWNER_UID) return 'owner';
    if (uid === process.env.APP_COLLABORATOR_UID && process.env.APP_COLLABORATOR_UID) return 'collaborator';
    throw new UnauthorizedException('Identity is not authorized for this application');
  }

  private credential() {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!serviceAccount) return applicationDefault();
    try {
      return cert(JSON.parse(serviceAccount) as Parameters<typeof cert>[0]);
    } catch {
      throw new Error('Firebase service-account configuration is invalid');
    }
  }
}
