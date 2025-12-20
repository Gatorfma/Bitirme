/**
 * NewSessionScreen
 * Chat-like journaling interface
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { JournalStackScreenProps } from '../../types/navigation';

import { MessageBubble, QuestionBubble } from '../../components/journal';
import { PrimaryButton } from '../../components/common';
import { useCreateSession } from '../../hooks/useJournal';
import type { ChatMessage } from '../../types/models';
import { getJournalAssistantReply } from '../../api/openaiChat';
import { retrieve } from '../../rag/inMemoryRag';
import { updateSlotsFromUserText, computeMissingSlots, type Slots } from '../../journal/slots';
import { createSession, updateSession, deleteSession, hasUserMessages } from '../../journal/supabaseSessionRepo';

type NavigationProp = JournalStackScreenProps<'NewSession'>['navigation'];

// Initial guiding questions
const INITIAL_QUESTIONS = [
  "Hello! I'm here to help you explore your thoughts. What's on your mind right now?",
];

// Follow-up questions pool (simplified - would come from AI in production)
const FOLLOW_UP_QUESTIONS = [
  "What triggered this feeling?",
  "How did your body react to this?",
  "Can you tell me more about that?",
  "What thoughts came to mind first?",
  "Have you experienced this before?",
  "What would help you feel better right now?",
];

export default function NewSessionScreen() {
  const navigation = useNavigation<NavigationProp>();
  const createSessionMutation = useCreateSession();
  const flatListRef = useRef<FlatList>(null);

  // Session tracking
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substring(7)}`);
  const [sessionStartedAt] = useState(() => new Date());
  const supabaseSessionIdRef = useRef<string | null>(null);
  const hasCreatedSessionRef = useRef(false);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      type: 'question',
      content: INITIAL_QUESTIONS[0],
      timestamp: new Date().toISOString(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [slots, setSlots] = useState<Slots>({});

  const userThoughts = messages.filter(m => m.type === 'user');

  // Ensure Supabase session exists (create if needed)
  const ensureSupabaseSession = useCallback(async () => {
    if (hasCreatedSessionRef.current && supabaseSessionIdRef.current) {
      return; // Already created
    }

    try {
      const result = await createSession({
        startedAt: sessionStartedAt.toISOString(),
      });
      supabaseSessionIdRef.current = result.id;
      hasCreatedSessionRef.current = true;
      console.log('[NewSession] Supabase session created:', result.id);
    } catch (error) {
      console.error('[NewSession] Failed to create Supabase session:', error);
      // Don't throw - non-blocking
    }
  }, [sessionStartedAt]);

  // Update Supabase session (non-blocking)
  const updateSupabaseSession = useCallback(async (currentMessages: ChatMessage[], endedAt?: string) => {
    if (!supabaseSessionIdRef.current) {
      // Try to create session first if it doesn't exist
      await ensureSupabaseSession();
    }

    if (!supabaseSessionIdRef.current) {
      console.warn('[NewSession] Cannot update session - no Supabase session ID');
      return;
    }

    // Check if session has user messages
    const hasUserMsgs = hasUserMessages(currentMessages);
    
    // Fire and forget - don't block UI
    (async () => {
      try {
        if (!hasUserMsgs) {
          // Delete empty session instead of updating
          console.log('[NewSession] Session has no user messages, deleting empty session');
          await deleteSession(supabaseSessionIdRef.current!);
          supabaseSessionIdRef.current = null;
          hasCreatedSessionRef.current = false;
        } else {
          await updateSession({
            id: supabaseSessionIdRef.current!,
            messages: currentMessages,
            endedAt,
          });
        }
      } catch (error) {
        console.error('[NewSession] Failed to update/delete Supabase session:', error);
        // Don't throw - non-blocking
      }
    })();
  }, [ensureSupabaseSession]);

  // Save on unmount
  useEffect(() => {
    return () => {
      // Update session with endedAt on unmount (non-blocking)
      if (supabaseSessionIdRef.current) {
        updateSupabaseSession(messages, new Date().toISOString());
      }
    };
  }, [messages, updateSupabaseSession]);

  // Save on back navigation (when screen loses focus)
  useFocusEffect(
    useCallback(() => {
      return () => {
        // Screen is losing focus (navigating away)
        if (supabaseSessionIdRef.current) {
          updateSupabaseSession(messages, new Date().toISOString());
        }
      };
    }, [messages, updateSupabaseSession])
  );

  const sendMessage = useCallback(async () => {
    if (!inputText.trim()) return;

    // Add user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: inputText.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsTyping(true);

    // Ensure Supabase session exists (create on first message)
    await ensureSupabaseSession();

    try {
      // Get updated messages with the new user message
      const updatedMessages = [...messages, userMessage];
      const userText = userMessage.content;

      // Update slots from user text
      const updatedSlots = updateSlotsFromUserText(slots, userText);
      setSlots(updatedSlots);
      const missingSlots = computeMissingSlots(updatedSlots);

      // Build slot hint
      const knownParts: string[] = [];
      if (updatedSlots.situation) knownParts.push(`situation=${updatedSlots.situation.substring(0, 50)}...`);
      if (updatedSlots.trigger) knownParts.push(`trigger=${updatedSlots.trigger.substring(0, 50)}...`);
      if (updatedSlots.thought) knownParts.push(`thought=${updatedSlots.thought.substring(0, 50)}...`);
      if (updatedSlots.emotions) knownParts.push(`emotions=${updatedSlots.emotions}`);
      if (updatedSlots.intensity) knownParts.push(`intensity=${updatedSlots.intensity}`);

      let slotHint: string | undefined;
      if (knownParts.length > 0 || missingSlots.length > 0) {
        const knownStr = knownParts.length > 0 ? `Known so far: ${knownParts.join(', ')}\n` : '';
        const missingStr = missingSlots.length > 0 ? `Missing information: ${missingSlots.join(', ')}\n` : '';
        slotHint = `${knownStr}${missingStr}Ask ONE contextually relevant question about the missing information that relates to what the user just shared. Reference specific details from their message.`;
      }

      // Retrieve RAG context (gracefully handle failures)
      let ragContext: string | undefined;
      try {
        const hits = await retrieve(userText, 4);
        console.log('[RAG] topHits:', hits.map((h) => ({
          id: h.id,
          score: h.score.toFixed(4),
        })));

        // Build ragContext string with ~300 char limit per snippet
        const contextParts = hits.map((hit) => {
          const truncated = hit.text.length > 300
            ? hit.text.substring(0, 297) + '...'
            : hit.text;
          return `[${hit.id} score=${hit.score.toFixed(2)}] ${truncated}`;
        });
        ragContext = contextParts.join('\n');
      } catch (ragError) {
        console.error('[NewSession] RAG retrieval failed, continuing without context:', ragError);
        // Continue without RAG context
      }

      console.log('[NewSession] Calling OpenAI API with', updatedMessages.length, 'messages');
      const aiReply = await getJournalAssistantReply(updatedMessages, ragContext, slotHint);
      console.log('[NewSession] Received AI reply:', aiReply.substring(0, 50) + '...');
      
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'question',
        content: aiReply,
        timestamp: new Date().toISOString(),
      };
      const updatedMessagesWithReply = [...updatedMessages, aiMessage];
      setMessages(prev => [...prev, aiMessage]);

      // Autosave to Supabase after agent reply (non-blocking)
      updateSupabaseSession(updatedMessagesWithReply);
    } catch (error) {
      console.error('[NewSession] Failed to get AI response:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[NewSession] Error details:', errorMessage);
      const fallbackMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'question',
        content: "Sorry — I couldn't respond right now. Please try again.",
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, fallbackMessage]);
    } finally {
      setIsTyping(false);
    }
  }, [inputText, messages]);

  const handleBack = useCallback(() => {
    // Update session with endedAt before navigating (non-blocking)
    updateSupabaseSession(messages, new Date().toISOString());
    navigation.goBack();
  }, [navigation, messages, updateSupabaseSession]);

  const handleEndSession = async () => {
    if (userThoughts.length === 0) {
      handleBack();
      return;
    }

    try {
      await createSessionMutation.mutateAsync({
        thoughts: userThoughts.map(m => ({
          content: m.content,
          timestamp: m.timestamp,
        })),
        mood: 6, // Would be set by user in a real app
      });
      
      // Update Supabase session with endedAt (non-blocking)
      updateSupabaseSession(messages, new Date().toISOString());
      
      navigation.goBack();
    } catch (error) {
      console.error('Failed to save session:', error);
      // Still update Supabase even if API call failed
      updateSupabaseSession(messages, new Date().toISOString());
    }
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    if (item.type === 'user') {
      return <MessageBubble content={item.content} timestamp={item.timestamp} />;
    }
    return <QuestionBubble content={item.content} />;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Session</Text>
        <TouchableOpacity onPress={handleEndSession}>
          <Text style={styles.endText}>End</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
          ListFooterComponent={isTyping ? <QuestionBubble content="" isTyping /> : null}
        />

        {/* Input */}
        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="Share what's on your mind..."
              placeholderTextColor="#9DAEBB"
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={1000}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                inputText.trim() && styles.sendButtonActive,
              ]}
              onPress={sendMessage}
              disabled={!inputText.trim()}
            >
              <Text style={styles.sendText}>↑</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Session info */}
        <View style={styles.sessionInfo}>
          <Text style={styles.sessionInfoText}>
            {userThoughts.length} thought{userThoughts.length !== 1 ? 's' : ''} shared
          </Text>
          <PrimaryButton
            title="End Session"
            onPress={handleEndSession}
            variant="outline"
            size="small"
            loading={createSessionMutation.isPending}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFBFC',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E8ECEB',
  },
  backText: {
    color: '#5B8A72',
    fontSize: 16,
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#2D3436',
  },
  endText: {
    color: '#5B8A72',
    fontSize: 16,
    fontWeight: '500',
  },
  keyboardAvoid: {
    flex: 1,
  },
  messagesList: {
    padding: 16,
    paddingBottom: 8,
  },
  inputContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#E8ECEB',
    backgroundColor: '#FFFFFF',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#F0F4F3',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#2D3436',
    maxHeight: 100,
    paddingVertical: 8,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E8ECEB',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButtonActive: {
    backgroundColor: '#5B8A72',
  },
  sendText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
  },
  sessionInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E8ECEB',
  },
  sessionInfoText: {
    color: '#636E72',
    fontSize: 14,
  },
});

