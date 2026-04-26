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
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';

import { MessageBubble, QuestionBubble } from '../../components/journal';
import { useCreateSession } from '../../hooks/useJournal';
import type { ChatMessage } from '../../types/models';
import { getJournalAssistantReply } from '../../api/openaiChat';
import { retrieve } from '../../rag/inMemoryRag';
import { createSession, updateSession, deleteSession, hasUserMessages } from '../../journal/supabaseSessionRepo';
import { summarizeAndExtractThoughts } from '../../agents/journalingPostProcessor';
import { updateSessionSummaryAndThoughts } from '../../repos/journalSessionsRepo';
import { insertThoughtItems } from '../../repos/thoughtItemsRepo';
import { runCategorizationForSession } from '../../agents/categorizationPipeline';
import { supabase } from '../../lib/supabase';

export default function NewSessionScreen() {
  const navigation = useNavigation<any>();
  const createSessionMutation = useCreateSession();
  const flatListRef = useRef<FlatList>(null);
  const headerHeight = useHeaderHeight();

  const [sessionStartedAt] = useState(() => new Date());
  const supabaseSessionIdRef = useRef<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      type: 'question',
      content: "Hello! I'm here to help you explore your thoughts. What's on your mind right now?",
      timestamp: new Date().toISOString(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const userThoughts = messages.filter(m => m.type === 'user');

  const ensureSupabaseSession = useCallback(async () => {
    if (supabaseSessionIdRef.current) return;
    try {
      const result = await createSession({ startedAt: sessionStartedAt.toISOString() });
      supabaseSessionIdRef.current = result.id;
    } catch (e) {
      console.error('[NewSession] Create session failed:', e);
    }
  }, [sessionStartedAt]);

  const cleanupAndNavigate = useCallback(async () => {
    if (supabaseSessionIdRef.current) {
      if (userThoughts.length === 0) {
        deleteSession(supabaseSessionIdRef.current).catch(e => console.error(e));
      } else {
        const now = new Date().toISOString();
        updateSession({
          id: supabaseSessionIdRef.current,
          messages: messages,
          endedAt: now
        }).catch(e => console.error(e));

        summarizeAndExtractThoughts({
          messages: messages.filter(msg => msg.type === 'user' || msg.type === 'question').map(msg => ({
            role: (msg.type === 'user' ? 'user' : 'agent') as 'user' | 'agent',
            content: msg.content,
            timestamp: msg.timestamp,
          }))
        }).then(async ({ summary, thoughts }) => {
          if (supabaseSessionIdRef.current) {
            await updateSessionSummaryAndThoughts({ sessionId: supabaseSessionIdRef.current, summary, thoughts, setPostProcessedAt: true });
            await insertThoughtItems({ sessionId: supabaseSessionIdRef.current, thoughts: thoughts.map(t => ({ text: t.text, timestamp: t.timestamp })) });
            runCategorizationForSession(supabaseSessionIdRef.current);
          }
        }).catch(e => console.error('[NewSession] Post-processing failed:', e));
      }
    }
    navigation.navigate('JournalHomeScreen');
  }, [navigation, messages, userThoughts.length]);

  const handleBack = () => {
    cleanupAndNavigate();
  };

  const handleEndSession = async () => {
    if (userThoughts.length > 0) {
      createSessionMutation.mutate({
        thoughts: userThoughts.map(m => ({ content: m.content, timestamp: m.timestamp })),
        mood: 6,
      });
    }
    cleanupAndNavigate();
  };

  const sendMessage = useCallback(async () => {
    if (!inputText.trim()) return;
    const userMessage: ChatMessage = { id: Date.now().toString(), type: 'user', content: inputText.trim(), timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsTyping(true);
    await ensureSupabaseSession();

    try {
      const updatedMessages = [...messages, userMessage];
      const aiReply = await getJournalAssistantReply(updatedMessages);
      const aiMessage: ChatMessage = { id: (Date.now() + 1).toString(), type: 'question', content: aiReply, timestamp: new Date().toISOString() };
      setMessages(prev => [...prev, aiMessage]);

      if (supabaseSessionIdRef.current) {
        updateSession({ id: supabaseSessionIdRef.current, messages: [...updatedMessages, aiMessage] }).catch(e => console.error(e));
      }
    } catch (e) {
      console.error('[NewSession] AI error:', e);
    } finally {
      setIsTyping(false);
    }
  }, [inputText, messages, ensureSupabaseSession]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Journaling</Text>
        <TouchableOpacity onPress={handleEndSession} hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}>
          <Text style={styles.endText}>Save</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            item.type === 'user'
              ? <MessageBubble content={item.content} timestamp={item.timestamp} />
              : <QuestionBubble content={item.content} />
          )}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
          ListFooterComponent={isTyping ? <QuestionBubble content="" isTyping /> : null}
        />

        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="Share your thoughts..."
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFBFC' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E8ECEB' },
  backText: { color: '#5B8A72', fontSize: 16, fontWeight: '600' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#2D3436' },
  endText: { color: '#5B8A72', fontSize: 16, fontWeight: '600' },
  keyboardAvoid: { flex: 1 },
  messagesList: { padding: 16, paddingBottom: 8 },
  inputContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1, 
    borderTopColor: '#E8ECEB', 
    backgroundColor: '#FFFFFF' 
  },
  inputWrapper: { flexDirection: 'row', alignItems: 'flex-end', backgroundColor: '#F0F4F3', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 8 },
  input: { flex: 1, fontSize: 16, color: '#2D3436', maxHeight: 100, paddingVertical: 8 },
  sendButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#E8ECEB', justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  sendButtonActive: { backgroundColor: '#5B8A72' },
  sendText: { color: '#FFFFFF', fontSize: 20, fontWeight: '600' },
});
