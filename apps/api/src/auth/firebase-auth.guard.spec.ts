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
    roleFor: jest.fn()
  } as unknown as FirebaseAuthService;
  const guard = new FirebaseAuthGuard(firebaseAuth);

  beforeEach(() => jest.clearAllMocks());

  it('verifies the bearer token and attaches only the server-derived role', async () => {
    jest.mocked(firebaseAuth.verifyIdToken).mockResolvedValue({ uid: 'owner-uid' });
    jest.mocked(firebaseAuth.roleFor).mockReturnValue('owner');
    const context = requestContext('Bearer id-token');
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(jest.mocked(firebaseAuth.verifyIdToken)).toHaveBeenCalledWith('id-token');
    expect(context.switchToHttp().getRequest().user).toEqual({ uid: 'owner-uid', role: 'owner' });
  });

  it('rejects missing bearer credentials', async () => {
    await expect(guard.canActivate(requestContext())).rejects.toBeInstanceOf(UnauthorizedException);
    expect(jest.mocked(firebaseAuth.verifyIdToken)).not.toHaveBeenCalled();
  });

  it('rejects an invalid Firebase token', async () => {
    jest.mocked(firebaseAuth.verifyIdToken).mockRejectedValue(new Error('invalid'));
    await expect(guard.canActivate(requestContext('Bearer bad-token'))).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
