import { NextResponse } from 'next/server';
import { PLATFORM_COOKIE_NAME } from '@/lib/platform/auth';

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete(PLATFORM_COOKIE_NAME);
  return response;
}

export async function GET(request: Request) {
  const url = new URL('/platform/login', request.url);
  const response = NextResponse.redirect(url);
  response.cookies.delete(PLATFORM_COOKIE_NAME);
  return response;
}
