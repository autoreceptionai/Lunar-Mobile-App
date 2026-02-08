import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/hooks/useSession';
import type { Restaurant, RestaurantReview } from '@/lib/types';

const StarRating = ({ rating, size = 16 }: { rating: number; size?: number }) => {
  const { colors } = useTheme();
  const stars = [];
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating - fullStars >= 0.5;

  for (let i = 0; i < 5; i++) {
    if (i < fullStars) {
      stars.push(
        <FontAwesome key={i} name="star" size={size} color={colors.star} />
      );
    } else if (i === fullStars && hasHalfStar) {
      stars.push(
        <FontAwesome key={i} name="star-half-o" size={size} color={colors.star} />
      );
    } else {
      stars.push(
        <FontAwesome key={i} name="star-o" size={size} color={colors.border} />
      );
    }
  }

  return <View style={styles.starRow}>{stars}</View>;
};

// Interactive star selector for review form
const StarSelector = ({
  rating,
  onSelect,
}: {
  rating: number;
  onSelect: (rating: number) => void;
}) => {
  const { colors } = useTheme();
  return (
    <View style={styles.starSelectorRow}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Pressable
          key={star}
          onPress={() => onSelect(star)}
          style={styles.starSelectorButton}
          hitSlop={{ top: 10, bottom: 10, left: 5, right: 5 }}
        >
          <FontAwesome
            name={star <= rating ? 'star' : 'star-o'}
            size={36}
            color={star <= rating ? colors.star : colors.border}
          />
        </Pressable>
      ))}
    </View>
  );
};

const RatingBar = ({ stars, percentage }: { stars: number; percentage: number }) => {
  const { colors } = useTheme();
  return (
    <View style={styles.ratingBarRow}>
      <Text style={[styles.ratingBarLabel, { color: colors.textSecondary }]}>{stars}</Text>
      <FontAwesome name="star" size={12} color={colors.star} />
      <View style={[styles.ratingBarTrack, { backgroundColor: colors.backgroundAlt }]}>
        <View style={[styles.ratingBarFill, { width: `${percentage}%`, backgroundColor: colors.primary }]} />
      </View>
      <Text style={[styles.ratingBarPercent, { color: colors.textMuted }]}>{percentage}%</Text>
    </View>
  );
};

// Helper to format relative date
const formatRelativeDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
};

const ReviewCard = ({ review, isCurrentUser }: { review: RestaurantReview; isCurrentUser?: boolean }) => {
  const { colors, isDark } = useTheme();
  // Generate initials from user_id
  const initials = review.user_id.substring(0, 2).toUpperCase();

  return (
    <View style={[styles.reviewCard, { backgroundColor: isDark ? colors.surface : colors.backgroundAlt }, isCurrentUser && { borderColor: colors.primary, borderWidth: 1 }]}>
      <View style={styles.reviewHeader}>
        <View style={[styles.reviewAvatar, { backgroundColor: colors.primary }, isCurrentUser && { backgroundColor: colors.primaryDark }]}>
          <Text style={[styles.reviewAvatarText, { color: colors.white }]}>{initials}</Text>
        </View>
        <View style={styles.reviewMeta}>
          <Text style={[styles.reviewUserName, { color: colors.textPrimary }]}>
            {isCurrentUser ? 'You' : 'User'}
          </Text>
          <View style={styles.reviewRatingRow}>
            <StarRating rating={review.rating} size={12} />
            <Text style={[styles.reviewDate, { color: colors.textMuted }]}>{formatRelativeDate(review.created_at)}</Text>
          </View>
        </View>
      </View>
      {review.review_text && (
        <Text style={[styles.reviewText, { color: colors.textSecondary }]}>{review.review_text}</Text>
      )}
    </View>
  );
};

