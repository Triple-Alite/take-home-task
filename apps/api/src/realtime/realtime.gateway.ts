import { Injectable, Logger } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Company } from '@prisma/client';
import { Server, Socket } from 'socket.io';
import { FirebaseAuthService } from '../auth/firebase-auth.service';

@Injectable()
@WebSocketGateway({
  namespace: '/collaboration',
  cors: { origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000' }
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(private readonly firebaseAuth: FirebaseAuthService) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = client.handshake.auth?.token;
      if (typeof token !== 'string' || !token) throw new Error('Missing token');
      const identity = await this.firebaseAuth.verifyIdToken(token);
      this.firebaseAuth.roleFor(identity.uid);
      const ownerUid = process.env.APP_OWNER_UID;
      if (!ownerUid) throw new Error('Owner identity is not configured');
      client.data.uid = identity.uid;
      client.join(this.room(ownerUid));
    } catch {
      this.logger.warn('Rejected unauthenticated or unauthorized socket connection');
      client.disconnect(true);
    }
  }

  handleDisconnect(): void {}

  emitCompanyUpdated(company: Company): void {
    this.server?.to(this.room(company.ownerUid)).emit('company:updated', {
      id: company.id,
      name: company.name,
      userCount: company.userCount,
      productCount: company.productCount,
      percentage: company.percentage,
      createdAt: company.createdAt,
      updatedAt: company.updatedAt
    });
  }

  emitImageUploaded(companyId: string, image: { id: string; originalName: string; mimeType: string; sizeBytes: number; createdAt: Date }): void {
    this.server?.to(this.room(process.env.APP_OWNER_UID ?? '')).emit('image:uploaded', { companyId, ...image });
  }

  private room(ownerUid: string): string { return `company:${ownerUid}`; }
}
