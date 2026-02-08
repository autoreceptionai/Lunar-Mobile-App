import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as AppleAuthentication from 'expo-apple-authentication';

import { brand } from '@/constants/Brand';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);

  const handleAppleSignIn = async () => {
    try {
      setAppleLoading(true);
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        Alert.alert('Apple Sign In failed', 'No identity token returned.');
        return;
      }

      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });

      if (error) {
        Alert.alert('Apple Sign In failed', error.message);
      }
    } catch (e: any) {
      if (e.code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert('Apple Sign In failed', e.message ?? 'An unknown error occurred.');
      }
    } finally {
      setAppleLoading(false);
    }
  };

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert('Missing info', 'Enter an email and password.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      Alert.alert('Sign in failed', error.message);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.surface }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 20 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Branding Section */}
        <View style={styles.brandSection}>
          <View style={styles.logoWrapper}>
            {/* Decorative stars */}
            <View style={[styles.star, styles.starTopLeft]}>
              <FontAwesome name="star" size={8} color={isDark ? colors.primary : colors.textMuted} />
            </View>
            <View style={[styles.star, styles.starTopRight]}>
              <FontAwesome name="star" size={6} color={isDark ? colors.primary : colors.textDisabled} />
            </View>
            <View style={[styles.star, styles.starBottomLeft]}>
              <FontAwesome name="star" size={5} color={isDark ? colors.primary : colors.textDisabled} />
            </View>
            <View style={[styles.star, styles.starBottomRight]}>
              <FontAwesome name="star" size={7} color={isDark ? colors.primary : colors.textMuted} />
            </View>
            
            {/* Logo with glow effect in dark mode */}
            <View
              style={[
                styles.logoContainer,
                { backgroundColor: colors.primaryLight },
                isDark && styles.logoGlow,
              ]}
            >
              <FontAwesome name="moon-o" size={48} color={colors.primary} />
            </View>
          </View>
          <Text style={[styles.welcomeText, { color: colors.textMuted }]}>Welcome back</Text>
          <Text style={[styles.brandName, { color: colors.textPrimary }]}>Lunar</Text>
          <Text style={[styles.tagline, { color: colors.textSecondary }]}>Sign in to continue</Text>
        </View>

        {/* Form Section */}
        <View style={styles.formSection}>
          {/* Email Input */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Email</Text>
            <View style={[styles.inputContainer, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              <FontAwesome
                name="envelope-o"
                size={18}
                color={colors.textMuted}
                style={styles.inputIcon}
              />
              <TextInput
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                placeholder="Enter your email"
                placeholderTextColor={colors.textDisabled}
                style={[styles.input, { color: colors.textPrimary }]}
                value={email}
                onChangeText={setEmail}
              />
            </View>
          </View>

          {/* Password Input */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Password</Text>
            <View style={[styles.inputContainer, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              <FontAwesome
                name="lock"
                size={20}
                color={colors.textMuted}
                style={styles.inputIcon}
              />
              <TextInput
                placeholder="Enter your password"
                placeholderTextColor={colors.textDisabled}
                secureTextEntry={!showPassword}
                style={[styles.input, { color: colors.textPrimary }]}
                value={password}
                onChangeText={setPassword}
              />
              <Pressable
                onPress={() => setShowPassword((prev) => !prev)}
                style={styles.eyeButton}
              >
                <FontAwesome
                  name={showPassword ? 'eye' : 'eye-slash'}
                  size={18}
                  color={colors.textMuted}
                />
              </Pressable>
            </View>
          </View>

          {/* Submit Button */}
          <Pressable
            onPress={handleSignIn}
            disabled={loading}
            style={[styles.submitButton, { backgroundColor: colors.primary }, loading && styles.submitButtonDisabled]}
          >
            {loading ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={[styles.submitButtonText, { color: colors.white }]}>Sign In</Text>
            )}
          </Pressable>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, { color: colors.textMuted }]}>or</Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          </View>

          {/* Apple Sign In */}
          {Platform.OS === 'ios' && (
            <Pressable
              onPress={handleAppleSignIn}
              disabled={appleLoading}
              style={[
                styles.appleButton,
                { backgroundColor: isDark ? colors.white : '#000' },
                appleLoading && styles.submitButtonDisabled,
              ]}
            >
              {appleLoading ? (
                <ActivityIndicator size="small" color={isDark ? '#000' : '#fff'} />
              ) : (
                <>
                  <FontAwesome name="apple" size={20} color={isDark ? '#000' : '#fff'} />
                  <Text style={[styles.appleButtonText, { color: isDark ? '#000' : '#fff' }]}>
                    Continue with Apple
                  </Text>
                </>
              )}
            </Pressable>
          )}

          {/* Navigate to Sign Up */}
          <View style={styles.toggleContainer}>
            <Text style={[styles.toggleText, { color: colors.textMuted }]}>Don't have an account?</Text>
            <Pressable onPress={() => router.push('/(auth)/signup')}>
              <Text style={[styles.toggleLink, { color: colors.primary }]}>Sign up</Text>
            </Pressable>
          </View>
        </View>

        {/* Feature Highlights */}
        <View style={[styles.featureSection, { borderTopColor: colors.borderLight }]}>
          <View style={styles.featureRow}>
            <View style={styles.featureItem}>
              <FontAwesome name="users" size={18} color={colors.primary} />
              <Text style={[styles.featureText, { color: colors.textMuted }]}>Spaces</Text>
            </View>
            <View style={[styles.featureDot, { backgroundColor: colors.border }]} />
            <View style={styles.featureItem}>
              <FontAwesome name="cutlery" size={18} color={colors.primary} />
              <Text style={[styles.featureText, { color: colors.textMuted }]}>Halal Finder</Text>
            </View>
            <View style={[styles.featureDot, { backgroundColor: colors.border }]} />
            <View style={styles.featureItem}>
              <FontAwesome name="shopping-bag" size={18} color={colors.primary} />
              <Text style={[styles.featureText, { color: colors.textMuted }]}>Bazaar</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  brandSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoWrapper: {
    position: 'relative',
    marginBottom: 20,
  },
  logoContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoGlow: {
    shadowColor: brand.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 10,
  },
  star: {
    position: 'absolute',
    opacity: 0.7,
  },
  starTopLeft: {
    top: -8,
    left: -4,
  },
  starTopRight: {
    top: 4,
    right: -12,
  },
  starBottomLeft: {
    bottom: 12,
    left: -16,
  },
  starBottomRight: {
    bottom: -4,
    right: -8,
  },
  welcomeText: {
    fontSize: 17,
    marginBottom: 4,
  },
  brandName: {
    fontSize: 37,
    fontWeight: '700',
    marginBottom: 8,
  },
  tagline: {
    fontSize: 16,
    textAlign: 'center',
  },
  formSection: {
    flex: 1,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  inputIcon: {
    marginRight: 12,
    width: 20,
    textAlign: 'center',
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
  },
  eyeButton: {
    padding: 8,
    marginRight: -8,
  },
  submitButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 17,
    fontWeight: '600',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 24,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 14,
    fontWeight: '500',
  },
  appleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 16,
    gap: 10,
  },
  appleButtonText: {
    fontSize: 17,
    fontWeight: '600',
  },
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    gap: 6,
  },
  toggleText: {
    fontSize: 15,
  },
  toggleLink: {
    fontSize: 15,
    fontWeight: '600',
  },
  featureSection: {
    marginTop: 40,
    paddingTop: 24,
    borderTopWidth: 1,
  },
  featureRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  featureText: {
    fontSize: 14,
    fontWeight: '500',
  },
  featureDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});
