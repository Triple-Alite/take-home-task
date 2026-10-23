import { SetMetadata } from '@nestjs/common';

export type AppRole = 'USER_A' | 'USER_B';
export const ROLES_KEY = 'app_roles';
export const Roles = (...roles: AppRole[]) => SetMetadata(ROLES_KEY, roles);
