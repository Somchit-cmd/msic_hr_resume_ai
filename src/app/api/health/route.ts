import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  const checks: Record<string, string> = {};

  // Check environment variables
  const dbUrl = process.env.DATABASE_URL || '❌ Missing';
  checks.DATABASE_URL = dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://')
    ? `✅ Set (${dbUrl.substring(0, 30)}...)` 
    : `❌ Invalid: ${dbUrl.substring(0, 20)}`;
  checks.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET ? '✅ Set' : '❌ Missing';
  checks.NEXTAUTH_URL = process.env.NEXTAUTH_URL || '❌ Missing';
  checks.NODE_ENV = process.env.NODE_ENV || 'undefined';

  // Check if using Neon pooled connection
  const isPooled = dbUrl.includes('-pooler');
  const hasPgbouncer = dbUrl.includes('pgbouncer=true');
  checks.ConnectionType = isPooled 
    ? `Neon Pooled (${hasPgbouncer ? 'pgbouncer=true ✅' : '⚠️ missing pgbouncer=true'})` 
    : 'Direct';

  // Check database connection with retry for Neon cold starts
  let lastError = '';
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const userCount = await db.user.count();
      checks.Database = `✅ Connected (${userCount} users)`;

      // Check if admin user exists
      const admin = await db.user.findUnique({
        where: { email: 'admin@resumescreen.ai' },
      });
      checks.AdminUser = admin ? `✅ Exists` : '❌ Not found - run seed script';
      break;
    } catch (error) {
      lastError = (error as Error).message;
      if (attempt < 3 && lastError.includes('Can\'t reach database')) {
        // Wait before retry (Neon cold start)
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
        checks.Database = `⏳ Retrying connection (attempt ${attempt}/3)...`;
        continue;
      }
      checks.Database = `❌ Error: ${lastError}`;
      
      // Add helpful hint
      if (lastError.includes('Can\'t reach database')) {
        checks.Hint = 'Neon database may be paused. Visit your Neon console to wake it up, or check if the connection string is correct.';
      } else if (lastError.includes('prepared statement')) {
        checks.Hint = 'Add ?pgbouncer=true to your DATABASE_URL for Neon pooled connections.';
      }
    }
  }

  const allOk = Object.values(checks).every(v => !v.startsWith('❌'));

  return NextResponse.json({
    status: allOk ? 'healthy' : 'unhealthy',
    checks,
    timestamp: new Date().toISOString(),
  }, { status: allOk ? 200 : 500 });
}
