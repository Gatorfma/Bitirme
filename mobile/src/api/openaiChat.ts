/**
 * OpenAI Chat API
 * Direct OpenAI API integration for journal assistant
 */

import type { ChatMessage } from '../types/models';
import { QUESTION_STEMS } from '../journal/questionStems';

const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

/**
 * Get journal assistant reply from OpenAI
 * @param messages - Full conversation history
 * @param ragContext - Optional RAG context with reference examples
 * @param slotHint - Optional hint about known/missing slots
 * @returns Assistant's reply text
 */
export async function getJournalAssistantReply(
  messages: ChatMessage[],
  ragContext?: string,
  slotHint?: string
): Promise<string> {
  console.log('[OpenAI] Checking API key...', {
    hasKey: !!OPENAI_API_KEY,
    keyLength: OPENAI_API_KEY?.length || 0,
    keyPrefix: OPENAI_API_KEY?.substring(0, 7) || 'none',
  });

  if (!OPENAI_API_KEY) {
    console.error('[OpenAI] API key is not configured');
    throw new Error('OpenAI API key is not configured');
  }

  // Convert ChatMessage format to OpenAI format
  const openaiMessages = messages.map((msg) => {
    if (msg.type === 'user') {
      return {
        role: 'user' as const,
        content: msg.content,
      };
    } else {
      // Both 'question' and 'system' types are treated as assistant messages
      return {
        role: 'assistant' as const,
        content: msg.content,
      };
    }
  });

  // Build system prompt with optional RAG context
  const ragIncluded = !!ragContext;
  const slotHintIncluded = !!slotHint;
  let systemContent =
    'You are the MindJournal Journaling Agent. Your only goal is to extract details about the user\'s thought so a separate categorizer agent can classify it later.\n\n' +
    'Style: Be warm, concise, and non-clinical.\n\n' +
    'HARD CONSTRAINTS:\n' +
    '- DO NOT give advice, solutions, coping strategies, or action steps.\n' +
    '- Ask ONE specific leading question per turn.\n' +
    '- Questions MUST be contextually relevant to what the user just said.\n' +
    '- Reference specific details, emotions, or situations the user mentioned.\n' +
    '- Build on previous responses - do NOT ask generic or repetitive questions.\n' +
    '- If the user mentions a specific situation, emotion, or detail, ask about that specifically.\n\n' +
    'Information slots to collect (prioritize missing):\n' +
    '- situation (what/when/where/who)\n' +
    '- trigger (what started it)\n' +
    '- automatic thought (exact sentence)\n' +
    '- emotions + intensity 0-10\n' +
    '- body sensations\n' +
    '- evidence for / evidence against\n' +
    '- meaning (what it says about self/others/future)\n' +
    '- behavior/urge + consequence\n' +
    '- need/value/fear underneath\n\n' +
    'Question Relevance Guidelines:\n' +
    '- Read the user\'s most recent message carefully.\n' +
    '- Identify specific details they mentioned (emotions, situations, people, triggers).\n' +
    '- Ask about something directly related to what they just shared.\n' +
    '- If they mention an emotion, ask about intensity or where they feel it.\n' +
    '- If they mention a situation, ask about what triggered it or what happened before.\n' +
    '- If they mention a thought, ask about what it means to them or what evidence supports/contradicts it.\n' +
    '- Avoid asking about things they\'ve already clearly stated.\n\n' +
    'Output format:\n' +
    '- Start with one short reflective sentence that acknowledges what they just shared\n' +
    '- Then ask ONE contextually relevant question that builds on their response\n' +
    '- Do NOT number the question (no "1." prefix)\n' +
    '- Write the question naturally, as a complete sentence\n\n' +
    'Question style examples (adapt these to the user\'s specific context):\n' +
    QUESTION_STEMS.map((stem, i) => `${i + 1}. ${stem}`).join('\n');

  if (ragContext) {
    systemContent += `\n\nREFERENCE EXAMPLES INSTRUCTIONS:\n` +
      `Use references ONLY for how to ask probing questions and reflect feelings.\n` +
      `Do NOT quote verbatim.\n` +
      `Do NOT give advice or strategies.\n` +
      `Do NOT mention the dataset or RAG.\n\n` +
      `Reference examples:\n${ragContext}`;
  }

  const systemPrompt = {
    role: 'system' as const,
    content: systemContent,
  };

  // Build messages array: main system prompt, optional slotHint system message, then conversation
  const apiMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    systemPrompt,
  ];

  if (slotHint) {
    apiMessages.push({
      role: 'system' as const,
      content: slotHint,
    });
  }

  apiMessages.push(...openaiMessages);

  console.log('[OpenAI] Making API request...', {
    messageCount: openaiMessages.length,
    model: 'gpt-3.5-turbo',
    ragIncluded,
    slotHintIncluded,
  });

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: apiMessages,
      temperature: 0.7,
      max_tokens: 150,
    }),
  });

  console.log('[OpenAI] Response status:', response.status, response.statusText);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('[OpenAI] API error:', {
      status: response.status,
      statusText: response.statusText,
      error: errorData,
    });
    throw new Error(
      errorData.error?.message || `OpenAI API error: ${response.statusText}`
    );
  }

  const data = await response.json();
  console.log('[OpenAI] Response received:', {
    hasChoices: !!data.choices,
    choiceCount: data.choices?.length || 0,
    usage: data.usage,
  });

  const assistantMessage = data.choices?.[0]?.message?.content;

  if (!assistantMessage) {
    console.error('[OpenAI] No message content in response');
    throw new Error('No response from OpenAI');
  }

  console.log('[OpenAI] Success! Message length:', assistantMessage.length);
  return assistantMessage.trim();
}

