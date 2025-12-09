/**
 * TrendChart Component
 * Line chart for sentiment/mood trends
 */

import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path, Circle, Line, Text as SvgText } from 'react-native-svg';

interface DataPoint {
  date: string;
  value: number;
}

interface TrendChartProps {
  data: DataPoint[];
  title?: string;
  height?: number;
  color?: string;
  showLabels?: boolean;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function TrendChart({
  data,
  title,
  height = 150,
  color = '#5B8A72',
  showLabels = true,
}: TrendChartProps) {
  if (data.length < 2) {
    return (
      <View style={[styles.container, { height }]}>
        <Text style={styles.emptyText}>Not enough data to display</Text>
      </View>
    );
  }

  const chartWidth = SCREEN_WIDTH - 80;
  const chartHeight = height - 40;
  const padding = { top: 20, bottom: 20, left: 10, right: 10 };

  // Normalize values between 0 and 1
  const minValue = Math.min(...data.map(d => d.value));
  const maxValue = Math.max(...data.map(d => d.value));
  const range = maxValue - minValue || 1;

  // Calculate points
  const points = data.map((point, index) => {
    const x = padding.left + (index / (data.length - 1)) * (chartWidth - padding.left - padding.right);
    const normalizedValue = (point.value - minValue) / range;
    const y = padding.top + (1 - normalizedValue) * (chartHeight - padding.top - padding.bottom);
    return { x, y, ...point };
  });

  // Create path
  const pathD = points.reduce((acc, point, index) => {
    if (index === 0) return `M ${point.x} ${point.y}`;
    return `${acc} L ${point.x} ${point.y}`;
  }, '');

  // Create area fill path
  const areaD = `${pathD} L ${points[points.length - 1].x} ${chartHeight - padding.bottom} L ${points[0].x} ${chartHeight - padding.bottom} Z`;

  return (
    <View style={styles.container}>
      {title && <Text style={styles.title}>{title}</Text>}
      
      <Svg width={chartWidth} height={chartHeight}>
        {/* Grid lines */}
        <Line
          x1={padding.left}
          y1={chartHeight - padding.bottom}
          x2={chartWidth - padding.right}
          y2={chartHeight - padding.bottom}
          stroke="#E8ECEB"
          strokeWidth={1}
        />
        
        {/* Area fill */}
        <Path d={areaD} fill={color} fillOpacity={0.1} />
        
        {/* Line */}
        <Path d={pathD} stroke={color} strokeWidth={2} fill="none" />
        
        {/* Points */}
        {points.map((point, index) => (
          <Circle
            key={index}
            cx={point.x}
            cy={point.y}
            r={4}
            fill="#FFFFFF"
            stroke={color}
            strokeWidth={2}
          />
        ))}

        {/* Labels */}
        {showLabels && points.filter((_, i) => i === 0 || i === points.length - 1).map((point, index) => (
          <SvgText
            key={index}
            x={point.x}
            y={chartHeight - 5}
            fontSize={10}
            fill="#9DAEBB"
            textAnchor="middle"
          >
            {new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D3436',
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  emptyText: {
    color: '#9DAEBB',
    fontSize: 14,
  },
});

export default TrendChart;

