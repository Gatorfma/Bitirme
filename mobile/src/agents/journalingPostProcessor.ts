/**
 * Journaling Post-Processor
 * Summarizes journaling sessions and extracts thought statements using OpenAI
 */

const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

/**
 * Summarize and extract thoughts from journaling messages
 * @param params - Messages array with role, content, and timestamp
 * @returns Summary string and array of extracted thoughts with confidence
 */
export async function summarizeAndExtractThoughts(params: {
  messages: Array<{ role: 'user' | 'agent'; content: string; timestamp: string }>;
}): Promise<{
  summary: string;
  thoughts: Array<{ text: string; timestamp?: string; confidence?: number }>;
}> {
  try {
    console.log('[PostProcessor] Starting summarization and extraction:', {
      messageCount: params.messages.length,
    });

    if (!OPENAI_API_KEY) {
      console.error('[PostProcessor] API key is not configured');
      throw new Error('OpenAI API key is not configured');
    }

    if (!params.messages || params.messages.length === 0) {
      throw new Error('Messages array is required and cannot be empty');
    }

    // Filter to only user messages for thought extraction
    const userMessages = params.messages.filter((msg) => msg.role === 'user');
    const conversationText = params.messages
      .map((msg) => `${msg.role === 'user' ? 'User' : 'Agent'}: ${msg.content}`)
      .join('\n\n');

    console.log('[PostProcessor] Prepared conversation:', {
      totalMessages: params.messages.length,
      userMessageCount: userMessages.length,
      conversationLength: conversationText.length,
    });

    // Build system prompt for summarization and extraction
    const systemPrompt = `You are a journaling analysis agent. Your task is to:
1. Write a 2-4 sentence summary describing the core issue and emotions expressed
2. Extract 1-5 concise "thought statements" from the user's messages

CRITICAL REQUIREMENTS:
- Output ONLY valid JSON (no markdown, no code blocks, no explanations)
- The JSON must be parseable directly
- Summary should be 2-4 sentences describing the core issue + emotions
- Thoughts should be extracted from user content only (not agent questions)
- Each thought should be a concise statement like "I miss my ex." or "I'm failing at school."
- Include confidence score 0-1 for each thought (how certain you are this is a core thought)
- Do NOT include advice, solutions, or interpretations - only factual thought statements

Output format (JSON only):
{
  "summary": "2-4 sentence summary here",
  "thoughts": [
    {
      "text": "I miss my ex.",
      "confidence": 0.9
    },
    {
      "text": "I'm failing at school.",
      "confidence": 0.85
    }
  ]
}`;

    // Convert messages to OpenAI format
    const openaiMessages = [
      {
        role: 'system' as const,
        content: systemPrompt,
      },
      {
        role: 'user' as const,
        content: `Analyze this journaling conversation and extract the summary and thoughts:\n\n${conversationText}`,
      },
    ];

    console.log('[PostProcessor] Making OpenAI API request...', {
      model: 'gpt-3.5-turbo',
      temperature: 0.2,
      messageCount: params.messages.length,
    });

    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: openaiMessages,
        temperature: 0.2, // Low temperature for consistent, factual extraction
        max_tokens: 500,
        response_format: { type: 'json_object' }, // Force JSON output
      }),
    });

    console.log('[PostProcessor] Response status:', response.status, response.statusText);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[PostProcessor] API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
      });
      throw new Error(
        errorData.error?.message || `OpenAI API error: ${response.statusText}`
      );
    }

    const data = await response.json();
    console.log('[PostProcessor] Response received:', {
      hasChoices: !!data.choices,
      choiceCount: data.choices?.length || 0,
      usage: data.usage,
    });

    const assistantMessage = data.choices?.[0]?.message?.content;

    if (!assistantMessage) {
      console.error('[PostProcessor] No message content in response');
      throw new Error('No response from OpenAI');
    }

    // Parse JSON response
    let parsed: { summary: string; thoughts: Array<{ text: string; confidence?: number }> };
    try {
      // Remove any markdown code blocks if present (defensive)
      let jsonText = assistantMessage.trim();
      if (jsonText.startsWith('```')) {
        // Remove markdown code block markers
        jsonText = jsonText.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '');
      }
      parsed = JSON.parse(jsonText);
    } catch (parseError) {
      console.error('[PostProcessor] Failed to parse JSON response:', {
        rawResponse: assistantMessage.substring(0, 200),
        error: parseError instanceof Error ? parseError.message : String(parseError),
      });
      throw new Error('Failed to parse OpenAI response as JSON');
    }

    // Validate response structure
    if (!parsed.summary || typeof parsed.summary !== 'string') {
      throw new Error('Invalid response: summary is missing or not a string');
    }

    if (!Array.isArray(parsed.thoughts)) {
      throw new Error('Invalid response: thoughts is missing or not an array');
    }

    // Process thoughts: ensure they have text and confidence
    const processedThoughts = parsed.thoughts
      .filter((thought) => thought && typeof thought.text === 'string' && thought.text.trim().length > 0)
      .map((thought) => ({
        text: thought.text.trim(),
        confidence: typeof thought.confidence === 'number' 
          ? Math.max(0, Math.min(1, thought.confidence)) // Clamp to 0-1
          : 0.5, // Default confidence if missing
      }))
      .slice(0, 5); // Limit to 5 thoughts max

    // Map timestamps from original messages if available
    const thoughtsWithTimestamps = processedThoughts.map((thought) => {
      // Try to find matching user message timestamp
      const matchingMessage = userMessages.find((msg) =>
        msg.content.toLowerCase().includes(thought.text.toLowerCase().substring(0, 20))
      );
      
      return {
        text: thought.text,
        timestamp: matchingMessage?.timestamp,
        confidence: thought.confidence,
      };
    });

    console.log('[PostProcessor] Extraction completed:', {
      summaryLength: parsed.summary.length,
      extractedThoughtCount: thoughtsWithTimestamps.length,
      thoughts: thoughtsWithTimestamps.map((t) => ({
        text: t.text.substring(0, 50),
        confidence: t.confidence,
      })),
    });

    return {
      summary: parsed.summary.trim(),
      thoughts: thoughtsWithTimestamps,
    };
  } catch (error) {
    console.error('[PostProcessor] Failed to summarize and extract thoughts:', {
      messageCount: params.messages.length,
      error: (error as any)?.message ?? String(error),
      stack: (error as any)?.stack,
    });
    throw error;
  }
}

