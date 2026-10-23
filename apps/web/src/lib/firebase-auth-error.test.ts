import { firebaseSignInErrorMessage } from './firebase-auth-error';

describe('firebaseSignInErrorMessage', () => {
  it('directs invalid credentials to check the Firebase account and password', () => {
    expect(firebaseSignInErrorMessage({ code: 'auth/invalid-credential' })).toContain(
      'Confirm the account exists under Firebase Authentication'
    );
  });

  it('explains when email and password sign-in is disabled', () => {
    expect(firebaseSignInErrorMessage({ code: 'auth/operation-not-allowed' })).toContain(
      'Enable the Email/Password provider'
    );
  });

  it('does not expose arbitrary error messages or credentials', () => {
    expect(firebaseSignInErrorMessage(new Error('private details'))).toBe(
      'No Firebase error code was returned. Hard-refresh this page (Ctrl+Shift+R) and check the browser console for the sign-in error.'
    );
  });

  it('shows a safe Firebase error code when it has no specific guidance', () => {
    expect(firebaseSignInErrorMessage({ code: 'auth/configuration-not-found' })).toContain(
      'same Firebase project'
    );
    expect(firebaseSignInErrorMessage({ code: 'auth/unknown-error' })).toContain(
      'Firebase sign-in failed (auth/unknown-error)'
    );
  });

  it('does not include malformed error codes in the message', () => {
    expect(firebaseSignInErrorMessage({ code: 'auth/secret?token=value' })).toBe(
      'No Firebase error code was returned. Hard-refresh this page (Ctrl+Shift+R) and check the browser console for the sign-in error.'
    );
  });

  it('extracts a safe Firebase code from an error message', () => {
    expect(firebaseSignInErrorMessage(new Error('Firebase error: auth/invalid-api-key'))).toContain(
      'NEXT_PUBLIC_FIREBASE_API_KEY'
    );
  });
});
