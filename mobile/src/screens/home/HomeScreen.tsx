/**
 * HomeScreen
 * The primary dashboard with a custom GLSL Shader background.
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Modal } from 'react-native';
import { GLView } from 'expo-gl';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { useAuthStore } from '../../state/authStore';
import { PrimaryButton } from '../../components/common';
import { useStatsOverview } from '../../hooks/useStats';

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

/**
 * A stylized "Real-Life" physical calendar component with navigation
 */
const CalendarView = ({ viewDate, onPrevMonth, onNextMonth, activeDates = [] }: any) => {
  const today = new Date();
  const monthName = viewDate.toLocaleString('default', { month: 'long' });
  const year = viewDate.getFullYear();

  const firstDayOfMonth = (new Date(year, viewDate.getMonth(), 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, viewDate.getMonth() + 1, 0).getDate();

  const days = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }
  while (days.length < 42) {
    days.push(null);
  }

  const isToday = (day: number | null) => {
    return day === today.getDate() &&
           viewDate.getMonth() === today.getMonth() &&
           viewDate.getFullYear() === today.getFullYear();
  };

  const hasEntry = (day: number | null) => {
    if (!day) return false;
    // Format to YYYY-MM-DD to match stats API format
    const dateStr = `${year}-${String(viewDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return activeDates.includes(dateStr);
  };

  const weekDays = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

  return (
    <View style={styles.calendarContainer}>
      <View style={styles.calendarRings}>
        {[1, 2, 3, 4, 5, 6, 7].map(i => (
          <View key={i} style={styles.ringContainer}>
            <View style={styles.ringHole} />
            <View style={styles.ring} />
          </View>
        ))}
      </View>

      <View style={styles.calendarPaper}>
        <View style={styles.calendarTopBar}>
          <TouchableOpacity onPress={onPrevMonth} style={styles.navButton}>
            <Text style={styles.navButtonText}>◀</Text>
          </TouchableOpacity>

          <View style={styles.headerTitleContainer}>
            <Text style={styles.calendarMonthText}>{monthName.toUpperCase()}</Text>
            <Text style={styles.calendarYearText}>{year}</Text>
          </View>

          <TouchableOpacity onPress={onNextMonth} style={styles.navButton}>
            <Text style={styles.navButtonText}>▶</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.calendarBody}>
          <View style={styles.weekDaysRow}>
            {weekDays.map((day, index) => (
              <Text key={index} style={styles.weekDayText}>{day}</Text>
            ))}
          </View>
          <View style={styles.daysGrid}>
            {days.map((day, index) => (
              <View key={index} style={styles.dayCell}>
                {day && (
                  <View style={[
                    styles.dayCircle,
                    isToday(day) && styles.todayCircle
                  ]}>
                    <Text style={[
                      styles.dayText,
                      isToday(day) && styles.todayText
                    ]}>
                      {day}
                    </Text>
                    {hasEntry(day) && (
                      <View style={[
                        styles.entryDot,
                        isToday(day) && styles.todayDot
                      ]} />
                    )}
                  </View>
                )}
              </View>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
};

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const isFocused = useIsFocused();
  const { user, token } = useAuthStore();
  const { data: stats } = useStatsOverview('week');
  const frameId = useRef<number | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const hasShownPopup = useRef(false);
  const [isPopupVisible, setIsPopupVisible] = useState(false);
  const [viewDate, setViewDate] = useState(new Date());

  // Scroll to top whenever the screen becomes focused
  useEffect(() => {
    if (isFocused) {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }
  }, [isFocused]);

  // Only show popup when screen becomes focused and user is definitely logged in
  useEffect(() => {
    if (isFocused && token && !hasShownPopup.current) {
      const timer = setTimeout(() => {
        setIsPopupVisible(true);
        hasShownPopup.current = true;
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isFocused, token]);

  const handlePrevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

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
      {/* Only hide status bar when this specific screen is visible */}
      {isFocused && <StatusBar hidden />}

      <GLView style={styles.canvas} onContextCreate={onContextCreate} />

      <Modal
        animationType="fade"
        transparent={true}
        visible={isPopupVisible}
        onRequestClose={() => setIsPopupVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.featuredTitle}>How are you today?</Text>
            <PrimaryButton
              title="Let's Talk!"
              onPress={() => {
                setIsPopupVisible(false);
                navigation.navigate('JournalHome', { screen: 'NewSession' });
              }}
              size="medium"
              style={styles.featuredButton}
            />
            <TouchableOpacity
              style={styles.maybeLaterButton}
              onPress={() => setIsPopupVisible(false)}
            >
              <Text style={styles.maybeLaterText}>Maybe later...</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ScrollView
        ref={scrollRef}
        style={styles.contentLayer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.welcomeText}>MindJournal</Text>
          <Text style={styles.userName}>Hello, {user?.name || 'Friend'}</Text>
        </View>

        <CalendarView
          viewDate={viewDate}
          onPrevMonth={handlePrevMonth}
          onNextMonth={handleNextMonth}
          activeDates={stats?.activeDates}
        />

        {/* Streak Indicator */}
        <View style={styles.streakContainer}>
          <Text style={styles.streakLabel}>CURRENT STREAK</Text>
          <Text style={styles.streakValue}>
            {stats?.currentStreak ?? 0} <Text style={styles.streakEmoji}>🔥</Text>
          </Text>
        </View>

        <View style={styles.menuContainer}>
          <MenuButton
            title="Journal"
            subtitle="Write and reflect"
            emoji="✍️"
            onPress={() => navigation.navigate('JournalHome')}
          />
          <MenuButton
            title="Mind Map"
            subtitle="Visualize thoughts"
            emoji="🧠"
            onPress={() => navigation.navigate('MindMap')}
          />
          <MenuButton
            title="Stats"
            subtitle="Track your progress"
            emoji="📊"
            onPress={() => navigation.navigate('Stats')}
          />
          <MenuButton
            title="Behaviors"
            subtitle="Analyze patterns"
            emoji="🎯"
            onPress={() => navigation.navigate('Behaviors')}
          />
          <MenuButton
            title="Profile"
            subtitle="Manage account"
            emoji="👤"
            onPress={() => navigation.navigate('Profile')}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A2633' },
  canvasContainer: { ...StyleSheet.absoluteFillObject },
  canvas: { ...StyleSheet.absoluteFillObject },
  contentLayer: { flex: 1 },
  scrollContent: { padding: 24, paddingTop: 60, paddingBottom: 40 },
  header: { marginBottom: 32 },
  welcomeText: { fontSize: 16, color: 'rgba(255,255,255,0.6)', fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase' },
  userName: { fontSize: 32, fontWeight: 'bold', color: '#FFFFFF', marginTop: 8 },

  calendarContainer: {
    marginBottom: 20,
    alignItems: 'center',
    width: '100%',
  },
  calendarRings: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '90%',
    zIndex: 10,
    marginBottom: -10,
  },
  ringContainer: {
    alignItems: 'center',
  },
  ring: {
    width: 6,
    height: 20,
    backgroundColor: '#D1D1D1',
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#AAAAAA',
  },
  ringHole: {
    width: 8,
    height: 8,
    backgroundColor: '#1A2633',
    borderRadius: 4,
    marginBottom: -4,
    zIndex: 11,
  },
  calendarPaper: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    width: '100%',
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
  },
  calendarTopBar: {
    backgroundColor: '#5B8A72',
    paddingVertical: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  navButton: {
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 8,
  },
  navButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  calendarMonthText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 2,
  },
  calendarYearText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  calendarBody: {
    padding: 16,
  },
  weekDaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
    paddingBottom: 8,
  },
  weekDayText: {
    color: '#9DAEBB',
    fontSize: 10,
    width: '14.28%',
    textAlign: 'center',
    fontWeight: '800',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircle: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  todayCircle: {
    backgroundColor: '#5B8A72',
    elevation: 2,
    shadowColor: '#5B8A72',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  dayText: {
    color: '#2D3436',
    fontSize: 13,
    fontWeight: '500',
  },
  todayText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  entryDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#000000',
    position: 'absolute',
    bottom: 3,
  },
  todayDot: {
    backgroundColor: '#FFFFFF',
  },

  // Streak Styles
  streakContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    padding: 16,
    marginBottom: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  streakLabel: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 4,
  },
  streakValue: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  streakEmoji: {
    fontSize: 24,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: 'rgba(30, 45, 40, 0.95)',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(91, 138, 114, 0.3)',
  },
  maybeLaterButton: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(60, 100, 60, 0.8)',
    width: '100%',
    alignItems: 'center',
  },
  maybeLaterText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    fontWeight: '600',
  },

  featuredTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 24,
    textAlign: 'center',
  },
  featuredButton: {
    width: '100%',
    backgroundColor: 'rgba(100, 160, 100, 1.0)',
    borderColor: 'rgba(91, 138, 114, 1)'
  },

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
});
