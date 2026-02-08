import FontAwesome from '@expo/vector-icons/FontAwesome';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    Alert,
    Image,
    Linking,
    Pressable,
    RefreshControl,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ReportModal from '@/components/ReportModal';
import { useTheme } from '@/contexts/ThemeContext';
import { useSession } from '@/hooks/useSession';
import { supabase } from '@/lib/supabase';
import type { BazaarPost, Profile } from '@/lib/types';
import { getDisplayName } from '@/lib/types';

// Helper to format relative time
const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minutes ago`;
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return date.toLocaleDateString();
};

export default function BazaarDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useSession();
  const [post, setPost] = useState<BazaarPost | null>(null);
  const [sellerProfile, setSellerProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const formatPrice = (price: number | null, currency: string | null) => {
    if (price === null || !currency) return null;
    const symbols: Record<string, string> = {
      CAD: 'C$',
      USD: '$',
      EUR: '€',
    };
    const symbol = symbols[currency] || '$';
    return `${symbol}${price.toFixed(2)} ${currency}`;
  };

  useEffect(() => {
    if (id) {
      loadPost(id);
    }
  }, [id]);

  const loadPost = async (postId: string) => {
    setRefreshing(true);
    const { data, error } = await supabase
      .from('bazaar_posts')
      .select('*')
      .eq('id', postId)
      .single();
    if (error) {
      Alert.alert('Unable to load post', error.message);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    setPost(data);

    // Load seller profile
    if (data?.user_id) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user_id)
        .single();
      setSellerProfile(profileData);
    }

    setLoading(false);
    setRefreshing(false);
  };

  const contactValue =
    post?.contact ?? post?.contact_email ?? post?.contact_phone ?? null;
  const isOwner = !!user && !!post && user.id === post.user_id;

  const handleDelete = () => {
    if (!post) return;
    Alert.alert('Delete listing?', 'This will remove the listing permanently.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase
            .from('bazaar_posts')
            .delete()
            .eq('id', post.id);
          if (error) {
            Alert.alert('Delete failed', error.message);
            return;
          }
          router.back();
        },
      },
    ]);
  };

  const handleMarkAsSold = () => {
    if (!post) return;
    Alert.alert(
      'Mark as Sold?',
      'This will remove the listing from active listings. You can still see it in "My Listings".',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark as Sold',
          onPress: async () => {
            const { error } = await supabase
              .from('bazaar_posts')
              .update({ status: 'sold', sold_at: new Date().toISOString() })
              .eq('id', post.id);
            if (error) {
              Alert.alert('Update failed', error.message);
              return;
            }
            setPost({ ...post, status: 'sold', sold_at: new Date().toISOString() });
            Alert.alert('Success', 'Your listing has been marked as sold!');
          },
        },
      ]
    );
  };

  const handleMessageSeller = async () => {
    if (!user || !post) return;

    // Check if conversation already exists
    const { data: existingConv } = await supabase
      .from('bazaar_conversations')
      .select('id')
      .eq('post_id', post.id)
      .eq('buyer_id', user.id)
      .single();

    if (existingConv) {
      // Navigate to existing conversation
      router.push(`/bazaar/messages/${existingConv.id}`);
      return;
    }

    // Create new conversation
    const { data: newConv, error } = await supabase
      .from('bazaar_conversations')
      .insert({
        post_id: post.id,
        buyer_id: user.id,
        seller_id: post.user_id,
      })
      .select()
      .single();

    if (error) {
      Alert.alert('Error', 'Unable to start conversation. Please try again.');
      return;
    }

    // Navigate to new conversation
    router.push(`/bazaar/messages/${newConv.id}`);
  };

  const handleShare = async () => {
    if (!post) return;
    try {
      await Share.share({
        message: `Check out this listing: ${post.title}${
          post.price ? ` - ${formatPrice(post.price, post.currency)}` : ''
        }`,
      });
    } catch (error) {
      // User cancelled
    }
  };

  const handleContact = (method: 'email' | 'phone' | 'message') => {
    if (!contactValue) return;

    // Check if it's an email
    if (contactValue.includes('@')) {
      Linking.openURL(`mailto:${contactValue}`);
      return;
    }

    // Check if it looks like a phone number
    const phonePattern = /^[\d\s\-+()]+$/;
    if (phonePattern.test(contactValue)) {
      if (method === 'phone') {
        Linking.openURL(`tel:${contactValue}`);
      } else {
        Linking.openURL(`sms:${contactValue}`);
      }
      return;
    }

    // Otherwise just show an alert with the contact info
    Alert.alert('Contact Seller', contactValue);
  };

  if (loading || !post) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadPost(id!)}
            tintColor={colors.primary}
          />
        }
      >
        {/* Header Image */}
        <View style={styles.imageContainer}>
          {post.photo_url ? (
            <Image source={{ uri: post.photo_url }} style={styles.image} />
          ) : (
            <View style={[styles.imagePlaceholder, { backgroundColor: colors.backgroundAlt }]}>
              <FontAwesome name="image" size={64} color={colors.textMuted} />
            </View>
          )}
          <LinearGradient
            colors={['rgba(0,0,0,0.5)', 'transparent']}
            style={styles.imageGradient}
          />

          {/* Back Button */}
          <Pressable
            style={[styles.backButton, { top: insets.top + 10 }]}
            onPress={() => router.back()}
          >
            <FontAwesome name="arrow-left" size={18} color={colors.white} />
          </Pressable>

          {/* Share Button */}
          <Pressable
            style={[styles.shareButton, { top: insets.top + 10 }]}
            onPress={handleShare}
          >
            <FontAwesome name="share" size={18} color={colors.white} />
          </Pressable>

          {/* Report Button */}
          {!isOwner && (
            <Pressable
              style={[styles.reportHeaderButton, { top: insets.top + 10 }]}
              onPress={() => setReportModalVisible(true)}
            >
              <FontAwesome name="flag" size={16} color={colors.white} />
            </Pressable>
          )}

          {/* Sold Banner */}
          {post.status === 'sold' && (
            <View style={[styles.soldBanner, { backgroundColor: colors.error }]}>
              <Text style={styles.soldBannerText}>SOLD</Text>
            </View>
          )}
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Price */}
          {formatPrice(post.price, post.currency) && (
            <Text style={[styles.price, { color: colors.primary }]}>{formatPrice(post.price, post.currency)}</Text>
          )}

          {/* Title */}
          <Text style={[styles.title, { color: colors.textPrimary }]}>{post.title}</Text>

          {/* Meta Info */}
          <View style={styles.metaContainer}>
            {post.city && (
              <View style={styles.metaItem}>
                <FontAwesome name="map-marker" size={14} color={colors.textMuted} />
                <Text style={[styles.metaText, { color: colors.textMuted }]}>{post.city}</Text>
              </View>
            )}
            <View style={styles.metaItem}>
              <FontAwesome name="clock-o" size={14} color={colors.textMuted} />
              <Text style={[styles.metaText, { color: colors.textMuted }]}>{formatRelativeTime(post.created_at)}</Text>
            </View>
          </View>

          {/* Description */}
          {post.description && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Description</Text>
              <Text style={[styles.description, { color: colors.textSecondary }]}>{post.description}</Text>
            </View>
          )}

          {/* Seller Card */}
          <View style={[styles.contactCard, { backgroundColor: colors.surface }]}>
            <View style={styles.sellerHeader}>
              <View style={[styles.sellerAvatarSmall, { backgroundColor: isDark ? colors.backgroundAlt : colors.primaryLight }]}>
                <FontAwesome name="user" size={20} color={colors.primary} />
              </View>
              <View style={styles.sellerInfo}>
                <Text style={[styles.sellerName, { color: colors.textPrimary }]}>{getDisplayName(sellerProfile)}</Text>
                {(sellerProfile?.seller_rating_count ?? 0) > 0 ? (
                  <View style={styles.sellerRating}>
                    <FontAwesome name="star" size={12} color="#F59E0B" />
                    <Text style={[styles.sellerRatingText, { color: colors.textPrimary }]}>
                      {(sellerProfile?.seller_rating ?? 0).toFixed(1)}
                    </Text>
                    <Text style={[styles.sellerRatingCount, { color: colors.textMuted }]}>
                      ({sellerProfile?.seller_rating_count} {sellerProfile?.seller_rating_count === 1 ? 'rating' : 'ratings'})
                    </Text>
                  </View>
                ) : (
                  <Text style={[styles.noRatingsText, { color: colors.textMuted }]}>No ratings yet</Text>
                )}
              </View>
            </View>

            {/* Message Seller Button */}
            <Pressable style={[styles.messageSellerButton, { backgroundColor: colors.primary }]} onPress={handleMessageSeller}>
              <FontAwesome name="comment" size={16} color={colors.white} />
              <Text style={[styles.messageSellerButtonText, { color: colors.white }]}>Message Seller</Text>
            </Pressable>

            {/* Rate Seller Button (for buyers when item is sold) */}
            {!isOwner && post.status === 'sold' && user && (
              <Pressable
                style={[styles.rateSellerButton, { borderColor: colors.primary }]}
                onPress={() => router.push(`/bazaar/rate/${post.id}`)}
              >
                <FontAwesome name="star" size={14} color={colors.primary} />
                <Text style={[styles.rateSellerButtonText, { color: colors.primary }]}>Rate this Seller</Text>
              </Pressable>
            )}

            {/* Contact Info */}
            {contactValue ? (
              <>
                <View style={[styles.contactDivider, { backgroundColor: colors.border }]} />
                <Text style={[styles.contactLabel, { color: colors.textMuted }]}>Contact</Text>
                <View style={styles.contactInfo}>
                  <FontAwesome
                    name={
                      contactValue.includes('@')
                        ? 'envelope'
                        : /^[\d\s\-+()]+$/.test(contactValue)
                        ? 'phone'
                        : 'user'
                    }
                    size={16}
                    color={colors.primary}
                  />
                  <Text style={[styles.contactText, { color: colors.textSecondary }]}>{contactValue}</Text>
                </View>
                {/^[\d\s\-+()]+$/.test(contactValue) && (
                  <View style={styles.contactActions}>
                    <Pressable
                      style={[styles.contactButton, { backgroundColor: colors.primary }]}
                      onPress={() => handleContact('phone')}
                    >
                      <FontAwesome name="phone" size={16} color={colors.white} />
                      <Text style={[styles.contactButtonText, { color: colors.white }]}>Call</Text>
                    </Pressable>
                  </View>
                )}
              </>
            ) : (
              <>
                <View style={[styles.contactDivider, { backgroundColor: colors.border }]} />
                <Text style={[styles.noContact, { color: colors.textMuted }]}>No contact details provided</Text>
              </>
            )}
          </View>

          {/* Owner Actions */}
          {isOwner && (
            <View style={styles.ownerActionsContainer}>
              {post.status !== 'sold' && (
                <Pressable style={[styles.markSoldButton, { backgroundColor: '#10B981' }]} onPress={handleMarkAsSold}>
                  <FontAwesome name="check-circle" size={16} color={colors.white} />
                  <Text style={[styles.markSoldButtonText, { color: colors.white }]}>Mark as Sold</Text>
                </Pressable>
              )}
              <View style={styles.ownerActions}>
                <Pressable
                  style={[styles.editButton, { borderColor: colors.primary, backgroundColor: colors.surface }]}
                  onPress={() => router.push(`/bazaar/edit/${post.id}`)}
                >
                  <FontAwesome name="pencil" size={16} color={colors.primary} />
                  <Text style={[styles.editButtonText, { color: colors.primary }]}>Edit Listing</Text>
                </Pressable>
                <Pressable style={[styles.deleteButton, { borderColor: colors.errorLight, backgroundColor: colors.errorLight }]} onPress={handleDelete}>
                  <FontAwesome name="trash-o" size={16} color={colors.error} />
                  <Text style={[styles.deleteButtonText, { color: colors.error }]}>Delete</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>

        <View style={{ height: insets.bottom + 20 }} />
      </ScrollView>
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
    marginTop: 12,
  },
  imageContainer: {
    height: 300,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 120,
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
  shareButton: {
    position: 'absolute',
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportHeaderButton: {
    position: 'absolute',
    right: 66,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  soldBanner: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    paddingVertical: 10,
    alignItems: 'center',
  },
  soldBannerText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 2,
  },
  content: {
    padding: 20,
  },
  price: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  title: {
    fontSize: 23,
    fontWeight: '700',
    marginBottom: 12,
  },
  metaContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 20,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 15,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
  },
  contactCard: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
  },
  sellerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sellerAvatarSmall: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  sellerInfo: {
    flex: 1,
  },
  sellerName: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 2,
  },
  sellerRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sellerRatingText: {
    fontSize: 15,
    fontWeight: '600',
  },
  sellerRatingCount: {
    fontSize: 14,
  },
  noRatingsText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  messageSellerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  messageSellerButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  rateSellerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1.5,
    marginBottom: 12,
  },
  rateSellerButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  contactDivider: {
    height: 1,
    marginVertical: 12,
  },
  contactLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  contactInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  contactText: {
    fontSize: 16,
  },
  contactActions: {
    flexDirection: 'row',
    gap: 12,
  },
  contactButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  contactButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  noContact: {
    fontSize: 15,
    fontStyle: 'italic',
  },
  ownerActionsContainer: {
    gap: 12,
  },
  markSoldButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  markSoldButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  ownerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  editButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  editButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
