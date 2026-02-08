import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    TextInput,
    View,
    useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import TabHeader from '@/components/TabHeader';
import { BazaarSkeleton } from '@/components/SkeletonLoader';
import { useTheme } from '@/contexts/ThemeContext';
import { useSession } from '@/hooks/useSession';
import { supabase } from '@/lib/supabase';
import type { BazaarPost } from '@/lib/types';

// Helper to format relative time
const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString();
};

export default function BazaarScreen() {
  const router = useRouter();
  const { user } = useSession();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const { colors, isDark } = useTheme();
  const [posts, setPosts] = useState<BazaarPost[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 10;
  const [searchQuery, setSearchQuery] = useState('');
  const [listingFilter, setListingFilter] = useState<'all' | 'mine'>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Calculate card width for 2-column grid
  const cardWidth = (screenWidth - 48 - 12) / 2; // 48 = padding, 12 = gap

  const formatPrice = (price: number | null, currency: string | null) => {
    if (price === null || !currency) return 'Contact for price';
    const symbols: Record<string, string> = {
      CAD: 'C$',
      USD: '$',
      EUR: '€',
    };
    const symbol = symbols[currency] || '$';
    return `${symbol}${price.toFixed(0)}`;
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      onRefresh();
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  useFocusEffect(
    useCallback(() => {
      loadPosts();
      loadUnreadCount();
    }, [user])
  );

  const loadUnreadCount = async () => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    // Get conversations where user is participant
    const { data: conversations } = await supabase
      .from('bazaar_conversations')
      .select('id')
      .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`);

    if (!conversations || conversations.length === 0) {
      setUnreadCount(0);
      return;
    }

    const convIds = conversations.map((c) => c.id);

    // Count unread messages not sent by user
    const { count } = await supabase
      .from('bazaar_messages')
      .select('*', { count: 'exact', head: true })
      .in('conversation_id', convIds)
      .eq('is_read', false)
      .neq('sender_id', user.id);

    setUnreadCount(count || 0);
  };

  const loadPosts = async (pageNum = 0, shouldRefresh = false) => {
    if (loading && !shouldRefresh) return;
    if (!hasMore && !shouldRefresh) return;

    setLoading(true);
    const from = pageNum * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from('bazaar_posts')
      .select('*')
      .order('created_at', { ascending: false });

    if (searchQuery.trim()) {
      query = query.textSearch('fts', searchQuery.trim().split(/\s+/).join(' & '));
    }

    const { data, error } = await query.range(from, to);

    setLoading(false);
    setRefreshing(false);

    if (error) {
      Alert.alert('Unable to load posts', error.message);
      return;
    }

    if (data) {
      if (shouldRefresh) {
        setPosts(data);
        setPage(0);
        setHasMore(data.length === PAGE_SIZE);
      } else {
        setPosts((prev) => [...prev, ...data]);
        setPage(pageNum);
        setHasMore(data.length === PAGE_SIZE);
      }
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPosts(0, true);
  };

  const onLoadMore = () => {
    if (!loading && hasMore) {
      loadPosts(page + 1);
    }
  };

  const filteredPosts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    let scoped;
    
    if (listingFilter === 'mine' && user) {
      // My Listings: show all posts (including sold)
      scoped = posts.filter((post) => post.user_id === user.id);
    } else {
      // All Listings: only show active posts
      scoped = posts.filter((post) => post.status !== 'sold');
    }
    
    if (!query) return scoped;
    return scoped.filter((post) => {
      return (
        post.title.toLowerCase().includes(query) ||
        (post.description ?? '').toLowerCase().includes(query) ||
        (post.city ?? '').toLowerCase().includes(query)
      );
    });
  }, [posts, searchQuery, listingFilter, user]);

  const handleFilterChange = (nextFilter: 'all' | 'mine') => {
    setListingFilter(nextFilter);
  };

  const handleCreateListing = () => {
    router.push('/bazaar/new');
  };

  const renderEmptyState = () => {
    if (loading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>Loading listings...</Text>
        </View>
      );
    }

    if (searchQuery.trim()) {
      return (
        <View style={styles.emptyContainer}>
          <FontAwesome name="moon-o" size={48} color={colors.textMuted} />
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Nothing under this moon</Text>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            Try different words to find what you seek
          </Text>
          <Pressable
            style={[styles.emptyButton, { backgroundColor: colors.primary }]}
            onPress={() => setSearchQuery('')}
          >
            <Text style={[styles.emptyButtonText, { color: colors.white }]}>Clear search</Text>
          </Pressable>
        </View>
      );
    }

    if (listingFilter === 'mine') {
      return (
        <View style={styles.emptyContainer}>
          <FontAwesome name="star-o" size={48} color={colors.textMuted} />
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Your shop is quiet</Text>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            Create your first listing to start selling
          </Text>
          <Pressable style={[styles.emptyButton, { backgroundColor: colors.primary }]} onPress={handleCreateListing}>
            <Text style={[styles.emptyButtonText, { color: colors.white }]}>Create listing</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <FontAwesome name="moon-o" size={48} color={colors.textMuted} />
        <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>The marketplace is quiet tonight</Text>
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>
          Be the first to list something for sale
        </Text>
        <Pressable style={[styles.emptyButton, { backgroundColor: colors.primary }]} onPress={handleCreateListing}>
          <Text style={[styles.emptyButtonText, { color: colors.white }]}>Create listing</Text>
        </Pressable>
      </View>
    );
  };

  if (loading && posts.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <FlatList
          data={[1, 2, 3, 4, 5, 6]}
          renderItem={() => <BazaarSkeleton />}
          keyExtractor={(item) => item.toString()}
          numColumns={2}
          contentContainerStyle={[styles.listContent, { paddingTop: insets.top + 130 }]}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TabHeader title="Bazaar" />

      {/* Search Row */}
      <View style={styles.searchRow}>
        <View style={[styles.searchContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <FontAwesome
            name="search"
            size={16}
            color={colors.textMuted}
            style={styles.searchIcon}
          />
          <TextInput
            placeholder="Search listings..."
            placeholderTextColor={colors.textMuted}
            style={[styles.searchInput, { color: colors.textPrimary }]}
            value={searchQuery}
            onChangeText={setSearchQuery}
            accessibilityLabel="Search bazaar listings"
            accessibilityHint="Type to search for items in the marketplace"
          />
          {searchQuery.length > 0 && (
            <Pressable 
              onPress={() => setSearchQuery('')} 
              style={styles.clearButton}
              accessibilityRole="button"
              accessibilityLabel="Clear search">
              <FontAwesome name="times-circle" size={18} color={colors.textMuted} />
            </Pressable>
          )}
        </View>
        {/* Messages Button */}
        <Pressable
          style={[styles.actionButton, { backgroundColor: colors.surface }]}
          onPress={() => router.push('/bazaar/messages')}
        >
          <FontAwesome name="comments" size={18} color={colors.primary} />
          {unreadCount > 0 && (
            <View style={[styles.unreadBadge, { backgroundColor: colors.error }]}>
              <Text style={styles.unreadBadgeText}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </Text>
            </View>
          )}
        </Pressable>
        {/* Create Button */}
        <Pressable 
          style={[styles.actionButton, { backgroundColor: colors.primary }]} 
          onPress={handleCreateListing}
          accessibilityRole="button"
          accessibilityLabel="Create Listing"
          accessibilityHint="Navigate to create a new bazaar listing screen">
          <FontAwesome name="plus" size={18} color={colors.white} />
        </Pressable>
      </View>

      {/* Segmented Control */}
      <View style={[styles.segmentedControl, { backgroundColor: colors.backgroundAlt }]}>
        <Pressable
          style={[
            styles.segmentButton,
            listingFilter === 'all' && [styles.segmentButtonActive, { backgroundColor: colors.surface }],
          ]}
          onPress={() => handleFilterChange('all')}
        >
          <Text
            style={[
              styles.segmentText,
              { color: colors.textMuted },
              listingFilter === 'all' && { color: colors.primary },
            ]}
          >
            All Listings
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.segmentButton,
            listingFilter === 'mine' && [styles.segmentButtonActive, { backgroundColor: colors.surface }],
          ]}
          onPress={() => handleFilterChange('mine')}
          accessibilityRole="tab"
          accessibilityLabel="My Listings"
          accessibilityState={{ selected: listingFilter === 'mine' }}
        >
          <Text
            style={[
              styles.segmentText,
              { color: colors.textMuted },
              listingFilter === 'mine' && { color: colors.primary },
            ]}
          >
            My Listings
          </Text>
        </Pressable>
      </View>

      {/* Listings Grid */}
      <FlatList
        data={filteredPosts}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        numColumns={2}
        columnWrapperStyle={styles.grid}
        keyExtractor={(item) => item.id}
        onEndReached={onLoadMore}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        renderItem={({ item }) => (
          <Pressable
            key={item.id}
            style={[
              styles.card,
              { width: cardWidth, backgroundColor: colors.surface },
              isDark && { borderWidth: 1, borderColor: colors.border },
            ]}
            onPress={() =>
              router.push({ pathname: '/bazaar/[id]', params: { id: item.id } })
            }
          >
            <View style={styles.cardImageContainer}>
              {item.photo_url ? (
                <Image
                  source={{ uri: item.photo_url }}
                  style={styles.cardImage}
                  contentFit="cover"
                  transition={200}
                />
              ) : (
                <View style={[styles.cardImagePlaceholder, { backgroundColor: colors.backgroundAlt }]}>
                  <FontAwesome name="image" size={32} color={colors.textMuted} />
                </View>
              )}
              {/* Price Badge */}
              <View style={[styles.priceBadge, { backgroundColor: item.status === 'sold' ? colors.textMuted : colors.primary }]}>
                <Text style={[styles.priceBadgeText, { color: colors.white }]}>
                  {formatPrice(item.price, item.currency)}
                </Text>
              </View>
              {/* Sold Badge Overlay */}
              {item.status === 'sold' && (
                <View style={styles.soldOverlay}>
                  <View style={[styles.soldBadge, { backgroundColor: colors.error }]}>
                    <Text style={styles.soldBadgeText}>SOLD</Text>
                  </View>
                </View>
              )}
            </View>
            <View style={styles.cardContent}>
              <Text style={[styles.cardTitle, { color: colors.textPrimary }]} numberOfLines={2}>
                {item.title}
              </Text>
              <View style={styles.cardMeta}>
                {item.city && (
                  <View style={styles.cardMetaRow}>
                    <FontAwesome
                      name="map-marker"
                      size={12}
                      color={colors.textMuted}
                    />
                    <Text style={[styles.cardMetaText, { color: colors.textMuted }]} numberOfLines={1}>
                      {item.city}
                    </Text>
                  </View>
                )}
                <Text style={[styles.cardTime, { color: colors.textDisabled }]}>
                  {formatRelativeTime(item.created_at)}
                </Text>
              </View>
            </View>
          </Pressable>
        )}
        ListFooterComponent={
          loading && !refreshing ? (
            <ActivityIndicator style={styles.loader} color={colors.primary} />
          ) : (
            <View style={{ height: insets.bottom + 80 }} />
          )
        }
        ListEmptyComponent={renderEmptyState()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 12,
    gap: 10,
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  unreadBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  clearButton: {
    padding: 4,
  },
  segmentedControl: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 4,
    borderRadius: 12,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  segmentButtonActive: {
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  segmentText: {
    fontSize: 15,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  cardImageContainer: {
    position: 'relative',
    height: 140,
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardImagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  priceBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  priceBadgeText: {
    fontSize: 14,
    fontWeight: '700',
  },
  soldOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  soldBadge: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 4,
    transform: [{ rotate: '-15deg' }],
  },
  soldBadgeText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1,
  },
  cardContent: {
    padding: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
    marginBottom: 8,
  },
  cardMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  cardMetaText: {
    fontSize: 13,
    flex: 1,
  },
  cardTime: {
    fontSize: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 19,
    fontWeight: '600',
    marginTop: 8,
  },
  emptyText: {
    fontSize: 15,
    textAlign: 'center',
  },
  emptyButton: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  emptyButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  loader: {
    paddingVertical: 20,
  },
});
