import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Fix: If DATABASE_URL is not a PostgreSQL URL (e.g. file: from sandbox),
// override it with the correct PostgreSQL URL from .env.local
// This must happen BEFORE Prisma Client is instantiated
let dbUrl = process.env.DATABASE_URL
if (dbUrl && !dbUrl.startsWith('postgresql://') && !dbUrl.startsWith('postgres://')) {
  // The system env has a non-PostgreSQL URL (like file: from sandbox)
  // Override it - read from .env.local directly as a fallback
  try {
    const envPath = path.join(process.cwd(), '.env.local')
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8')
      const match = envContent.match(/DATABASE_URL\s*=\s*(postgresql:\/\/[^\s]+)/)
      if (match) {
        dbUrl = match[1]
        process.env.DATABASE_URL = dbUrl
      }
    }
  } catch {
    // Ignore read errors
  }
}

// For Neon pooled connections (-pooler endpoint), Prisma needs pgbouncer=true
// and connection_timeout increased to handle cold starts
if (dbUrl && dbUrl.includes('-pooler') && !dbUrl.includes('pgbouncer=true')) {
  const separator = dbUrl.includes('?') ? '&' : '?'
  process.env.DATABASE_URL = `${dbUrl}${separator}pgbouncer=true`
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query'] : ['error'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
