import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser } from '../auth/authenticated-user';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { Roles } from '../common/roles.decorator';
import { CompanyService } from './company.service';

@ApiTags('collaborator')
@ApiBearerAuth()
@Controller('collaborator/company')
@UseGuards(FirebaseAuthGuard, RolesGuard)
export class CollaboratorController {
  constructor(private readonly companies: CompanyService) {}

  @Get('latest')
  @Roles('USER_B')
  @ApiOperation({ summary: 'Read the latest persisted company record assigned to User B' })
  latest(@CurrentUser() user: AuthenticatedUser) {
    return this.companies.getLatest(user);
  }
}
