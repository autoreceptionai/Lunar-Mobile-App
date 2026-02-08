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

export default function SignUpScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
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

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!firstName.trim()) newErrors.firstName = 'First name is required';
    if (!lastName.trim()) newErrors.lastName = 'Last name is required';
    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Invalid email format';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 8) {
      newErrors.password = 'Min 8 characters';
    } else if (!/[A-Z]/.test(password)) {
      newErrors.password = 'Need uppercase letter';
    } else if (!/[0-9]/.test(password)) {
      newErrors.password = 'Need one number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignUp = async () => {
    if (!validate()) return;

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
        },
      },
    });
    setLoading(false);

    if (error) {
      Alert.alert('Sign up failed', error.message);
    } else if (data.session === null) {
      // Email verification is likely enabled in Supabase
      Alert.alert(
        'Verify your email',
        'A confirmation link has been sent to your email. Please verify it before signing in.'
      );
      router.replace('/(auth)/login');
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
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 20 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header with Back Button */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={[styles.backButton, { backgroundColor: colors.background }]}>
            <FontAwesome name="arrow-left" size={20} color={colors.textPrimary} />
          </Pressable>
        </View>

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
          <Text style={[styles.title, { color: colors.textPrimary }]}>Create account</Text>
          <Text style={[styles.tagline, { color: colors.textSecondary }]}>Join the Lunar community</Text>
        </View>

        {/* Form Section */}
        <View style={styles.formSection}>
          {/* Name Row */}
          <View style={styles.nameRow}>
            {/* First Name Input */}
            <View style={[styles.inputGroup, styles.nameInput]}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>First Name</Text>
              <View style={[styles.inputContainer, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <FontAwesome
                  name="user-o"
                  size={18}
                  color={colors.textMuted}
                  style={styles.inputIcon}
                />
                <TextInput
                  autoCapitalize="words"
                  autoComplete="given-name"
                  placeholder="First"
                  placeholderTextColor={colors.textDisabled}
                  style={[styles.input, { color: colors.textPrimary }]}
                  value={firstName}
                  onChangeText={setFirstName}
                />
              </View>
            </View>

            {/* Last Name Input */}
            <View style={[styles.inputGroup, styles.nameInput]}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Last Name</Text>
              <View style={[styles.inputContainer, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <TextInput
                  autoCapitalize="words"
                  autoComplete="family-name"
                  placeholder="Last"
                  placeholderTextColor={colors.textDisabled}
                  style={[styles.input, { color: colors.textPrimary }]}
                  value={lastName}
                  onChangeText={setLastName}
                />
              </View>
            </View>
          </View>

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
                placeholder="Create a password"
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
            <Text style={[styles.hint, { color: colors.textMuted }]}>
              At least 8 characters, 1 uppercase letter, and 1 number
            </Text>
          </View>

          {/* Submit Button */}
          <Pressable
            onPress={handleSignUp}
            disabled={loading}
            style={[styles.submitButton, { backgroundColor: colors.primary }, loading && styles.submitButtonDisabled]}
          >
            {loading ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={[styles.submitButtonText, { color: colors.white }]}>Create Account</Text>
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

          {/* Navigate to Sign In */}
          <View style={styles.toggleContainer}>
            <Text style={[styles.toggleText, { color: colors.textMuted }]}>Already have an account?</Text>
            <Pressable onPress={() => router.back()}>
              <Text style={[styles.toggleLink, { color: colors.primary }]}>Sign in</Text>
            </Pressable>
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
  header: {
    marginBottom: 16,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
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
  title: {
    fontSize: 29,
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
  nameRow: {
    flexDirection: 'row',
    gap: 12,
  },
  nameInput: {
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
  hint: {
    fontSize: 13,
    marginTop: 6,
    marginLeft: 4,
  },
  errorText: {
    fontSize: 13,
    marginTop: 6,
    marginLeft: 4,
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
});
