import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { FirebaseAuthGuard } from './firebase-auth.guard';
import { FirebaseAuthService } from './firebase-auth.service';

function requestContext(authorization?: string): ExecutionContext {
  const request: { headers: { authorization?: string }; user?: unknown } = { headers: { authorization } };
  return {
    switchToHttp: () => ({ getRequest: () => request })
  } as unknown as ExecutionContext;
}

describe('FirebaseAuthGuard', () => {
  const firebaseAuth = {
    verifyIdToken: jest.fn(),
  } as unknown as FirebaseAuthService;
  const guard = new FirebaseAuthGuard(firebaseAuth);

  beforeEach(() => jest.clearAllMocks());

  it('verifies the bearer token and attaches the database-provisioned identity', async () => {
    const identity = {
      id: 'internal-user-id',
      uid: 'owner-uid',
      email: 'owner@example.test',
      role: 'USER_A' as const,
      isActive: true as const
    };
    jest.mocked(firebaseAuth.verifyIdToken).mockResolvedValue(identity);
    const context = requestContext('Bearer id-token');
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(jest.mocked(firebaseAuth.verifyIdToken)).toHaveBeenCalledWith('id-token');
    expect(context.switchToHttp().getRequest().user).toEqual(identity);
  });

  it('rejects missing bearer credentials', async () => {
    await expect(guard.canActivate(requestContext())).rejects.toBeInstanceOf(UnauthorizedException);
    expect(jest.mocked(firebaseAuth.verifyIdToken)).not.toHaveBeenCalled();
  });

  it('rejects an invalid Firebase token', async () => {
    jest.mocked(firebaseAuth.verifyIdToken).mockRejectedValue(new UnauthorizedException('invalid'));
    await expect(guard.canActivate(requestContext('Bearer bad-token'))).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
