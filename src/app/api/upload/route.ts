import { NextRequest, NextResponse } from 'next/server';
import { validateFile, saveFile, extractTextFromFile } from '@/lib/file-processor';
import { analyzeResume } from '@/lib/ai-analyzer';
import { db } from '@/lib/db';

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

    // Step 1: Save and extract text from the resume
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

    // Step 2: AI Analysis with timeout (Netlify serverless has ~26s limit)
    let analysis;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25000);

      analysis = await Promise.race([
        analyzeResume(extractedText, jobDescription),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('AI analysis timed out after 25 seconds')), 25000)
        ),
      ]);

      clearTimeout(timeout);
    } catch (error) {
      console.error('AI analysis error:', error);
      // Still save the candidate but mark as error
      const candidate = await db.candidate.create({
        data: {
          fileName: file.name,
          filePath: filePath || '',
          department: department || '',
          jobTitle: jobTitle || '',
          jobDescription: jobDescription,
          candidateOverview: 'Analysis failed - please retry',
          scoring: 0,
          assessment: `AI analysis failed: ${(error as Error).message}`,
          professionalAudit: JSON.stringify({ pros: [], cons: [], red_flags: ['AI analysis failed'] }),
          recommendation: 'Error',
          extractedText: extractedText.substring(0, 5000),
          status: 'error',
        },
      });

      return NextResponse.json({
        success: false,
        error: `AI analysis failed: ${(error as Error).message}`,
        candidateId: candidate.id,
      }, { status: 500 });
    }

    // Step 3: Save candidate to database
    try {
      const candidate = await db.candidate.create({
        data: {
          fileName: file.name,
          filePath: filePath || '',
          firstName: analysis.candidate_info.first_name || '',
          lastName: analysis.candidate_info.last_name || '',
          email: analysis.candidate_info.email || '',
          phone: analysis.candidate_info.phone || '',
          department: department || '',
          jobTitle: jobTitle || '',
          jobDescription: jobDescription,
          candidateOverview: analysis.candidate_overview || '',
          scoring: analysis.scoring || 0,
          assessment: analysis.assessment || '',
          professionalAudit: JSON.stringify(analysis.professional_audit || { pros: [], cons: [], red_flags: [] }),
          recommendation: analysis.recommendation || '',
          extractedText: extractedText.substring(0, 5000),
          status: 'completed',
        },
      });

      return NextResponse.json({
        success: true,
        candidateId: candidate.id,
        scoring: analysis.scoring,
        recommendation: analysis.recommendation,
      });
    } catch (dbError) {
      console.error('Database save error:', dbError);
      return NextResponse.json({
        success: true,
        warning: 'Analysis completed but failed to save to database',
        scoring: analysis.scoring,
        recommendation: analysis.recommendation,
      });
    }
  } catch (error) {
    console.error('Upload processing error:', error);
    return NextResponse.json({
      error: `Internal server error: ${(error as Error).message}`,
    }, { status: 500 });
  }
}
