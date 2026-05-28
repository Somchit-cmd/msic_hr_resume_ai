import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const firstName = searchParams.get('firstName') || '';
    const lastName = searchParams.get('lastName') || '';
    const department = searchParams.get('department') || '';
    const jobTitle = searchParams.get('jobTitle') || '';
    const search = searchParams.get('search') || '';

    // Build where clause
    const where: Record<string, unknown> = {};

    if (search) {
      // General search across name, department, job title
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { department: { contains: search, mode: 'insensitive' } },
        { jobTitle: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { fileName: { contains: search, mode: 'insensitive' } },
      ];
    } else {
      // Individual field filters
      const conditions: Record<string, unknown>[] = [];
      if (firstName) {
        conditions.push({ firstName: { contains: firstName, mode: 'insensitive' } });
      }
      if (lastName) {
        conditions.push({ lastName: { contains: lastName, mode: 'insensitive' } });
      }
      if (department) {
        conditions.push({ department: { contains: department, mode: 'insensitive' } });
      }
      if (jobTitle) {
        conditions.push({ jobTitle: { contains: jobTitle, mode: 'insensitive' } });
      }
      if (conditions.length > 0) {
        where.AND = conditions;
      }
    }

    const candidates = await db.candidate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fileName: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        department: true,
        jobTitle: true,
        scoring: true,
        recommendation: true,
        candidateOverview: true,
        status: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ candidates });
  } catch (error) {
    console.error('Error fetching candidates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch candidates' },
      { status: 500 }
    );
  }
}
