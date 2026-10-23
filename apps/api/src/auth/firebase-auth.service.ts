import { Injectable, UnauthorizedException } from '@nestjs/common';
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FirebaseAuthService {
  constructor(private readonly prisma: PrismaService) {}

  async verifyIdToken(idToken: string) {
    let decoded: { uid: string };
    try {
      const app = getApps()[0] ?? initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        credential: this.credential()
      });
      decoded = await getAuth(app).verifyIdToken(idToken, true);
    } catch {
      throw new UnauthorizedException('A valid authorized Firebase ID token is required');
    }

    const user = await this.prisma.user.findUnique({
      where: { firebaseUid: decoded.uid },
      select: { id: true, firebaseUid: true, email: true, role: true, isActive: true }
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('This account is not provisioned or active for this application');
    }
    return {
      id: user.id,
      uid: user.firebaseUid,
      email: user.email,
      role: user.role,
      isActive: user.isActive
    };
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
