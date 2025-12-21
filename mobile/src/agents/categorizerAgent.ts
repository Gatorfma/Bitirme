/**
 * Categorizer Agent
 * Classifies thoughts into existing categories or proposes new ones
 */

const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

/**
 * Categorize a thought into an existing active/pending category or propose a new one
 * @param params - Session summary, thought text, and lists of active and pending category names
 * @returns Classification result with matchType, label, and confidence
 */
export async function categorizeThought(params: {
  sessionSummary: string;
  thoughtText: string;
  activeCategoryNames: string[];
  pendingCategoryNames: string[];
}): Promise<{ matchType: 'active' | 'pending' | 'new'; label: string; confidence: number }> {
  try {
    console.log('[Categorizer] Categorizing thought:', {
      thoughtTextLength: params.thoughtText.length,
      summaryLength: params.sessionSummary.length,
      activeCategoryCount: params.activeCategoryNames.length,
      pendingCategoryCount: params.pendingCategoryNames.length,
    });

    if (!OPENAI_API_KEY) {
      console.error('[Categorizer] API key is not configured');
      throw new Error('OpenAI API key is not configured');
    }

    if (!params.thoughtText || params.thoughtText.trim().length === 0) {
      throw new Error('Thought text is required');
    }

    // Build system prompt for categorization
    const activeCategoriesText =
      params.activeCategoryNames.length > 0
        ? `Existing active categories:\n${params.activeCategoryNames.map((name, i) => `${i + 1}. ${name}`).join('\n')}`
        : 'No existing active categories.';

    const pendingCategoriesText =
      params.pendingCategoryNames.length > 0
        ? `Existing pending categories:\n${params.pendingCategoryNames.map((name, i) => `${i + 1}. ${name}`).join('\n')}`
        : 'No existing pending categories.';

    const systemPrompt = `You are a thought categorization agent. Your task is to classify thoughts into categories.

CRITICAL REQUIREMENTS:
- Output ONLY valid JSON (no markdown, no code blocks, no explanations)
- The JSON must be parseable directly
- DO NOT give advice, interpretations, or suggestions - only classification
- MATCHING PRIORITY (in order):
  1. If the thought fits an existing ACTIVE category, use matchType="active" and label=that exact category name
  2. If no active match but fits a PENDING category, use matchType="pending" and label=that exact category name
  3. If neither fits, use matchType="new" and propose a short label (2-3 words, Title Case)
- Confidence should be 0-1 (how certain you are about this classification)

Output format (JSON only):
{
  "matchType": "active" or "pending" or "new",
  "label": "exact category name if active/pending, or new 2-3 word Title Case label if new",
  "confidence": 0.0-1.0
}

Examples:
- If thought is "I miss my ex" and active categories include "Relationship Loss", return: {"matchType": "active", "label": "Relationship Loss", "confidence": 0.9}
- If thought is "I'm stressed about work" and no active match but pending includes "Work Stress", return: {"matchType": "pending", "label": "Work Stress", "confidence": 0.85}
- If thought is "I'm failing at school" and no matching category exists, return: {"matchType": "new", "label": "Academic Failure", "confidence": 0.85}`;

    // Build user message with context
    const userMessage = `Session Summary:\n${params.sessionSummary}\n\nThought to categorize:\n"${params.thoughtText}"\n\n${activeCategoriesText}\n\n${pendingCategoriesText}\n\nClassify this thought.`;

    console.log('[Categorizer] Making OpenAI API request...', {
      model: 'gpt-3.5-turbo',
      temperature: 0.2,
      hasActiveCategories: params.activeCategoryNames.length > 0,
      hasPendingCategories: params.pendingCategoryNames.length > 0,
    });

    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: userMessage,
          },
        ],
        temperature: 0.2, // Low temperature for consistent classification
        max_tokens: 150,
        response_format: { type: 'json_object' }, // Force JSON output
      }),
    });

    console.log('[Categorizer] Response status:', response.status, response.statusText);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[Categorizer] API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
      });
      throw new Error(
        errorData.error?.message || `OpenAI API error: ${response.statusText}`
      );
    }

    const data = await response.json();
    console.log('[Categorizer] Response received:', {
      hasChoices: !!data.choices,
      choiceCount: data.choices?.length || 0,
      usage: data.usage,
    });

    const assistantMessage = data.choices?.[0]?.message?.content;

    if (!assistantMessage) {
      console.error('[Categorizer] No message content in response');
      throw new Error('No response from OpenAI');
    }

    // Parse JSON response
    let parsed: { matchType: string; label: string; confidence: number };
    try {
      // Remove any markdown code blocks if present (defensive)
      let jsonText = assistantMessage.trim();
      if (jsonText.startsWith('```')) {
        // Remove markdown code block markers
        jsonText = jsonText.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '');
      }
      parsed = JSON.parse(jsonText);
    } catch (parseError) {
      console.error('[Categorizer] Failed to parse JSON response:', {
        rawResponse: assistantMessage.substring(0, 200),
        error: parseError instanceof Error ? parseError.message : String(parseError),
      });
      throw new Error('Failed to parse OpenAI response as JSON');
    }

    // Validate response structure
    if (!parsed.matchType || (parsed.matchType !== 'active' && parsed.matchType !== 'pending' && parsed.matchType !== 'new')) {
      throw new Error(`Invalid response: matchType must be "active", "pending", or "new", got "${parsed.matchType}"`);
    }

    if (!parsed.label || typeof parsed.label !== 'string' || parsed.label.trim().length === 0) {
      throw new Error('Invalid response: label is missing or empty');
    }

    // Validate and clamp confidence
    let confidence = typeof parsed.confidence === 'number' 
      ? Math.max(0, Math.min(1, parsed.confidence)) // Clamp to 0-1
      : 0.5; // Default confidence if missing

    const normalizedLabel = parsed.label.trim();

    // If matchType is "active", verify the label matches an existing active category
    if (parsed.matchType === 'active') {
      const matchingCategory = params.activeCategoryNames.find(
        (cat) => cat.toLowerCase() === normalizedLabel.toLowerCase()
      );

      if (!matchingCategory) {
        console.warn('[Categorizer] Active match returned but label does not match any active category:', {
          returnedLabel: normalizedLabel,
          availableActiveCategories: params.activeCategoryNames,
        });
        // Fallback: check if it matches a pending category
        const pendingMatch = params.pendingCategoryNames.find(
          (cat) => cat.toLowerCase() === normalizedLabel.toLowerCase()
        );
        if (pendingMatch) {
          return {
            matchType: 'pending',
            label: pendingMatch,
            confidence: Math.max(0.3, confidence * 0.8), // Slightly reduce confidence
          };
        }
        // If no match at all, treat as new
        const newLabel = normalizedLabel
          .split(/\s+/)
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');
        return {
          matchType: 'new',
          label: newLabel,
          confidence: Math.max(0.3, confidence * 0.7), // Reduce confidence for mismatch
        };
      }

      // Use the exact category name from the list
      return {
        matchType: 'active',
        label: matchingCategory,
        confidence,
      };
    }

    // If matchType is "pending", verify the label matches an existing pending category
    if (parsed.matchType === 'pending') {
      const matchingCategory = params.pendingCategoryNames.find(
        (cat) => cat.toLowerCase() === normalizedLabel.toLowerCase()
      );

      if (!matchingCategory) {
        console.warn('[Categorizer] Pending match returned but label does not match any pending category:', {
          returnedLabel: normalizedLabel,
          availablePendingCategories: params.pendingCategoryNames,
        });
        // Fallback: check if it matches an active category
        const activeMatch = params.activeCategoryNames.find(
          (cat) => cat.toLowerCase() === normalizedLabel.toLowerCase()
        );
        if (activeMatch) {
          return {
            matchType: 'active',
            label: activeMatch,
            confidence: Math.max(0.3, confidence * 0.8), // Slightly reduce confidence
          };
        }
        // If no match at all, treat as new
        const newLabel = normalizedLabel
          .split(/\s+/)
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');
        return {
          matchType: 'new',
          label: newLabel,
          confidence: Math.max(0.3, confidence * 0.7), // Reduce confidence for mismatch
        };
      }

      // Use the exact category name from the list
      return {
        matchType: 'pending',
        label: matchingCategory,
        confidence,
      };
    }

    // For new categories, ensure Title Case (2-3 words)
    const newLabel = normalizedLabel
      .split(/\s+/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');

    console.log('[Categorizer] Classification completed:', {
      matchType: parsed.matchType,
      label: newLabel,
      confidence,
    });

    return {
      matchType: 'new',
      label: newLabel,
      confidence,
    };
  } catch (error) {
    console.error('[Categorizer] Failed to categorize thought:', {
      thoughtText: params.thoughtText.substring(0, 50),
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

