import { db } from '@/lib/db';

const SYSTEM_PROMPT = `You are an expert HR Recruitment Consultant. Analyze the provided resume text against the Job Description. Return ONLY a valid JSON object with these keys: 'candidate_info', 'candidate_overview', 'scoring' (1-10), 'assessment', 'professional_audit' (pros, cons, red_flags), and 'recommendation'. No markdown, no conversational text.

The JSON structure must be exactly:
{
  "candidate_info": {
    "first_name": "Candidate's first name extracted from resume, or empty string if not found",
    "last_name": "Candidate's last name extracted from resume, or empty string if not found",
    "email": "Candidate's email address extracted from resume, or empty string if not found",
    "phone": "Candidate's phone number extracted from resume, or empty string if not found"
  },
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

Be thorough, objective, and professional in your analysis. Consider skills match, experience relevance, education, and any gaps or concerns. Always try to extract the candidate's name, email, and phone from the resume header/contact section.`;

export interface CandidateInfo {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
}

export interface AnalysisResult {
  candidate_info: CandidateInfo;
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

// Z-AI config - loaded from environment or .z-ai-config file
interface ZAIConfig {
  baseUrl: string;
  apiKey: string;
  chatId?: string;
  userId?: string;
  token?: string;
}

let zaiConfig: ZAIConfig | null = null;

async function getZAIConfig(): Promise<ZAIConfig> {
  if (zaiConfig) return zaiConfig;

  // Option 1: Environment variables
  if (process.env.ZAI_BASE_URL && process.env.ZAI_API_KEY) {
    zaiConfig = {
      baseUrl: process.env.ZAI_BASE_URL,
      apiKey: process.env.ZAI_API_KEY,
      chatId: process.env.ZAI_CHAT_ID,
      userId: process.env.ZAI_USER_ID,
      token: process.env.ZAI_TOKEN,
    };
    return zaiConfig;
  }

  // Option 2: Read .z-ai-config file
  try {
    const fsModule = await import('fs');
    const pathModule = await import('path');
    const osModule = await import('os');
    const configPaths = [
      pathModule.join(process.cwd(), '.z-ai-config'),
      pathModule.join(osModule.homedir(), '.z-ai-config'),
      '/etc/.z-ai-config',
    ];
    for (const filePath of configPaths) {
      try {
        const configStr = fsModule.readFileSync(filePath, 'utf-8');
        const config = JSON.parse(configStr);
        if (config.baseUrl && config.apiKey) {
          zaiConfig = config;
          return config;
        }
      } catch {
        // Continue to next path
      }
    }
  } catch {
    // Ignore
  }

  throw new Error('Z-AI configuration not found. Set ZAI_BASE_URL and ZAI_API_KEY environment variables, or create .z-ai-config file.');
}

/**
 * Get system AI settings (from the admin user - system-wide config)
 */
async function getSystemSettings() {
  try {
    // Find the admin user and use their AI settings
    const admin = await db.user.findFirst({ where: { role: "admin" } });
    if (!admin) return null;
    const settings = await db.aISettings.findUnique({ where: { userId: admin.id } });
    return settings;
  } catch {
    return null;
  }
}

/**
 * Analyze using Z-AI SDK (free mode) - directly calls the API
 */
async function analyzeWithZAI(resumeText: string, jobDescription: string): Promise<AnalysisResult> {
  const config = await getZAIConfig();

  const userMessage = `## Job Description:
${jobDescription}

## Candidate Resume:
${resumeText}

Analyze this resume against the job description and provide your assessment as a valid JSON object.`;

  const url = `${config.baseUrl}/chat/completions`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${config.apiKey}`,
    'X-Z-AI-From': 'Z',
  };
  if (config.chatId) headers['X-Chat-Id'] = config.chatId;
  if (config.userId) headers['X-User-Id'] = config.userId;
  if (config.token) headers['X-Token'] = config.token;

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      thinking: { type: 'disabled' },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Z-AI API error (${response.status}): ${errorText.substring(0, 200)}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content || content.trim().length === 0) {
    throw new Error('Empty response from Z-AI');
  }
  return parseAIResponse(content);
}

/**
 * Analyze using Z-AI with a custom API key (OpenAI-compatible endpoint)
 */
async function analyzeWithZAIKey(
  resumeText: string,
  jobDescription: string,
  apiKey: string,
  baseUrl: string | null,
  temperature: number,
  maxTokens: number
): Promise<AnalysisResult> {
  const endpoint = baseUrl || 'https://internal-api.z.ai/v1/chat/completions';

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'default',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `## Job Description:\n${jobDescription}\n\n## Candidate Resume:\n${resumeText}\n\nAnalyze this resume against the job description and provide your assessment as a valid JSON object.` },
      ],
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Z-AI API error (${response.status}): ${errorText.substring(0, 200)}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content || content.trim().length === 0) {
    throw new Error('Empty response from Z-AI (API Key mode)');
  }
  return parseAIResponse(content);
}

