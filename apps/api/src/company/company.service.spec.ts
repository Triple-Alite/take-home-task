import { CompanyService } from './company.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { AuthenticatedUser } from '../auth/authenticated-user';
import { Prisma } from '@prisma/client';

describe('CompanyService', () => {
  const prisma = {
    company: { upsert: jest.fn(), findFirst: jest.fn() },
    user: { findMany: jest.fn() }
  } as unknown as PrismaService;
  const realtime = { emitCompanyUpdated: jest.fn() } as unknown as RealtimeGateway;
  const service = new CompanyService(prisma, realtime);
  const owner: AuthenticatedUser = {
    id: 'owner-record-id', uid: 'private-owner-uid', email: 'owner@example.test', role: 'USER_A', isActive: true
  };

  beforeEach(() => {
    process.env.APP_OWNER_UID = 'private-owner-uid';
    jest.clearAllMocks();
    jest.mocked(prisma.user.findMany).mockResolvedValue([{ id: 'collaborator-record-id' }] as never);
  });

  it('calculates and persists the shared formula and omits private identity fields', async () => {
    jest.mocked(prisma.company.upsert).mockResolvedValue({
      id: 'company-1', ownerUid: 'private-owner-uid', name: 'Northstar Labs',
      ownerId: owner.id, collaboratorId: 'collaborator-record-id',
      userCount: 20, productCount: 80, percentage: new Prisma.Decimal(20),
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z')
    });

    const result = await service.submit(owner, {
      companyName: 'Northstar Labs', numberOfUsers: 20, numberOfProducts: 80
    });

    expect(jest.mocked(prisma.company.upsert)).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        ownerUid: owner.uid, ownerId: owner.id, collaboratorId: 'collaborator-record-id', percentage: 20
      }),
      update: expect.objectContaining({ percentage: 20 })
    }));
    expect(result).not.toHaveProperty('ownerUid');
    expect(result.percentage).toBe(20);
    expect(jest.mocked(realtime.emitCompanyUpdated)).toHaveBeenCalledTimes(1);
  });

  it('rejects a collaborator before touching company data', async () => {
    const collaborator: AuthenticatedUser = {
      id: 'collaborator-record-id', uid: 'private-collaborator-uid',
      email: 'collaborator@example.test', role: 'USER_B', isActive: true
    };
    await expect(service.submit(collaborator, {
      companyName: 'Tampered', numberOfUsers: 1, numberOfProducts: 1
    })).rejects.toThrow('Only User A can update company information');
    expect(jest.mocked(prisma.company.upsert)).not.toHaveBeenCalled();
  });

  it('looks up only the caller’s assigned company', async () => {
    jest.mocked(prisma.company.findFirst).mockResolvedValue({
      id: 'company-1', ownerUid: owner.uid, ownerId: owner.id, collaboratorId: null,
      name: 'Northstar Labs', userCount: 20, productCount: 80, percentage: new Prisma.Decimal(20),
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z')
    } as never);
    await service.getLatest(owner);
    expect(jest.mocked(prisma.company.findFirst)).toHaveBeenCalledWith({
      where: { ownerId: owner.id }
    });
  });
});
