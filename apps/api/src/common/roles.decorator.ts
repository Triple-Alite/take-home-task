import { SetMetadata } from '@nestjs/common';

export type AppRole = 'owner' | 'collaborator';
export const ROLES_KEY = 'app_roles';
export const Roles = (...roles: AppRole[]) => SetMetadata(ROLES_KEY, roles);
