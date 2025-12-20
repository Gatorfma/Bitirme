/**
 * HomeScreen
 * The primary dashboard with a custom GLSL Shader background.
 * Now serves as a central hub with big buttons and no tab bar.
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { GLView } from 'expo-gl';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../../state/authStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// 1. Vertex Shader: Simple pass-through for the screen coordinates
const vertSource = `
  attribute vec2 position;
  void main() {
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

// 2. Fragment Shader: Animated Atmosphere effect
const fragSource = `
  precision mediump float;
  uniform float time;
  uniform vec2 resolution;

  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
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
    const vert = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vert, vertSource);
    gl.compileShader(vert);

    const frag = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(frag, fragSource);
    gl.compileShader(frag);

    const program = gl.createProgram();
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    const verts = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);

    const positionAttrib = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(positionAttrib);
    gl.vertexAttribPointer(positionAttrib, 2, gl.FLOAT, false, 0, 0);

    const timeUniform = gl.getUniformLocation(program, 'time');
    const resUniform = gl.getUniformLocation(program, 'resolution');

    let startTime = Date.now();
    const render = () => {
      const now = Date.now();
      const elapsed = (now - startTime) / 1000;
      gl.uniform1f(timeUniform, elapsed);
      gl.uniform2f(resUniform, gl.drawingBufferWidth, gl.drawingBufferHeight);
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

  const MenuButton = ({ title, emoji, onPress, subtitle }: any) => (
    <TouchableOpacity style={styles.menuButton} onPress={onPress} activeOpacity={0.8}>
      <Text style={styles.menuEmoji}>{emoji}</Text>
      <View style={styles.menuTextContainer}>
        <Text style={styles.menuTitle}>{title}</Text>
        <Text style={styles.menuSubtitle}>{subtitle}</Text>
      </View>
      <Text style={styles.arrow}>→</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <GLView style={styles.canvas} onContextCreate={onContextCreate} />
      
      <ScrollView 
        style={styles.contentLayer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.welcomeText}>MindJournal</Text>
          <Text style={styles.userName}>Hello, {user?.name || 'Friend'} ✨</Text>
        </View>

        <View style={styles.menuContainer}>
          <MenuButton 
            title="Journal" 
            subtitle="Write and reflect" 
            emoji="✍️" 
            onPress={() => navigation.navigate('Main', { screen: 'JournalHome' })} 
          />
          <MenuButton 
            title="Mind Map" 
            subtitle="Visualize thoughts" 
            emoji="🧠" 
            onPress={() => navigation.navigate('Main', { screen: 'MindMap' })} 
          />
          <MenuButton 
            title="Stats" 
            subtitle="Track your progress" 
            emoji="📊" 
            onPress={() => navigation.navigate('Main', { screen: 'Stats' })} 
          />
          <MenuButton 
            title="Behaviors" 
            subtitle="Analyze patterns" 
            emoji="🎯" 
            onPress={() => navigation.navigate('Main', { screen: 'Behaviors' })} 
          />
          <MenuButton 
            title="Profile" 
            subtitle="Manage account" 
            emoji="👤" 
            onPress={() => navigation.navigate('Main', { screen: 'Profile' })} 
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  canvas: { ...StyleSheet.absoluteFillObject },
  contentLayer: { flex: 1 },
  scrollContent: { padding: 24, paddingTop: 80, paddingBottom: 40 },
  header: { marginBottom: 40 },
  welcomeText: { fontSize: 16, color: 'rgba(255,255,255,0.6)', fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase' },
  userName: { fontSize: 32, fontWeight: 'bold', color: '#FFFFFF', marginTop: 8 },
  menuContainer: { gap: 16 },
  menuButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 24,
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  menuEmoji: { fontSize: 32, marginRight: 20 },
  menuTextContainer: { flex: 1 },
  menuTitle: { fontSize: 20, fontWeight: 'bold', color: '#FFFFFF' },
  menuSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.6)', marginTop: 4 },
  arrow: { fontSize: 24, color: 'rgba(255,255,255,0.3)', fontWeight: '300' },
  footer: { marginTop: 40, alignItems: 'center' },
  quote: { fontSize: 16, fontStyle: 'italic', color: 'rgba(255,255,255,0.5)' },
});
