import { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import GradientButton from '@/components/GradientButton';
import { useTheme } from '@/contexts/ThemeContext';
import { useSession } from '@/hooks/useSession';
import { supabase } from '@/lib/supabase';
import type { Space } from '@/lib/types';

const ORG_TYPES = ['MSA', 'Mosque', 'Non-Profit', 'Islamic Education', 'Business'] as const;

export default function EditSpaceScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useSession();
  const { colors, isDark } = useTheme();
  const [space, setSpace] = useState<Space | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [orgType, setOrgType] = useState<(typeof ORG_TYPES)[number] | null>(null);
  const [orgTypeOpen, setOrgTypeOpen] = useState(false);
  const [cover, setCover] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (id) {
      loadSpace(id);
    }
  }, [id]);

  const loadSpace = async (spaceId: string) => {
    const { data, error } = await supabase.from('spaces').select('*').eq('id', spaceId).single();
    if (error) {
      Alert.alert('Unable to load space', error.message);
      router.back();
      return;
    }
    setSpace(data);
    setName(data.name);
    setDescription(data.description ?? '');
    setAddress(data.address ?? '');
    setOrgType((data.org_type as (typeof ORG_TYPES)[number]) ?? null);
  };

  const pickCover = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Please allow photo library access.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
    });
    if (!result.canceled) {
      setCover(result.assets[0]);
    }
  };

  const uploadCover = async (userId: string) => {
    if (!cover) return space?.cover_image_url ?? null;

    // 5MB limit
    if (cover.fileSize && cover.fileSize > 5 * 1024 * 1024) {
      throw new Error('Image size must be less than 5MB.');
    }

    const fileName = `${userId}/${Date.now()}.jpg`;
    let sourceUri = cover.uri;

    // Handle iOS ph:// URIs
    if (sourceUri.startsWith('ph://')) {
      const cacheUri = `${FileSystem.cacheDirectory}space_${Date.now()}.jpg`;
      await FileSystem.copyAsync({ from: sourceUri, to: cacheUri });
      sourceUri = cacheUri;
    }

    // Optimize image
    const manipulated = await ImageManipulator.manipulateAsync(
      sourceUri,
      [{ resize: { width: 1200 } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
    );

    // Multipart upload using Blob
    const response = await fetch(manipulated.uri);
    const blob = await response.blob();

    const { error } = await supabase.storage.from('space-covers').upload(fileName, blob, {
      contentType: 'image/jpeg',
      upsert: false,
    });

    if (error) {
      throw error;
    }

    const { data } = supabase.storage.from('space-covers').getPublicUrl(fileName);
    return data.publicUrl;
  };

  const handleSave = async () => {
    if (!user || !space) return;
    if (!name.trim()) {
      Alert.alert('Missing info', 'Add a space title.');
      return;
    }
    if (!orgType) {
      Alert.alert('Missing info', 'Select an organization type.');
      return;
    }
    setLoading(true);
    try {
      const coverUrl = await uploadCover(user.id);
      const { error } = await supabase
        .from('spaces')
        .update({
          name: name.trim(),
          description: description.trim() || null,
          address: address.trim() || null,
          org_type: orgType,
          cover_image_url: coverUrl,
        })
        .eq('id', space.id);
      if (error) {
        throw error;
      }
      router.back();
    } catch (error) {
      Alert.alert('Unable to update space', (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: 'Edit space', headerStyle: { backgroundColor: colors.surface }, headerTintColor: colors.textPrimary }} />
      <Text style={[styles.title, { color: colors.textPrimary }]}>Edit space</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>Update the space details.</Text>

      <Pressable style={[styles.coverPicker, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={pickCover}>
        {cover ? (
          <Image 
            source={{ uri: cover.uri }} 
            style={styles.coverPreview} 
            contentFit="cover"
            transition={200}
          />
        ) : space?.cover_image_url ? (
          <Image 
            source={{ uri: space.cover_image_url }} 
            style={styles.coverPreview} 
            contentFit="cover"
            transition={200}
          />
        ) : (
          <Text style={[styles.coverPlaceholder, { color: colors.primary }]}>Add cover image</Text>
        )}
      </Pressable>

      <TextInput
        placeholder="Title"
        placeholderTextColor={colors.textDisabled}
        style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
        value={name}
        onChangeText={setName}
      />
      <TextInput
        placeholder="Description"
        placeholderTextColor={colors.textDisabled}
        style={[styles.input, styles.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
        value={description}
        onChangeText={setDescription}
        multiline
      />
      <TextInput
        placeholder="Address"
        placeholderTextColor={colors.textDisabled}
        style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
        value={address}
        onChangeText={setAddress}
      />
      <Pressable style={[styles.orgTypeButton, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => setOrgTypeOpen(true)}>
        <Text style={[styles.orgTypeText, { color: orgType ? colors.textPrimary : colors.textDisabled }]}>{orgType ?? 'Select organization type'}</Text>
      </Pressable>

      <GradientButton
        onPress={handleSave}
        title={loading ? 'Saving...' : 'Save Changes'}
        disabled={loading}
        style={styles.submitButton}
      />

      <Modal visible={orgTypeOpen} transparent animationType="fade">
        <View style={[styles.modalBackdrop, { backgroundColor: colors.overlay }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setOrgTypeOpen(false)}
          />
          <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Organization type</Text>
            {ORG_TYPES.map((option) => (
              <Pressable
                key={option}
                style={[
                  styles.modalOption,
                  { backgroundColor: colors.backgroundAlt },
                  orgType === option && [styles.modalOptionActive, { backgroundColor: colors.primary }],
                ]}
                onPress={() => {
                  setOrgType(option);
                  setOrgTypeOpen(false);
                }}>
                <Text
                  style={[
                    styles.modalOptionText,
                    { color: colors.textPrimary },
                    orgType === option && [styles.modalOptionTextActive, { color: colors.white }],
                  ]}>
                  {option}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 80,
  },
  title: {
    fontSize: 25,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 6,
    marginBottom: 20,
    fontSize: 15,
  },
  coverPicker: {
    height: 180,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    overflow: 'hidden',
  },
  coverPreview: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    fontWeight: '600',
    fontSize: 16,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 12,
  },
  textArea: {
    height: 110,
    textAlignVertical: 'top',
  },
  orgTypeButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 12,
  },
  orgTypeText: {
    fontWeight: '600',
    fontSize: 16,
  },
  submitButton: {
    marginTop: 6,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    borderRadius: 18,
    padding: 18,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 12,
  },
  modalOption: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  modalOptionActive: {
  },
  modalOptionText: {
    fontWeight: '600',
    fontSize: 16,
  },
  modalOptionTextActive: {
  },
});
