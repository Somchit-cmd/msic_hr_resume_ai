import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const candidate = await db.candidate.findUnique({
      where: { id },
    });

    if (!candidate) {
      return NextResponse.json(
        { error: 'Candidate not found' },
        { status: 404 }
      );
    }

    // Parse the professional audit JSON
    let professionalAudit;
    try {
      professionalAudit = JSON.parse(candidate.professionalAudit);
    } catch {
      professionalAudit = { pros: [], cons: [], red_flags: [] };
    }

    return NextResponse.json({
      candidate: {
        ...candidate,
        professionalAudit,
      },
    });
  } catch (error) {
    console.error('Error fetching candidate:', error);
    return NextResponse.json(
      { error: 'Failed to fetch candidate details' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const candidate = await db.candidate.findUnique({
      where: { id },
    });

    if (!candidate) {
      return NextResponse.json(
        { error: 'Candidate not found' },
        { status: 404 }
      );
    }

    await db.candidate.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting candidate:', error);
    return NextResponse.json(
      { error: 'Failed to delete candidate' },
      { status: 500 }
    );
  }
}
