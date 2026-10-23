import { Injectable, Logger } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Company } from '@prisma/client';
import { Server, Socket } from 'socket.io';
import { FirebaseAuthService } from '../auth/firebase-auth.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
@WebSocketGateway({
  namespace: '/collaboration',
  cors: { origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000' }
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(private readonly firebaseAuth: FirebaseAuthService, private readonly prisma: PrismaService) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = client.handshake.auth?.token;
      if (typeof token !== 'string' || !token) throw new Error('Missing token');
      const identity = await this.firebaseAuth.verifyIdToken(token);
      const company = await this.prisma.company.findFirst({
        where: identity.role === 'USER_A' ? { ownerId: identity.id } : { collaboratorId: identity.id },
        select: { id: true }
      });
      client.data.userId = identity.id;
      if (company) {
        client.data.companyId = company.id;
        await client.join(this.companyRoom(company.id));
      }
      await client.join(this.userRoom(identity.id));
    } catch {
      this.logger.warn('Rejected unauthenticated or unauthorized socket connection');
      client.disconnect(true);
    }
  }

  handleDisconnect(): void {}

  emitCompanyUpdated(company: Company): void {
    const event = {
      id: company.id,
      updatedAt: company.updatedAt
    };
    if (company.ownerId && company.collaboratorId) {
      this.server?.to(this.userRoom(company.ownerId)).to(this.userRoom(company.collaboratorId)).emit('company.updated', event);
      return;
    }
    this.server?.to(this.companyRoom(company.id)).emit('company.updated', event);
  }

  emitImageUploaded(
    companyId: string,
    image: { id: string },
    participants: { ownerId: string | null; collaboratorId: string | null }
  ): void {
    const rooms = [
      this.companyRoom(companyId),
      ...[participants.ownerId, participants.collaboratorId]
        .filter((id): id is string => id !== null)
        .map((id) => this.userRoom(id))
    ];
    this.server?.to(rooms).emit('image.uploaded', { companyId, id: image.id });
  }

  private companyRoom(companyId: string): string { return `company:${companyId}`; }
  private userRoom(userId: string): string { return `user:${userId}`; }
}
