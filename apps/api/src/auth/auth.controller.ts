import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/current-user.decorator';
import { AuthenticatedUser } from './authenticated-user';
import { FirebaseAuthGuard } from './firebase-auth.guard';

@ApiTags('auth')
@ApiBearerAuth()
@Controller('auth')
@UseGuards(FirebaseAuthGuard)
export class AuthController {
  @Get('me')
  @ApiOperation({ summary: 'Return the authenticated user role' })
  me(@CurrentUser() user: AuthenticatedUser): Pick<AuthenticatedUser, 'id' | 'email' | 'role' | 'isActive'> {
    return { id: user.id, email: user.email, role: user.role, isActive: user.isActive };
  }
}
