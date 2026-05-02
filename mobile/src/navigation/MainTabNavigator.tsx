/**
 * MainTabNavigator
 * Bottom tab navigator for main app screens. 
 * Home is now on the far left and the tab bar is hidden when on the Home screen.
 */

import React from 'react';
import { StyleSheet, View, Text, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { MainTabParamList, JournalStackParamList } from '../types/navigation';

import HomeScreen from '../screens/home/HomeScreen';
import JournalHomeScreen from '../screens/journal/JournalHomeScreen';
import NewSessionScreen from '../screens/journal/NewSessionScreen';
import AvatarSessionScreen from '../screens/journal/AvatarSessionScreen';
import SessionDetailScreen from '../screens/journal/SessionDetailScreen';
import MindMapScreen from '../screens/mindmap/MindMapScreen';
import BehaviorsScreen from '../screens/behaviors/BehaviorsScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();
const JournalStack = createNativeStackNavigator<JournalStackParamList>();

// Tab bar icon component
function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Home: '🏠',
    JournalHome: '✍️',
    MindMap: '🧠',
    Behaviors: '🎯',
    Profile: '👤',
  };

  return (
    <View style={[styles.iconContainer, focused && styles.iconContainerActive]}>
      <Text style={[styles.icon, name === 'Home' && styles.homeIcon]}>
        {icons[name] || '❓'}
      </Text>
    </View>
  );
}

// Journal stack navigator (includes nested screens)
function JournalStackNavigator() {
  return (
    <JournalStack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#FAFBFC' },
      }}
    >
      <JournalStack.Screen name="JournalHomeScreen" component={JournalHomeScreen} />
      <JournalStack.Screen name="NewSession" component={NewSessionScreen} />
      <JournalStack.Screen name="AvatarSession" component={AvatarSessionScreen} />
      <JournalStack.Screen name="SessionDetail" component={SessionDetailScreen} />
    </JournalStack.Navigator>
  );
}

export function MainTabNavigator() {
  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
        tabBarActiveTintColor: '#5B8A72',
        tabBarInactiveTintColor: '#9DAEBB',
        tabBarHideOnKeyboard: true,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: styles.tabItem,
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: 'Home' }}
      />
      <Tab.Screen
        name="JournalHome"
        component={JournalStackNavigator}
        options={{ title: 'Journal' }}
      />
      <Tab.Screen
        name="MindMap"
        component={MindMapScreen}
        options={{ title: 'Mind Map' }}
      />
      <Tab.Screen
        name="Behaviors"
        component={BehaviorsScreen}
        options={{ title: 'Actions' }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: 'Profile' }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#FFFFFF',
    borderTopColor: '#E8ECEB',
    borderTopWidth: 1,
    height: Platform.OS === 'ios' ? 100 : 85,
    paddingBottom: Platform.OS === 'ios' ? 40 : 25,
    paddingTop: 12,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  tabItem: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 5,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
    width: '100%',
    textAlign: 'center',
  },
  iconContainer: {
    width: 44,
    height: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainerActive: {
    backgroundColor: 'rgba(91, 138, 114, 0.1)',
  },
  icon: {
    fontSize: 22,
  },
  homeIcon: {
    fontSize: 24,
  },
});

export default MainTabNavigator;
