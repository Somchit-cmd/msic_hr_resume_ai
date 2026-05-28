import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  const checks: Record<string, string> = {};

  // Check environment variables
  const dbUrl = process.env.DATABASE_URL || '❌ Missing';
  checks.DATABASE_URL = dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://')
    ? `✅ Set` 
    : `❌ Invalid: ${dbUrl.substring(0, 20)}`;
  
  const directUrl = process.env.DIRECT_URL || '❌ Missing';
  checks.DIRECT_URL = directUrl.startsWith('postgresql://') || directUrl.startsWith('postgres://')
    ? `✅ Set`
    : `❌ Missing`;

  checks.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET ? '✅ Set' : '❌ Missing';
  checks.NEXTAUTH_URL = process.env.NEXTAUTH_URL || '❌ Missing';
  checks.NODE_ENV = process.env.NODE_ENV || 'undefined';

  // Parse connection details for diagnostics
  try {
    const url = new URL(dbUrl.startsWith('postgresql://') ? dbUrl : 'postgresql://localhost/tmp');
    checks.DB_Host = url.hostname;
    checks.DB_Port = url.port;
    checks.DB_User = url.username;
    checks.DB_Name = url.pathname.slice(1);
  } catch {
    checks.DB_Parse = '❌ Could not parse DATABASE_URL';
  }

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
    const errMsg = (error as Error).message;
    checks.Database = `❌ Error: ${errMsg.substring(0, 200)}`;
    
    // Add helpful hints
    if (errMsg.includes('tenant/user') && errMsg.includes('not found')) {
      checks.Hint = 'Supabase pooler cannot find your project. Verify: 1) Project is active (not paused), 2) Connection string from Supabase Dashboard > Settings > Database, 3) Try direct connection: postgresql://postgres:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres';
    } else if (errMsg.includes("Can't reach database")) {
      checks.Hint = 'Database server unreachable. If using Neon, the database may be paused. If using Supabase direct connection, enable IPv4 add-on or use the pooler.';
    }
  }

  const allOk = Object.values(checks).every(v => !v.startsWith('❌'));

  return NextResponse.json({
    status: allOk ? 'healthy' : 'unhealthy',
    checks,
    timestamp: new Date().toISOString(),
  }, { status: allOk ? 200 : 500 });
}
