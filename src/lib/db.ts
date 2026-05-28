import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Fix: If DATABASE_URL is not a PostgreSQL URL (e.g. file: from sandbox),
// override it with the correct PostgreSQL URL from .env.local
// This must happen BEFORE Prisma Client is instantiated
const currentUrl = process.env.DATABASE_URL
if (currentUrl && !currentUrl.startsWith('postgresql://') && !currentUrl.startsWith('postgres://')) {
  // The system env has a non-PostgreSQL URL (like file: from sandbox)
  // Override it - read from .env.local directly as a fallback
  try {
    const envPath = path.join(process.cwd(), '.env.local')
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8')
      const match = envContent.match(/DATABASE_URL\s*=\s*(postgresql:\/\/[^\s]+)/)
      if (match) {
        process.env.DATABASE_URL = match[1]
      }
    }
  } catch {
    // Ignore read errors
  }
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
