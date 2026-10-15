import { CompanyService } from './company.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

describe('CompanyService', () => {
  const prisma = { company: { upsert: jest.fn(), findUnique: jest.fn() } } as unknown as PrismaService;
  const realtime = { emitCompanyUpdated: jest.fn() } as unknown as RealtimeGateway;
  const service = new CompanyService(prisma, realtime);

  beforeEach(() => {
    process.env.APP_OWNER_UID = 'private-owner-uid';
    jest.clearAllMocks();
  });

  it('calculates the value server-side and omits the owner UID from its response', async () => {
    jest.mocked(prisma.company.upsert).mockResolvedValue({
      id: 'company-1', ownerUid: 'private-owner-uid', name: 'Northstar Labs',
      userCount: 24, productCount: 7, percentage: 29.2,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z')
    });

    const result = await service.submit('private-owner-uid', {
      name: 'Northstar Labs', userCount: 24, productCount: 7
    });

    expect(jest.mocked(prisma.company.upsert)).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ ownerUid: 'private-owner-uid', percentage: 29.2 }),
      update: expect.objectContaining({ percentage: 29.2 })
    }));
    expect(result).not.toHaveProperty('ownerUid');
    expect(jest.mocked(realtime.emitCompanyUpdated)).toHaveBeenCalledTimes(1);
  });
});
