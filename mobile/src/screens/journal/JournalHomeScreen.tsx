/**
 * JournalHomeScreen
 * Main journal screen showing session list
 */

import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { JournalStackScreenProps } from '../../types/navigation';

import { ScreenContainer, AppHeader } from '../../components/layout';
import { LoadingSpinner, PrimaryButton } from '../../components/common';
import { useJournalSessions } from '../../hooks/useJournal';
import { formatRelativeTime, getMoodEmoji } from '../../utils';
import type { JournalSession } from '../../types/models';

type NavigationProp = JournalStackScreenProps<'JournalHomeScreen'>['navigation'];

function SessionCard({ session, onPress }: { session: JournalSession; onPress: () => void }) {
  const thoughtCount = session.thoughts.length;
  const preview = session.thoughts[0]?.content || 'No thoughts recorded';

  return (
    <TouchableOpacity style={styles.sessionCard} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.sessionHeader}>
        <Text style={styles.sessionDate}>{formatRelativeTime(session.startedAt)}</Text>
        {session.mood && (
          <Text style={styles.sessionMood}>{getMoodEmoji(session.mood)}</Text>
        )}
      </View>
      <Text style={styles.sessionPreview} numberOfLines={2}>
        {preview}
      </Text>
      <View style={styles.sessionFooter}>
        <Text style={styles.sessionMeta}>
          {thoughtCount} thought{thoughtCount !== 1 ? 's' : ''}
        </Text>
        {session.summary && (
          <Text style={styles.sessionSummary} numberOfLines={1}>
            {session.summary}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

function EmptyState({ onStartSession }: { onStartSession: () => void }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyEmoji}>📝</Text>
      <Text style={styles.emptyTitle}>Start Your Journey</Text>
      <Text style={styles.emptyText}>
        Begin your first journaling session to explore your thoughts and feelings.
      </Text>
      <PrimaryButton
        title="Start Journaling"
        onPress={onStartSession}
        style={{ marginTop: 20 }}
      />
    </View>
  );
}

export default function JournalHomeScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { data, isLoading, refetch, isRefetching } = useJournalSessions();

  const sessions = data?.items || [];

  const handleStartSession = () => {
    navigation.navigate('NewSession');
  };

  const handleStartAvatarSession = () => {
    navigation.navigate('AvatarSession');
  };

  const handleViewSession = (sessionId: string) => {
    navigation.navigate('SessionDetail', { sessionId });
  };

  if (isLoading) {
    return (
      <ScreenContainer>
        <LoadingSpinner message="Loading sessions..." />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer padded={false}>
      <View style={styles.header}>
        <AppHeader title="Journal" subtitle="Your thought space" />
      </View>

      {sessions.length === 0 ? (
        <View style={styles.content}>
          <EmptyState onStartSession={handleStartSession} />
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <SessionCard
              session={item}
              onPress={() => handleViewSession(item.id)}
            />
          )}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor="#5B8A72"
            />
          }
        />
      )}

      {/* Avatar / Voice FAB */}
      <TouchableOpacity
        style={styles.blueFab}
        onPress={handleStartAvatarSession}
        activeOpacity={0.8}
      >
        <Text style={styles.fabText}>🎙️</Text>
      </TouchableOpacity>

      {/* Text journaling FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={handleStartSession}
        activeOpacity={0.8}
      >
        <Text style={styles.fabText}>✏️</Text>
      </TouchableOpacity>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  list: {
    padding: 20,
    paddingBottom: 100,
  },
  sessionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E8ECEB',
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sessionDate: {
    fontSize: 12,
    color: '#636E72',
    fontWeight: '500',
  },
  sessionMood: {
    fontSize: 18,
  },
  sessionPreview: {
    fontSize: 15,
    color: '#2D3436',
    lineHeight: 21,
    marginBottom: 12,
  },
  sessionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sessionMeta: {
    fontSize: 12,
    color: '#9DAEBB',
  },
  sessionSummary: {
    fontSize: 12,
    color: '#5B8A72',
    fontWeight: '500',
    flex: 1,
    marginLeft: 12,
    textAlign: 'right',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2D3436',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    color: '#636E72',
    textAlign: 'center',
    lineHeight: 22,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#5B8A72',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  fabText: {
    fontSize: 28,
    color: '#FFFFFF',
    fontWeight: '300',
    lineHeight: 32,
  },
  blueFab: {
    position: 'absolute',
    right: 20,
    bottom: 105,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#3498db',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
});
