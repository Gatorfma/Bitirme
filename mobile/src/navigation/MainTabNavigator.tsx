/**
 * MainTabNavigator
 * Bottom tab navigator for main app screens
 */

import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { MainTabParamList, JournalStackParamList } from '../types/navigation';

import HomeScreen from '../screens/home/HomeScreen';
import JournalHomeScreen from '../screens/journal/JournalHomeScreen';
import NewSessionScreen from '../screens/journal/NewSessionScreen';
import SessionDetailScreen from '../screens/journal/SessionDetailScreen';
import MindMapScreen from '../screens/mindmap/MindMapScreen';
import StatsScreen from '../screens/stats/StatsScreen';
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
    Stats: '📊',
    Behaviors: '🎯',
    Profile: '👤',
  };

  return (
    <View style={[styles.iconContainer, focused && styles.iconContainerActive]}>
      <Text style={styles.icon}>{icons[name]}</Text>
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
      <JournalStack.Screen name="SessionDetail" component={SessionDetailScreen} />
    </JournalStack.Navigator>
  );
}

export function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
        tabBarActiveTintColor: '#5B8A72',
        tabBarInactiveTintColor: '#9DAEBB',
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
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
        name="Stats"
        component={StatsScreen}
        options={{ title: 'Stats' }}
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
    height: 85,
    paddingTop: 8,
    paddingBottom: 25,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 4,
  },
  iconContainer: {
    padding: 6,
    borderRadius: 10,
  },
  iconContainerActive: {
    backgroundColor: 'rgba(91, 138, 114, 0.1)',
  },
  icon: {
    fontSize: 22,
  },
});

export default MainTabNavigator;
