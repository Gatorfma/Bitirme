/**
 * SessionDetailScreen
 * View details of a past journal session
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRoute } from '@react-navigation/native';
import type { JournalStackScreenProps } from '../../types/navigation';

import { ScreenContainer, AppHeader } from '../../components/layout';
import { LoadingSpinner } from '../../components/common';
import { MessageBubble } from '../../components/journal';
import { useJournalSession } from '../../hooks/useJournal';
import { formatDateTime, getMoodEmoji, getMoodLabel, formatDuration, getDurationMinutes } from '../../utils';

type RouteProps = JournalStackScreenProps<'SessionDetail'>['route'];

export default function SessionDetailScreen() {
  const route = useRoute<RouteProps>();
  const { sessionId } = route.params;
  const { data: session, isLoading } = useJournalSession(sessionId);

  if (isLoading || !session) {
    return (
      <ScreenContainer>
        <LoadingSpinner message="Loading session..." />
      </ScreenContainer>
    );
  }

  const duration = session.endedAt
    ? formatDuration(getDurationMinutes(session.startedAt, session.endedAt))
    : 'Ongoing';

  return (
    <ScreenContainer padded={false}>
      <View style={styles.header}>
        <AppHeader title="Session" showBack />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Session info */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Date</Text>
            <Text style={styles.infoValue}>{formatDateTime(session.startedAt)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Duration</Text>
            <Text style={styles.infoValue}>{duration}</Text>
          </View>
          {session.mood && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Mood</Text>
              <Text style={styles.infoValue}>
                {getMoodEmoji(session.mood)} {getMoodLabel(session.mood)}
              </Text>
            </View>
          )}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Thoughts</Text>
            <Text style={styles.infoValue}>{session.thoughts.length}</Text>
          </View>
        </View>

        {/* Summary */}
        {session.summary && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Summary</Text>
            <Text style={styles.summaryText}>{session.summary}</Text>
          </View>
        )}

        {/* Thoughts */}
        <Text style={styles.sectionTitle}>Your Thoughts</Text>
        <View style={styles.thoughts}>
          {session.thoughts.map((thought) => (
            <MessageBubble
              key={thought.id}
              content={thought.content}
              timestamp={thought.timestamp}
              sentiment={thought.sentiment}
            />
          ))}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E8ECEB',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F4F3',
  },
  infoLabel: {
    fontSize: 14,
    color: '#636E72',
  },
  infoValue: {
    fontSize: 14,
    color: '#2D3436',
    fontWeight: '500',
  },
  summaryCard: {
    backgroundColor: '#E8F0EC',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#5B8A72',
    fontWeight: '600',
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 15,
    color: '#2D3436',
    lineHeight: 22,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2D3436',
    marginBottom: 16,
  },
  thoughts: {
    gap: 4,
  },
});

