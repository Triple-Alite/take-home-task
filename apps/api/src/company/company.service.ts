import { Injectable, NotFoundException } from '@nestjs/common';
import { Company } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { UpdateCompanyDto } from './company.dto';
import { calculatePercentage } from './percentage';

@Injectable()
export class CompanyService {
  constructor(private readonly prisma: PrismaService, private readonly realtime: RealtimeGateway) {}

  async getLatest(): Promise<Omit<Company, 'ownerUid'>> {
    const ownerUid = process.env.APP_OWNER_UID;
    if (!ownerUid) throw new NotFoundException('Company information has not been submitted yet');
    const company = await this.prisma.company.findUnique({ where: { ownerUid } });
    if (!company) throw new NotFoundException('Company information has not been submitted yet');
    const { ownerUid: _ownerUid, ...publicCompany } = company;
    return publicCompany;
  }

  async submit(ownerUid: string, dto: UpdateCompanyDto): Promise<Omit<Company, 'ownerUid'>> {
    const data = {
      name: dto.name.trim(),
      userCount: dto.userCount,
      productCount: dto.productCount,
      percentage: calculatePercentage(dto.userCount, dto.productCount)
    };
    const company = await this.prisma.company.upsert({
      where: { ownerUid },
      create: { ownerUid, ...data },
      update: data
    });
    this.realtime.emitCompanyUpdated(company);
    const { ownerUid: _ownerUid, ...publicCompany } = company;
    return publicCompany;
  }
}
