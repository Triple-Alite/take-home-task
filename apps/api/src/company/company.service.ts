import { ForbiddenException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Company } from '@prisma/client';
import { AuthenticatedUser } from '../auth/authenticated-user';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { UpdateCompanyDto } from './company.dto';
import { calculatePercentage } from './percentage';

export type CompanyResponse = {
  id: string;
  companyName: string;
  numberOfUsers: number;
  numberOfProducts: number;
  percentage: number;
  createdAt: Date;
  updatedAt: Date;
};

function toResponse(company: Company): CompanyResponse {
  return {
    id: company.id,
    companyName: company.name,
    numberOfUsers: company.userCount,
    numberOfProducts: company.productCount,
    percentage: Number(company.percentage),
    createdAt: company.createdAt,
    updatedAt: company.updatedAt
  };
}

@Injectable()
export class CompanyService {
  constructor(private readonly prisma: PrismaService, private readonly realtime: RealtimeGateway) {}

  async getLatest(user: AuthenticatedUser): Promise<CompanyResponse> {
    const company = await this.prisma.company.findFirst({
      where: user.role === 'USER_A' ? { ownerId: user.id } : { collaboratorId: user.id }
    });
    if (!company) throw new NotFoundException('Company information has not been submitted yet');
    return toResponse(company);
  }

  async submit(user: AuthenticatedUser, dto: UpdateCompanyDto): Promise<CompanyResponse> {
    if (user.role !== 'USER_A') throw new ForbiddenException('Only User A can update company information');
    const collaborators = await this.prisma.user.findMany({
      where: { role: 'USER_B', isActive: true },
      select: { id: true },
      take: 2
    });
    if (collaborators.length !== 1) {
      throw new InternalServerErrorException('Exactly one active User B must be provisioned before company data can be submitted');
    }
    const collaborator = collaborators[0];
    const data = {
      name: dto.companyName,
      userCount: dto.numberOfUsers,
      productCount: dto.numberOfProducts,
      percentage: calculatePercentage(dto.numberOfUsers, dto.numberOfProducts),
      ownerId: user.id,
      collaboratorId: collaborator.id
    };
    const company = await this.prisma.company.upsert({
      where: { ownerUid: user.uid },
      create: { ownerUid: user.uid, ...data },
      update: data
    });
    this.realtime.emitCompanyUpdated(company);
    return toResponse(company);
  }
}
