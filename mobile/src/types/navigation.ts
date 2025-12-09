/**
 * Navigation Types
 * Type definitions for React Navigation
 */

import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';

// Root Stack Navigator param list
export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Onboarding: undefined;
  Main: NavigatorScreenParams<MainTabParamList>;
};

// Auth Stack Navigator param list
export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

// Main Tab Navigator param list
export type MainTabParamList = {
  JournalHome: undefined;
  MindMap: undefined;
  Stats: undefined;
  Behaviors: undefined;
  Profile: undefined;
};

// Journal Stack Navigator param list (nested in JournalHome tab)
export type JournalStackParamList = {
  JournalHomeScreen: undefined;
  NewSession: undefined;
  SessionDetail: { sessionId: string };
};

// Screen Props Types
// Root Stack
export type RootStackScreenProps<T extends keyof RootStackParamList> = 
  NativeStackScreenProps<RootStackParamList, T>;

// Auth Stack
export type AuthStackScreenProps<T extends keyof AuthStackParamList> = 
  CompositeScreenProps<
    NativeStackScreenProps<AuthStackParamList, T>,
    RootStackScreenProps<keyof RootStackParamList>
  >;

// Main Tab
export type MainTabScreenProps<T extends keyof MainTabParamList> = 
  CompositeScreenProps<
    BottomTabScreenProps<MainTabParamList, T>,
    RootStackScreenProps<keyof RootStackParamList>
  >;

// Journal Stack
export type JournalStackScreenProps<T extends keyof JournalStackParamList> = 
  CompositeScreenProps<
    NativeStackScreenProps<JournalStackParamList, T>,
    MainTabScreenProps<'JournalHome'>
  >;

// Declare global types for useNavigation hook
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}

