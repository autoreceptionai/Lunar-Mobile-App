import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
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
import { Image } from 'expo-image';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet';
import { useCallback, useMemo, useRef } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { brand, neutrals } from '@/constants/Brand';
import { useTheme } from '@/contexts/ThemeContext';
import { useSession } from '@/hooks/useSession';
import { supabase } from '@/lib/supabase';

export default function BazaarNewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useSession();
  const { colors, isDark } = useTheme();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [city, setCity] = useState('');
  const [contact, setContact] = useState('');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState<'CAD' | 'USD' | 'EUR'>('CAD');
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!title.trim()) newErrors.title = 'Title is required';
    if (!price.trim() || Number.isNaN(Number(price))) newErrors.price = 'Valid price is required';
    if (!contact.trim()) newErrors.contact = 'Contact method is required';
    if (!photo) newErrors.photo = 'Photo is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const currencySheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['35%'], []);

  const pickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Please allow photo library access.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled) {
      setPhoto(result.assets[0]);
    }
  };

  const uploadPhoto = async (userId: string) => {
    if (!photo) return null;

    // 5MB limit
    if (photo.fileSize && photo.fileSize > 5 * 1024 * 1024) {
      throw new Error('Photo size must be less than 5MB.');
    }

    const fileName = `${userId}/${Date.now()}.jpg`;
    let sourceUri = photo.uri;

    // Handle iOS ph:// URIs
    if (sourceUri.startsWith('ph://')) {
      const cacheUri = `${FileSystem.cacheDirectory}bazaar_${Date.now()}.jpg`;
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

    const { error } = await supabase.storage.from('bazaar-photos').upload(fileName, blob, {
      contentType: 'image/jpeg',
      upsert: false,
    });

    if (error) {
      throw error;
    }

    const { data } = supabase.storage.from('bazaar-photos').getPublicUrl(fileName);
    return data.publicUrl;
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (!validate()) return;

    setLoading(true);
    try {
      const photoUrl = await uploadPhoto(user.id);
      const { error } = await supabase.from('bazaar_posts').insert({
        user_id: user.id,
        title: title.trim(),
        description: description.trim() || null,
        city: city.trim() || null,
        contact: contact.trim(),
        price: Number(price),
        currency,
        photo_url: photoUrl,
      });
      if (error) {
        throw error;
      }
      router.back();
    } catch (error) {
      Alert.alert('Unable to create listing', (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const openCurrencySheet = () => {
    currencySheetRef.current?.expand();
  };

  const closeCurrencySheet = () => {
    currencySheetRef.current?.close();
  };

  const selectCurrency = (value: 'CAD' | 'USD' | 'EUR') => {
    setCurrency(value);
    closeCurrencySheet();
  };

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.35}
      />
    ),
    []
  );

  const currencySymbols: Record<string, string> = {
    CAD: 'C$',
    USD: '$',
    EUR: '€',
  };

  return (
    <GestureHandlerRootView style={[styles.root, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[styles.container, { paddingTop: insets.top }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Pressable onPress={() => router.back()} style={[styles.backButton, { backgroundColor: colors.backgroundAlt }]}>
              <FontAwesome name="arrow-left" size={20} color={colors.textPrimary} />
            </Pressable>
            <View style={styles.headerText}>
              <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Create Listing</Text>
              <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>Share what you're selling</Text>
            </View>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Photo Picker */}
            <Pressable style={[styles.photoPicker, { backgroundColor: colors.backgroundAlt, borderColor: colors.border }]} onPress={pickPhoto}>
              {photo ? (
                <Image 
                  source={{ uri: photo.uri }} 
                  style={styles.photoPreview} 
                  contentFit="cover"
                  transition={200}
                />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <View style={[styles.photoIconCircle, { backgroundColor: isDark ? colors.surface : colors.primaryLight }]}>
                    <FontAwesome name="camera" size={24} color={colors.primary} />
                  </View>
                  <Text style={[styles.photoText, { color: colors.textPrimary }]}>Add photo</Text>
                  <Text style={[styles.photoSubtext, { color: colors.textMuted }]}>Tap to select an image</Text>
                </View>
              )}
              {photo && (
                <View style={styles.photoOverlay}>
                  <FontAwesome name="camera" size={20} color={colors.white} />
                  <Text style={[styles.photoOverlayText, { color: colors.white }]}>Change photo</Text>
                </View>
              )}
            </Pressable>

            {/* Form Fields */}
            <View style={styles.formSection}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                Title <Text style={[styles.required, { color: colors.error }]}>*</Text>
              </Text>
              <TextInput
                placeholder="What are you selling?"
                placeholderTextColor={colors.textDisabled}
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
                value={title}
                onChangeText={setTitle}
              />
            </View>

            <View style={styles.formSection}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Description</Text>
              <TextInput
                placeholder="Add details about your item..."
                placeholderTextColor={colors.textDisabled}
                style={[styles.input, styles.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
                value={description}
                onChangeText={setDescription}
                multiline
                textAlignVertical="top"
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.formSection, { flex: 1 }]}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>
                  Price <Text style={[styles.required, { color: colors.error }]}>*</Text>
                </Text>
                <View style={[styles.priceInputContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={[styles.currencyPrefix, { color: colors.textMuted }]}>{currencySymbols[currency]}</Text>
                  <TextInput
                    placeholder="0.00"
                    placeholderTextColor={colors.textDisabled}
                    style={[styles.priceInput, { color: colors.textPrimary }]}
                    value={price}
                    onChangeText={setPrice}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
              <View style={styles.formSection}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Currency</Text>
                <Pressable style={[styles.currencyButton, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={openCurrencySheet}>
                  <Text style={[styles.currencyButtonText, { color: colors.textPrimary }]}>{currency}</Text>
                  <FontAwesome name="chevron-down" size={12} color={colors.textMuted} />
                </Pressable>
              </View>
            </View>

            <View style={styles.formSection}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Location</Text>
              <TextInput
                placeholder="City or area"
                placeholderTextColor={colors.textDisabled}
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
                value={city}
                onChangeText={setCity}
              />
            </View>

            <View style={styles.formSection}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                Contact <Text style={[styles.required, { color: colors.error }]}>*</Text>
              </Text>
              <TextInput
                placeholder="Email, phone, or social handle"
                placeholderTextColor={colors.textDisabled}
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
                value={contact}
                onChangeText={setContact}
              />
            </View>

            {/* Submit Button */}
            <Pressable
              style={[styles.submitButton, { backgroundColor: colors.primary }, loading && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <>
                  <FontAwesome name="check" size={18} color={colors.white} />
                  <Text style={[styles.submitButtonText, { color: colors.white }]}>Publish Listing</Text>
                </>
              )}
            </Pressable>

            <View style={{ height: insets.bottom + 20 }} />
          </ScrollView>

          {/* Currency Bottom Sheet */}
          <BottomSheet
            ref={currencySheetRef}
            index={-1}
            snapPoints={snapPoints}
            enablePanDownToClose
            backdropComponent={renderBackdrop}
            backgroundStyle={[styles.sheetBackground, { backgroundColor: colors.surface }]}
            handleIndicatorStyle={[styles.sheetHandle, { backgroundColor: colors.border }]}
          >
            <BottomSheetView style={styles.sheetContent}>
              <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>Select Currency</Text>
              {(['CAD', 'USD', 'EUR'] as const).map((option) => (
                <Pressable
                  key={option}
                  style={[
                    styles.sheetOption,
                    { backgroundColor: colors.backgroundAlt },
                    currency === option && [styles.sheetOptionActive, { backgroundColor: isDark ? colors.primaryDark : colors.primaryLight }],
                  ]}
                  onPress={() => selectCurrency(option)}
                >
                  <Text style={[styles.sheetOptionSymbol, { color: colors.textPrimary }]}>{currencySymbols[option]}</Text>
                  <Text
                    style={[
                      styles.sheetOptionText,
                      { color: colors.textSecondary },
                      currency === option && [styles.sheetOptionTextActive, { color: colors.primary }],
                    ]}
                  >
                    {option === 'CAD'
                      ? 'Canadian Dollar'
                      : option === 'USD'
                      ? 'US Dollar'
                      : 'Euro'}
                  </Text>
                  {currency === option && (
                    <FontAwesome name="check" size={16} color={colors.primary} />
                  )}
                </Pressable>
              ))}
            </BottomSheetView>
          </BottomSheet>
        </View>
      </KeyboardAvoidingView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 21,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 15,
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  photoPicker: {
    height: 200,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    overflow: 'hidden',
    marginBottom: 24,
  },
  photoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  photoText: {
    fontSize: 17,
    fontWeight: '600',
  },
  photoSubtext: {
    fontSize: 14,
    marginTop: 4,
  },
  photoPreview: {
    width: '100%',
    height: '100%',
  },
  photoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  photoOverlayText: {
    fontSize: 15,
    fontWeight: '600',
  },
  formSection: {
    marginBottom: 20,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  required: {
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  priceInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingLeft: 14,
  },
  currencyPrefix: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 4,
  },
  priceInput: {
    flex: 1,
    paddingVertical: 12,
    paddingRight: 14,
    fontSize: 16,
  },
  currencyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minWidth: 90,
  },
  currencyButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 17,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 13,
    marginTop: 4,
    marginLeft: 4,
  },
  // Bottom Sheet
  sheetBackground: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  sheetHandle: {
    width: 40,
  },
  sheetContent: {
    padding: 20,
  },
  sheetTitle: {
    fontSize: 19,
    fontWeight: '700',
    marginBottom: 16,
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  sheetOptionActive: {
  },
  sheetOptionSymbol: {
    fontSize: 17,
    fontWeight: '700',
    width: 32,
  },
  sheetOptionText: {
    flex: 1,
    fontSize: 16,
  },
  sheetOptionTextActive: {
    fontWeight: '600',
  },
});
