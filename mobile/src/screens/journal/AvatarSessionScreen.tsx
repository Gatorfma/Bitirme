/**
 * AvatarSessionScreen
 * Humanoid Avatar rewritten using Three.js for 3D expressiveness.
 * Features: Breathing, Blinking, Separate Idle/Speaking mouths, and Vertical Bobbing.
 * Side-to-side head movement and swaying have been removed.
 * Integration with Whisper (STT), OpenAI, and Text-to-Speech.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
  Alert,
} from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { GLView } from 'expo-gl';
import { StatusBar } from 'expo-status-bar';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import * as THREE from 'three';
import { Renderer } from 'expo-three';

import type { ChatMessage } from '../../types/models';
import { getJournalAssistantReply } from '../../api/openaiChat';
import { createSession, updateSession, deleteSession } from '../../journal/supabaseSessionRepo';
import { summarizeAndExtractThoughts } from '../../agents/journalingPostProcessor';
import { updateSessionSummaryAndThoughts } from '../../repos/journalSessionsRepo';
import { insertThoughtItems } from '../../repos/thoughtItemsRepo';
import { runCategorizationForSession } from '../../agents/categorizationPipeline';
import { useCreateSession } from '../../hooks/useJournal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function AvatarSessionScreen() {
  const navigation = useNavigation<any>();
  const isFocused = useIsFocused();
  const createSessionMutation = useCreateSession();

  const [status, setStatus] = useState<'idle' | 'recording' | 'processing' | 'speaking'>('idle');
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const frameId = useRef<number | null>(null);

  // Status Ref for the animation loop to avoid stale closures
  const statusRef = useRef(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const supabaseSessionIdRef = useRef<string | null>(null);
  const isStartingRecording = useRef(false);

  const userThoughts = messages.filter(m => m.type === 'user');

  // --- Three.js Logic ---
  const onContextCreate = async (gl: any) => {
    const { drawingBufferWidth: width, drawingBufferHeight: height } = gl;

    // 1. Setup Scene, Camera, and Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xfafbfc); // Safe, warm background

    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.z = 5;
    camera.position.y = 0.5;

    const renderer = new Renderer({ gl });
    renderer.setSize(width, height);

    // 2. Add Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);
    
    const frontLight = new THREE.DirectionalLight(0xffffff, 0.6);
    frontLight.position.set(0, 2, 5);
    scene.add(frontLight);

    // 3. Construct Avatar Group
    const avatarGroup = new THREE.Group();
    scene.add(avatarGroup);

    // Materials
    const skinMat = new THREE.MeshPhongMaterial({ color: 0x6b7a8c, shininess: 10 });
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a });

    // Torso (Soft pill shape)
    const torsoGeom = new THREE.SphereGeometry(1.6, 32, 32);
    torsoGeom.scale(1.1, 1.4, 0.7);
    const torso = new THREE.Mesh(torsoGeom, skinMat);
    torso.position.y = -3.2;
    avatarGroup.add(torso);

    // Head Group (to rotate and move as one unit)
    const headGroup = new THREE.Group();
    headGroup.position.y = 0.6;
    avatarGroup.add(headGroup);

    const headGeom = new THREE.SphereGeometry(0.85, 32, 32);
    headGeom.scale(1, 1.1, 0.9);
    const headMesh = new THREE.Mesh(headGeom, skinMat);
    headGroup.add(headMesh);

    // Eyes
    const eyeGeom = new THREE.SphereGeometry(0.07, 16, 16);
    const leftEye = new THREE.Mesh(eyeGeom, eyeMat);
    leftEye.position.set(-0.28, 0.15, 0.86); 
    const rightEye = new THREE.Mesh(eyeGeom, eyeMat);
    rightEye.position.set(0.28, 0.15, 0.86);
    headGroup.add(leftEye, rightEye);

    // Eyebrows (Capsules)
    const browGeom = new THREE.CapsuleGeometry(0.02, 0.15, 4, 8);
    browGeom.rotateZ(Math.PI / 2);
    const leftBrow = new THREE.Mesh(browGeom, eyeMat);
    leftBrow.position.set(-0.28, 0.35, 0.86);
    const rightBrow = new THREE.Mesh(browGeom, eyeMat);
    rightBrow.position.set(0.28, 0.35, 0.86);
    headGroup.add(leftBrow, rightBrow);

    // --- Separate Mouths ---
    // 1. Idle Mouth (Smile shape)
    const idleMouthGeom = new THREE.TorusGeometry(0.12, 0.015, 16, 32, Math.PI);
    const idleMouth = new THREE.Mesh(idleMouthGeom, eyeMat);
    idleMouth.position.set(0, -0.15, 0.86);
    idleMouth.rotation.x = Math.PI; 
    headGroup.add(idleMouth);

    // 2. Speaking Mouth (Open shape)
    const speakingMouthGeom = new THREE.SphereGeometry(0.08, 16, 16);
    speakingMouthGeom.scale(1, 0.6, 0.1);
    const speakingMouth = new THREE.Mesh(speakingMouthGeom, eyeMat);
    speakingMouth.position.set(0, -0.2, 0.87);
    speakingMouth.visible = false;
    headGroup.add(speakingMouth);

    // 4. Animation Loop
    const render = () => {
      frameId.current = requestAnimationFrame(render);
      const time = Date.now() * 0.001;
      const currentStatus = statusRef.current;

      // --- Idle Animations ---
      // side-to-side swaying removed (avatarGroup.position.x and rotation.z)

      // Breathing effect
      const breath = 1.0 + Math.sin(time * 1.5) * 0.02;
      torso.scale.set(1.1 * breath, 1.4 * breath, 0.7 * breath);

      // Random Blinking
      const blink = Math.sin(time * 0.4) * Math.sin(time * 3.1);
      const isBlinking = blink > 0.98;
      leftEye.scale.y = isBlinking ? 0.1 : 1.0;
      rightEye.scale.y = isBlinking ? 0.1 : 1.0;

      // --- Reactive Animations ---
      const isTalking = currentStatus === 'speaking';
      const isRecording = currentStatus === 'recording';
      const isThinking = currentStatus === 'processing';

      // Head Bobbing (Vertical movement only - Side sway removed)
      const bobFreq = (isRecording || isTalking) ? 8.0 : 1.5;
      const bobAmp = isRecording ? 0.12 : (isTalking ? 0.08 : 0.005);
      headGroup.position.y = 0.6 + Math.sin(time * bobFreq) * bobAmp;

      // Mouth logic - Switch between idle smile and talking mouth
      if (isTalking) {
        idleMouth.visible = false;
        speakingMouth.visible = true;
        // Simple talking scale animation
        speakingMouth.scale.y = 0.8 + Math.abs(Math.sin(time * 15.0)) * 0.7;
      } else {
        idleMouth.visible = true;
        speakingMouth.visible = false;
      }

      // Thinking State - Brows only, side-to-side head rotation removed
      if (isThinking) {
        // Furrow brows
        leftBrow.position.y = 0.33;
        rightBrow.position.y = 0.33;
        leftBrow.rotation.z = -0.15;
        rightBrow.rotation.z = 0.15;
      } else if (isTalking) {
        // Raise brows
        leftBrow.position.y = 0.38;
        rightBrow.position.y = 0.38;
        leftBrow.rotation.z = 0;
        rightBrow.rotation.z = 0;
      } else {
        // Reset brows to idle position
        leftBrow.position.y = THREE.MathUtils.lerp(leftBrow.position.y, 0.35, 0.1);
        rightBrow.position.y = THREE.MathUtils.lerp(rightBrow.position.y, 0.35, 0.1);
        leftBrow.rotation.z = THREE.MathUtils.lerp(leftBrow.rotation.z, 0, 0.1);
        rightBrow.rotation.z = THREE.MathUtils.lerp(rightBrow.rotation.z, 0, 0.1);
      }

      renderer.render(scene, camera);
      gl.endFrameEXP();
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

  // UI Pulse Animation
  useEffect(() => {
    if (status === 'recording') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [status]);

  // --- Voice / Transcription / AI Logic ---

  async function startRecording() {
    if (isStartingRecording.current || recordingRef.current || status !== 'idle') return;
    try {
      isStartingRecording.current = true;
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow microphone access.');
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recordingRef.current = recording;
      setStatus('recording');

      if (!supabaseSessionIdRef.current) {
        const { id } = await createSession({ startedAt: new Date().toISOString() });
        supabaseSessionIdRef.current = id;
      }
    } catch (err) {
      console.error('[Avatar] Start failed:', err);
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
      if (!uri) throw new Error('No URI');

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
        updateSession({ id: supabaseSessionIdRef.current, messages: finalMessages }).catch(() => {});
      }

      setStatus('speaking');
      Speech.speak(aiReply, {
        language: 'en-US',
        onDone: () => setStatus('idle'),
        onError: () => setStatus('idle'),
      });

    } catch (err) {
      console.error('[Avatar] Recording flow failed', err);
      setStatus('idle');
    }
  }

  async function transcribeWithWhisper(uri: string) {
    const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
    const formData = new FormData();
    // @ts-ignore
    formData.append('file', { uri, name: 'recording.m4a', type: 'audio/m4a' });
    formData.append('model', 'whisper-1');
    formData.append('language', 'en');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.text;
  }

  const handleBack = useCallback(async () => {
    Speech.stop();
    if (supabaseSessionIdRef.current) {
      const userMsgCount = messages.filter(m => m.type === 'user').length;
      if (userMsgCount === 0) {
        deleteSession(supabaseSessionIdRef.current).catch(() => {});
      } else {
        const now = new Date().toISOString();
        updateSession({ id: supabaseSessionIdRef.current, messages: messages, endedAt: now }).catch(() => {});

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
  }, [navigation, messages]);

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
      
      {/* 3D Canvas Area */}
      <View style={styles.upperHalf}>
        <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} />
      </View>

      {/* Control Panel Area */}
      <View style={styles.lowerHalf}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>AI Assistant</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.statusBox}>
          <Text style={styles.statusText}>
            {status === 'idle' && 'Hold mic to speak'}
            {status === 'recording' && 'I\'m listening...'}
            {status === 'processing' && 'One moment...'}
            {status === 'speaking' && 'Reflecting...'}
          </Text>
        </View>

        <View style={styles.buttonContainer}>
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <TouchableOpacity
              style={[styles.recordButton, status === 'recording' && styles.recordButtonActive]}
              onPressIn={startRecording}
              onPressOut={stopRecording}
              activeOpacity={0.8}
            >
              <Text style={styles.recordIcon}>{status === 'recording' ? '⏹' : '🎤'}</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>

        <TouchableOpacity style={styles.endButton} onPress={handleEndSession}>
          <Text style={styles.endButtonText}>End Conversation</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A2633' },
  upperHalf: { flex: 1.2, overflow: 'hidden' },
  lowerHalf: { flex: 1, backgroundColor: '#FAFBFC', alignItems: 'center', paddingBottom: 40, borderTopLeftRadius: 30, borderTopRightRadius: 30, marginTop: -30, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: -5 }, shadowOpacity: 0.1, shadowRadius: 10 },
  header: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 20 },
  backText: { color: '#3498db', fontSize: 16, fontWeight: '600' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#2D3436' },
  statusBox: { marginTop: 10, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20, backgroundColor: 'rgba(52, 152, 219, 0.08)' },
  statusText: { fontSize: 18, color: '#3498db', fontWeight: '600' },
  buttonContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  recordButton: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#3498db', justifyContent: 'center', alignItems: 'center', elevation: 8, shadowColor: '#3498db', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10 },
  recordButtonActive: { backgroundColor: '#FF5252', shadowColor: '#FF5252' },
  recordIcon: { fontSize: 36, color: '#FFFFFF' },
  endButton: { paddingHorizontal: 40, paddingVertical: 14, borderRadius: 25, backgroundColor: '#F0F3F4' },
  endButtonText: { color: '#7F8C8D', fontSize: 15, fontWeight: '700' },
});
