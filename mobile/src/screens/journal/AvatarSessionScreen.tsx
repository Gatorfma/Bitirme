/**
 * AvatarSessionScreen
 * Split-screen interface with WebGL Atmosphere, Speech-to-Text (Whisper), and Text-to-Speech.
 * Optimised for responsiveness with non-blocking database saves.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
  SafeAreaView,
  Alert,
} from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { GLView } from 'expo-gl';
import { StatusBar } from 'expo-status-bar';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';

import type { ChatMessage } from '../../types/models';
import { getJournalAssistantReply } from '../../api/openaiChat';
import { createSession, updateSession, deleteSession, hasUserMessages } from '../../journal/supabaseSessionRepo';
import { summarizeAndExtractThoughts } from '../../agents/journalingPostProcessor';
import { updateSessionSummaryAndThoughts } from '../../repos/journalSessionsRepo';
import { insertThoughtItems } from '../../repos/thoughtItemsRepo';
import { runCategorizationForSession } from '../../agents/categorizationPipeline';
import { useAuthStore } from '../../state/authStore';
import { useCreateSession } from '../../hooks/useJournal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// --- WebGL Shaders (Stylized Humanoid Avatar) ---
const vertSource = `
  attribute vec2 position;
  void main() {
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

const fragSource = `
  precision mediump float;
  uniform float time;
  uniform vec2 resolution;
  uniform float uIsTalking;

  float circle(vec2 uv, vec2 center, float radius, float blur) {
    float d = distance(uv, center);
    return smoothstep(radius, radius - blur, d);
  }

  float ellipse(vec2 uv, vec2 center, float rx, float ry, float blur) {
    vec2 p = (uv - center) / vec2(rx, ry);
    float d = length(p);
    return smoothstep(1.0, 1.0 - blur, d);
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    float aspect = resolution.x / resolution.y;
    vec2 p = uv;
    p.x *= aspect;
    vec2 center = vec2(0.5 * aspect, 0.5);

    vec3 color1 = vec3(0.35, 0.54, 0.45);
    vec3 color2 = vec3(0.1, 0.15, 0.2);
    float bgDist = distance(uv, vec2(0.5 + sin(time * 0.3) * 0.1, 0.5 + cos(time * 0.5) * 0.1));
    vec3 color = mix(color1, color2, bgDist);

    float head = ellipse(p, center, 0.25, 0.35, 0.01);
    vec3 skinColor = vec3(0.85, 0.75, 0.65);
    color = mix(color, skinColor, head);

    float blink = step(0.05, fract(time * 0.2));
    float eyeSize = 0.02 * blink;
    float eyeL = circle(p, center + vec2(-0.08, 0.08), eyeSize, 0.005);
    float eyeR = circle(p, center + vec2(0.08, 0.08), eyeSize, 0.005);
    color = mix(color, vec3(0.1), eyeL + eyeR);

    float mouthOpen = uIsTalking * (0.04 + 0.04 * sin(time * 12.0));
    float mouthHeight = 0.01 + mouthOpen;
    float mouth = ellipse(p, center + vec2(0.0, -0.12), 0.08, mouthHeight, 0.005);
    color = mix(color, vec3(0.3, 0.1, 0.1), mouth);

    gl_FragColor = vec4(color, 1.0);
  }
`;

export default function AvatarSessionScreen() {
  const navigation = useNavigation<any>();
  const isFocused = useIsFocused();
  const createSessionMutation = useCreateSession();
  
  const [status, setStatus] = useState<'idle' | 'recording' | 'processing' | 'speaking'>('idle');
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const frameId = useRef<number | null>(null);
  const isTalkingRef = useRef(0.0);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const supabaseSessionIdRef = useRef<string | null>(null);
  const isStartingRecording = useRef(false);

  const userThoughts = messages.filter(m => m.type === 'user');

  useEffect(() => {
    isTalkingRef.current = status === 'speaking' ? 1.0 : 0.0;
  }, [status]);

  const onContextCreate = (gl: any) => {
    if (frameId.current) cancelAnimationFrame(frameId.current);
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
    const talkingUniform = gl.getUniformLocation(program, 'uIsTalking');
    let startTime = Date.now();
    const render = () => {
      const now = Date.now();
      const elapsed = (now - startTime) / 1000;
      gl.uniform1f(timeUniform, elapsed);
      gl.uniform2f(resUniform, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.uniform1f(talkingUniform, isTalkingRef.current);
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
      Speech.stop();
      if (recordingRef.current) recordingRef.current.stopAndUnloadAsync().catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (status === 'recording') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [status]);

  const ensureSupabaseSession = async () => {
    if (supabaseSessionIdRef.current) return;
    try {
      const result = await createSession({ startedAt: new Date().toISOString() });
      supabaseSessionIdRef.current = result.id;
    } catch (err) {
      console.error('[Avatar] Failed to create session:', err);
    }
  };

  async function startRecording() {
    if (isStartingRecording.current || recordingRef.current || status !== 'idle') return;
    try {
      isStartingRecording.current = true;
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow microphone access.');
        isStartingRecording.current = false;
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recordingRef.current = recording;
      setStatus('recording');
      ensureSupabaseSession(); // Fire and forget
    } catch (err) {
      console.error('[Avatar] Failed to start recording', err);
      setStatus('idle');
    } finally {
      isStartingRecording.current = false;
    }
  }

  async function stopRecording() {
    if (!recordingRef.current || status !== 'recording') return;
    const recording = recordingRef.current;
    recordingRef.current = null;
    setStatus('processing');
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      if (!uri) throw new Error('No recording URI returned');
      const transcription = await transcribeWithWhisper(uri);
      if (!transcription || transcription.trim().length < 2) {
        setStatus('idle');
        return;
      }
      const userMessage: ChatMessage = { id: Date.now().toString(), type: 'user', content: transcription, timestamp: new Date().toISOString() };
      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);
      const aiReply = await getJournalAssistantReply(updatedMessages);
      const aiMessage: ChatMessage = { id: (Date.now() + 1).toString(), type: 'question', content: aiReply, timestamp: new Date().toISOString() };
      const finalMessages = [...updatedMessages, aiMessage];
      setMessages(finalMessages);
      if (supabaseSessionIdRef.current) {
        updateSession({ id: supabaseSessionIdRef.current, messages: finalMessages }).catch(e => console.error(e));
      }
      setStatus('speaking');
      Speech.speak(aiReply, { onDone: () => setStatus('idle'), onError: () => setStatus('idle') });
    } catch (err) {
      console.error('[Avatar] flow failed', err);
      setStatus('idle');
    }
  }

  async function transcribeWithWhisper(uri: string) {
    const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
    if (!apiKey) throw new Error('Missing OpenAI API Key');
    const formData = new FormData();
    // @ts-ignore
    formData.append('file', { uri, name: 'recording.m4a', type: 'audio/m4a' });
    formData.append('model', 'whisper-1');
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'multipart/form-data' },
      body: formData,
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.text;
  }

  const handleBack = useCallback(async () => {
    Speech.stop();
    if (supabaseSessionIdRef.current) {
      if (userThoughts.length === 0) {
        await deleteSession(supabaseSessionIdRef.current);
      } else {
        const now = new Date().toISOString();
        await updateSession({ id: supabaseSessionIdRef.current, messages: messages, endedAt: now });
        summarizeAndExtractThoughts({ 
          messages: messages.filter(msg => msg.type === 'user' || msg.type === 'question').map(msg => ({
            role: (msg.type === 'user' ? 'user' : 'agent') as 'user' | 'agent',
            content: msg.content,
            timestamp: msg.timestamp,
          }))
        }).then(async ({ summary, thoughts }) => {
          if (supabaseSessionIdRef.current) {
            await updateSessionSummaryAndThoughts({ sessionId: supabaseSessionIdRef.current, summary, thoughts, setPostProcessedAt: true });
            await insertThoughtItems({ sessionId: supabaseSessionIdRef.current, thoughts: thoughts.map(t => ({ text: t.text, timestamp: t.timestamp })) });
            runCategorizationForSession(supabaseSessionIdRef.current);
          }
        }).catch(e => console.error(e));
      }
    }
    navigation.navigate('JournalHomeScreen');
  }, [navigation, messages, userThoughts.length]);

  const handleEndSession = async () => {
    if (userThoughts.length > 0) {
      try {
        await createSessionMutation.mutateAsync({
          thoughts: userThoughts.map(m => ({ content: m.content, timestamp: m.timestamp })),
          mood: 6,
        });
      } catch (e) {}
    }
    await handleBack();
  };

  return (
    <View style={styles.container}>
      {isFocused && <StatusBar hidden />}
      <View style={styles.upperHalf}>
        <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} />
      </View>
      <View style={styles.lowerHalf}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}><Text style={styles.backText}>Back</Text></TouchableOpacity>
          <Text style={styles.headerTitle}>Avatar Session</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.statusBox}>
          <Text style={styles.statusText}>
            {status === 'idle' && 'Tap to speak'}
            {status === 'recording' && 'Listening...'}
            {status === 'processing' && 'Thinking...'}
            {status === 'speaking' && 'Speaking...'}
          </Text>
        </View>
        <View style={styles.buttonContainer}>
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <TouchableOpacity style={[styles.recordButton, status === 'recording' && styles.recordButtonActive]} onPressIn={startRecording} onPressOut={stopRecording} activeOpacity={0.8}>
              <Text style={styles.recordIcon}>{status === 'recording' ? '⏹' : '🎤'}</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
        <TouchableOpacity style={styles.endButton} onPress={handleEndSession}><Text style={styles.endButtonText}>End Session</Text></TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A2633' },
  upperHalf: { flex: 1, overflow: 'hidden' },
  lowerHalf: { flex: 1, backgroundColor: '#FAFBFC', alignItems: 'center', paddingBottom: 40 },
  header: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 20 },
  backText: { color: '#3498db', fontSize: 16, fontWeight: '600' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#2D3436' },
  statusBox: { marginTop: 10, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20, backgroundColor: 'rgba(52, 152, 219, 0.1)' },
  statusText: { fontSize: 18, color: '#3498db', fontWeight: '600' },
  buttonContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  recordButton: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#3498db', justifyContent: 'center', alignItems: 'center', elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10 },
  recordButtonActive: { backgroundColor: '#FF5252' },
  recordIcon: { fontSize: 40, color: '#FFFFFF' },
  endButton: { paddingHorizontal: 30, paddingVertical: 15, borderRadius: 25, backgroundColor: '#E8ECEB' },
  endButtonText: { color: '#636E72', fontSize: 16, fontWeight: '600' },
});
