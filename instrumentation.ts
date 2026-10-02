/**
 * Runs once when the Next.js server starts. Reports insecure configuration
 * (missing, short or shared secrets) so it is caught at deploy time rather
 * than at first login. See lib/security/secrets.ts.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { validateSecurityConfig } = await import('./lib/security/secrets');
  for (const issue of validateSecurityConfig()) {
    const line = `[security] ${issue.level.toUpperCase()}: ${issue.message}`;
    if (issue.level === 'error') console.error(line);
    else console.warn(line);
  }
}
