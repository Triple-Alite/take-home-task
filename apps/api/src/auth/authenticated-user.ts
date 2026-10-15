import { AppRole } from '../common/roles.decorator';

export interface AuthenticatedUser {
  uid: string;
  role: AppRole;
}
