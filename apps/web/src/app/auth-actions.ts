'use server';
import { signIn, signOut } from '@/auth';

export async function doSignOut() {
  await signOut({ redirectTo: '/' });
}

/** Straight to Discord's authorize screen — never NextAuth's provider-picker page. */
export async function doSignIn(redirectTo: string) {
  await signIn('discord', { redirectTo });
}
