import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Use DATABASE_URL from environment, preferring .env.local over system env
const databaseUrl = process.env.DATABASE_URL?.startsWith('postgresql://') || process.env.DATABASE_URL?.startsWith('postgres://')
  ? process.env.DATABASE_URL
  : 'postgresql://neondb_owner:npg_padyBwj2Uo4b@ep-morning-tooth-aon35kuf-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['query'],
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
