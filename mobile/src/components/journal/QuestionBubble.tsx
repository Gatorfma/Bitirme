/**
 * QuestionBubble Component
 * Chat bubble for guiding questions from the system
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface QuestionBubbleProps {
  content: string;
  isTyping?: boolean;
}

export function QuestionBubble({ content, isTyping = false }: QuestionBubbleProps) {
  return (
    <View style={styles.container}>
      <View style={styles.avatar}>
        <Text style={styles.avatarEmoji}>🧠</Text>
      </View>
      <View style={styles.bubble}>
        {isTyping ? (
          <Text style={styles.typing}>Thinking...</Text>
        ) : (
          <Text style={styles.content}>{content}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E8F0EC',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  avatarEmoji: {
    fontSize: 16,
  },
  bubble: {
    backgroundColor: '#F0F4F3',
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    maxWidth: '75%',
  },
  content: {
    color: '#2D3436',
    fontSize: 15,
    lineHeight: 21,
  },
  typing: {
    color: '#636E72',
    fontSize: 14,
    fontStyle: 'italic',
  },
});

export default QuestionBubble;

