import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { validateFile, saveFile, extractTextFromFile } from "@/lib/file-processor";
import { analyzeResume } from "@/lib/ai-analyzer";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("resume") as File | null;
    const jobDescription = formData.get("jobDescription") as string | null;
    const department = formData.get("department") as string || "";
    const jobTitle = formData.get("jobTitle") as string || "";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!jobDescription?.trim()) {
      return NextResponse.json({ error: "Job description is required" }, { status: 400 });
    }

    // Validate file
    const validation = validateFile(file);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Save file
    let filePath: string;
    try {
      filePath = await saveFile(file);
    } catch (error) {
      console.error("File save error:", error);
      return NextResponse.json({ error: "Failed to save file" }, { status: 500 });
    }

    // Extract text with timeout
    let resumeText: string;
    try {
      const extractController = new AbortController();
      const extractTimeout = setTimeout(() => extractController.abort(), 15000);

      resumeText = await Promise.race([
        extractTextFromFile(filePath, file.name),
        new Promise<never>((_, reject) =>
          extractController.signal.addEventListener("abort", () =>
            reject(new Error("File extraction timed out"))
          )
        ),
      ]);
      clearTimeout(extractTimeout);
    } catch (error) {
      console.error("Text extraction error:", error);
      return NextResponse.json({
        error: `Failed to extract text: ${(error as Error).message}`,
      }, { status: 400 });
    }

    // AI analysis with timeout
    const analysisController = new AbortController();
    const analysisTimeout = setTimeout(() => analysisController.abort(), 25000);

    try {
      const result = await Promise.race([
        analyzeResume(resumeText, jobDescription, (session.user as { id: string }).id),
        new Promise<never>((_, reject) =>
          analysisController.signal.addEventListener("abort", () =>
            reject(new Error("AI analysis timed out (25s limit)"))
          )
        ),
      ]);
      clearTimeout(analysisTimeout);

      // Save candidate to database
      const candidate = await db.candidate.create({
        data: {
          fileName: file.name,
          filePath,
          firstName: result.candidate_info.first_name,
          lastName: result.candidate_info.last_name,
          email: result.candidate_info.email,
          phone: result.candidate_info.phone,
          department,
          jobTitle,
          jobDescription,
          candidateOverview: result.candidate_overview,
          scoring: result.scoring,
          assessment: result.assessment,
          professionalAudit: JSON.stringify(result.professional_audit),
          recommendation: result.recommendation,
          extractedText: resumeText.substring(0, 5000),
          status: "completed",
        },
      });

      return NextResponse.json({
        success: true,
        candidate: {
          id: candidate.id,
          fileName: candidate.fileName,
          scoring: candidate.scoring,
          recommendation: candidate.recommendation,
        },
      });
    } catch (error) {
      clearTimeout(analysisTimeout);
      console.error("AI analysis error:", error);

      // Save candidate with error status
      await db.candidate.create({
        data: {
          fileName: file.name,
          filePath,
          department,
          jobTitle,
          jobDescription,
          candidateOverview: "",
          scoring: 0,
          assessment: "",
          professionalAudit: JSON.stringify({ pros: [], cons: [], red_flags: [] }),
          recommendation: "Error",
          extractedText: resumeText.substring(0, 5000),
          status: "error",
        },
      });

      return NextResponse.json({
        error: `AI analysis failed: ${(error as Error).message}`,
      }, { status: 500 });
    }
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({
      error: "An unexpected error occurred during upload",
    }, { status: 500 });
  }
}
