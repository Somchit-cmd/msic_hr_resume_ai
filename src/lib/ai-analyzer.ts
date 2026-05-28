import ZAI from 'z-ai-web-dev-sdk';

const SYSTEM_PROMPT = `You are an expert HR Recruitment Consultant. Analyze the provided resume text against the Job Description. Return ONLY a valid JSON object with these keys: 'candidate_overview', 'scoring' (1-10), 'assessment', 'professional_audit' (pros, cons, red_flags), and 'recommendation'. No markdown, no conversational text.

The JSON structure must be exactly:
{
  "candidate_overview": "A brief summary of the candidate's background, experience, and key qualifications",
  "scoring": <number 1-10>,
  "assessment": "A detailed assessment of how well the candidate matches the job requirements",
  "professional_audit": {
    "pros": ["strength1", "strength2", "strength3"],
    "cons": ["weakness1", "weakness2", "weakness3"],
    "red_flags": ["flag1", "flag2"] 
  },
  "recommendation": "Strong Hire | Hire | Lean Hire | No Hire | Strong No Hire"
}

Be thorough, objective, and professional in your analysis. Consider skills match, experience relevance, education, and any gaps or concerns.`;

let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null;

async function getZAI() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}

export interface AnalysisResult {
  candidate_overview: string;
  scoring: number;
  assessment: string;
  professional_audit: {
    pros: string[];
    cons: string[];
    red_flags: string[];
  };
  recommendation: string;
}

/**
 * Analyzes a resume against a job description using AI
 */
export async function analyzeResume(
  resumeText: string,
  jobDescription: string
): Promise<AnalysisResult> {
  const zai = await getZAI();

  const userMessage = `## Job Description:
${jobDescription}

## Candidate Resume:
${resumeText}

Analyze this resume against the job description and provide your assessment as a valid JSON object.`;

  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const completion = await zai.chat.completions.create({
        messages: [
          {
            role: 'assistant',
            content: SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: userMessage,
          },
        ],
        thinking: { type: 'disabled' },
      });

      const response = completion.choices[0]?.message?.content;

      if (!response || response.trim().length === 0) {
        throw new Error('Empty response from AI');
      }

      // Parse the JSON response - handle potential markdown code blocks
      let jsonStr = response.trim();
      
      // Remove markdown code block formatting if present
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.slice(7);
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.slice(3);
      }
      if (jsonStr.endsWith('```')) {
        jsonStr = jsonStr.slice(0, -3);
      }
      jsonStr = jsonStr.trim();

      const result: AnalysisResult = JSON.parse(jsonStr);

      // Validate the structure
      if (!result.candidate_overview || typeof result.scoring !== 'number' || 
          !result.assessment || !result.professional_audit || !result.recommendation) {
        throw new Error('Invalid response structure from AI');
      }

      // Clamp scoring to 1-10
      result.scoring = Math.max(1, Math.min(10, Math.round(result.scoring)));

      // Ensure arrays exist
      if (!Array.isArray(result.professional_audit.pros)) {
        result.professional_audit.pros = [String(result.professional_audit.pros)];
      }
      if (!Array.isArray(result.professional_audit.cons)) {
        result.professional_audit.cons = [String(result.professional_audit.cons)];
      }
      if (!Array.isArray(result.professional_audit.red_flags)) {
        result.professional_audit.red_flags = [String(result.professional_audit.red_flags)];
      }

      return result;
    } catch (error) {
      lastError = error as Error;
      console.error(`AI analysis attempt ${attempt} failed:`, error);

      if (attempt < maxRetries) {
        // Wait before retry with exponential backoff
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  throw new Error(`AI analysis failed after ${maxRetries} attempts: ${lastError?.message}`);
}
