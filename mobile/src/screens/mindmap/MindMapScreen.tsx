/**
 * MindMapScreen
 * Visual representation of thought categories
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';

import { ScreenContainer, AppHeader } from '../../components/layout';
import { LoadingSpinner } from '../../components/common';
import { useMindMap, useCategories } from '../../hooks/useCategories';
import type { MindMapNode } from '../../types/models';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_SIZE = SCREEN_WIDTH - 40;

function MindMapVisualization({ nodes }: { nodes: MindMapNode[] }) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  // Scale positions to fit chart
  const scaleX = (x: number) => (x / 400) * CHART_SIZE;
  const scaleY = (y: number) => (y / 400) * CHART_SIZE;

  return (
    <View style={styles.chartContainer}>
      <Svg width={CHART_SIZE} height={CHART_SIZE}>
        {/* Draw connections */}
        {nodes.map((node) =>
          node.connections.map((targetId) => {
            const target = nodes.find((n) => n.id === targetId);
            if (!target) return null;
            return (
              <Line
                key={`${node.id}-${targetId}`}
                x1={scaleX(node.x)}
                y1={scaleY(node.y)}
                x2={scaleX(target.x)}
                y2={scaleY(target.y)}
                stroke="#E8ECEB"
                strokeWidth={2}
              />
            );
          })
        )}

        {/* Draw nodes */}
        {nodes.map((node) => (
          <React.Fragment key={node.id}>
            <Circle
              cx={scaleX(node.x)}
              cy={scaleY(node.y)}
              r={node.size / 2}
              fill={node.color}
              opacity={selectedNode && selectedNode !== node.id ? 0.4 : 1}
              onPress={() => setSelectedNode(selectedNode === node.id ? null : node.id)}
            />
            <SvgText
              x={scaleX(node.x)}
              y={scaleY(node.y) + 4}
              fontSize={node.id === 'center' ? 12 : 10}
              fill="#FFFFFF"
              textAnchor="middle"
              fontWeight="600"
            >
              {node.label}
            </SvgText>
          </React.Fragment>
        ))}
      </Svg>

      {/* Selected node info */}
      {selectedNode && selectedNode !== 'center' && (
        <View style={styles.nodeInfo}>
          <Text style={styles.nodeInfoTitle}>
            {nodes.find((n) => n.id === selectedNode)?.label}
          </Text>
          <Text style={styles.nodeInfoText}>
            Tap to explore thoughts in this category
          </Text>
        </View>
      )}
    </View>
  );
}

function EmptyState() {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyEmoji}>🧠</Text>
      <Text style={styles.emptyTitle}>Your Mind Map Awaits</Text>
      <Text style={styles.emptyText}>
        Start journaling to see your thoughts organized into meaningful categories.
      </Text>
    </View>
  );
}

export default function MindMapScreen() {
  const { data: nodes, isLoading } = useMindMap();
  const { data: categories } = useCategories();

  if (isLoading) {
    return (
      <ScreenContainer>
        <LoadingSpinner message="Loading mind map..." />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scrollable>
      <AppHeader title="Mind Map" subtitle="Visualize your thoughts" />

      {nodes && nodes.length > 0 ? (
        <>
          <MindMapVisualization nodes={nodes} />

          {/* Legend */}
          <View style={styles.legend}>
            <Text style={styles.legendTitle}>Categories</Text>
            {categories?.map((cat) => (
              <View key={cat.id} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: cat.color }]} />
                <Text style={styles.legendLabel}>{cat.name}</Text>
                <Text style={styles.legendCount}>{cat.thoughtCount}</Text>
              </View>
            ))}
          </View>
        </>
      ) : (
        <EmptyState />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  chartContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  nodeInfo: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8ECEB',
    width: '100%',
  },
  nodeInfoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3436',
    marginBottom: 4,
  },
  nodeInfoText: {
    fontSize: 13,
    color: '#636E72',
  },
  legend: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E8ECEB',
  },
  legendTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3436',
    marginBottom: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  legendLabel: {
    flex: 1,
    fontSize: 14,
    color: '#2D3436',
  },
  legendCount: {
    fontSize: 14,
    color: '#636E72',
    fontWeight: '500',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 80,
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
});