/**
 * Analyze using OpenAI-compatible API (also works with Groq, Together, etc.)
 */
async function analyzeWithOpenAI(
  resumeText: string,
  jobDescription: string,
  apiKey: string,
  baseUrl: string | null,
  model: string,
  temperature: number,
  maxTokens: number
): Promise<AnalysisResult> {
  // Smart URL handling: if baseUrl doesn't end with /chat/completions, append it
  let endpoint = baseUrl || 'https://api.openai.com/v1/chat/completions';
  if (!endpoint.endsWith('/chat/completions')) {
    // Remove trailing slash before appending
    endpoint = endpoint.replace(/\/+$/, '') + '/chat/completions';
  }
  const modelName = model === 'default' ? 'gpt-4o-mini' : model;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: modelName,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `## Job Description:\n${jobDescription}\n\n## Candidate Resume:\n${resumeText}\n\nAnalyze this resume against the job description and provide your assessment as a valid JSON object.` },
      ],
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error (${response.status}): ${errorText.substring(0, 200)}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content || content.trim().length === 0) {
    throw new Error('Empty response from AI');
  }
  return parseAIResponse(content);
}

/**
 * Analyze using OpenRouter API (OpenAI-compatible with extra headers)
 */
async function analyzeWithOpenRouter(
  resumeText: string,
  jobDescription: string,
  apiKey: string,
  baseUrl: string | null,
  model: string,
  temperature: number,
  maxTokens: number
): Promise<AnalysisResult> {
  const modelName = model === 'default' ? 'qwen/qwen3-235b-a22b' : model;
  // OpenRouter default base URL
  let endpoint = baseUrl || 'https://openrouter.ai/api/v1/chat/completions';
  if (!endpoint.endsWith('/chat/completions')) {
    endpoint = endpoint.replace(/\/+$/, '') + '/chat/completions';
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
    'HTTP-Referer': process.env.NEXTAUTH_URL || 'https://msic-hr-ai.msigsx.com',
    'X-Title': 'MSIC HR Resume AI',
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: modelName,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `## Job Description:\n${jobDescription}\n\n## Candidate Resume:\n${resumeText}\n\nAnalyze this resume against the job description and provide your assessment as a valid JSON object.` },
      ],
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error (${response.status}): ${errorText.substring(0, 200)}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content || content.trim().length === 0) {
    throw new Error('Empty response from OpenRouter');
  }
  return parseAIResponse(content);
}

/**
 * Analyze using Anthropic API
 */
