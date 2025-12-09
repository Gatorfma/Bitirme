/**
 * RegisterScreen
 * New user registration screen
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { AuthStackScreenProps } from '../../types/navigation';

import { ScreenContainer } from '../../components/layout';
import { TextInputField, PrimaryButton } from '../../components/common';
import { useAuth } from '../../hooks/useAuth';

type NavigationProp = AuthStackScreenProps<'Register'>['navigation'];

export default function RegisterScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { register, isLoading } = useAuth();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    
    if (!displayName) newErrors.displayName = 'Name is required';
    if (!email) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = 'Invalid email format';
    if (!password) newErrors.password = 'Password is required';
    else if (password.length < 6) newErrors.password = 'Password must be at least 6 characters';
    if (password !== confirmPassword) newErrors.confirmPassword = 'Passwords do not match';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;

    const result = await register({ displayName, email, password });
    if (!result.success) {
      setErrors({ email: result.error || 'Registration failed' });
    }
  };

  return (
    <ScreenContainer scrollable keyboardAvoiding padded>
      <View style={styles.container}>
        {/* Back button */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Start your journey to mental clarity</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <TextInputField
            label="Full Name"
            placeholder="Enter your name"
            value={displayName}
            onChangeText={setDisplayName}
            error={errors.displayName}
            autoCapitalize="words"
          />

          <TextInputField
            label="Email"
            placeholder="Enter your email"
            value={email}
            onChangeText={setEmail}
            error={errors.email}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TextInputField
            label="Password"
            placeholder="Create a password"
            value={password}
            onChangeText={setPassword}
            error={errors.password}
            helperText="At least 6 characters"
            showPasswordToggle
            secureTextEntry
          />

          <TextInputField
            label="Confirm Password"
            placeholder="Confirm your password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            error={errors.confirmPassword}
            secureTextEntry
          />

          <PrimaryButton
            title={isLoading ? 'Creating Account...' : 'Create Account'}
            onPress={handleRegister}
            loading={isLoading}
            disabled={!displayName || !email || !password || !confirmPassword}
            size="large"
            style={{ marginTop: 8 }}
          />
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.linkText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: 20,
  },
  backButton: {
    marginBottom: 20,
  },
  backText: {
    color: '#5B8A72',
    fontSize: 16,
    fontWeight: '500',
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2D3436',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#636E72',
  },
  form: {
    marginBottom: 32,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  footerText: {
    color: '#636E72',
    fontSize: 15,
  },
  linkText: {
    color: '#5B8A72',
    fontSize: 15,
    fontWeight: '600',
  },
});

