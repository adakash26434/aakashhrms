'use server';

import { signIn, signOut } from '@/lib/auth';
import { AuthError } from 'next-auth';

// Define the exact shape of the state we return to the UI
export type LoginState = {
  error?: string;
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

    // NextAuth signIn with standard redirect to /dashboard.
    // The dashboard page will dynamically check if onboarding is needed
    // using the resolved tenant context and redirect to /onboarding only if incomplete.
    await signIn('credentials', {
      email,
      password,
      companyCode,
      redirectTo: '/dashboard', 
    }); 
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      const cause = (error as any).cause?.err ?? (error as any).cause;
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
        cause?.name === 'CredentialsSignin' ||
        cause?.code === 'credentials'
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