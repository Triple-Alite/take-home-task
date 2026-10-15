import { INestApplication, ValidationPipe, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import request from 'supertest';
import { AuthController } from '../src/auth/auth.controller';
import { FirebaseAuthGuard } from '../src/auth/firebase-auth.guard';
import { FirebaseAuthService } from '../src/auth/firebase-auth.service';
import { RolesGuard } from '../src/auth/roles.guard';
import { CompanyController } from '../src/company/company.controller';
import { CompanyService } from '../src/company/company.service';

const company = {
  id: 'company-1', ownerUid: 'owner-uid', name: 'Northstar Labs',
  userCount: 24, productCount: 7, percentage: 29.2,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z')
};

const identities: Record<string, string> = { 'owner-token': 'owner-uid', 'collaborator-token': 'collaborator-uid' };
const firebaseAuth = {
  verifyIdToken: jest.fn(async (token: string) => {
    const uid = identities[token];
    if (!uid) throw new UnauthorizedException();
    return { uid };
  }),
  roleFor: jest.fn((uid: string) => uid === 'owner-uid' ? 'owner' as const : 'collaborator' as const)
};
const companyService = {
  getLatest: jest.fn().mockResolvedValue(company),
  submit: jest.fn().mockResolvedValue(company)
};

describe('Company API authorization', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.APP_OWNER_UID = 'owner-uid';
    process.env.APP_COLLABORATOR_UID = 'collaborator-uid';
    const module = await Test.createTestingModule({
      controllers: [AuthController, CompanyController],
      providers: [
        FirebaseAuthGuard,
        RolesGuard,
        { provide: FirebaseAuthService, useValue: firebaseAuth },
        { provide: CompanyService, useValue: companyService },
        { provide: Reflector, useValue: new Reflector() }
      ]
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();
  });

  afterAll(async () => app.close());

  it('requires a verified bearer token', async () => {
    await request(app.getHttpServer()).get('/api/company').expect(401);
  });

  it('allows the collaborator to read but not change company data', async () => {
    await request(app.getHttpServer()).get('/api/company')
      .set('Authorization', 'Bearer collaborator-token')
      .expect(200)
      .expect(({ body }) => expect(body.name).toBe('Northstar Labs'));
    await request(app.getHttpServer()).put('/api/company')
      .set('Authorization', 'Bearer collaborator-token')
      .send({ name: 'Tampered', userCount: 2, productCount: 3 })
      .expect(403);
  });

  it('allows the owner to submit validated company details', async () => {
    await request(app.getHttpServer()).put('/api/company')
      .set('Authorization', 'Bearer owner-token')
      .send({ name: 'Northstar Labs', userCount: 24, productCount: 7 })
      .expect(200);
    expect(companyService.submit).toHaveBeenCalledWith('owner-uid', {
      name: 'Northstar Labs', userCount: 24, productCount: 7
    });
  });

  it('rejects unknown fields rather than trusting a client-supplied role', async () => {
    await request(app.getHttpServer()).put('/api/company')
      .set('Authorization', 'Bearer owner-token')
      .send({ name: 'Northstar Labs', userCount: 24, productCount: 7, role: 'owner' })
      .expect(400);
  });
});
