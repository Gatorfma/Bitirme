/**
 * NewSessionScreen
 * Chat-like journaling interface
 */

import React, { useState, useRef, useCallback } from 'react';
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
import type { JournalStackScreenProps } from '../../types/navigation';

import { MessageBubble, QuestionBubble } from '../../components/journal';
import { PrimaryButton } from '../../components/common';
import { useCreateSession } from '../../hooks/useJournal';
import type { ChatMessage } from '../../types/models';

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

  const userThoughts = messages.filter(m => m.type === 'user');

  const sendMessage = useCallback(() => {
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

    // Simulate AI response (would be real API call in production)
    setTimeout(() => {
      const randomQuestion = FOLLOW_UP_QUESTIONS[Math.floor(Math.random() * FOLLOW_UP_QUESTIONS.length)];
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'question',
        content: randomQuestion,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, aiMessage]);
      setIsTyping(false);
    }, 1500);
  }, [inputText]);

  const handleEndSession = async () => {
    if (userThoughts.length === 0) {
      navigation.goBack();
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
      navigation.goBack();
    } catch (error) {
      console.error('Failed to save session:', error);
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
        <TouchableOpacity onPress={() => navigation.goBack()}>
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

