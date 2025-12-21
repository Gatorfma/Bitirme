/**
 * MindMapScreen
 * Visual representation of thought categories
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Modal, FlatList, ScrollView, Pressable } from 'react-native';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';

import { ScreenContainer, AppHeader } from '../../components/layout';
import { LoadingSpinner } from '../../components/common';
import { getActiveCategories } from '../../repos/categoriesRepo';
import { getThoughtsByActiveCategory } from '../../repos/thoughtItemsRepo';
import { formatRelativeTime, formatDateTime } from '../../utils/dates';
import type { MindMapNode, ThoughtCategory } from '../../types/models';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_SIZE = SCREEN_WIDTH - 40;

// Helper functions for node text sizing
function getNodeFontSize(label: string, radius: number) {
  const base = Math.max(10, Math.min(16, radius * 0.35));
  if (label.length <= 10) return base;
  if (label.length <= 16) return base - 2;
  if (label.length <= 22) return base - 3;
  return base - 4;
}

function getNodeMaxLines(radius: number) {
  return radius >= 26 ? 2 : 1;
}

function shortenCategoryName(name: string): string {
  let shortened = name;
  
  // Replace common long words
  shortened = shortened.replace(/Relationship/g, 'Relations');
  shortened = shortened.replace(/Irritability/g, 'Irritable');
  shortened = shortened.replace(/Uncertainty/g, 'Uncertain');
  
  // Trim to max 18 chars with ellipsis if needed
  if (shortened.length > 18) {
    shortened = shortened.substring(0, 15) + '...';
  }
  
  return shortened;
}

function MindMapVisualization({ 
  nodes, 
  onCategoryTap 
}: { 
  nodes: MindMapNode[];
  onCategoryTap: (categoryId: string) => void;
}) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  // Scale positions to fit chart
  const scaleX = (x: number) => (x / 400) * CHART_SIZE;
  const scaleY = (y: number) => (y / 400) * CHART_SIZE;

  const handleNodePress = (nodeId: string) => {
    if (nodeId === 'center') {
      setSelectedNode(selectedNode === nodeId ? null : nodeId);
    } else {
      // Category node - trigger tap handler
      onCategoryTap(nodeId);
    }
  };

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
        {nodes.map((node) => {
          const radius = node.size / 2;
          const scaledX = scaleX(node.x);
          const scaledY = scaleY(node.y);
          const fontSize = node.id === 'center' ? 12 : getNodeFontSize(node.label, radius);
          const maxLines = node.id === 'center' ? 1 : getNodeMaxLines(radius);
          
          return (
            <React.Fragment key={node.id}>
              <Circle
                cx={scaledX}
                cy={scaledY}
                r={radius}
                fill={node.color}
                opacity={selectedNode && selectedNode !== node.id ? 0.4 : 1}
                onPress={() => handleNodePress(node.id)}
              />
            </React.Fragment>
          );
        })}
      </Svg>

      {/* Node text labels - positioned absolutely over circles */}
      {nodes.map((node) => {
        const radius = node.size / 2;
        const scaledX = scaleX(node.x);
        const scaledY = scaleY(node.y);
        const displayLabel = node.id === 'center' ? node.label : shortenCategoryName(node.label);
        const fontSize = node.id === 'center' ? 12 : getNodeFontSize(displayLabel, radius);
        const maxLines = node.id === 'center' ? 1 : getNodeMaxLines(radius);
        const maxWidth = radius * 2 - 10;
        
        return (
          <View
            key={`text-${node.id}`}
            style={[
              styles.nodeTextContainer,
              {
                left: scaledX - radius,
                top: scaledY - radius,
                width: radius * 2,
                height: radius * 2,
                opacity: selectedNode && selectedNode !== node.id ? 0.4 : 1,
              },
            ]}
            pointerEvents="none"
          >
            <Text
              style={[
                styles.nodeText,
                {
                  fontSize,
                  lineHeight: fontSize + 2,
                  maxWidth,
                },
              ]}
              numberOfLines={maxLines}
              ellipsizeMode="tail"
            >
              {displayLabel}
            </Text>
          </View>
        );
      })}

      {/* Selected node info */}
      {selectedNode && selectedNode === 'center' && (
        <View style={styles.nodeInfo}>
          <Text style={styles.nodeInfoTitle}>
            {nodes.find((n) => n.id === selectedNode)?.label}
          </Text>
          <Text style={styles.nodeInfoText}>
            Tap a category to explore thoughts
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

// Color palette for categories
const CATEGORY_COLORS = [
  '#5B8A72', // Green
  '#89A4C7', // Blue
  '#B8A9C9', // Purple
  '#D4B896', // Beige
  '#C4A484', // Brown
  '#A8D5BA', // Light Green
  '#F4A261', // Orange
  '#E76F51', // Red
  '#2A9D8F', // Teal
  '#264653', // Dark Green
];

// Icons for categories
const CATEGORY_ICONS = ['💼', '❤️', '🏥', '🌱', '😰', '🎯', '🌟', '💡', '🎨', '🔮'];

/**
 * Generate mind map nodes from categories
 */
function generateMindMapNodes(categories: ThoughtCategory[]): MindMapNode[] {
  if (categories.length === 0) {
    return [];
  }

  const centerNode: MindMapNode = {
    id: 'center',
    label: 'My Thoughts',
    type: 'category',
    x: 200,
    y: 200,
    size: 60,
    color: CATEGORY_COLORS[0],
    connections: categories.map((cat) => cat.id),
  };

  // Position categories in a circle around the center
  const angleStep = (2 * Math.PI) / categories.length;
  const radius = 150;

  const categoryNodes: MindMapNode[] = categories.map((cat, index) => {
    const angle = index * angleStep;
    const x = 200 + radius * Math.cos(angle);
    const y = 200 + radius * Math.sin(angle);
    
    // Size based on thought count (min 30, max 50)
    const size = Math.min(50, Math.max(30, 30 + cat.thoughtCount * 2));

    return {
      id: cat.id,
      label: cat.name,
      type: 'category',
      x: Math.round(x),
      y: Math.round(y),
      size,
      color: cat.color,
      connections: ['center'],
    };
  });

  return [centerNode, ...categoryNodes];
}

export default function MindMapScreen() {
  const [categories, setCategories] = useState<ThoughtCategory[]>([]);
  const [nodes, setNodes] = useState<MindMapNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modal state
  const [isThoughtsModalVisible, setIsThoughtsModalVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<{id: string; name: string} | null>(null);
  const [selectedCategoryThoughts, setSelectedCategoryThoughts] = useState<Array<{id: string; text: string; created_at: string}>>([]);
  const [isThoughtsLoading, setIsThoughtsLoading] = useState(false);
  const [isAllCategoriesModalVisible, setIsAllCategoriesModalVisible] = useState(false);

  useEffect(() => {
    async function loadCategories() {
      try {
        console.log('[MindMapScreen] Loading categories from Supabase...');
        setIsLoading(true);
        setError(null);

        const activeCategories = await getActiveCategories();
        console.log('[MindMapScreen] Loaded active categories:', {
          count: activeCategories.length,
          categories: activeCategories.map((c) => ({ id: c.id, name: c.name, thought_count: c.thought_count })),
        });

        // Convert Supabase format to ThoughtCategory format
        const thoughtCategories: ThoughtCategory[] = activeCategories.map((cat, index) => ({
          id: cat.id,
          name: cat.name,
          description: undefined, // Not stored in DB yet
          color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
          icon: CATEGORY_ICONS[index % CATEGORY_ICONS.length],
          thoughtCount: cat.thought_count,
          averageSentiment: undefined, // Not calculated yet
        }));

        setCategories(thoughtCategories);

        // Generate mind map nodes from top 5 categories only
        const topCategories = thoughtCategories.slice(0, 5);
        const mindMapNodes = generateMindMapNodes(topCategories);
        setNodes(mindMapNodes);

        console.log('[MindMapScreen] Categories loaded successfully:', {
          categoryCount: thoughtCategories.length,
          nodeCount: mindMapNodes.length,
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load categories';
        console.error('[MindMapScreen] Error loading categories:', {
          error: errorMessage,
          stack: err instanceof Error ? err.stack : undefined,
        });
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    }

    loadCategories();
  }, []);

  useEffect(() => {
    console.log("[MindMapScreen] Modal state changed:", { isThoughtsModalVisible, count: selectedCategoryThoughts.length });
  }, [isThoughtsModalVisible, selectedCategoryThoughts.length]);

  const handleCategoryTap = async (categoryId: string) => {
    if (categoryId === 'center') return;

    const category = categories.find((cat) => cat.id === categoryId);
    if (!category) {
      console.warn('[MindMapScreen] Category not found:', categoryId);
      return;
    }

    console.log('[MindMapScreen] Category tapped:', {
      categoryId,
      categoryName: category.name,
    });

    // Set selected category
    setSelectedCategory({ id: categoryId, name: category.name });
    
    // Start loading
    setIsThoughtsLoading(true);
    
    try {
      // Fetch thoughts
      const fetchedThoughts = await getThoughtsByActiveCategory(categoryId);
      console.log('[MindMapScreen] Loaded thoughts:', {
        categoryId,
        count: fetchedThoughts.length,
      });
      
      // Set thoughts
      setSelectedCategoryThoughts(fetchedThoughts);
      console.log("[MindMapScreen] Setting modal visible with thoughts:", { count: fetchedThoughts.length });
      
      // Show modal
      setIsThoughtsModalVisible(true);
    } catch (err) {
      console.error('[MindMapScreen] Error loading thoughts:', {
        categoryId,
        error: err instanceof Error ? err.message : String(err),
      });
      setSelectedCategoryThoughts([]);
      console.log("[MindMapScreen] Clearing thoughts because: error occurred");
      console.log("[MindMapScreen] Setting modal visible with thoughts:", { count: 0 });
      setIsThoughtsModalVisible(true); // Still show modal even on error
    } finally {
      setIsThoughtsLoading(false);
    }
  };

  const handleCloseModal = () => {
    console.log("[MindMapScreen] Closing modal because: handleCloseModal called (close button pressed)");
    setIsThoughtsModalVisible(false);
    console.log("[MindMapScreen] Clearing selected category because: handleCloseModal called");
    setSelectedCategory(null);
    console.log("[MindMapScreen] Clearing thoughts because: handleCloseModal called");
    setSelectedCategoryThoughts([]);
  };

  if (isLoading) {
    return (
      <ScreenContainer>
        <LoadingSpinner message="Loading mind map..." />
      </ScreenContainer>
    );
  }

  if (error) {
    return (
      <ScreenContainer scrollable>
        <AppHeader title="Mind Map" subtitle="Visualize your thoughts" />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Failed to load categories: {error}</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scrollable>
      <AppHeader title="Mind Map" subtitle="Visualize your thoughts" />

      {nodes && nodes.length > 0 ? (
        <>
          <MindMapVisualization nodes={nodes} onCategoryTap={handleCategoryTap} />

          {/* Legend */}
          <View style={styles.legend}>
            <View style={styles.legendHeader}>
              <Text style={styles.legendTitle}>Categories</Text>
              {categories.length > 5 && (
                <Pressable onPress={() => setIsAllCategoriesModalVisible(true)}>
                  <Text style={styles.seeAllButton}>See all</Text>
                </Pressable>
              )}
            </View>
            {categories.slice(0, 5).map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={styles.legendItem}
                onPress={() => handleCategoryTap(cat.id)}
                activeOpacity={0.7}
              >
                <View style={[styles.legendDot, { backgroundColor: cat.color }]} />
                <Text style={styles.legendLabel}>{cat.name}</Text>
                <Text style={styles.legendCount}>{cat.thoughtCount}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      ) : (
        <EmptyState />
      )}

      {/* Thoughts Modal */}
      <Modal
        visible={isThoughtsModalVisible}
        transparent
        animationType="fade"
        presentationStyle="overFullScreen"
        statusBarTranslucent
        onRequestClose={() => {
          console.log("[MindMapScreen] Closing modal because: onRequestClose called (Android back button)");
          setIsThoughtsModalVisible(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedCategory?.name ?? "Thoughts"}</Text>
              <Pressable onPress={() => setIsThoughtsModalVisible(false)} style={styles.modalCloseIcon}>
                <Text style={styles.modalCloseIconText}>×</Text>
              </Pressable>
            </View>

            <View style={styles.modalDivider} />

            <View style={styles.modalBody}>
              {isThoughtsLoading ? (
                <View style={{ flex: 1, justifyContent: "center", alignItems: "center", minHeight: 100 }}>
                  <Text>Loading…</Text>
                </View>
              ) : (
                <FlatList
                  style={styles.modalBodyList}
                  contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, paddingBottom: 24 }}
                  data={selectedCategoryThoughts}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f1f1f1" }}>
                      <Text style={{ fontSize: 15, lineHeight: 20, color: "#111" }}>{item.text}</Text>
                    </View>
                  )}
                  ListEmptyComponent={
                    <Text style={{ padding: 16, color: "#666" }}>No thoughts found.</Text>
                  }
                  nestedScrollEnabled={true}
                />
              )}
            </View>

            <View style={styles.modalFooter}>
              <Pressable style={styles.modalCloseButton} onPress={() => setIsThoughtsModalVisible(false)}>
                <Text style={styles.modalCloseButtonText}>Close</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* All Categories Modal */}
      <Modal
        visible={isAllCategoriesModalVisible}
        transparent
        animationType="fade"
        presentationStyle="overFullScreen"
        statusBarTranslucent
        onRequestClose={() => setIsAllCategoriesModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>All Categories</Text>
              <Pressable onPress={() => setIsAllCategoriesModalVisible(false)} style={styles.modalCloseIcon}>
                <Text style={styles.modalCloseIconText}>×</Text>
              </Pressable>
            </View>

            <View style={styles.modalDivider} />

            <View style={styles.modalBody}>
              <FlatList
                style={styles.modalBodyList}
                contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, paddingBottom: 24 }}
                data={categories}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.categoryModalItem}
                    onPress={() => {
                      setIsAllCategoriesModalVisible(false);
                      handleCategoryTap(item.id);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                    <Text style={styles.categoryModalName}>{item.name}</Text>
                    <Text style={styles.categoryModalCount}>{item.thoughtCount}</Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <Text style={{ padding: 16, color: "#666" }}>No categories found.</Text>
                }
                nestedScrollEnabled={true}
              />
            </View>

            <View style={styles.modalFooter}>
              <Pressable style={styles.modalCloseButton} onPress={() => setIsAllCategoriesModalVisible(false)}>
                <Text style={styles.modalCloseButtonText}>Close</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  chartContainer: {
    position: 'relative',
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
  nodeTextContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  nodeText: {
    color: '#FFFFFF',
    fontWeight: '600',
    textAlign: 'center',
    includeFontPadding: false,
  },
  legend: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E8ECEB',
  },
  legendHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  legendTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3436',
  },
  seeAllButton: {
    fontSize: 14,
    color: '#5B8A72',
    fontWeight: '600',
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 80,
  },
  errorText: {
    fontSize: 15,
    color: '#E76F51',
    textAlign: 'center',
    lineHeight: 22,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    width: '92%',
    maxHeight: '80%',
    backgroundColor: '#fff',
    borderRadius: 18,
    overflow: 'hidden',
  },
  modalHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalCloseIcon: {
    padding: 4,
  },
  modalCloseIconText: {
    fontSize: 24,
    color: '#636E72',
  },
  modalDivider: {
    height: 1,
    backgroundColor: '#eee',
  },
  modalBody: {
    maxHeight: 400,
    flexShrink: 1,
  },
  modalBodyList: {
    flexGrow: 1,
    flexShrink: 1,
  },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  loadingText: {
    paddingVertical: 12,
    color: '#666',
    textAlign: 'center',
  },
  thoughtListContent: {
    paddingBottom: 8,
  },
  thoughtRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f1f1',
  },
  thoughtText: {
    fontSize: 15,
    color: '#111',
  },
  modalEmptyText: {
    paddingVertical: 12,
    color: '#666',
    textAlign: 'center',
  },
  modalCloseButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#5B8A72',
  },
  modalCloseButtonText: {
    fontWeight: '700',
    color: '#FFFFFF',
    fontSize: 16,
  },
  categoryModalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f1f1',
  },
  categoryModalName: {
    flex: 1,
    fontSize: 15,
    color: '#2D3436',
    marginLeft: 12,
  },
  categoryModalCount: {
    fontSize: 14,
    color: '#636E72',
    fontWeight: '500',
  },
});

