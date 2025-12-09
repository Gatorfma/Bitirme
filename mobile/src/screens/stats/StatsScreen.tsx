/**
 * StatsScreen
 * Statistics and insights dashboard
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';

import { ScreenContainer, AppHeader } from '../../components/layout';
import { LoadingSpinner } from '../../components/common';
import { TrendChart, EmotionChart } from '../../components/charts';
import { useStatsOverview, useImprovementScore } from '../../hooks/useStats';
import { formatStreak } from '../../utils';

type TimeRange = 'week' | 'month' | 'year';

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function RangeSelector({
  selected,
  onSelect,
}: {
  selected: TimeRange;
  onSelect: (range: TimeRange) => void;
}) {
  const ranges: TimeRange[] = ['week', 'month', 'year'];

  return (
    <View style={styles.rangeSelector}>
      {ranges.map((range) => (
        <TouchableOpacity
          key={range}
          style={[styles.rangeButton, selected === range && styles.rangeButtonActive]}
          onPress={() => onSelect(range)}
        >
          <Text
            style={[styles.rangeText, selected === range && styles.rangeTextActive]}
          >
            {range.charAt(0).toUpperCase() + range.slice(1)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function StatsScreen() {
  const [range, setRange] = useState<TimeRange>('week');
  const { data: stats, isLoading } = useStatsOverview(range);
  const { data: improvement } = useImprovementScore();

  if (isLoading || !stats) {
    return (
      <ScreenContainer>
        <LoadingSpinner message="Loading stats..." />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer padded={false}>
      <View style={styles.header}>
        <AppHeader title="Insights" subtitle="Track your progress" />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <RangeSelector selected={range} onSelect={setRange} />

        {/* Quick Stats */}
        <View style={styles.statsGrid}>
          <StatCard
            icon="📝"
            value={stats.totalSessions}
            label="Sessions"
          />
          <StatCard
            icon="💭"
            value={stats.totalThoughts}
            label="Thoughts"
          />
          <StatCard
            icon="😊"
            value={stats.averageMood.toFixed(1)}
            label="Avg Mood"
          />
          <StatCard
            icon="🔥"
            value={stats.currentStreak}
            label="Day Streak"
          />
        </View>

        {/* Improvement Score */}
        {improvement && (
          <View style={styles.improvementCard}>
            <View style={styles.improvementHeader}>
              <Text style={styles.improvementEmoji}>📈</Text>
              <Text style={styles.improvementTitle}>Your Progress</Text>
            </View>
            <View style={styles.improvementScore}>
              <Text style={styles.scoreValue}>{improvement.score}</Text>
              <Text style={styles.scoreLabel}>Improvement Score</Text>
            </View>
            <Text style={styles.improvementChange}>
              {improvement.change > 0 ? '+' : ''}{improvement.change}% from last period
            </Text>
          </View>
        )}

        {/* Sentiment Trend */}
        <View style={styles.chartCard}>
          <TrendChart
            data={stats.sentimentTrend}
            title="Mood Trend"
            color="#5B8A72"
          />
        </View>

        {/* Emotion Breakdown */}
        <View style={styles.chartCard}>
          <EmotionChart
            data={stats.emotionBreakdown}
            title="Emotion Distribution"
          />
        </View>

        {/* Streak Info */}
        <View style={styles.streakCard}>
          <Text style={styles.streakEmoji}>🔥</Text>
          <Text style={styles.streakText}>{formatStreak(stats.currentStreak)}</Text>
          <Text style={styles.streakHint}>Keep journaling daily to build your streak!</Text>
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
  rangeSelector: {
    flexDirection: 'row',
    backgroundColor: '#F0F4F3',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  rangeButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  rangeButtonActive: {
    backgroundColor: '#FFFFFF',
  },
  rangeText: {
    fontSize: 14,
    color: '#636E72',
    fontWeight: '500',
  },
  rangeTextActive: {
    color: '#5B8A72',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    width: '47%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8ECEB',
  },
  statIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2D3436',
  },
  statLabel: {
    fontSize: 12,
    color: '#636E72',
    marginTop: 4,
  },
  improvementCard: {
    backgroundColor: '#E8F0EC',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    alignItems: 'center',
  },
  improvementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  improvementEmoji: {
    fontSize: 20,
  },
  improvementTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#5B8A72',
  },
  improvementScore: {
    alignItems: 'center',
    marginBottom: 8,
  },
  scoreValue: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#5B8A72',
  },
  scoreLabel: {
    fontSize: 13,
    color: '#636E72',
  },
  improvementChange: {
    fontSize: 14,
    color: '#5B8A72',
    fontWeight: '500',
  },
  chartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E8ECEB',
  },
  streakCard: {
    backgroundColor: '#FFF9F0',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F5E6D3',
  },
  streakEmoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  streakText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2D3436',
    marginBottom: 4,
  },
  streakHint: {
    fontSize: 13,
    color: '#636E72',
    textAlign: 'center',
  },
});

