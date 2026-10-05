'use server';

import { signIn, signOut } from '@/lib/auth';
import { AuthError } from 'next-auth';

// Define the exact shape of the state we return to the UI
export type LoginState = {
  error?: string;
  /** Signed in: the form loads this page (a full load, so the server's own redirects set the address). */
  redirectTo?: string;
} | undefined;

export async function loginAction(
  prevState: LoginState, 
  formData: FormData
): Promise<LoginState> {
  try {
    let companyCode = (formData.get('companyCode') as string || '').trim().toUpperCase();
    if (companyCode && !companyCode.startsWith('CMP-')) {
      companyCode = `CMP-${companyCode}`;
    }
    const email = (formData.get('email') as string || '').trim().toLowerCase();
    const password = (formData.get('password') as string || '');

    if (!companyCode) {
      return { error: 'Please enter your company code.' };
    }
    if (!email) {
      return { error: 'Please enter your email address.' };
    }
    if (!password) {
      return { error: 'Please enter your password.' };
    }

    // Sign in without a server-action redirect, then let the form load /dashboard as a full page.
    // The dashboard sends self-service users on to /self-service and incomplete companies to
    // /onboarding. Chained redirects after a server-action redirect left the address on
    // /dashboard while showing self-service, so every later action posted to the wrong page.
    await signIn('credentials', {
      email,
      password,
      companyCode,
      redirect: false,
    });
    return { redirectTo: '/dashboard' };
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      const rawCause: unknown = (error as { cause?: unknown }).cause;
      const cause: unknown = rawCause && typeof rawCause === 'object' && 'err' in rawCause ? ((rawCause as { err?: unknown }).err ?? rawCause) : rawCause;
      const info = (cause && typeof cause === 'object' ? cause : {}) as { name?: string; code?: string };
      const message = cause instanceof Error ? cause.message : (typeof cause === 'string' ? cause : '');

      if (message.startsWith("TOO_MANY_ATTEMPTS:")) {
        return { error: message.split(":").slice(1).join(":") };
      }
      if (message.startsWith("INVALID_COMPANY:")) {
        return { error: message.split(":").slice(1).join(":") };
      }
      if (
        error.type === 'CredentialsSignin' ||
        error.type === 'CallbackRouteError' ||
        info.name === 'CredentialsSignin' ||
        info.code === 'credentials'
      ) {
        return { error: 'Invalid email or password.' };
      }
      return { error: 'Something went wrong. Please try again.' };
    }
    // Handle rate-limit lockout thrown from authorize()
    if (error instanceof Error && error.message.startsWith("TOO_MANY_ATTEMPTS:")) {
      return { error: error.message.split(":").slice(1).join(":") };
    }
    // Handle invalid company code
    if (error instanceof Error && error.message.startsWith("INVALID_COMPANY:")) {
      return { error: error.message.split(":").slice(1).join(":") };
    }

    // Next.js redirect() throws an error intentionally under the hood to cancel the execution,
    // so we must re-throw it if it isn't an AuthError!
    throw error; 
  }
}

export async function logoutAction() {
  await signOut({ redirectTo: '/login' });
}