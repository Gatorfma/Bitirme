/**
 * RootNavigator
 * Main navigation container that handles auth state
 */

import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';

import { useAuthStore } from '../state/authStore';

import AuthNavigator from './AuthNavigator';
import MainTabNavigator from './MainTabNavigator';
import OnboardingScreen from '../screens/onboarding/OnboardingScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

// Simple inline loading component to avoid import issues
function LoadingScreen() {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#5B8A72" />
      <Text style={styles.loadingText}>Loading MindJournal...</Text>
    </View>
  );
}

export function RootNavigator() {
  const { token, isOnboarded, isInitialized, initialize } = useAuthStore();
  const [hasError, setHasError] = useState(false);

  // Initialize auth state on mount
  useEffect(() => {
    const init = async () => {
      try {
        await initialize();
      } catch (error) {
        console.error('Failed to initialize:', error);
        setHasError(true);
      }
    };
    init();
  }, []);

  // Show error state
  if (hasError) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Something went wrong</Text>
      </View>
    );
  }

  // Show loading while initializing
  if (!isInitialized) {
    return <LoadingScreen />;
  }

  const isAuthenticated = !!token;

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#FAFBFC' },
        animation: 'fade',
      }}
    >
      {!isAuthenticated ? (
        // Not logged in - show auth screens
        <Stack.Screen name="Auth" component={AuthNavigator} />
      ) : !isOnboarded ? (
        // Logged in but not onboarded - show onboarding
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      ) : (
        // Logged in and onboarded - show main app (Home is now inside the tabs)
        <Stack.Screen name="Main" component={MainTabNavigator} />
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAFBFC',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#636E72',
  },
  errorText: {
    fontSize: 16,
    color: '#C4A484',
  },
});

export default RootNavigator;
