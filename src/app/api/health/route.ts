import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  const checks: Record<string, string> = {};

  // Check environment variables
  checks.NEON_DATABASE_URL = process.env.NEON_DATABASE_URL ? '✅ Set' : '❌ Missing';
  checks.DATABASE_URL = process.env.DATABASE_URL ? '✅ Set' : '❌ Missing';
  checks.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET ? '✅ Set' : '❌ Missing';
  checks.NEXTAUTH_URL = process.env.NEXTAUTH_URL || '❌ Missing';
  checks.NODE_ENV = process.env.NODE_ENV || 'undefined';

  // Check database connection and admin user
  try {
    const userCount = await db.user.count();
    checks.Database = `✅ Connected (${userCount} users)`;

    // Check if admin user exists
    const admin = await db.user.findUnique({
      where: { email: 'admin@resumescreen.ai' },
    });
    checks.AdminUser = admin ? `✅ Exists (id: ${admin.id})` : '❌ Not found - run seed script';
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