async function analyzeWithAnthropic(
  resumeText: string,
  jobDescription: string,
  apiKey: string,
  baseUrl: string | null,
  model: string,
  temperature: number,
  maxTokens: number
): Promise<AnalysisResult> {
  const endpoint = baseUrl || 'https://api.anthropic.com/v1/messages';
  const modelName = model === 'default' ? 'claude-sonnet-4-20250514' : model;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: modelName,
      max_tokens: maxTokens,
      temperature,
      system: SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: `## Job Description:\n${jobDescription}\n\n## Candidate Resume:\n${resumeText}\n\nAnalyze this resume against the job description and provide your assessment as a valid JSON object.` },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic API error (${response.status}): ${errorText.substring(0, 200)}`);
  }

  const data = await response.json();
  const content = data.content?.[0]?.text;
  if (!content || content.trim().length === 0) {
    throw new Error('Empty response from Anthropic');
  }
  return parseAIResponse(content);
}

/**
 * Analyze using Google Gemini API
 */
async function analyzeWithGoogle(
  resumeText: string,
  jobDescription: string,
  apiKey: string,
  baseUrl: string | null,
  model: string,
  temperature: number,
  maxTokens: number
): Promise<AnalysisResult> {
  const modelName = model === 'default' ? 'gemini-2.0-flash' : model;
  const endpoint = baseUrl || `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: `${SYSTEM_PROMPT}\n\n## Job Description:\n${jobDescription}\n\n## Candidate Resume:\n${resumeText}\n\nAnalyze this resume against the job description and provide your assessment as a valid JSON object.`
        }]
      }],
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google AI API error (${response.status}): ${errorText.substring(0, 200)}`);
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content || content.trim().length === 0) {
    throw new Error('Empty response from Google AI');
  }
  return parseAIResponse(content);
}

/**
 * Parse and validate AI response
 */
function parseAIResponse(response: string): AnalysisResult {
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

  // Validate and default candidate_info
  if (!result.candidate_info) {
    result.candidate_info = { first_name: '', last_name: '', email: '', phone: '' };
  }
  result.candidate_info = {
    first_name: result.candidate_info.first_name || '',
    last_name: result.candidate_info.last_name || '',
    email: result.candidate_info.email || '',
    phone: result.candidate_info.phone || '',
  };

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
}

/**
 * Main analysis function - reads user settings and routes to appropriate provider
 */
export async function analyzeResume(
  resumeText: string,
  jobDescription: string,
  userId?: string
): Promise<AnalysisResult> {
  const settings = await getSystemSettings();

  const provider = settings?.provider || 'z-ai';
  const model = settings?.model || 'default';
  const apiKey = settings?.apiKey || null;
  const baseUrl = settings?.baseUrl || null;
  const temperature = settings?.temperature ?? 0.7;
  const maxTokens = settings?.maxTokens ?? 4096;

  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      switch (provider) {
        case 'z-ai':
          if (model === 'z-ai-api-key') {
            if (!apiKey) throw new Error('API key is required for Z-AI with custom key');
            return await analyzeWithZAIKey(resumeText, jobDescription, apiKey, baseUrl, temperature, maxTokens);
          }
          return await analyzeWithZAI(resumeText, jobDescription);

        case 'openrouter':
          if (!apiKey) throw new Error('API key is required for OpenRouter');
          return await analyzeWithOpenRouter(resumeText, jobDescription, apiKey, baseUrl, model, temperature, maxTokens);

        case 'openai':
        case 'custom':
          if (!apiKey) throw new Error('API key is required for this provider');
          return await analyzeWithOpenAI(resumeText, jobDescription, apiKey, baseUrl, model, temperature, maxTokens);

        case 'anthropic':
          if (!apiKey) throw new Error('API key is required for Anthropic provider');
          return await analyzeWithAnthropic(resumeText, jobDescription, apiKey, baseUrl, model, temperature, maxTokens);

        case 'google':
          if (!apiKey) throw new Error('API key is required for Google AI provider');
          return await analyzeWithGoogle(resumeText, jobDescription, apiKey, baseUrl, model, temperature, maxTokens);

        default:
          throw new Error(`Unknown AI provider: ${provider}`);
      }
    } catch (error) {
      lastError = error as Error;
      console.error(`AI analysis attempt ${attempt} failed (${provider}/${model}):`, error);

      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  throw new Error(`AI analysis failed after ${maxRetries} attempts (${provider}/${model}): ${lastError?.message}`);
}