export default function RestaurantDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useSession();
  const { colors, isDark } = useTheme();

  // Restaurant and reviews state
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [reviews, setReviews] = useState<RestaurantReview[]>([]);
  const [loading, setLoading] = useState(true);

  // Review form state
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [userReview, setUserReview] = useState<RestaurantReview | null>(null);

  useEffect(() => {
    if (id) {
      loadRestaurant();
      loadReviews();
    }
  }, [id]);

  // Check for user's existing review when user or reviews change
  useEffect(() => {
    if (user && reviews.length > 0) {
      const existingReview = reviews.find((r) => r.user_id === user.id);
      setUserReview(existingReview || null);
    } else {
      setUserReview(null);
    }
  }, [user, reviews]);

  const loadRestaurant = async () => {
    const { data, error } = await supabase
      .from('restaurants')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      Alert.alert('Error', 'Unable to load restaurant details');
      router.back();
      return;
    }

    setRestaurant(data);
    setLoading(false);
  };

  const loadReviews = async () => {
    const { data, error } = await supabase
      .from('restaurant_reviews')
      .select('*')
      .eq('restaurant_id', id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setReviews(data);
    }
  };

  const openDirections = () => {
    if (!restaurant) return;
    const lat = restaurant.lat;
    const lng = restaurant.lng;
    const label = encodeURIComponent(restaurant.name);

    const url = Platform.select({
      ios: `maps:?q=${label}&ll=${lat},${lng}`,
      android: `geo:${lat},${lng}?q=${lat},${lng}(${label})`,
      default: `https://maps.google.com/?q=${lat},${lng}`,
    });

    Linking.openURL(url);
  };

  const openReviewModal = () => {
    if (userReview) {
      // Pre-fill with existing review data
      setReviewRating(userReview.rating);
      setReviewText(userReview.review_text || '');
    } else {
      // Reset form for new review
      setReviewRating(0);
      setReviewText('');
    }
    setShowReviewModal(true);
  };

  const closeReviewModal = () => {
    setShowReviewModal(false);
    setReviewRating(0);
    setReviewText('');
  };

  const submitReview = async () => {
    if (!user || reviewRating === 0) {
      Alert.alert('Rating required', 'Please select a star rating');
      return;
    }

    setSubmitting(true);

    const reviewData = {
      restaurant_id: id,
      user_id: user.id,
      rating: reviewRating,
      review_text: reviewText.trim() || null,
    };

    let error;

    if (userReview) {
      // Update existing review
      const result = await supabase
        .from('restaurant_reviews')
        .update({
          rating: reviewRating,
          review_text: reviewText.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userReview.id);
      error = result.error;
    } else {
      // Insert new review
      const result = await supabase
        .from('restaurant_reviews')
        .insert(reviewData);
      error = result.error;
    }

    if (error) {
      Alert.alert('Error', 'Could not submit review. Please try again.');
    } else {
      // Success - close modal and refresh data
      closeReviewModal();
      loadReviews();
      loadRestaurant(); // Refresh to get updated average_rating
      Alert.alert(
        'Success',
        userReview ? 'Your review has been updated!' : 'Thank you for your review!'
      );
    }

    setSubmitting(false);
  };

  const deleteReview = async () => {
    if (!userReview) return;

    Alert.alert(
      'Delete Review',
      'Are you sure you want to delete your review?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('restaurant_reviews')
              .delete()
              .eq('id', userReview.id);

            if (error) {
              Alert.alert('Error', 'Could not delete review');
            } else {
              closeReviewModal();
              loadReviews();
              loadRestaurant();
            }
          },
        },
      ]
    );
  };

  // Calculate rating distribution from reviews
  const calculateRatingDistribution = () => {
    if (reviews.length === 0) {
      return [
        { stars: 5, percentage: 0 },
        { stars: 4, percentage: 0 },
        { stars: 3, percentage: 0 },
        { stars: 2, percentage: 0 },
        { stars: 1, percentage: 0 },
      ];
    }

    const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    reviews.forEach((review) => {
      if (review.rating >= 1 && review.rating <= 5) {
        counts[review.rating as keyof typeof counts]++;
      }
    });

    const total = reviews.length;
    return [5, 4, 3, 2, 1].map((stars) => ({
      stars,
      percentage: Math.round((counts[stars as keyof typeof counts] / total) * 100),
    }));
  };

  if (loading || !restaurant) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  const rating = restaurant.average_rating || 0;
  const reviewCount = restaurant.review_count || 0;
  const ratingDistribution = calculateRatingDistribution();

  // Determine review button state
  const renderReviewButton = () => {
    if (userReview) {
      return (
        <Pressable style={[styles.reviewButtonOutline, { borderColor: colors.primary, backgroundColor: colors.background }]} onPress={openReviewModal}>
          <FontAwesome name="pencil" size={14} color={colors.primary} />
          <Text style={[styles.reviewButtonOutlineText, { color: colors.primary }]}>Edit Review</Text>
        </Pressable>
      );
    }

    return (
      <Pressable style={[styles.reviewButton, { backgroundColor: colors.primary }]} onPress={openReviewModal}>
        <FontAwesome name="star" size={14} color={colors.white} />
        <Text style={[styles.reviewButtonText, { color: colors.white }]}>Write Review</Text>
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header Image */}
        <View style={styles.headerImageContainer}>
          {restaurant.cover_image_url ? (
            <Image
              source={{ uri: restaurant.cover_image_url }}
              style={styles.headerImage}
            />
          ) : (
            <View style={[styles.headerImagePlaceholder, { backgroundColor: colors.backgroundAlt }]}>
              <FontAwesome name="cutlery" size={48} color={colors.textDisabled} />
            </View>
          )}
          <LinearGradient
            colors={['rgba(0,0,0,0.5)', 'transparent', 'rgba(0,0,0,0.3)']}
            locations={[0, 0.3, 1]}
            style={styles.headerGradient}
          />

          {/* Back Button */}
          <Pressable
            style={[styles.backButton, { top: insets.top + 10 }]}
            onPress={() => router.back()}
          >
            <FontAwesome name="arrow-left" size={18} color={colors.white} />
          </Pressable>
        </View>

        {/* Restaurant Info Section */}
        <View style={[styles.infoSection, { borderBottomColor: colors.border }]}>
          <Text style={[styles.restaurantName, { color: colors.textPrimary }]}>{restaurant.name}</Text>

          <View style={styles.ratingOverview}>
            <Text style={[styles.ratingNumber, { color: colors.textPrimary }]}>{rating.toFixed(1)}</Text>
            <View style={styles.ratingDetails}>
              <StarRating rating={rating} size={18} />
              <Text style={[styles.reviewCountText, { color: colors.textMuted }]}>
                {reviewCount} {reviewCount === 1 ? 'review' : 'reviews'}
              </Text>
            </View>
          </View>

          <View style={styles.addressRow}>
            <FontAwesome name="map-marker" size={16} color={colors.primary} />
            <Text style={[styles.addressText, { color: colors.textSecondary }]}>{restaurant.address}</Text>
          </View>

          <View style={styles.badges}>
            <View style={[styles.badge, { backgroundColor: isDark ? colors.backgroundAlt : colors.primaryLight }]}>
              <FontAwesome name="check-circle" size={14} color={colors.primary} />
              <Text style={[styles.badgeText, { color: isDark ? colors.primary : colors.primaryDark }]}>{restaurant.verification_category}</Text>
            </View>
            <View style={[styles.badgeSecondary, { backgroundColor: colors.backgroundAlt }]}>
              <Text style={[styles.badgeSecondaryText, { color: colors.textSecondary }]}>{restaurant.halal_type}</Text>
            </View>
          </View>

          {restaurant.notes && (
            <Text style={[styles.notesText, { color: colors.textSecondary }]}>{restaurant.notes}</Text>
          )}

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <Pressable style={[styles.actionButton, { backgroundColor: colors.primary }]} onPress={openDirections}>
              <FontAwesome name="location-arrow" size={18} color={colors.white} />
              <Text style={[styles.actionButtonText, { color: colors.white }]}>Directions</Text>
            </Pressable>
          </View>
        </View>

        {/* Ratings Breakdown Section */}
        <View style={[styles.ratingsSection, { borderBottomColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Ratings</Text>
          {reviewCount > 0 ? (
            <View style={styles.ratingsBreakdown}>
              {ratingDistribution.map((item) => (
                <RatingBar
                  key={item.stars}
                  stars={item.stars}
                  percentage={item.percentage}
                />
              ))}
            </View>
          ) : (
            <Text style={[styles.noReviewsText, { color: colors.textMuted }]}>No ratings yet</Text>
          )}
        </View>

        {/* Reviews Section */}
        <View style={styles.reviewsSection}>
          <View style={styles.reviewsSectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Reviews</Text>
            {renderReviewButton()}
          </View>

          {reviews.length > 0 ? (
            reviews.map((review) => (
              <ReviewCard
                key={review.id}
                review={review}
                isCurrentUser={user?.id === review.user_id}
              />
            ))
          ) : (
            <View style={styles.noReviewsContainer}>
              <FontAwesome name="comment-o" size={32} color={colors.textDisabled} />
              <Text style={[styles.noReviewsText, { color: colors.textMuted }]}>No reviews yet</Text>
              <Text style={[styles.noReviewsSubtext, { color: colors.textDisabled }]}>
                Be the first to review this restaurant
              </Text>
            </View>
          )}
        </View>

        <View style={{ height: insets.bottom + 20 }} />
      </ScrollView>

      {/* Review Modal */}
      <Modal
        visible={showReviewModal}
        transparent
        animationType="slide"
        onRequestClose={closeReviewModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <Pressable style={styles.modalBackdrop} onPress={closeReviewModal} />
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20, backgroundColor: colors.surface }]}>
            {/* Modal Header */}
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                {userReview ? 'Edit Your Review' : 'Write a Review'}
              </Text>
              <Pressable onPress={closeReviewModal} style={[styles.modalCloseButton, { backgroundColor: colors.background }]}>
                <FontAwesome name="times" size={20} color={colors.textMuted} />
              </Pressable>
            </View>

            {/* Star Rating Selector */}
            <View style={styles.modalSection}>
              <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>Tap to rate</Text>
              <StarSelector rating={reviewRating} onSelect={setReviewRating} />
              {reviewRating > 0 && (
                <Text style={[styles.ratingLabel, { color: colors.primary }]}>
                  {reviewRating === 1 && 'Poor'}
                  {reviewRating === 2 && 'Fair'}
                  {reviewRating === 3 && 'Good'}
                  {reviewRating === 4 && 'Very Good'}
                  {reviewRating === 5 && 'Excellent'}
                </Text>
              )}
            </View>

            {/* Review Text Input */}
            <View style={styles.modalSection}>
              <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>Your review (optional)</Text>
              <TextInput
                style={[styles.reviewInput, { backgroundColor: colors.background, color: colors.textPrimary }]}
                placeholder="Share your experience..."
                placeholderTextColor={colors.textDisabled}
                value={reviewText}
                onChangeText={setReviewText}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                maxLength={500}
              />
              <Text style={[styles.charCount, { color: colors.textMuted }]}>{reviewText.length}/500</Text>
            </View>

            {/* Action Buttons */}
            <View style={[styles.modalActions, { borderTopColor: colors.border }]}>
              {userReview && (
                <Pressable style={[styles.deleteButton, { backgroundColor: colors.errorLight, borderColor: colors.error }]} onPress={deleteReview}>
                  <FontAwesome name="trash-o" size={16} color={colors.error} />
                </Pressable>
              )}
              <Pressable
                style={[styles.cancelButton, { backgroundColor: colors.background }]}
                onPress={closeReviewModal}
                disabled={submitting}
              >
                <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.submitButton,
                  { backgroundColor: colors.primary },
                  (reviewRating === 0 || submitting) && styles.submitButtonDisabled,
                ]}
                onPress={submitReview}
                disabled={reviewRating === 0 || submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={[styles.submitButtonText, { color: colors.white }]}>
                    {userReview ? 'Update' : 'Submit'}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 17,
  },
  headerImageContainer: {
    height: 280,
    position: 'relative',
  },
  headerImage: {
    width: '100%',
    height: '100%',
  },
  headerImagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  backButton: {
    position: 'absolute',
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoSection: {
    padding: 20,
    borderBottomWidth: 1,
  },
  restaurantName: {
    fontSize: 25,
    fontWeight: '700',
    marginBottom: 12,
  },
  ratingOverview: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  ratingNumber: {
    fontSize: 37,
    fontWeight: '700',
    marginRight: 12,
  },
  ratingDetails: {
    justifyContent: 'center',
  },
  starRow: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewCountText: {
    marginTop: 2,
    fontSize: 15,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 16,
  },
  addressText: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  badgeSecondary: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  badgeSecondaryText: {
    fontSize: 14,
    fontWeight: '500',
  },
  notesText: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  ratingsSection: {
    padding: 20,
    borderBottomWidth: 1,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '700',
  },
  ratingsBreakdown: {
    marginTop: 16,
    gap: 8,
  },
  ratingBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ratingBarLabel: {
    width: 12,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  ratingBarTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
  },
  ratingBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  ratingBarPercent: {
    width: 36,
    fontSize: 14,
    textAlign: 'right',
  },
  reviewsSection: {
    padding: 20,
  },
  reviewsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  reviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  reviewButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  reviewButtonOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  reviewButtonOutlineText: {
    fontSize: 14,
    fontWeight: '600',
  },
  reviewCard: {
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
  },
  reviewCardHighlight: {
    borderWidth: 1,
  },
  reviewHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  reviewAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  reviewAvatarHighlight: {
  },
  reviewAvatarText: {
    fontSize: 17,
    fontWeight: '600',
  },
  reviewMeta: {
    flex: 1,
    justifyContent: 'center',
  },
  reviewUserName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  reviewRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reviewDate: {
    fontSize: 13,
  },
  reviewText: {
    fontSize: 15,
    lineHeight: 22,
  },
  noReviewsContainer: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  noReviewsText: {
    fontSize: 16,
  },
  noReviewsSubtext: {
    fontSize: 14,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: '700',
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  modalLabel: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 12,
  },
  starSelectorRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  starSelectorButton: {
    padding: 8,
  },
  ratingLabel: {
    textAlign: 'center',
    marginTop: 12,
    fontSize: 16,
    fontWeight: '600',
  },
  reviewInput: {
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    minHeight: 100,
  },
  charCount: {
    marginTop: 8,
    textAlign: 'right',
    fontSize: 13,
  },
  modalActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
    borderTopWidth: 1,
  },
  deleteButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    flex: 1,
    paddingVertical: 14,
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
