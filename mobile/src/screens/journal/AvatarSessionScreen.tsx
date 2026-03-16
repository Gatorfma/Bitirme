/**
 * AvatarSessionScreen
 * Chat-based interface with an AI avatar
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
import { summarizeAndExtractThoughts } from '../../agents/journalingPostProcessor';
import { updateSessionSummaryAndThoughts } from '../../repos/journalSessionsRepo';
import { insertThoughtItems } from '../../repos/thoughtItemsRepo';
import { runCategorizationForSession } from '../../agents/categorizationPipeline';
import { supabase } from '../../lib/supabase';

type NavigationProp = JournalStackScreenProps<'AvatarSession'>['navigation'];

const INITIAL_QUESTIONS = [
  "Hi! I'm your AI companion. I'm here to listen and reflect with you. How's your day going?",
];

export default function AvatarSessionScreen() {
  const navigation = useNavigation<any>();
  const createSessionMutation = useCreateSession();
  const flatListRef = useRef<FlatList>(null);

  // Session tracking
  const [sessionId] = useState(() => `avatar_session_${Date.now()}_${Math.random().toString(36).substring(7)}`);
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

  const ensureSupabaseSession = useCallback(async () => {
    if (hasCreatedSessionRef.current && supabaseSessionIdRef.current) {
      return;
    }

    try {
      const result = await createSession({
        startedAt: sessionStartedAt.toISOString(),
      });
      supabaseSessionIdRef.current = result.id;
      hasCreatedSessionRef.current = true;
    } catch (error) {
      console.error('[AvatarSession] Failed to create session:', error);
    }
  }, [sessionStartedAt]);

  const updateSupabaseSession = useCallback(async (currentMessages: ChatMessage[], endedAt?: string) => {
    if (!supabaseSessionIdRef.current) {
      await ensureSupabaseSession();
    }

    if (!supabaseSessionIdRef.current) return;

    const hasUserMsgs = hasUserMessages(currentMessages);
    
    (async () => {
      try {
        if (!hasUserMsgs) {
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
        console.error('[AvatarSession] Failed to update session:', error);
      }
    })();
  }, [ensureSupabaseSession]);

  const postProcessSession = useCallback(async (currentMessages: ChatMessage[]) => {
    if (!supabaseSessionIdRef.current) return;
    if (!hasUserMessages(currentMessages)) return;

    (async () => {
      try {
        const { data: sessionData } = await supabase
          .from('journal_sessions')
          .select('post_processed_at')
          .eq('id', supabaseSessionIdRef.current!)
          .single();

        if (sessionData?.post_processed_at) return;

        const messagesForProcessing = currentMessages
          .filter((msg) => msg.type === 'user' || msg.type === 'question')
          .map((msg) => ({
            role: (msg.type === 'user' ? 'user' : 'agent') as 'user' | 'agent',
            content: msg.content,
            timestamp: msg.timestamp,
          }));

        const { summary, thoughts } = await summarizeAndExtractThoughts({
          messages: messagesForProcessing,
        });

        await updateSessionSummaryAndThoughts({
          sessionId: supabaseSessionIdRef.current!,
          summary,
          thoughts,
          setPostProcessedAt: true,
        });

        await insertThoughtItems({
          sessionId: supabaseSessionIdRef.current!,
          thoughts: thoughts.map((t) => ({
            text: t.text,
            timestamp: t.timestamp,
          })),
        });

        runCategorizationForSession(supabaseSessionIdRef.current!);
      } catch (error) {
        console.error('[AvatarSession] Post-processing failed:', error);
      }
    })();
  }, []);

  useEffect(() => {
    return () => {
      if (supabaseSessionIdRef.current) {
        updateSupabaseSession(messages, new Date().toISOString());
        postProcessSession(messages);
      }
    };
  }, [messages, updateSupabaseSession, postProcessSession]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        if (supabaseSessionIdRef.current) {
          updateSupabaseSession(messages, new Date().toISOString());
          postProcessSession(messages);
        }
      };
    }, [messages, updateSupabaseSession, postProcessSession])
  );

  const sendMessage = useCallback(async () => {
    if (!inputText.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: inputText.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsTyping(true);

    await ensureSupabaseSession();

    try {
      const updatedMessages = [...messages, userMessage];
      const userText = userMessage.content;

      const updatedSlots = updateSlotsFromUserText(slots, userText);
      setSlots(updatedSlots);
      const missingSlots = computeMissingSlots(updatedSlots);

      const knownParts: string[] = [];
      if (updatedSlots.situation) knownParts.push(`situation=${updatedSlots.situation}`);
      if (updatedSlots.trigger) knownParts.push(`trigger=${updatedSlots.trigger}`);
      if (updatedSlots.thought) knownParts.push(`thought=${updatedSlots.thought}`);

      let slotHint: string | undefined;
      if (knownParts.length > 0 || missingSlots.length > 0) {
        slotHint = `Known: ${knownParts.join(', ')}. Missing: ${missingSlots.join(', ')}. Ask a thoughtful question.`;
      }

      let ragContext: string | undefined;
      try {
        const hits = await retrieve(userText, 3);
        ragContext = hits.map(h => h.text).join('\n');
      } catch (e) {}

      const aiReply = await getJournalAssistantReply(updatedMessages, ragContext, slotHint);
      
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'question',
        content: aiReply,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, aiMessage]);
      updateSupabaseSession([...updatedMessages, aiMessage]);
    } catch (error) {
      console.error('[AvatarSession] AI error:', error);
    } finally {
      setIsTyping(false);
    }
  }, [inputText, messages, slots, ensureSupabaseSession, updateSupabaseSession]);

  const handleBack = useCallback(() => {
    if (supabaseSessionIdRef.current) {
      updateSupabaseSession(messages, new Date().toISOString());
      postProcessSession(messages);
    }
    navigation.navigate('JournalHome');
  }, [navigation, messages, updateSupabaseSession, postProcessSession]);

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
        mood: 6,
      });
      
      if (supabaseSessionIdRef.current) {
        updateSupabaseSession(messages, new Date().toISOString());
        postProcessSession(messages);
      }
      
      navigation.navigate('JournalHome');
    } catch (error) {
      navigation.navigate('JournalHome');
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
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Avatar Session</Text>
        <TouchableOpacity onPress={handleEndSession}>
          <Text style={styles.endText}>End</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
          ListFooterComponent={isTyping ? <QuestionBubble content="" isTyping /> : null}
        />

        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="Talk to your avatar..."
              placeholderTextColor="#9DAEBB"
              value={inputText}
              onChangeText={setInputText}
              multiline
            />
            <TouchableOpacity
              style={[styles.sendButton, inputText.trim() && styles.sendButtonActive]}
              onPress={sendMessage}
              disabled={!inputText.trim()}
            >
              <Text style={styles.sendText}>↑</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.sessionInfo}>
          <Text style={styles.sessionInfoText}>Avatar Mode Active</Text>
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
  container: { flex: 1, backgroundColor: '#FAFBFC' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E8ECEB',
  },
  backText: { color: '#3498db', fontSize: 16, fontWeight: '500' },
  headerTitle: { fontSize: 17, fontWeight: '600', color: '#2D3436' },
  endText: { color: '#3498db', fontSize: 16, fontWeight: '500' },
  keyboardAvoid: { flex: 1 },
  messagesList: { padding: 16, paddingBottom: 8 },
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
  input: { flex: 1, fontSize: 16, color: '#2D3436', maxHeight: 100, paddingVertical: 8 },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E8ECEB',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButtonActive: { backgroundColor: '#3498db' },
  sendText: { color: '#FFFFFF', fontSize: 20, fontWeight: '600' },
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
  sessionInfoText: { color: '#636E72', fontSize: 14 },
});
