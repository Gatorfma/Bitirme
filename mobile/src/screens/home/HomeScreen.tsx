/**
 * HomeScreen
 * The primary dashboard with a custom GLSL Shader background
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { GLView } from 'expo-gl';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../../state/authStore';
import { PrimaryButton } from '../../components/common';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// 1. Vertex Shader: Simple pass-through for the screen coordinates
const vertSource = `
  attribute vec2 position;
  void main() {
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

// 2. Fragment Shader: This creates the animated "Atmosphere" effect
const fragSource = `
  precision mediump float;
  uniform float time;
  uniform vec2 resolution;

  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    
    // Create an animated gradient using time and UV coordinates
    vec3 color1 = vec3(0.35, 0.54, 0.45); // Brand Green
    vec3 color2 = vec3(0.1, 0.15, 0.2);   // Dark Slate
    
    float mixValue = distance(uv, vec2(0.5 + sin(time * 0.5) * 0.2, 0.5 + cos(time * 0.3) * 0.2));
    vec3 finalColor = mix(color1, color2, mixValue);
    
    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuthStore();
  const frameId = useRef<number | null>(null);

  const onContextCreate = async (gl: any) => {
    // Compile Vertex Shader
    const vert = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vert, vertSource);
    gl.compileShader(vert);

    // Compile Fragment Shader
    const frag = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(frag, fragSource);
    gl.compileShader(frag);

    // Link Program
    const program = gl.createProgram();
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);
    gl.useProgram(program);

    // Create Buffer for a full-screen rectangle (two triangles)
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    const verts = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);

    // Map "position" attribute
    const positionAttrib = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(positionAttrib);
    gl.vertexAttribPointer(positionAttrib, 2, gl.FLOAT, false, 0, 0);

    // Get Uniform Locations
    const timeUniform = gl.getUniformLocation(program, 'time');
    const resUniform = gl.getUniformLocation(program, 'resolution');

    let startTime = Date.now();

    const render = () => {
      const now = Date.now();
      const elapsed = (now - startTime) / 1000;

      // Update Uniforms
      gl.uniform1f(timeUniform, elapsed);
      gl.uniform2f(resUniform, gl.drawingBufferWidth, gl.drawingBufferHeight);

      // Draw
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      gl.endFrameEXP();
      frameId.current = requestAnimationFrame(render);
    };

    render();
  };

  useEffect(() => {
    return () => {
      if (frameId.current) cancelAnimationFrame(frameId.current);
    };
  }, []);

  return (
    <View style={styles.container}>
      <GLView style={styles.canvas} onContextCreate={onContextCreate} />
      <ScrollView 
        style={styles.contentLayer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.welcomeText}>Welcome back,</Text>
          <Text style={styles.userName}>{user?.name || 'Friend'} ✨</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardEmoji}>📝</Text>
          <Text style={styles.cardTitle}>Ready to journal?</Text>
          <Text style={styles.cardSubtitle}>
            Take a moment to check in with yourself.
          </Text>
          <PrimaryButton
            title="Start New Session"
            onPress={() => navigation.navigate('JournalHome', { screen: 'NewSession' })}
            size="medium"
          />
        </View>

        <View style={styles.statsRow}>
          <TouchableOpacity style={styles.statCard} onPress={() => navigation.navigate('Stats')}>
            <Text style={styles.statEmoji}>📊</Text>
            <Text style={styles.statLabel}>View Stats</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.statCard} onPress={() => navigation.navigate('MindMap')}>
            <Text style={styles.statEmoji}>🧠</Text>
            <Text style={styles.statLabel}>Mind Map</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  canvas: { ...StyleSheet.absoluteFillObject },
  contentLayer: { flex: 1 },
  scrollContent: { padding: 20, paddingTop: 60 },
  header: { marginBottom: 30 },
  welcomeText: { fontSize: 16, color: 'rgba(255,255,255,0.7)' },
  userName: { fontSize: 28, fontWeight: 'bold', color: '#FFFFFF' },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  cardEmoji: { fontSize: 40, marginBottom: 12 },
  cardTitle: { fontSize: 20, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 8 },
  cardSubtitle: { fontSize: 15, color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginBottom: 20 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  statCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 16,
    width: '48%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  statEmoji: { fontSize: 24, marginBottom: 8 },
  statLabel: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
});
