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
  id: 'company-1', companyName: 'Northstar Labs',
  numberOfUsers: 20, numberOfProducts: 80, percentage: 20,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z')
};

const identities = {
  'owner-token': {
    id: 'owner-record-id', uid: 'owner-uid', email: 'owner@example.test', role: 'USER_A' as const, isActive: true
  },
  'collaborator-token': {
    id: 'collaborator-record-id', uid: 'collaborator-uid', email: 'collaborator@example.test', role: 'USER_B' as const, isActive: true
  }
};
const firebaseAuth = {
  verifyIdToken: jest.fn(async (token: string) => {
    const identity = identities[token as keyof typeof identities];
    if (!identity) throw new UnauthorizedException();
    return identity;
  })
};
const companyService = {
  getLatest: jest.fn().mockResolvedValue(company),
  submit: jest.fn().mockResolvedValue(company)
};

describe('Company API authorization', () => {
  let app: INestApplication;

  beforeAll(async () => {
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
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();
  });

  afterAll(async () => app.close());

  it('requires a verified bearer token', async () => {
    await request(app.getHttpServer()).get('/api/v1/company/me').expect(401);
  });

  it('allows the collaborator to read but not change company data', async () => {
    await request(app.getHttpServer()).get('/api/v1/company/me')
      .set('Authorization', 'Bearer collaborator-token')
      .expect(200)
      .expect(({ body }) => expect(body.companyName).toBe('Northstar Labs'));
    await request(app.getHttpServer()).put('/api/v1/company/me')
      .set('Authorization', 'Bearer collaborator-token')
      .send({ companyName: 'Tampered', numberOfUsers: 2, numberOfProducts: 3 })
      .expect(403);
  });

  it('allows the owner to submit validated company details', async () => {
    await request(app.getHttpServer()).put('/api/v1/company/me')
      .set('Authorization', 'Bearer owner-token')
      .send({ companyName: 'Northstar Labs', numberOfUsers: 20, numberOfProducts: 80 })
      .expect(200);
    expect(companyService.submit).toHaveBeenCalledWith(identities['owner-token'], {
      companyName: 'Northstar Labs', numberOfUsers: 20, numberOfProducts: 80
    });
  });

  it('rejects unknown fields rather than trusting a client-supplied role', async () => {
    await request(app.getHttpServer()).put('/api/v1/company/me')
      .set('Authorization', 'Bearer owner-token')
      .send({ companyName: 'Northstar Labs', numberOfUsers: 20, numberOfProducts: 80, role: 'USER_A' })
      .expect(400);
  });
});
