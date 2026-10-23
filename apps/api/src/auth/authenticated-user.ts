import { UserRole } from '@prisma/client';

export interface AuthenticatedUser {
  id: string;
  uid: string;
  email: string;
  role: UserRole;
  isActive: boolean;
}
