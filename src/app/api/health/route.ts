import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  const checks: Record<string, string> = {};

  // Check environment variables
  const dbUrl = process.env.DATABASE_URL || '❌ Missing';
  checks.DATABASE_URL = dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://')
    ? `✅ Set (${dbUrl.substring(0, 30)}...)` 
    : `❌ Invalid: ${dbUrl.substring(0, 20)}`;
  
  const directUrl = process.env.DIRECT_URL || '❌ Missing';
  checks.DIRECT_URL = directUrl.startsWith('postgresql://') || directUrl.startsWith('postgres://')
    ? `✅ Set (${directUrl.substring(0, 30)}...)` 
    : `❌ Invalid: ${directUrl.substring(0, 20)}`;

  checks.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET ? '✅ Set' : '❌ Missing';
  checks.NEXTAUTH_URL = process.env.NEXTAUTH_URL || '❌ Missing';
  checks.NODE_ENV = process.env.NODE_ENV || 'undefined';

  // Check database connection
  try {
    const userCount = await db.user.count();
    checks.Database = `✅ Connected (${userCount} users)`;

    // Check if admin user exists
    const admin = await db.user.findUnique({
      where: { email: 'admin@resumescreen.ai' },
    });
    checks.AdminUser = admin ? `✅ Exists` : '❌ Not found - run seed script';
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
