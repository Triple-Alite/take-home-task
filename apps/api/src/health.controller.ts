import { Controller, Get, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from './prisma/prisma.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Get('live')
  @ApiOperation({ summary: 'Public liveness check' })
  live(): { status: string } { return { status: 'ok' }; }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness check for required dependencies' })
  async ready(): Promise<{ status: string }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok' };
    } catch (error) {
      this.logger.error(`Readiness check failed (${error instanceof Error ? error.name : 'unknown error'})`);
      throw new ServiceUnavailableException('Required service is unavailable');
    }
  }
}
