import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/contexts/ThemeContext';
import { useSession } from '@/hooks/useSession';
import { supabase } from '@/lib/supabase';
import type { BazaarPost, Profile } from '@/lib/types';
import { getDisplayName } from '@/lib/types';

export default function RateSellerScreen() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useSession();
  const { colors, isDark } = useTheme();

  const [post, setPost] = useState<BazaarPost | null>(null);
  const [sellerProfile, setSellerProfile] = useState<Profile | null>(null);
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [existingRating, setExistingRating] = useState<number | null>(null);

  useEffect(() => {
    if (postId) {
      loadData();
    }
  }, [postId]);

  const loadData = async () => {
    // Load post
    const { data: postData, error: postError } = await supabase
      .from('bazaar_posts')
      .select('*')
      .eq('id', postId)
      .single();

    if (postError || !postData) {
      Alert.alert('Error', 'Unable to load listing');
      router.back();
      return;
    }

    setPost(postData);

    // Load seller profile
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', postData.user_id)
      .single();

    setSellerProfile(profileData);

    // Check for existing rating
    if (user) {
      const { data: ratingData } = await supabase
        .from('seller_ratings')
        .select('rating, review_text')
        .eq('buyer_id', user.id)
        .eq('post_id', postId)
        .single();

      if (ratingData) {
        setRating(ratingData.rating);
        setReviewText(ratingData.review_text || '');
        setExistingRating(ratingData.rating);
      }
    }

    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!user || !post || rating === 0) {
      Alert.alert('Rating required', 'Please select a star rating');
      return;
    }

    setSubmitting(true);

    const ratingData = {
      seller_id: post.user_id,
      buyer_id: user.id,
      post_id: postId,
      rating,
      review_text: reviewText.trim() || null,
    };

    const { error } = await supabase.from('seller_ratings').upsert(ratingData, {
      onConflict: 'buyer_id,post_id',
    });

    setSubmitting(false);

    if (error) {
      Alert.alert('Error', 'Failed to submit rating. Please try again.');
      return;
    }

    Alert.alert(
      'Thank you!',
      existingRating ? 'Your rating has been updated.' : 'Your rating has been submitted.',
      [{ text: 'OK', onPress: () => router.back() }]
    );
  };

  if (loading || !post) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const sellerName = getDisplayName(sellerProfile);

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={[styles.backButton, { backgroundColor: colors.background }]}>
          <FontAwesome name="arrow-left" size={20} color={colors.textPrimary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Rate Seller</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.content}>
        {/* Seller Info */}
        <View style={styles.sellerSection}>
          <View style={[styles.sellerAvatar, { backgroundColor: colors.primaryLight }]}>
            <FontAwesome name="user" size={32} color={colors.primary} />
          </View>
          <Text style={[styles.sellerName, { color: colors.textPrimary }]}>{sellerName}</Text>
          <Text style={[styles.postTitle, { color: colors.textMuted }]} numberOfLines={2}>
            {post.title}
          </Text>
        </View>

        {/* Star Rating */}
        <View style={styles.ratingSection}>
          <Text style={[styles.ratingLabel, { color: colors.textSecondary }]}>
            How was your experience?
          </Text>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Pressable
                key={star}
                onPress={() => setRating(star)}
                style={styles.starButton}
              >
                <FontAwesome
                  name={star <= rating ? 'star' : 'star-o'}
                  size={40}
                  color={star <= rating ? '#F59E0B' : colors.border}
                />
              </Pressable>
            ))}
          </View>
          {rating > 0 && (
            <Text style={[styles.ratingText, { color: colors.primary }]}>
              {rating === 1 && 'Poor'}
              {rating === 2 && 'Fair'}
              {rating === 3 && 'Good'}
              {rating === 4 && 'Very Good'}
              {rating === 5 && 'Excellent'}
            </Text>
          )}
        </View>

        {/* Review Text */}
        <View style={styles.reviewSection}>
          <Text style={[styles.reviewLabel, { color: colors.textSecondary }]}>
            Share your experience (optional)
          </Text>
          <TextInput
            style={[
              styles.reviewInput,
              { backgroundColor: colors.surface, color: colors.textPrimary, borderColor: colors.border },
              isDark && { borderWidth: 1 },
            ]}
            placeholder="How was your transaction with this seller?"
            placeholderTextColor={colors.textDisabled}
            value={reviewText}
            onChangeText={setReviewText}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            maxLength={500}
          />
          <Text style={[styles.charCount, { color: colors.textMuted }]}>
            {reviewText.length}/500
          </Text>
        </View>

        {/* Submit Button */}
        <Pressable
          style={[
            styles.submitButton,
            { backgroundColor: colors.primary },
            (rating === 0 || submitting) && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={rating === 0 || submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Text style={[styles.submitButtonText, { color: colors.white }]}>
              {existingRating ? 'Update Rating' : 'Submit Rating'}
            </Text>
          )}
        </Pressable>
      </View>
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
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  sellerSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  sellerAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  sellerName: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  postTitle: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  ratingSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  ratingLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  starButton: {
    padding: 4,
  },
  ratingText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '600',
  },
  reviewSection: {
    marginBottom: 24,
  },
  reviewLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  reviewInput: {
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    minHeight: 120,
  },
  charCount: {
    textAlign: 'right',
    marginTop: 4,
    fontSize: 12,
  },
  submitButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
