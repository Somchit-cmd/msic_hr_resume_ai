import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { validateFile, saveFile, extractTextFromFile, sanitizeText } from '@/lib/file-processor';
import { analyzeResume } from '@/lib/ai-analyzer';

// Timeout wrapper for serverless environments (Netlify has ~10-26s limit)
function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(message)), ms)
    ),
  ]);
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('resume') as File | null;
    const jobDescription = formData.get('jobDescription') as string | null;
    const jdDepartment = formData.get('department') as string | null;
    const jdJobTitle = formData.get('jobTitle') as string | null;

    // Validate job description
    if (!jobDescription || jobDescription.trim().length === 0) {
      return NextResponse.json(
        { error: 'Job description is required' },
        { status: 400 }
      );
    }

    if (jobDescription.trim().length < 20) {
      return NextResponse.json(
        { error: 'Job description is too short. Please provide a more detailed description.' },
        { status: 400 }
      );
    }

    // Validate file
    if (!file) {
      return NextResponse.json(
        { error: 'No resume file provided' },
        { status: 400 }
      );
    }

    const validation = validateFile(file);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    // Save file to disk (uses /tmp on serverless)
    const filePath = await saveFile(file);

    // Extract text from file
    let extractedText: string;
    try {
      extractedText = await withTimeout(
        extractTextFromFile(filePath, file.name),
        15000,
        'File text extraction timed out'
      );
    } catch (error) {
      return NextResponse.json(
        { error: `Failed to extract text from file: ${(error as Error).message}` },
        { status: 422 }
      );
    }

    // Get current user ID for AI settings
    let userId: string | undefined;
    try {
      const session = await getServerSession(authOptions);
      userId = (session?.user as { id?: string })?.id;
    } catch { /* ignore */ }

    // Analyze resume with AI (with 25s timeout for serverless)
    const sanitizedJD = sanitizeText(jobDescription);
    let analysis;
    try {
      analysis = await withTimeout(
        analyzeResume(extractedText, sanitizedJD, userId),
        25000,
        'AI analysis timed out. The server may be busy, please try again.'
      );
    } catch (error) {
      // Save the candidate with error status
      try {
        await db.candidate.create({
          data: {
            fileName: file.name,
            filePath,
            firstName: '',
            lastName: '',
            email: '',
            phone: '',
            department: jdDepartment || '',
            jobTitle: jdJobTitle || '',
            jobDescription: sanitizedJD,
            candidateOverview: 'Analysis failed',
            scoring: 0,
            assessment: `AI analysis failed: ${(error as Error).message}`,
            professionalAudit: JSON.stringify({ pros: [], cons: [], red_flags: ['AI analysis failed'] }),
            recommendation: 'Error',
            extractedText: extractedText.substring(0, 5000),
            status: 'error',
          },
        });
      } catch { /* ignore db error */ }
      
      return NextResponse.json(
        { error: `AI analysis failed: ${(error as Error).message}` },
        { status: 500 }
      );
    }

    // Save to database
    const candidate = await db.candidate.create({
      data: {
        fileName: file.name,
        filePath,
        firstName: analysis.candidate_info?.first_name || '',
        lastName: analysis.candidate_info?.last_name || '',
        email: analysis.candidate_info?.email || '',
        phone: analysis.candidate_info?.phone || '',
        department: jdDepartment || '',
        jobTitle: jdJobTitle || '',
        jobDescription: sanitizedJD,
        candidateOverview: analysis.candidate_overview,
        scoring: analysis.scoring,
        assessment: analysis.assessment,
        professionalAudit: JSON.stringify(analysis.professional_audit),
        recommendation: analysis.recommendation,
        extractedText: extractedText.substring(0, 5000),
        status: 'completed',
      },
    });

    return NextResponse.json({
      success: true,
      candidate: {
        id: candidate.id,
        fileName: candidate.fileName,
        scoring: candidate.scoring,
        recommendation: candidate.recommendation,
        candidateOverview: candidate.candidateOverview,
        createdAt: candidate.createdAt,
      },
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred while processing the resume' },
      { status: 500 }
    );
  }
}
