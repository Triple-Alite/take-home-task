export function firebaseSignInErrorMessage(error: unknown): string {
  const code = getFirebaseErrorCode(error);

  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'Email or password was not accepted. Confirm the account exists under Firebase Authentication → Users and that its password is correct.';
    case 'auth/user-disabled':
      return 'This Firebase account is disabled. Ask a project administrator to enable it in Firebase Authentication.';
    case 'auth/too-many-requests':
      return 'Firebase has temporarily blocked sign-in attempts. Wait a while, then try again.';
    case 'auth/operation-not-allowed':
      return 'Email/password sign-in is disabled. Enable the Email/Password provider in Firebase Authentication settings.';
    case 'auth/unauthorized-domain':
      return 'This site is not authorized for Firebase sign-in. Add localhost to the project’s authorized domains in Firebase Authentication settings.';
    case 'auth/invalid-api-key':
    case 'auth/api-key-not-valid':
      return 'The Firebase web API key is invalid. Check NEXT_PUBLIC_FIREBASE_API_KEY in apps/web/.env.local and restart the web server.';
    case 'auth/app-not-authorized':
    case 'auth/configuration-not-found':
      return 'This Firebase app is not authorized for the requested sign-in. Confirm the web app and Email/Password provider are enabled in the same Firebase project.';
    case 'auth/network-request-failed':
      return 'Firebase could not be reached. Check your internet connection and try again.';
    default:
      if (code && /^auth\/[a-z0-9-]+$/.test(code)) {
        return `Firebase sign-in failed (${code}). Check this code in the Firebase Authentication documentation or browser console.`;
      }
      return 'No Firebase error code was returned. Hard-refresh this page (Ctrl+Shift+R) and check the browser console for the sign-in error.';
  }
}

function getFirebaseErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  if ('code' in error && typeof error.code === 'string') return error.code;
  if ('message' in error && typeof error.message === 'string') {
    return error.message.match(/\bauth\/[a-z0-9-]+\b/)?.[0];
  }
  return undefined;
}
