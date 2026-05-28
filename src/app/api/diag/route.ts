import { NextResponse } from 'next/server';

export async function GET() {
  const results: Record<string, string> = {};

  // Test Z-AI API connectivity
  const baseUrl = process.env.ZAI_BASE_URL || 'not set';
  const apiKey = process.env.ZAI_API_KEY || 'not set';
  
  results.ZAI_BASE_URL = baseUrl;
  results.ZAI_API_KEY = apiKey ? '✅ Set' : '❌ Missing';
  results.ZAI_CHAT_ID = process.env.ZAI_CHAT_ID ? '✅ Set' : '❌ Missing';
  results.ZAI_USER_ID = process.env.ZAI_USER_ID ? '✅ Set' : '❌ Missing';
  results.ZAI_TOKEN = process.env.ZAI_TOKEN ? '✅ Set' : '❌ Missing';

  // Test API connection
  if (baseUrl !== 'not set' && apiKey !== 'not set') {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'X-Z-AI-From': 'Z',
      };
      if (process.env.ZAI_CHAT_ID) headers['X-Chat-Id'] = process.env.ZAI_CHAT_ID;
      if (process.env.ZAI_USER_ID) headers['X-User-Id'] = process.env.ZAI_USER_ID;
      if (process.env.ZAI_TOKEN) headers['X-Token'] = process.env.ZAI_TOKEN;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Reply with OK' }],
          thinking: { type: 'disabled' },
        }),
      });
      clearTimeout(timeout);

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        results.ZAI_Connection = `✅ Connected (response: ${content?.substring(0, 50)})`;
      } else {
        const errorText = await response.text();
        results.ZAI_Connection = `❌ HTTP ${response.status}: ${errorText.substring(0, 100)}`;
      }
    } catch (error) {
      const err = error as Error;
      if (err.name === 'AbortError') {
        results.ZAI_Connection = '❌ Timeout (10s) - API unreachable';
      } else {
        results.ZAI_Connection = `❌ Fetch failed: ${err.message}`;
      }
    }
  } else {
    results.ZAI_Connection = '❌ Missing ZAI_BASE_URL or ZAI_API_KEY env vars';
  }

  return NextResponse.json({ results });
}
