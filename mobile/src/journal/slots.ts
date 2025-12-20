/**
 * Slot Tracking
 * Heuristic-based extraction of information slots from user text
 */

export type Slots = {
  situation?: string;
  trigger?: string;
  thought?: string;
  emotions?: string;
  intensity?: string;
};

/**
 * Update slots from user text using simple heuristics
 * No model calls - just regex and keyword matching
 */
export function updateSlotsFromUserText(prev: Slots, userText: string): Slots {
  const text = userText.toLowerCase();
  const updated = { ...prev };

  // Extract situation (what/when/where/who patterns)
  if (!updated.situation) {
    const situationPatterns = [
      /\b(when|where|who|what happened|at work|at home|at school|yesterday|today|this morning|this afternoon|this evening)\b/i,
      /\b(i was|i'm at|i went|i saw|i heard|someone|somebody)\b/i,
    ];
    if (situationPatterns.some(pattern => pattern.test(userText))) {
      // Extract first sentence or relevant phrase
      const sentences = userText.split(/[.!?]/);
      updated.situation = sentences[0]?.trim().substring(0, 200) || undefined;
    }
  }

  // Extract trigger (what started it)
  if (!updated.trigger) {
    const triggerPatterns = [
      /\b(triggered|started|began|because|when|after|since|due to|caused by)\b/i,
      /\b(it started|it began|this happened|that's when)\b/i,
    ];
    if (triggerPatterns.some(pattern => pattern.test(userText))) {
      const match = userText.match(/(?:triggered|started|began|because|when|after|since|due to|caused by|it started|it began|this happened|that's when)[^.!?]*/i);
      if (match) {
        updated.trigger = match[0].trim().substring(0, 200);
      }
    }
  }

  // Extract automatic thought (exact sentence patterns)
  if (!updated.thought) {
    const thoughtPatterns = [
      /\b(i think|i feel like|i believe|i thought|i'm thinking|it seems like|it feels like)\b/i,
      /\b(maybe|perhaps|probably|i guess|i suppose)\b/i,
    ];
    if (thoughtPatterns.some(pattern => pattern.test(userText))) {
      const sentences = userText.split(/[.!?]/);
      const thoughtSentence = sentences.find(s => 
        thoughtPatterns.some(p => p.test(s))
      );
      if (thoughtSentence) {
        updated.thought = thoughtSentence.trim().substring(0, 200);
      }
    }
  }

  // Extract emotions
  if (!updated.emotions) {
    const emotionKeywords = [
      'anxious', 'anxiety', 'worried', 'worry', 'nervous', 'stressed', 'stress',
      'sad', 'depressed', 'down', 'upset', 'hurt', 'disappointed',
      'angry', 'mad', 'frustrated', 'irritated', 'annoyed',
      'happy', 'excited', 'joyful', 'pleased', 'relieved',
      'scared', 'afraid', 'fearful', 'terrified', 'panicked',
      'confused', 'uncertain', 'unsure', 'lost', 'overwhelmed',
      'guilty', 'ashamed', 'embarrassed', 'lonely', 'isolated',
    ];
    const foundEmotions = emotionKeywords.filter(keyword => 
      new RegExp(`\\b${keyword}\\w*\\b`, 'i').test(userText)
    );
    if (foundEmotions.length > 0) {
      updated.emotions = foundEmotions.join(', ');
    }
  }

  // Extract intensity (0-10 scale mentions)
  if (!updated.intensity) {
    const intensityMatch = userText.match(/\b([0-9]|10)\s*(out of|\/)\s*10\b/i) ||
                           userText.match(/\b(intensity|level|scale)\s*[:\-]?\s*([0-9]|10)\b/i) ||
                           userText.match(/\b(very|extremely|really|quite|somewhat|a little|slightly)\b/i);
    if (intensityMatch) {
      // Try to extract number
      const numMatch = userText.match(/\b([0-9]|10)\b/);
      if (numMatch) {
        updated.intensity = numMatch[1];
      } else {
        // Map words to approximate numbers
        const intensityWords: Record<string, string> = {
          'extremely': '9',
          'very': '7',
          'really': '7',
          'quite': '6',
          'somewhat': '4',
          'a little': '3',
          'slightly': '2',
        };
        const word = intensityMatch[0].toLowerCase();
        for (const [key, value] of Object.entries(intensityWords)) {
          if (word.includes(key)) {
            updated.intensity = value;
            break;
          }
        }
      }
    }
  }

  return updated;
}

/**
 * Compute list of missing slot names
 */
export function computeMissingSlots(slots: Slots): string[] {
  const missing: string[] = [];
  if (!slots.situation) missing.push('situation');
  if (!slots.trigger) missing.push('trigger');
  if (!slots.thought) missing.push('thought');
  if (!slots.emotions) missing.push('emotions');
  if (!slots.intensity) missing.push('intensity');
  return missing;
}

