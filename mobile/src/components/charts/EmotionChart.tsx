/**
 * EmotionChart Component
 * Bar chart for emotion breakdown
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface EmotionData {
  emotion: string;
  count: number;
  percentage: number;
}

interface EmotionChartProps {
  data: EmotionData[];
  title?: string;
}

// Color mapping for emotions
const emotionColors: Record<string, string> = {
  Calm: '#7FB095',
  Happy: '#D4B896',
  Grateful: '#89A4C7',
  Anxious: '#B8A9C9',
  Stressed: '#C4A484',
  Sad: '#9DAEBB',
};

export function EmotionChart({ data, title }: EmotionChartProps) {
  const maxPercentage = Math.max(...data.map(d => d.percentage));

  return (
    <View style={styles.container}>
      {title && <Text style={styles.title}>{title}</Text>}
      
      <View style={styles.chart}>
        {data.map((item, index) => (
          <View key={index} style={styles.barContainer}>
            <View style={styles.labelContainer}>
              <Text style={styles.emotion}>{item.emotion}</Text>
              <Text style={styles.percentage}>{item.percentage}%</Text>
            </View>
            <View style={styles.barBackground}>
              <View
                style={[
                  styles.barFill,
                  {
                    width: `${(item.percentage / maxPercentage) * 100}%`,
                    backgroundColor: emotionColors[item.emotion] || '#5B8A72',
                  },
                ]}
              />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D3436',
    marginBottom: 16,
  },
  chart: {
    gap: 12,
  },
  barContainer: {},
  labelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  emotion: {
    fontSize: 13,
    color: '#2D3436',
  },
  percentage: {
    fontSize: 13,
    color: '#636E72',
    fontWeight: '500',
  },
  barBackground: {
    height: 8,
    backgroundColor: '#F0F4F3',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
});

export default EmotionChart;

