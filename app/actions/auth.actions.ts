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
    // NextAuth signIn with standard redirect to /dashboard.
    // The dashboard page will dynamically check if onboarding is needed
    // using the resolved tenant context and redirect to /onboarding only if incomplete.
    await signIn('credentials', {
      email: formData.get('email'),
      password: formData.get('password'),
      companyCode: formData.get('companyCode') || '',
      redirectTo: '/dashboard', 
    });
    
    // signIn throws a redirect on success, so this line technically never runs,
    // but TypeScript requires a return value to match the signature.
    return undefined; 
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin':
          return { error: 'Invalid email or password.' };
        default:
          return { error: 'Something went wrong. Please try again.' };
      }
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