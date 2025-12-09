/**
 * OnboardingScreen
 * Initial onboarding for new users
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

import { ScreenContainer } from '../../components/layout';
import { TextInputField, PrimaryButton } from '../../components/common';
import { useAuth } from '../../hooks/useAuth';

export default function OnboardingScreen() {
  const { completeOnboarding, user } = useAuth();

  const [age, setAge] = useState('');
  const [goals, setGoals] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleComplete = async () => {
    setIsSubmitting(true);
    
    // In a real app, you might save these preferences to the backend
    // For now, we just complete onboarding
    await completeOnboarding();
    
    setIsSubmitting(false);
  };

  return (
    <ScreenContainer scrollable padded>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.welcome}>Welcome, {user?.displayName || 'Friend'}! 👋</Text>
          <Text style={styles.title}>Let's personalize your experience</Text>
          <Text style={styles.subtitle}>
            Tell us a bit about yourself so we can tailor MindJournal to your needs.
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <TextInputField
            label="Your Age (optional)"
            placeholder="Enter your age"
            value={age}
            onChangeText={setAge}
            keyboardType="numeric"
            helperText="This helps us provide age-appropriate insights"
          />

          <TextInputField
            label="What brings you to MindJournal?"
            placeholder="E.g., Managing stress, understanding my thoughts, building better habits..."
            value={goals}
            onChangeText={setGoals}
            multiline
            numberOfLines={4}
            style={styles.textArea}
            helperText="Share your goals so we can better support you"
          />

          {/* Goal Quick Picks */}
          <Text style={styles.quickPickLabel}>Or select common goals:</Text>
          <View style={styles.quickPicks}>
            {[
              '🧘 Reduce stress',
              '💭 Understand thoughts',
              '📈 Track progress',
              '🌱 Personal growth',
            ].map((goal, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.quickPick,
                  goals.includes(goal.slice(2)) && styles.quickPickSelected,
                ]}
                onPress={() => {
                  const goalText = goal.slice(2);
                  if (goals.includes(goalText)) {
                    setGoals(goals.replace(goalText, '').trim());
                  } else {
                    setGoals(goals ? `${goals}, ${goalText}` : goalText);
                  }
                }}
              >
                <Text style={styles.quickPickText}>{goal}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <PrimaryButton
            title={isSubmitting ? 'Getting Started...' : 'Get Started'}
            onPress={handleComplete}
            loading={isSubmitting}
            size="large"
          />
          
          <TouchableOpacity
            style={styles.skipButton}
            onPress={handleComplete}
            disabled={isSubmitting}
          >
            <Text style={styles.skipText}>Skip for now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: 40,
  },
  header: {
    marginBottom: 32,
  },
  welcome: {
    fontSize: 16,
    color: '#5B8A72',
    fontWeight: '500',
    marginBottom: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#2D3436',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: '#636E72',
    lineHeight: 22,
  },
  form: {
    marginBottom: 32,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
    paddingTop: 14,
  },
  quickPickLabel: {
    fontSize: 14,
    color: '#636E72',
    marginBottom: 12,
  },
  quickPicks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickPick: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F0F4F3',
    borderWidth: 1,
    borderColor: '#E8ECEB',
  },
  quickPickSelected: {
    backgroundColor: '#E8F0EC',
    borderColor: '#5B8A72',
  },
  quickPickText: {
    fontSize: 13,
    color: '#2D3436',
  },
  actions: {
    gap: 16,
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  skipText: {
    color: '#636E72',
    fontSize: 15,
  },
});

