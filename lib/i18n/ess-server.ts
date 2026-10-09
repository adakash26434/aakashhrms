import { cookies } from 'next/headers';
import { ESS_LANG_COOKIE, asEssLang, type EssLang } from '@/lib/i18n/ess';

/** The signed-in person's portal language (server components and actions). */
export async function essLang(): Promise<EssLang> {
  const store = await cookies();
  return asEssLang(store.get(ESS_LANG_COOKIE)?.value);
}
