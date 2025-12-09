/**
 * ProfileScreen
 * User profile and settings
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';

import { ScreenContainer, AppHeader } from '../../components/layout';
import { PrimaryButton } from '../../components/common';
import { useAuth } from '../../hooks/useAuth';
import { useStatsOverview } from '../../hooks/useStats';
import { formatStreak } from '../../utils';

function SettingsRow({
  icon,
  label,
  value,
  onPress,
}: {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.settingsRow}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <Text style={styles.settingsIcon}>{icon}</Text>
      <Text style={styles.settingsLabel}>{label}</Text>
      {value && <Text style={styles.settingsValue}>{value}</Text>}
      {onPress && <Text style={styles.settingsArrow}>→</Text>}
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const { data: stats } = useStatsOverview('week');

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log Out', style: 'destructive', onPress: logout },
      ]
    );
  };

  const handleExportData = () => {
    Alert.alert(
      'Export Data',
      'Your data will be exported. This feature is coming soon.',
      [{ text: 'OK' }]
    );
  };

  return (
    <ScreenContainer scrollable>
      <AppHeader title="Profile" />

      {/* User Info */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.displayName?.charAt(0).toUpperCase() || 'U'}
          </Text>
        </View>
        <Text style={styles.userName}>{user?.displayName || 'User'}</Text>
        <Text style={styles.userEmail}>{user?.email || 'user@example.com'}</Text>
      </View>

      {/* Quick Stats */}
      {stats && (
        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.totalSessions}</Text>
            <Text style={styles.statLabel}>Sessions</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.totalThoughts}</Text>
            <Text style={styles.statLabel}>Thoughts</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.currentStreak}</Text>
            <Text style={styles.statLabel}>Streak</Text>
          </View>
        </View>
      )}

      {/* Settings Sections */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ACCOUNT</Text>
        <View style={styles.sectionContent}>
          <SettingsRow
            icon="👤"
            label="Edit Profile"
            onPress={() => {}}
          />
          <SettingsRow
            icon="🔔"
            label="Notifications"
            value="On"
            onPress={() => {}}
          />
          <SettingsRow
            icon="🌙"
            label="Appearance"
            value="System"
            onPress={() => {}}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>DATA & PRIVACY</Text>
        <View style={styles.sectionContent}>
          <SettingsRow
            icon="📦"
            label="Export My Data"
            onPress={handleExportData}
          />
          <SettingsRow
            icon="🔒"
            label="Privacy Settings"
            onPress={() => {}}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>SUPPORT</Text>
        <View style={styles.sectionContent}>
          <SettingsRow
            icon="❓"
            label="Help & FAQ"
            onPress={() => {}}
          />
          <SettingsRow
            icon="💬"
            label="Contact Us"
            onPress={() => {}}
          />
          <SettingsRow
            icon="ℹ️"
            label="About"
            value="v1.0.0"
          />
        </View>
      </View>

      {/* Logout */}
      <View style={styles.logoutSection}>
        <PrimaryButton
          title="Log Out"
          onPress={handleLogout}
          variant="outline"
          style={styles.logoutButton}
        />
      </View>

      <Text style={styles.footer}>MindJournal © 2025</Text>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  profileCard: {
    alignItems: 'center',
    paddingVertical: 24,
    marginBottom: 8,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#5B8A72',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  userName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2D3436',
  },
  userEmail: {
    fontSize: 14,
    color: '#636E72',
    marginTop: 4,
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E8ECEB',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#5B8A72',
  },
  statLabel: {
    fontSize: 12,
    color: '#636E72',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#E8ECEB',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#636E72',
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E8ECEB',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F4F3',
  },
  settingsIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  settingsLabel: {
    flex: 1,
    fontSize: 15,
    color: '#2D3436',
  },
  settingsValue: {
    fontSize: 14,
    color: '#636E72',
    marginRight: 8,
  },
  settingsArrow: {
    fontSize: 16,
    color: '#9DAEBB',
  },
  logoutSection: {
    marginTop: 8,
    marginBottom: 16,
  },
  logoutButton: {
    borderColor: '#C4A484',
  },
  footer: {
    textAlign: 'center',
    fontSize: 12,
    color: '#9DAEBB',
    marginBottom: 20,
  },
});

