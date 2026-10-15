import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/current-user.decorator';
import { Roles } from '../common/roles.decorator';
import { AuthenticatedUser } from '../auth/authenticated-user';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CompanyService } from './company.service';
import { UpdateCompanyDto } from './company.dto';

@ApiTags('company')
@ApiBearerAuth()
@Controller('company')
@UseGuards(FirebaseAuthGuard, RolesGuard)
export class CompanyController {
  constructor(private readonly companies: CompanyService) {}

  @Get()
  @Roles('owner', 'collaborator')
  @ApiOperation({ summary: 'Read the latest company submission; owner and collaborator' })
  latest() { return this.companies.getLatest(); }

  @Put()
  @Roles('owner')
  @ApiOperation({ summary: 'Create or update company information; owner only' })
  submit(@CurrentUser() user: AuthenticatedUser, @Body() body: UpdateCompanyDto) {
    return this.companies.submit(user.uid, body);
  }
}
