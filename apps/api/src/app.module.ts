import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthController } from './auth/auth.controller';
import { FirebaseAuthGuard } from './auth/firebase-auth.guard';
import { FirebaseAuthService } from './auth/firebase-auth.service';
import { RolesGuard } from './auth/roles.guard';
import { CompanyController } from './company/company.controller';
import { CompanyService } from './company/company.service';
import { HealthController } from './health.controller';
import { ImagesController } from './images/images.controller';
import { ImagesService } from './images/images.service';
import { PrivateStorageService } from './images/private-storage.service';
import { PrismaService } from './prisma/prisma.service';
import { RealtimeGateway } from './realtime/realtime.gateway';

@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }])],
  controllers: [AuthController, CompanyController, ImagesController, HealthController],
  providers: [
    PrismaService, FirebaseAuthService, FirebaseAuthGuard, RolesGuard,
    CompanyService, ImagesService, PrivateStorageService, RealtimeGateway,
    { provide: APP_GUARD, useClass: ThrottlerGuard }
  ]
})
export class AppModule {}
