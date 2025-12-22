/**
 * MindMapScreen
 * Visual representation of thought categories using WebGL
 */

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Modal, FlatList, Pressable, TouchableWithoutFeedback, PanResponder, SafeAreaView } from 'react-native';
import { GLView } from 'expo-gl';
import Svg, { Text as SvgText } from 'react-native-svg';

import { ScreenContainer, AppHeader } from '../../components/layout';
import { LoadingSpinner } from '../../components/common';
import { getActiveCategories } from '../../repos/categoriesRepo';
import { getThoughtsByActiveCategory } from '../../repos/thoughtItemsRepo';
import type { MindMapNode, ThoughtCategory } from '../../types/models';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CHART_SIZE = SCREEN_WIDTH - 40;

// Shaders for Nodes (Circles with Transparent Black Outlines)
const nodeVert = `
  precision mediump float;
  attribute vec2 position;
  attribute float size;
  attribute vec3 color;
  attribute float alpha;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    gl_Position = vec4(position, 0.0, 1.0);
    gl_PointSize = size;
    vColor = color;
    vAlpha = alpha;
  }
`;

const nodeFrag = `
  precision mediump float;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float dist = distance(gl_PointCoord, vec2(0.5));
    if (dist > 0.5) discard;
    
    // Antialiasing for the outer edge
    float edge = smoothstep(0.5, 0.48, dist);
    
    // Outline logic (Inner border of the circle)
    float outlineWidth = 0.04;
    float innerContent = smoothstep(0.5 - outlineWidth, 0.5 - outlineWidth - 0.02, dist);
    
    // Mix between black outline and node color
    vec3 finalColor = mix(vec3(0.0, 0.0, 0.0), vColor, innerContent);
    
    // Make outline (where innerContent is 0) semi-transparent (0.5 opacity)
    float alpha = mix(0.5, 1.0, innerContent) * vAlpha * edge;
    
    gl_FragColor = vec4(finalColor, alpha);
  }
`;

// Shaders for Lines (Black Connections)
const lineVert = `
  precision mediump float;
  attribute vec2 position;
  void main() {
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

const lineFrag = `
  precision mediump float;
  void main() {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); // Black lines
  }
