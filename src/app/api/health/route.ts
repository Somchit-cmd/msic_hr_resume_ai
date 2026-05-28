import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  const checks: Record<string, string> = {};

  // Check environment variables
  checks.DATABASE_URL = process.env.DATABASE_URL ? '✅ Set' : '❌ Missing';
  checks.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET ? '✅ Set' : '❌ Missing';
  checks.NEXTAUTH_URL = process.env.NEXTAUTH_URL || '❌ Missing';
  checks.NODE_ENV = process.env.NODE_ENV || 'undefined';

  // Check database connection
  try {
    await db.user.findFirst({ take: 1 });
    checks.Database = '✅ Connected';
  } catch (error) {
    checks.Database = `❌ Error: ${(error as Error).message}`;
  }

  const allOk = Object.values(checks).every(v => !v.startsWith('❌'));

  return NextResponse.json({
    status: allOk ? 'healthy' : 'unhealthy',
    checks,
    timestamp: new Date().toISOString(),
  }, { status: allOk ? 200 : 500 });
}
