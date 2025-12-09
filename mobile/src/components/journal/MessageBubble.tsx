/**
 * MessageBubble Component
 * Chat bubble for user thoughts in journal
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { formatTime } from '../../utils/dates';

interface MessageBubbleProps {
  content: string;
  timestamp: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
}

export function MessageBubble({ content, timestamp, sentiment }: MessageBubbleProps) {
  return (
    <View style={styles.container}>
      <View style={[styles.bubble, sentiment && styles[`bubble_${sentiment}`]]}>
        <Text style={styles.content}>{content}</Text>
      </View>
      <Text style={styles.timestamp}>{formatTime(timestamp)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  bubble: {
    backgroundColor: '#5B8A72',
    borderRadius: 16,
    borderBottomRightRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    maxWidth: '80%',
  },
  bubble_positive: {
    backgroundColor: '#7FB095',
  },
  bubble_neutral: {
    backgroundColor: '#5B8A72',
  },
  bubble_negative: {
    backgroundColor: '#89A4C7',
  },
  content: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 21,
  },
  timestamp: {
    fontSize: 11,
    color: '#9DAEBB',
    marginTop: 4,
    marginRight: 4,
  },
});

export default MessageBubble;