`;

const hexToRgb = (hex: string) => {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return [r, g, b];
};

function MindMapVisualization({ 
  nodes, 
  onCategoryTap 
}: { 
  nodes: MindMapNode[];
  onCategoryTap: (categoryId: string) => void;
}) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [cameraPosState, setCameraPosState] = useState({ x: 0, y: 0 });
  const cameraPosRef = useRef({ x: 0, y: 0 });
  const startCameraPos = useRef({ x: 0, y: 0 });
  const glRef = useRef<any>(null);
  const frameId = useRef<number | null>(null);

  const currentWidth = isFullscreen ? SCREEN_WIDTH : CHART_SIZE;
  const currentHeight = isFullscreen ? SCREEN_HEIGHT : CHART_SIZE;

  // Coordinate Conversion helper using the Ref for high-performance rendering
  const toGLX = (x: number, camX: number) => (((x / 400) * currentWidth + camX) / currentWidth) * 2 - 1;
  const toGLY = (y: number, camY: number) => 1 - (((y / 400) * currentHeight + camY) / currentHeight) * 2;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5;
      },
      onPanResponderGrant: () => {
        startCameraPos.current = { ...cameraPosRef.current };
      },
      onPanResponderMove: (_, gestureState) => {
        const newPos = {
          x: startCameraPos.current.x + gestureState.dx,
          y: startCameraPos.current.y + gestureState.dy
        };
        // Update Ref for WebGL (Instant)
        cameraPosRef.current = newPos;
        // Update State for SVG labels (React render cycle)
        setCameraPosState(newPos);
      },
    })
  ).current;

  const onContextCreate = (gl: any) => {
    // Cancel any existing loop
    if (frameId.current) {
      cancelAnimationFrame(frameId.current);
    }

    glRef.current = gl;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // Node Program
    const nVert = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(nVert, nodeVert);
    gl.compileShader(nVert);
    const nFrag = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(nFrag, nodeFrag);
    gl.compileShader(nFrag);
    const nodeProgram = gl.createProgram();
    gl.attachShader(nodeProgram, nVert);
    gl.attachShader(nodeProgram, nFrag);
    gl.linkProgram(nodeProgram);

    // Line Program
    const lVert = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(lVert, lineVert);
    gl.compileShader(lVert);
    const lFrag = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(lFrag, lineFrag);
    gl.compileShader(lFrag);
    const lineProgram = gl.createProgram();
    gl.attachShader(lineProgram, lVert);
    gl.attachShader(lineProgram, lFrag);
    gl.linkProgram(lineProgram);

    const nodeBuffer = gl.createBuffer();
    const lineBuffer = gl.createBuffer();

    const render = () => {
      if (!glRef.current) return;
      const currentGl = glRef.current;
      
      currentGl.viewport(0, 0, currentGl.drawingBufferWidth, currentGl.drawingBufferHeight);
      currentGl.clearColor(0.9, 0.9, 0.9, 1.0);
      currentGl.clear(currentGl.COLOR_BUFFER_BIT);

      const { x: camX, y: camY } = cameraPosRef.current;

      // 1. Draw Lines
      currentGl.useProgram(lineProgram);
      // Set line width (thickness). Note: Many mobile devices only support 1.0.
      currentGl.lineWidth(3.0);
      const linePositions: number[] = [];
      nodes.forEach(node => {
        node.connections.forEach(targetId => {
          const target = nodes.find(n => n.id === targetId);
          if (target) {
            linePositions.push(toGLX(node.x, camX), toGLY(node.y, camY));
            linePositions.push(toGLX(target.x, camX), toGLY(target.y, camY));
          }
        });
      });

      currentGl.bindBuffer(currentGl.ARRAY_BUFFER, lineBuffer);
      currentGl.bufferData(currentGl.ARRAY_BUFFER, new Float32Array(linePositions), currentGl.DYNAMIC_DRAW);
      const lPosAttr = currentGl.getAttribLocation(lineProgram, 'position');
      currentGl.enableVertexAttribArray(lPosAttr);
      currentGl.vertexAttribPointer(lPosAttr, 2, currentGl.FLOAT, false, 0, 0);
      currentGl.drawArrays(currentGl.LINES, 0, linePositions.length / 2);

      // 2. Draw Nodes
      currentGl.useProgram(nodeProgram);
      const nodeData: number[] = [];
      
      nodes.forEach(node => {
        const rgb = hexToRgb(node.color);
        // Larger circles, using the proportional size defined in generateMindMapNodes
        const size = node.size * 1.8 * (currentWidth / 400);

        nodeData.push(toGLX(node.x, camX), toGLY(node.y, camY), size, ...rgb, 1.0);
      });

      currentGl.bindBuffer(currentGl.ARRAY_BUFFER, nodeBuffer);
      currentGl.bufferData(currentGl.ARRAY_BUFFER, new Float32Array(nodeData), currentGl.DYNAMIC_DRAW);
      
      const stride = 7 * 4; // x, y, size, r, g, b, a
      const nPosAttr = currentGl.getAttribLocation(nodeProgram, 'position');
      currentGl.vertexAttribPointer(nPosAttr, 2, currentGl.FLOAT, false, stride, 0);
      currentGl.enableVertexAttribArray(nPosAttr);

      const nSizeAttr = currentGl.getAttribLocation(nodeProgram, 'size');
      currentGl.vertexAttribPointer(nSizeAttr, 1, currentGl.FLOAT, false, stride, 2 * 4);
      currentGl.enableVertexAttribArray(nSizeAttr);

      const nColAttr = currentGl.getAttribLocation(nodeProgram, 'color');
      currentGl.vertexAttribPointer(nColAttr, 3, currentGl.FLOAT, false, stride, 3 * 4);
      currentGl.enableVertexAttribArray(nColAttr);

      const nAlphaAttr = currentGl.getAttribLocation(nodeProgram, 'alpha');
      currentGl.vertexAttribPointer(nAlphaAttr, 1, currentGl.FLOAT, false, stride, 6 * 4);
      currentGl.enableVertexAttribArray(nAlphaAttr);

      currentGl.drawArrays(currentGl.POINTS, 0, nodes.length);
      currentGl.endFrameEXP();
      frameId.current = requestAnimationFrame(render);
    };

    render();
  };

  useEffect(() => {
    return () => {
      if (frameId.current) cancelAnimationFrame(frameId.current);
    };
  }, []);

  const handleNodePress = (nodeId: string) => {
    if (nodeId === 'center') {
      return; // Nothing happens when the middle circle is clicked
    } else {
      setSelectedNode(nodeId);
      onCategoryTap(nodeId);
    }
  };

  const MapContent = (
    <View 
      {...panResponder.panHandlers}
      style={{ 
        width: currentWidth, 
        height: currentHeight, 
        borderRadius: isFullscreen ? 0 : 24, 
        overflow: 'hidden' 
      }}
    >
      <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} />
      
      <Svg width={currentWidth} height={currentHeight} style={StyleSheet.absoluteFill} pointerEvents="none">
        {nodes.map((node) => {
          const fontSize = node.id === 'center' ? 24 : 12;
          return (
            <SvgText
              key={node.id}
              x={(node.x / 400) * currentWidth + cameraPosState.x}
              y={(node.y / 400) * currentHeight + cameraPosState.y + 4}
              fontSize={fontSize}
              fill="#000000"
              textAnchor="middle"
              fontWeight="600"
            >
              {node.label}
            </SvgText>
          );
        })}
      </Svg>

      {nodes.map(node => {
        const radius = (node.size * 1.8 * (currentWidth / 400)) / 2;
        return (
          <TouchableWithoutFeedback key={node.id} onPress={() => handleNodePress(node.id)}>
            <View style={{
              position: 'absolute',
              left: (node.x / 400) * currentWidth + cameraPosState.x - radius,
              top: (node.y / 400) * currentHeight + cameraPosState.y - radius,
              width: radius * 2,
              height: radius * 2,
              borderRadius: radius,
            }} />
          </TouchableWithoutFeedback>
        );
      })}

      <TouchableOpacity
        style={[
          styles.fullscreenButton,
          isFullscreen && styles.fullscreenButtonExit
        ]}
        onPress={() => setIsFullscreen(!isFullscreen)}
        activeOpacity={0.7}
      >
        <Text style={styles.fullscreenButtonText}>{isFullscreen ? '↙️' : '↗️'}</Text>
      </TouchableOpacity>
    </View>
  );

  if (isFullscreen) {
    return (
      <Modal visible={true} transparent={false} animationType="fade">
        <View style={{ flex: 1, backgroundColor: '#355A48' }}>
          <SafeAreaView style={{ flex: 1 }}>
            {MapContent}
          </SafeAreaView>
        </View>
      </Modal>
    );
  }

  return (
    <View style={styles.chartContainer}>
      {MapContent}
      {selectedNode && selectedNode === 'center' && (
        <View style={styles.nodeInfo}>
          <Text style={styles.nodeInfoTitle}>
            {nodes.find((n) => n.id === selectedNode)?.label}
          </Text>
          <Text style={styles.nodeInfoText}>Tap a category to explore thoughts</Text>
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

const CATEGORY_COLORS = ['#5B8A72', '#89A4C7', '#B8A9C9', '#D4B896', '#C4A484', '#A8D5BA', '#F4A261', '#E76F51', '#2A9D8F', '#264653'];
const CATEGORY_ICONS = ['💼', '❤️', '🏥', '🌱', '😰', '🎯', '🌟', '💡', '🎨', '🔮'];

function generateMindMapNodes(categories: ThoughtCategory[]): MindMapNode[] {
  if (categories.length === 0) return [];
  const centerNode: MindMapNode = {
    id: 'center',
    label: 'My Thoughts',
    type: 'category',
    x: 200,
    y: 200,
    size: 240, 
    color: CATEGORY_COLORS[0],
    connections: categories.map((cat) => cat.id),
  };
  
  // Find max thought count for proportional scaling
  const maxThoughts = Math.max(...categories.map(c => c.thoughtCount), 1);
  
  // Equal spacing: 360 / number of categories
  const angleStep = (2 * Math.PI) / categories.length;

  const categoryNodes: MindMapNode[] = categories.map((cat, index) => {
    const angle = index * angleStep;
    const radius = 140;

    const x = 200 + radius * Math.cos(angle);
    const y = 200 + radius * Math.sin(angle);
    
    // Proportional size based on thought count (scaled between 30 and 70)
    const size = 30 + (cat.thoughtCount / maxThoughts) * 100;

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
  const [isThoughtsModalVisible, setIsThoughtsModalVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<{id: string; name: string} | null>(null);
  const [selectedCategoryThoughts, setSelectedCategoryThoughts] = useState<Array<{id: string; text: string; created_at: string}>>([]);
  const [isThoughtsLoading, setIsThoughtsLoading] = useState(false);
  const [isAllCategoriesModalVisible, setIsAllCategoriesModalVisible] = useState(false);

  useEffect(() => {
    async function loadCategories() {
      try {
        setIsLoading(true);
        const activeCategories = await getActiveCategories();
        
        // Log the number of things in each category
        console.log('--- Mind Map Categories Loading ---');
        activeCategories.forEach(cat => {
          console.log(`Category: ${cat.name}, Items: ${cat.thought_count}`);
        });
        console.log('-----------------------------------');

        const thoughtCategories: ThoughtCategory[] = activeCategories.map((cat, index) => ({
          id: cat.id,
          name: cat.name,
          color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
          icon: CATEGORY_ICONS[index % CATEGORY_ICONS.length],
          thoughtCount: cat.thought_count,
        }));
        setCategories(thoughtCategories);
        const topCategories = thoughtCategories.slice(0, 8); // Increased to 8 for better circle visualization
        setNodes(generateMindMapNodes(topCategories));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load categories');
      } finally {
        setIsLoading(false);
      }
    }
    loadCategories();
  }, []);

  const handleCategoryTap = async (categoryId: string) => {
    const category = categories.find((cat) => cat.id === categoryId);
    if (!category) return;
    setSelectedCategory({ id: categoryId, name: category.name });
    setIsThoughtsLoading(true);
    try {
      const fetchedThoughts = await getThoughtsByActiveCategory(categoryId);
      setSelectedCategoryThoughts(fetchedThoughts);
      setIsThoughtsModalVisible(true);
    } catch (err) {
      setSelectedCategoryThoughts([]);
      setIsThoughtsModalVisible(true);
    } finally {
      setIsThoughtsLoading(false);
    }
  };

  if (isLoading) return <ScreenContainer><LoadingSpinner message="Loading mind map..." /></ScreenContainer>;
  if (error) return <ScreenContainer scrollable><AppHeader title="Mind Map" subtitle="Visualize your thoughts" /><View style={styles.errorContainer}><Text style={styles.errorText}>Failed: {error}</Text></View></ScreenContainer>;

  return (
    <ScreenContainer scrollable>
      <AppHeader title="Mind Map" subtitle="Visualize your thoughts" />
      {nodes && nodes.length > 0 ? (
        <>
          <MindMapVisualization nodes={nodes} onCategoryTap={handleCategoryTap} />
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
              <TouchableOpacity key={cat.id} style={styles.legendItem} onPress={() => handleCategoryTap(cat.id)}>
                <View style={[styles.legendDot, { backgroundColor: cat.color }]} />
                <Text style={styles.legendLabel}>{cat.name}</Text>
                <Text style={styles.legendCount}>{cat.thoughtCount}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      ) : <EmptyState />}

      <Modal visible={isThoughtsModalVisible} transparent animationType="fade" onRequestClose={() => setIsThoughtsModalVisible(false)}>
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
              {isThoughtsLoading ? <View style={{ flex: 1, justifyContent: "center", alignItems: "center", minHeight: 100 }}><Text>Loading…</Text></View> : (
                <FlatList
                  data={selectedCategoryThoughts}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <View style={styles.thoughtRow}><Text style={styles.thoughtText}>{item.text}</Text></View>
                  )}
                  ListEmptyComponent={<Text style={styles.modalEmptyText}>No thoughts found.</Text>}
                />
              )}
            </View>
            <View style={styles.modalFooter}><Pressable style={styles.modalCloseButton} onPress={() => setIsThoughtsModalVisible(false)}><Text style={styles.modalCloseButtonText}>Close</Text></Pressable></View>
          </View>
        </View>
      </Modal>

      <Modal visible={isAllCategoriesModalVisible} transparent animationType="fade" onRequestClose={() => setIsAllCategoriesModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>All Categories</Text>
              <Pressable onPress={() => setIsAllCategoriesModalVisible(false)} style={styles.modalCloseIcon}><Text style={styles.modalCloseIconText}>×</Text></Pressable>
            </View>
            <View style={styles.modalDivider} />
            <View style={styles.modalBody}>
              <FlatList
                data={categories}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.categoryModalItem} onPress={() => { setIsAllCategoriesModalVisible(false); handleCategoryTap(item.id); }}>
                    <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                    <Text style={styles.categoryModalName}>{item.name}</Text>
                    <Text style={styles.categoryModalCount}>{item.thoughtCount}</Text>
                  </TouchableOpacity>
                )}
              />
            </View>
            <View style={styles.modalFooter}><Pressable style={styles.modalCloseButton} onPress={() => setIsAllCategoriesModalVisible(false)}><Text style={styles.modalCloseButtonText}>Close</Text></Pressable></View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  chartContainer: { position: 'relative', alignItems: 'center', marginVertical: 20 },
  nodeInfo: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginTop: 16, alignItems: 'center', borderWidth: 1, borderColor: '#E8ECEB', width: '100%' },
  nodeInfoTitle: { fontSize: 16, fontWeight: '600', color: '#2D3436', marginBottom: 4 },
  nodeInfoText: { fontSize: 13, color: '#636E72' },
  legend: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginTop: 8, borderWidth: 1, borderColor: '#E8ECEB' },
  legendHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  legendTitle: { fontSize: 16, fontWeight: '600', color: '#2D3436' },
  seeAllButton: { fontSize: 14, color: '#5B8A72', fontWeight: '600' },
  legendItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  legendDot: { width: 12, height: 12, borderRadius: 6, marginRight: 12 },
  legendLabel: { flex: 1, fontSize: 14, color: '#2D3436' },
  legendCount: { fontSize: 14, color: '#636E72', fontWeight: '500' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40, paddingTop: 80 },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 22, fontWeight: 'bold', color: '#2D3436', marginBottom: 8 },
  emptyText: { fontSize: 15, color: '#636E72', textAlign: 'center', lineHeight: 22 },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40, paddingTop: 80 },
  errorText: { fontSize: 15, color: '#E76F51', textAlign: 'center', lineHeight: 22 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.35)', justifyContent: 'center', alignItems: 'center' },
  modalCard: { width: '92%', maxHeight: '80%', backgroundColor: '#fff', borderRadius: 18, overflow: 'hidden' },
  modalHeader: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  modalCloseIcon: { padding: 4 },
  modalCloseIconText: { fontSize: 24, color: '#636E72' },
  modalDivider: { height: 1, backgroundColor: '#eee' },
  modalBody: { maxHeight: 400, flexShrink: 1 },
  modalFooter: { padding: 16, borderTopWidth: 1, borderTopColor: '#eee' },
  thoughtRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f1f1', marginHorizontal: 16 },
  thoughtText: { fontSize: 15, color: '#111' },
  modalEmptyText: { paddingVertical: 12, color: '#666', textAlign: 'center' },
  modalCloseButton: { paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: '#5B8A72' },
  modalCloseButtonText: { fontWeight: '700', color: '#FFFFFF', fontSize: 16 },
  categoryModalItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#f1f1f1' },
  categoryModalName: { flex: 1, fontSize: 15, color: '#2D3436', marginLeft: 12 },
  categoryModalCount: { fontSize: 14, color: '#636E72', fontWeight: '500' },
  starIcon: { position: 'absolute', fontSize: 24, color: 'rgba(255, 215, 0, 1)', zIndex: -1 },
  fullscreenButton: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  fullscreenButtonExit: {
    bottom: 64,
  },
  fullscreenButtonText: {
    fontSize: 20,
  },
});
