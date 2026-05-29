import { NextRequest, NextResponse } from 'next/server';
import { validateFile, saveFile, extractTextFromFile } from '@/lib/file-processor';
import { db } from '@/lib/db';

/**
 * POST /api/upload
 * Phase 1: Upload resume, extract text, create candidate with "processing" status
 * Returns candidate ID immediately (fast, < 5 seconds)
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('resume') as File | null;
    const jobDescription = formData.get('jobDescription') as string | null;
    const department = formData.get('department') as string | null;
    const jobTitle = formData.get('jobTitle') as string | null;

    // Validate inputs
    if (!file) {
      return NextResponse.json({ error: 'No resume file provided' }, { status: 400 });
    }

    const validation = validateFile(file);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    if (!jobDescription || jobDescription.trim().length === 0) {
      return NextResponse.json({ error: 'Job description is required' }, { status: 400 });
    }

    // Save file and extract text
    let filePath: string;
    let extractedText: string;
    try {
      filePath = await saveFile(file);
      extractedText = await extractTextFromFile(filePath, file.name);
    } catch (error) {
      console.error('File processing error:', error);
      return NextResponse.json({
        error: `Failed to process file: ${(error as Error).message}`,
      }, { status: 400 });
    }

    // Create candidate with "processing" status
    const candidate = await db.candidate.create({
      data: {
        fileName: file.name,
        filePath: filePath || '',
        department: department || '',
        jobTitle: jobTitle || '',
        jobDescription: jobDescription,
        candidateOverview: 'Analyzing resume...',
        scoring: 0,
        assessment: '',
        professionalAudit: JSON.stringify({ pros: [], cons: [], red_flags: [] }),
        recommendation: 'Processing',
        extractedText: extractedText.substring(0, 10000),
        status: 'processing',
      },
    });

    return NextResponse.json({
      success: true,
      candidateId: candidate.id,
      status: 'processing',
    });
  } catch (error) {
    console.error('Upload processing error:', error);
    return NextResponse.json({
      error: `Internal server error: ${(error as Error).message}`,
    }, { status: 500 });
  }
}
