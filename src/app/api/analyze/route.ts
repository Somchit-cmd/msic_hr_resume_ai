import { NextRequest, NextResponse } from 'next/server';
import { analyzeResume } from '@/lib/ai-analyzer';
import { db } from '@/lib/db';

/**
 * POST /api/analyze
 * Phase 2: Run AI analysis on an uploaded candidate (processing status)
 * This is called after /api/upload returns a candidate ID
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { candidateId } = body;

    if (!candidateId) {
      return NextResponse.json({ error: 'Candidate ID is required' }, { status: 400 });
    }

    // Fetch the candidate
    const candidate = await db.candidate.findUnique({
      where: { id: candidateId },
    });

    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    }

    if (candidate.status === 'completed') {
      return NextResponse.json({
        success: true,
        candidateId: candidate.id,
        scoring: candidate.scoring,
        recommendation: candidate.recommendation,
        status: 'completed',
      });
    }

    if (!candidate.extractedText || !candidate.jobDescription) {
      await db.candidate.update({
        where: { id: candidateId },
        data: {
          status: 'error',
          candidateOverview: 'Missing resume text or job description',
          assessment: 'Analysis failed: incomplete data',
          recommendation: 'Error',
        },
      });
      return NextResponse.json({
        success: false,
        error: 'Missing resume text or job description',
        candidateId,
        status: 'error',
      }, { status: 400 });
    }

    // Run AI analysis (no artificial timeout — let it run as long as the serverless function allows)
    try {
      const analysis = await analyzeResume(candidate.extractedText, candidate.jobDescription);

      // Update candidate with analysis results
      await db.candidate.update({
        where: { id: candidateId },
        data: {
          firstName: analysis.candidate_info.first_name || '',
          lastName: analysis.candidate_info.last_name || '',
          email: analysis.candidate_info.email || '',
          phone: analysis.candidate_info.phone || '',
          candidateOverview: analysis.candidate_overview || '',
          scoring: analysis.scoring || 0,
          assessment: analysis.assessment || '',
          professionalAudit: JSON.stringify(analysis.professional_audit || { pros: [], cons: [], red_flags: [] }),
          recommendation: analysis.recommendation || '',
          status: 'completed',
        },
      });

      return NextResponse.json({
        success: true,
        candidateId,
        scoring: analysis.scoring,
        recommendation: analysis.recommendation,
        status: 'completed',
      });
    } catch (error) {
      console.error('AI analysis error:', error);

      // Update candidate with error status
      await db.candidate.update({
        where: { id: candidateId },
        data: {
          status: 'error',
          candidateOverview: 'Analysis failed — click retry or try a different AI model',
          scoring: 0,
          assessment: `AI analysis failed: ${(error as Error).message}`,
          professionalAudit: JSON.stringify({ pros: [], cons: [], red_flags: ['AI analysis failed'] }),
          recommendation: 'Error',
        },
      });

      return NextResponse.json({
        success: false,
        error: `AI analysis failed: ${(error as Error).message}`,
        candidateId,
        status: 'error',
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Analyze route error:', error);
    return NextResponse.json({
      error: `Internal server error: ${(error as Error).message}`,
    }, { status: 500 });
  }
}
