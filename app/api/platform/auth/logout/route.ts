import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete('platform_session');
  response.cookies.delete('platform_impersonation');
  return response;
}
