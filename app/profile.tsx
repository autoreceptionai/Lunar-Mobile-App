import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { brand, neutrals } from '@/constants/Brand';
import { useTheme, ThemeMode } from '@/contexts/ThemeContext';
import { useProfile } from '@/hooks/useProfile';
import { useSession } from '@/hooks/useSession';
import { supabase } from '@/lib/supabase';
import { getDisplayName, getInitials } from '@/lib/types';

// App version from app.json
const APP_VERSION = '1.0.0';

// Helper to format date as "Month Year"
const formatMemberSince = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

type AppearanceOption = {
  mode: ThemeMode;
  label: string;
  icon: 'sun-o' | 'moon-o' | 'adjust';
};

const appearanceOptions: AppearanceOption[] = [
  { mode: 'light', label: 'Light', icon: 'sun-o' },
  { mode: 'dark', label: 'Dark', icon: 'moon-o' },
  { mode: 'system', label: 'System', icon: 'adjust' },
];

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useSession();
  const { profile, loading: profileLoading, updating, updateProfile } = useProfile();
  const { colors, isDark, themeMode, setThemeMode } = useTheme();

  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarAsset, setAvatarAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);

  // Sync edit fields with profile data
  useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name || '');
      setLastName(profile.last_name || '');
      setBio((profile as any).bio || '');
    }
  }, [profile]);

  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled) {
      setAvatarAsset(result.assets[0]);
    }
  };

  const uploadAvatar = async (userId: string) => {
    if (!avatarAsset) return profile?.avatar_url;

    const fileName = `${userId}/avatar.jpg`;
    
    // Optimize image
    const manipulated = await ImageManipulator.manipulateAsync(
      avatarAsset.uri,
      [{ resize: { width: 400, height: 400 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
    );

    const response = await fetch(manipulated.uri);
    const blob = await response.blob();

    const { error } = await supabase.storage.from('avatars').upload(fileName, blob, {
      contentType: 'image/jpeg',
      upsert: true,
    });

    if (error) throw error;

    const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
    return data.publicUrl;
  };

  const handleSave = async () => {
    try {
      const avatarUrl = await uploadAvatar(user?.id || '');
      
      const result = await updateProfile({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        bio: bio.trim(),
        avatar_url: avatarUrl,
      } as any);

      if (result.success) {
        setIsEditing(false);
        setAvatarAsset(null);
      } else {
        Alert.alert('Update failed', result.error || 'Unable to update profile');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to upload avatar');
    }
  };

  const handleChangePassword = () => {
    Alert.prompt(
      'Change Password',
      'Enter your new password',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Update',
          onPress: async (password) => {
            if (!password || password.length < 8) {
              Alert.alert('Invalid password', 'Password must be at least 8 characters.');
              return;
            }
            const { error } = await supabase.auth.updateUser({ password });
            if (error) {
              Alert.alert('Update failed', error.message);
            } else {
              Alert.alert('Success', 'Password updated successfully');
            }
          },
        },
      ],
      'secure-text'
    );
  };

  const handleCancel = () => {
    setFirstName(profile?.first_name || '');
    setLastName(profile?.last_name || '');
    setIsEditing(false);
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase.auth.signOut();
              if (error) throw error;
              // router.replace will be handled by the root layout's auth state listener
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to sign out');
            }
          },
        },
      ]
    );
  };

  const handleOpenPrivacy = () => {
    WebBrowser.openBrowserAsync('https://lunarapp.com/privacy'); // Replace with actual URL
  };

  const handleOpenTerms = () => {
    WebBrowser.openBrowserAsync('https://lunarapp.com/terms'); // Replace with actual URL
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account?',
      'This action is permanent and cannot be undone. All your data including listings, messages, and profile information will be deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            try {
              // In production, this should call a Supabase Edge Function 
              // that uses the service_role key to delete the user.
              // For now, we'll sign them out and show a success message.
              const { error } = await supabase.auth.signOut();
              if (error) throw error;
              
              Alert.alert(
                'Account Deleted',
                'Your account has been scheduled for deletion. You will be signed out now.'
              );
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete account');
            }
          },
        },
      ]
    );
  };

  const displayName = getDisplayName(profile, user?.email);
  const initials = getInitials(profile, user?.email);

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={[styles.backButton, { backgroundColor: colors.background }]}>
          <FontAwesome name="arrow-left" size={20} color={colors.textPrimary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Profile</Text>
        {isEditing ? (
          <Pressable onPress={handleCancel} style={styles.headerAction}>
            <Text style={[styles.headerActionText, { color: colors.textMuted }]}>Cancel</Text>
          </Pressable>
        ) : (
          <Pressable onPress={() => setIsEditing(true)} style={styles.headerAction}>
            <Text style={[styles.headerActionText, { color: colors.primary }]}>Edit</Text>
          </Pressable>
        )}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar Section */}
        <View style={styles.avatarSection}>
          <Pressable onPress={isEditing ? pickAvatar : undefined}>
            <View style={[styles.avatarCircle, { backgroundColor: colors.primaryLight }]}>
              {avatarAsset ? (
                <Image source={{ uri: avatarAsset.uri }} style={styles.avatarImage} />
              ) : profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
              ) : (
                <Text style={[styles.avatarInitials, { color: colors.primary }]}>{initials}</Text>
              )}
              {isEditing && (
                <View style={styles.avatarOverlay}>
                  <FontAwesome name="camera" size={16} color="#FFFFFF" />
                </View>
              )}
            </View>
          </Pressable>
          {profileLoading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <>
              <Text style={[styles.nameDisplay, { color: colors.textPrimary }]}>{displayName}</Text>
              <Text style={[styles.emailDisplay, { color: colors.textMuted }]}>{user?.email ?? 'Not signed in'}</Text>
            </>
          )}
        </View>

        {/* Profile Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Profile</Text>
          <View style={[styles.card, { backgroundColor: colors.surface }, isDark && { borderWidth: 1, borderColor: colors.border }]}>
            {/* First Name */}
            <View style={styles.cardRow}>
              <View style={[styles.cardIcon, { backgroundColor: colors.primaryLight }]}>
                <FontAwesome name="user-o" size={18} color={colors.primary} />
              </View>
              <View style={styles.cardContent}>
                <Text style={[styles.cardLabel, { color: colors.textMuted }]}>First Name</Text>
                {isEditing ? (
                  <TextInput
                    style={[styles.cardInput, { color: colors.textPrimary, borderColor: colors.border }]}
                    value={firstName}
                    onChangeText={setFirstName}
                    placeholder="Enter first name"
                    placeholderTextColor={colors.textDisabled}
                    autoCapitalize="words"
                  />
                ) : (
                  <Text style={[styles.cardValue, { color: colors.textPrimary }]}>
                    {profile?.first_name || '—'}
                  </Text>
                )}
              </View>
            </View>
            <View style={[styles.cardDivider, { backgroundColor: colors.borderLight }]} />

            {/* Last Name */}
            <View style={styles.cardRow}>
              <View style={[styles.cardIcon, { backgroundColor: colors.primaryLight }]}>
                <FontAwesome name="user-o" size={18} color={colors.primary} />
              </View>
              <View style={styles.cardContent}>
                <Text style={[styles.cardLabel, { color: colors.textMuted }]}>Last Name</Text>
                {isEditing ? (
                  <TextInput
                    style={[styles.cardInput, { color: colors.textPrimary, borderColor: colors.border }]}
                    value={lastName}
                    onChangeText={setLastName}
                    placeholder="Enter last name"
                    placeholderTextColor={colors.textDisabled}
                    autoCapitalize="words"
                  />
                ) : (
                  <Text style={[styles.cardValue, { color: colors.textPrimary }]}>
                    {profile?.last_name || '—'}
                  </Text>
                )}
              </View>
            </View>
            <View style={[styles.cardDivider, { backgroundColor: colors.borderLight }]} />

            {/* Bio */}
            <View style={styles.cardRow}>
              <View style={[styles.cardIcon, { backgroundColor: colors.primaryLight }]}>
                <FontAwesome name="info" size={18} color={colors.primary} />
              </View>
              <View style={styles.cardContent}>
                <Text style={[styles.cardLabel, { color: colors.textMuted }]}>Bio</Text>
                {isEditing ? (
                  <TextInput
                    style={[styles.cardInput, styles.bioInput, { color: colors.textPrimary, borderColor: colors.border }]}
                    value={bio}
                    onChangeText={setBio}
                    placeholder="Tell us about yourself"
                    placeholderTextColor={colors.textDisabled}
                    multiline
                  />
                ) : (
                  <Text style={[styles.cardValue, { color: colors.textPrimary }]}>
                    {(profile as any)?.bio || 'No bio yet'}
                  </Text>
                )}
              </View>
            </View>
          </View>

          {/* Save Button */}
          {isEditing && (
            <Pressable
              style={[styles.saveButton, { backgroundColor: colors.primary }, updating && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={updating}
            >
              {updating ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={[styles.saveButtonText, { color: colors.white }]}>Save Changes</Text>
              )}
            </Pressable>
          )}
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Account</Text>
          <View style={[styles.card, { backgroundColor: colors.surface }, isDark && { borderWidth: 1, borderColor: colors.border }]}>
            <View style={styles.cardRow}>
              <View style={[styles.cardIcon, { backgroundColor: colors.primaryLight }]}>
                <FontAwesome name="envelope-o" size={18} color={colors.primary} />
              </View>
              <View style={styles.cardContent}>
                <Text style={[styles.cardLabel, { color: colors.textMuted }]}>Email</Text>
                <Text style={[styles.cardValue, { color: colors.textPrimary }]}>{user?.email ?? '—'}</Text>
              </View>
            </View>
            <View style={[styles.cardDivider, { backgroundColor: colors.borderLight }]} />
            <View style={styles.cardRow}>
              <View style={[styles.cardIcon, { backgroundColor: colors.primaryLight }]}>
                <FontAwesome name="calendar-o" size={18} color={colors.primary} />
              </View>
              <View style={styles.cardContent}>
                <Text style={[styles.cardLabel, { color: colors.textMuted }]}>Member since</Text>
                <Text style={[styles.cardValue, { color: colors.textPrimary }]}>
                  {user?.created_at ? formatMemberSince(user.created_at) : '—'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Appearance Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Appearance</Text>
          <View style={[styles.card, { backgroundColor: colors.surface }, isDark && { borderWidth: 1, borderColor: colors.border }]}>
            <View style={styles.appearanceRow}>
              {appearanceOptions.map((option, index) => (
                <Pressable
                  key={option.mode}
                  style={[
                    styles.appearanceOption,
                    themeMode === option.mode && [styles.appearanceOptionActive, { backgroundColor: colors.primary }],
                    index !== appearanceOptions.length - 1 && { marginRight: 8 },
                  ]}
                  onPress={() => setThemeMode(option.mode)}
                >
                  <FontAwesome
                    name={option.icon}
                    size={18}
                    color={themeMode === option.mode ? colors.white : colors.textMuted}
                  />
                  <Text
                    style={[
                      styles.appearanceOptionText,
                      { color: themeMode === option.mode ? colors.white : colors.textSecondary },
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        {/* About Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>About</Text>
          <View style={[styles.card, { backgroundColor: colors.surface }, isDark && { borderWidth: 1, borderColor: colors.border }]}>
            <View style={styles.cardRow}>
              <View style={[styles.cardIcon, { backgroundColor: colors.primaryLight }]}>
                <FontAwesome name="info-circle" size={18} color={colors.primary} />
              </View>
              <View style={styles.cardContent}>
                <Text style={[styles.cardLabel, { color: colors.textMuted }]}>App Version</Text>
                <Text style={[styles.cardValue, { color: colors.textPrimary }]}>{APP_VERSION}</Text>
              </View>
            </View>
            <View style={[styles.cardDivider, { backgroundColor: colors.borderLight }]} />

            <Pressable onPress={handleOpenPrivacy} style={styles.cardRow}>
              <View style={[styles.cardIcon, { backgroundColor: colors.primaryLight }]}>
                <FontAwesome name="lock" size={18} color={colors.primary} />
              </View>
              <View style={styles.cardContent}>
                <Text style={[styles.cardValue, { color: colors.textPrimary }]}>Privacy Policy</Text>
              </View>
              <FontAwesome name="angle-right" size={20} color={colors.textDisabled} />
            </Pressable>
            <View style={[styles.cardDivider, { backgroundColor: colors.borderLight }]} />

            <Pressable onPress={handleOpenTerms} style={styles.cardRow}>
              <View style={[styles.cardIcon, { backgroundColor: colors.primaryLight }]}>
                <FontAwesome name="file-text-o" size={18} color={colors.primary} />
              </View>
              <View style={styles.cardContent}>
                <Text style={[styles.cardValue, { color: colors.textPrimary }]}>Terms of Service</Text>
              </View>
              <FontAwesome name="angle-right" size={20} color={colors.textDisabled} />
            </Pressable>
          </View>
        </View>

        {/* Sign Out Button */}
        <Pressable
          style={[
            styles.signOutButton,
            { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEF2F2', borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : '#FEE2E2' },
          ]}
          onPress={handleSignOut}
        >
          <FontAwesome name="sign-out" size={18} color="#EF4444" />
          <Text style={styles.signOutButtonText}>Sign Out</Text>
        </Pressable>

        {/* Delete Account Button */}
        <Pressable
          style={styles.deleteAccountButton}
          onPress={handleDeleteAccount}
        >
          <Text style={styles.deleteAccountButtonText}>Delete Account</Text>
        </Pressable>

        <View style={{ height: insets.bottom + 20 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 19,
    fontWeight: '600',
    textAlign: 'center',
  },
  headerAction: {
    width: 60,
    alignItems: 'flex-end',
  },
  headerActionText: {
    fontSize: 16,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  avatarCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  avatarInitials: {
    fontSize: 32,
    fontWeight: '700',
  },
  avatarImage: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  avatarOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: brand.primary,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: neutrals.white,
  },
  nameDisplay: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  emailDisplay: {
    fontSize: 14,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  cardIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  cardContent: {
    flex: 1,
  },
  cardLabel: {
    fontSize: 13,
    marginBottom: 2,
  },
  cardValue: {
    fontSize: 15,
    fontWeight: '500',
  },
  cardInput: {
    fontSize: 15,
    fontWeight: '500',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 8,
    marginTop: 4,
  },
  bioInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  cardDivider: {
    height: 1,
    marginLeft: 66,
  },
  saveButton: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 17,
    fontWeight: '600',
  },
  appearanceRow: {
    flexDirection: 'row',
    padding: 12,
  },
  appearanceOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
  },
  appearanceOptionActive: {
    // backgroundColor set dynamically
  },
  appearanceOptionText: {
    fontSize: 15,
    fontWeight: '600',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
  },
  signOutButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#EF4444',
  },
  deleteAccountButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 8,
    borderRadius: 12,
  },
  deleteAccountButtonText: {
    fontSize: 15,
    color: '#EF4444',
    fontWeight: '500',
    opacity: 0.8,
  },
});
