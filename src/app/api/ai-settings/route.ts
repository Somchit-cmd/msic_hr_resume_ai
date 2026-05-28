import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/ai-settings - Get current user's AI settings
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;

    let settings = await db.aISettings.findUnique({ where: { userId } });

    // Create default settings if none exist
    if (!settings) {
      settings = await db.aISettings.create({
        data: { userId },
      });
    }

    // Mask the API key for security - only show last 4 chars
    const maskedSettings = {
      ...settings,
      apiKey: settings.apiKey
        ? `••••••••${settings.apiKey.slice(-4)}`
        : null,
      hasApiKey: !!settings.apiKey,
    };

    return NextResponse.json({ settings: maskedSettings });
  } catch (error) {
    console.error("Error fetching AI settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch AI settings" },
      { status: 500 }
    );
  }
}

// PUT /api/ai-settings - Update AI settings
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const body = await request.json();

    const {
      provider,
      model,
      apiKey,
      baseUrl,
      temperature,
      maxTokens,
    } = body;

    // Validate provider
    const validProviders = ["z-ai", "openai", "anthropic", "google", "custom", "openrouter"];
    if (provider && !validProviders.includes(provider)) {
      return NextResponse.json(
        { error: `Invalid provider. Must be one of: ${validProviders.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate temperature
    if (temperature !== undefined && (temperature < 0 || temperature > 2)) {
      return NextResponse.json(
        { error: "Temperature must be between 0 and 2" },
        { status: 400 }
      );
    }

    // Validate maxTokens
    if (maxTokens !== undefined && (maxTokens < 1 || maxTokens > 128000)) {
      return NextResponse.json(
        { error: "Max tokens must be between 1 and 128000" },
        { status: 400 }
      );
    }

    // Build update data - only update apiKey if it's not a masked value
    const updateData: Record<string, unknown> = {};
    if (provider !== undefined) updateData.provider = provider;
    if (model !== undefined) updateData.model = model;
    if (baseUrl !== undefined) updateData.baseUrl = baseUrl || null;
    if (temperature !== undefined) updateData.temperature = temperature;
    if (maxTokens !== undefined) updateData.maxTokens = maxTokens;

    // Only update API key if it's a new value (not masked)
    if (apiKey !== undefined) {
      if (apiKey && !apiKey.startsWith("••••")) {
        updateData.apiKey = apiKey;
      } else if (apiKey === "" || apiKey === null) {
        updateData.apiKey = null;
      }
    }

    const settings = await db.aISettings.upsert({
      where: { userId },
      update: updateData,
      create: {
        userId,
        provider: provider || "z-ai",
        model: model || "default",
        apiKey: (apiKey && !apiKey.startsWith("••••")) ? apiKey : null,
        baseUrl: baseUrl || null,
        temperature: temperature ?? 0.7,
        maxTokens: maxTokens ?? 4096,
      },
    });

    // Return masked API key
    const maskedSettings = {
      ...settings,
      apiKey: settings.apiKey
        ? `••••••••${settings.apiKey.slice(-4)}`
        : null,
      hasApiKey: !!settings.apiKey,
    };

    return NextResponse.json({ settings: maskedSettings });
  } catch (error) {
    console.error("Error updating AI settings:", error);
    return NextResponse.json(
      { error: "Failed to update AI settings" },
      { status: 500 }
    );
  }
}

// POST /api/ai-settings - Test connection
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const settings = await db.aISettings.findUnique({ where: { userId } });

    if (!settings) {
      return NextResponse.json(
        { error: "No AI settings found" },
        { status: 404 }
      );
    }

    const { provider, apiKey, baseUrl, model } = settings;

    if (provider === "z-ai") {
      // If using Z-AI with custom API key
      if (model === "z-ai-api-key") {
        if (!apiKey) {
          return NextResponse.json({
            success: false,
            message: "API key is required for Z-AI with custom key mode",
            provider: "z-ai",
          }, { status: 400 });
        }
        // Use the user's custom base URL, or default to Z-AI public endpoint
        const endpoint = baseUrl || "https://internal-api.z.ai/v1/chat/completions";
        try {
          const response = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: "default",
              messages: [
                { role: "system", content: "You are a helpful assistant." },
                { role: "user", content: "Say 'Connection successful' and nothing else." },
              ],
              max_tokens: 20,
              temperature: 0.1,
            }),
          });

          if (!response.ok) {
            const errorData = await response.text();
            return NextResponse.json({
              success: false,
              message: `Z-AI API error (${response.status}): ${errorData.substring(0, 200)}`,
              provider: "z-ai",
            }, { status: 400 });
          }

          const data = await response.json();
          const content = data.choices?.[0]?.message?.content;
          return NextResponse.json({
            success: true,
            message: `Z-AI (API Key) connection successful`,
            response: content?.substring(0, 100),
            provider: "z-ai",
            model: "z-ai-api-key",
          });
        } catch (error) {
          return NextResponse.json({
            success: false,
            message: `Z-AI connection failed: ${(error as Error).message}`,
            provider: "z-ai",
          }, { status: 400 });
        }
      }

      // Test z-ai free mode - uses environment config (internal API)
      try {
        const zaiBaseUrl = process.env.ZAI_BASE_URL;
        const zaiApiKey = process.env.ZAI_API_KEY;
        
        if (!zaiBaseUrl || !zaiApiKey) {
          return NextResponse.json({
            success: false,
            message: "Z-AI free mode is not available on this server. Please switch to Z-AI with API Key or another provider.",
            provider: "z-ai",
          }, { status: 400 });
        }

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${zaiApiKey}`,
          "X-Z-AI-From": "Z",
        };
        if (process.env.ZAI_CHAT_ID) headers["X-Chat-Id"] = process.env.ZAI_CHAT_ID;
        if (process.env.ZAI_USER_ID) headers["X-User-Id"] = process.env.ZAI_USER_ID;
        if (process.env.ZAI_TOKEN) headers["X-Token"] = process.env.ZAI_TOKEN;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(`${zaiBaseUrl}/chat/completions`, {
          method: "POST",
          headers,
          signal: controller.signal,
          body: JSON.stringify({
            messages: [
              { role: "assistant", content: "You are a helpful assistant." },
              { role: "user", content: "Say 'Connection successful' and nothing else." },
            ],
            thinking: { type: "disabled" },
          }),
        });
        clearTimeout(timeout);

        if (!response.ok) {
          const errorData = await response.text();
          return NextResponse.json({
            success: false,
            message: `Z-AI API error (${response.status}): ${errorData.substring(0, 200)}`,
            provider: "z-ai",
          }, { status: 400 });
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        return NextResponse.json({
          success: true,
          message: `Z-AI (Free) connection successful`,
          response: content?.substring(0, 100),
          provider: "z-ai",
          model: "default",
        });
      } catch (error) {
        const err = error as Error;
        const message = err.name === 'AbortError' 
          ? "Z-AI free mode connection timed out. The server API may not be reachable from this hosting environment. Please switch to Z-AI with API Key or another provider."
          : `Z-AI connection failed: ${err.message}`;
        return NextResponse.json({
          success: false,
          message,
          provider: "z-ai",
        }, { status: 400 });
      }
    }

    if (!apiKey) {
      return NextResponse.json({
        success: false,
        message: `API key is required for ${provider}`,
        provider,
      }, { status: 400 });
    }

    // Test OpenAI-compatible endpoint (also handles OpenRouter and Custom)
    if (provider === "openai" || provider === "custom" || provider === "openrouter") {
      let endpoint = baseUrl;
      
      // Set default endpoint based on provider
      if (!endpoint) {
        endpoint = provider === "openrouter"
          ? "https://openrouter.ai/api/v1/chat/completions"
          : "https://api.openai.com/v1/chat/completions";
      }
      
      // Smart URL handling: if endpoint doesn't end with /chat/completions, append it
      if (!endpoint.endsWith('/chat/completions')) {
        endpoint = endpoint.replace(/\/+$/, '') + '/chat/completions';
      }

      const testHeaders: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      };

      // Add OpenRouter-specific headers
      if (endpoint.includes("openrouter.ai")) {
        testHeaders["HTTP-Referer"] = process.env.NEXTAUTH_URL || "https://msic-hr-ai.msigsx.com";
        testHeaders["X-Title"] = "MSIC HR Resume AI";
      }

      const modelName = provider === "openrouter" 
        ? (model === "default" ? "qwen/qwen3-235b-a22b" : model)
        : (model === "default" ? "gpt-4o-mini" : model);

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: testHeaders,
          body: JSON.stringify({
            model: modelName,
            messages: [
              { role: "system", content: "You are a helpful assistant." },
              { role: "user", content: "Say 'Connection successful' and nothing else." },
            ],
            max_tokens: 20,
            temperature: 0.1,
          }),
        });

        if (!response.ok) {
          const errorData = await response.text();
          return NextResponse.json({
            success: false,
            message: `${provider === "openrouter" ? "OpenRouter" : "OpenAI"} API error (${response.status}): ${errorData.substring(0, 200)}`,
            provider,
          }, { status: 400 });
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        return NextResponse.json({
          success: true,
          message: `${provider === "openrouter" ? "OpenRouter" : "OpenAI"} connection successful`,
          response: content?.substring(0, 100),
          provider,
          model: modelName,
        });
      } catch (error) {
        return NextResponse.json({
          success: false,
          message: `Connection failed: ${(error as Error).message}`,
          provider,
        }, { status: 400 });
      }
    }

    // Test Anthropic endpoint
    if (provider === "anthropic") {
      const endpoint = baseUrl || "https://api.anthropic.com/v1/messages";
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: model === "default" ? "claude-sonnet-4-20250514" : model,
            max_tokens: 20,
            messages: [
              { role: "user", content: "Say 'Connection successful' and nothing else." },
            ],
          }),
        });

        if (!response.ok) {
          const errorData = await response.text();
          return NextResponse.json({
            success: false,
            message: `Anthropic API error (${response.status}): ${errorData.substring(0, 200)}`,
            provider,
          }, { status: 400 });
        }

        const data = await response.json();
        const content = data.content?.[0]?.text;
        return NextResponse.json({
          success: true,
          message: `Anthropic connection successful`,
          response: content?.substring(0, 100),
          provider,
          model: model === "default" ? "claude-sonnet-4-20250514" : model,
        });
      } catch (error) {
        return NextResponse.json({
          success: false,
          message: `Connection failed: ${(error as Error).message}`,
          provider,
        }, { status: 400 });
      }
    }

    // Test Google Gemini endpoint
    if (provider === "google") {
      const geminiModel = model === "default" ? "gemini-2.0-flash" : model;
      const endpoint = baseUrl || `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`;
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: "Say 'Connection successful' and nothing else." }] }],
            generationConfig: { maxOutputTokens: 20, temperature: 0.1 },
          }),
        });

        if (!response.ok) {
          const errorData = await response.text();
          return NextResponse.json({
            success: false,
            message: `Google AI API error (${response.status}): ${errorData.substring(0, 200)}`,
            provider,
          }, { status: 400 });
        }

        const data = await response.json();
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
        return NextResponse.json({
          success: true,
          message: `Google AI connection successful`,
          response: content?.substring(0, 100),
          provider,
          model: geminiModel,
        });
      } catch (error) {
        return NextResponse.json({
          success: false,
          message: `Connection failed: ${(error as Error).message}`,
          provider,
        }, { status: 400 });
      }
    }

    return NextResponse.json({
      success: false,
      message: `Unknown provider: ${provider}`,
    }, { status: 400 });
  } catch (error) {
    console.error("Error testing AI connection:", error);
    return NextResponse.json(
      { error: "Failed to test connection" },
      { status: 500 }
    );
  }
}
