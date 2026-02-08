import FontAwesome from '@expo/vector-icons/FontAwesome';
import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { Image } from 'expo-image';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import TabHeader from '@/components/TabHeader';
import { gradients } from '@/constants/Brand';
import { useTheme } from '@/contexts/ThemeContext';
import { useSession } from '@/hooks/useSession';
import { supabase } from '@/lib/supabase';
import type { Space, SpaceAnnouncement } from '@/lib/types';

export default function SpacesScreen() {
  const router = useRouter();
  const { user } = useSession();
  const { colors, isDark, theme } = useTheme();
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 10;
  const [viewMode, setViewMode] = useState<'mine' | 'find'>('mine');
  const [memberships, setMemberships] = useState<Record<string, boolean>>({});
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});
  const [latestAnnouncements, setLatestAnnouncements] = useState<
    Record<string, SpaceAnnouncement>
  >({});
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const categories = ['All', 'MSA', 'Mosque', 'Non-Profit', 'Islamic Education', 'Business'];

  // Bottom sheet
  const categorySheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['50%'], []);

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

  const mySpaces = useMemo(() => {
    if (!user) return [];
    return spaces.filter((space) => memberships[space.id]);
  }, [spaces, user, memberships]);

  const findSpaces = useMemo(() => {
    if (!user) return spaces;
    const myIds = new Set(mySpaces.map((space) => space.id));
    return spaces.filter((space) => !myIds.has(space.id));
  }, [spaces, user, mySpaces]);

  const visibleSpaces = viewMode === 'mine' ? mySpaces : findSpaces;

  const categoryFilteredSpaces = useMemo(() => {
    if (selectedCategory === 'All') return visibleSpaces;
    return visibleSpaces.filter((space) => space.org_type === selectedCategory);
  }, [visibleSpaces, selectedCategory]);

  const dedupedSpaces = useMemo(() => {
    const map = new Map<string, Space>();
    categoryFilteredSpaces.forEach((space) => {
      if (!map.has(space.id)) {
        map.set(space.id, space);
      }
    });
    return Array.from(map.values());
  }, [categoryFilteredSpaces]);

  useEffect(() => {
    loadSpaces();
  }, []);

  useFocusEffect(
    useCallback(() => {
      onRefresh();
      if (user) {
        loadMemberships(user.id);
      }
    }, [user])
  );

  useEffect(() => {
    if (user) {
      loadMemberships(user.id);
    } else {
      setMemberships({});
    }
  }, [user]);

  useEffect(() => {
    if (viewMode === 'mine') {
      loadLatestAnnouncements(mySpaces.map((space) => space.id));
    }
  }, [viewMode, mySpaces]);

  useEffect(() => {
    if (spaces.length > 0) {
      loadMemberCounts(spaces.map((s) => s.id));
    }
  }, [spaces]);

  const loadSpaces = async (pageNum = 0, shouldRefresh = false) => {
    if (loading || (!hasMore && !shouldRefresh)) return;
    
    setLoading(true);
    const from = pageNum * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    // Use a single query with joins if possible, or batch requests
    const { data, error } = await supabase
      .from('spaces')
      .select(`
        *,
        member_count:space_members(count)
      `)
      .order('created_at', { ascending: false })
      .range(from, to);

    setLoading(false);
    setRefreshing(false);

    if (error) {
      Alert.alert('Unable to load spaces', error.message);
      return;
    }

    if (data) {
      // Process member counts from the joined count
      const counts: Record<string, number> = {};
      data.forEach((s: any) => {
        counts[s.id] = s.member_count?.[0]?.count || 0;
      });
      setMemberCounts((prev) => ({ ...prev, ...counts }));

      if (shouldRefresh) {
        setSpaces(data);
        setPage(0);
        setHasMore(data.length === PAGE_SIZE);
      } else {
        setSpaces((prev) => [...prev, ...data]);
        setPage(pageNum);
        setHasMore(data.length === PAGE_SIZE);
      }
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadSpaces(0, true);
  };

  const onLoadMore = () => {
    if (!loading && hasMore) {
      loadSpaces(page + 1);
    }
  };

  const loadMemberships = async (userId: string) => {
    const { data, error } = await supabase
      .from('space_members')
      .select('space_id')
      .eq('user_id', userId);
    if (error) {
      return;
    }
    const nextMemberships: Record<string, boolean> = {};
    data?.forEach((row) => {
      nextMemberships[row.space_id] = true;
    });
    setMemberships(nextMemberships);
  };

  const loadMemberCounts = async (spaceIds: string[]) => {
    if (!spaceIds.length) return;
    const { data, error } = await supabase
      .from('space_members')
      .select('space_id')
      .in('space_id', spaceIds);
    if (error) return;
    const counts: Record<string, number> = {};
    data?.forEach((row) => {
      counts[row.space_id] = (counts[row.space_id] || 0) + 1;
    });
    setMemberCounts(counts);
  };

  const loadLatestAnnouncements = async (spaceIds: string[]) => {
    if (!spaceIds.length) {
      setLatestAnnouncements({});
      return;
    }
    const { data, error } = await supabase
      .from('space_announcements')
      .select('id, space_id, title, body, created_at')
      .in('space_id', spaceIds)
      .order('created_at', { ascending: false });
    if (error) {
      return;
    }
    const next: Record<string, SpaceAnnouncement> = {};
    data?.forEach((announcement) => {
      if (!next[announcement.space_id]) {
        next[announcement.space_id] = announcement as SpaceAnnouncement;
      }
    });
    setLatestAnnouncements(next);
  };

  const handleFollow = async (spaceId: string) => {
    if (!user) return;
    const isFollowing = memberships[spaceId];
    if (isFollowing) {
      const { error } = await supabase
        .from('space_members')
        .delete()
        .eq('space_id', spaceId)
        .eq('user_id', user.id);
      if (error) {
        Alert.alert('Unable to leave', error.message);
        return;
      }
      setMemberships((prev) => {
        const next = { ...prev };
        delete next[spaceId];
        return next;
      });
      setMemberCounts((prev) => ({
        ...prev,
        [spaceId]: Math.max(0, (prev[spaceId] || 1) - 1),
      }));
      return;
    }

    const { error } = await supabase.from('space_members').insert({
      space_id: spaceId,
      user_id: user.id,
    });
    if (error) {
      Alert.alert('Unable to join', error.message);
      return;
    }
    setMemberships((prev) => ({ ...prev, [spaceId]: true }));
    setMemberCounts((prev) => ({
      ...prev,
      [spaceId]: (prev[spaceId] || 0) + 1,
    }));
  };

  const selectCategory = (category: string) => {
    setSelectedCategory(category);
    categorySheetRef.current?.close();
  };

  // Dynamic styles based on theme
  const dynamicStyles = {
    container: {
      backgroundColor: colors.background,
    },
    createButton: {
      borderColor: colors.primary,
      backgroundColor: colors.surface,
    },
    createButtonText: {
      color: colors.primary,
    },
    segmentedControl: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
    },
    segmentTab: {
      // base styles
    },
    segmentTabActive: {
      backgroundColor: colors.primary,
    },
    segmentText: {
      color: colors.primary,
    },
    segmentTextActive: {
      color: colors.white,
    },
    filterButton: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
    },
    filterButtonText: {
      color: colors.textPrimary,
    },
    spaceCard: {
      backgroundColor: colors.surface,
      ...(isDark && {
        borderWidth: 1,
        borderColor: colors.border,
      }),
    },
    cardTitle: {
      color: colors.textPrimary,
    },
    cardDescription: {
      color: colors.textSecondary,
    },
    metaText: {
      color: colors.textMuted,
    },
    announcementBanner: {
      backgroundColor: colors.primaryLight,
    },
    emptyTitle: {
      color: colors.textPrimary,
    },
    emptySubtitle: {
      color: colors.textMuted,
    },
    sheetBackground: {
      backgroundColor: colors.surface,
    },
    sheetHandle: {
      backgroundColor: colors.border,
    },
    sheetTitle: {
      color: colors.textPrimary,
    },
    sheetOption: {
      backgroundColor: colors.backgroundAlt,
    },
    sheetOptionActive: {
      backgroundColor: colors.primaryLight,
    },
    sheetOptionText: {
      color: colors.textSecondary,
    },
  };

  return (
    <GestureHandlerRootView style={[styles.container, dynamicStyles.container]}>
      <TabHeader title="Spaces" />

      {/* Segmented Tabs */}
      <View style={[styles.segmentedControl, dynamicStyles.segmentedControl]}>
        <Pressable
          style={[
            styles.segmentTab,
            viewMode === 'mine' && [styles.segmentTabActive, dynamicStyles.segmentTabActive],
          ]}
          onPress={() => setViewMode('mine')}
          accessibilityRole="tab"
          accessibilityLabel="My Spaces"
          accessibilityState={{ selected: viewMode === 'mine' }}>
          <Text
            style={[
              styles.segmentText,
              dynamicStyles.segmentText,
              viewMode === 'mine' && [styles.segmentTextActive, dynamicStyles.segmentTextActive],
            ]}>
            My Spaces
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.segmentTab,
            viewMode === 'find' && [styles.segmentTabActive, dynamicStyles.segmentTabActive],
          ]}
          onPress={() => setViewMode('find')}
          accessibilityRole="tab"
          accessibilityLabel="Find Spaces"
          accessibilityState={{ selected: viewMode === 'find' }}>
          <Text
            style={[
              styles.segmentText,
              dynamicStyles.segmentText,
              viewMode === 'find' && [styles.segmentTextActive, dynamicStyles.segmentTextActive],
            ]}>
            Find Spaces
          </Text>
        </Pressable>
      </View>

      {/* Filter Row with Create Button */}
      <View style={styles.filterRow}>
        <Pressable
          style={[styles.filterButton, dynamicStyles.filterButton]}
          onPress={() => categorySheetRef.current?.expand()}
          accessibilityRole="button"
          accessibilityLabel="Filter by Category"
          accessibilityHint="Opens a list of categories to filter spaces">
          <FontAwesome name="filter" size={14} color={colors.primary} />
          <Text style={[styles.filterButtonText, dynamicStyles.filterButtonText]}>
            {selectedCategory === 'All' ? 'Category' : selectedCategory}
          </Text>
          <FontAwesome name="chevron-down" size={12} color={colors.textMuted} />
        </Pressable>
        {selectedCategory !== 'All' && (
          <Pressable
            style={styles.clearButton}
            onPress={() => setSelectedCategory('All')}
            accessibilityRole="button"
            accessibilityLabel="Clear Filter">
            <Text style={[styles.clearButtonText, { color: colors.primary }]}>Clear</Text>
          </Pressable>
        )}
        <Pressable
          style={[styles.createButton, dynamicStyles.createButton]}
          onPress={() => router.push('/spaces/create')}
          accessibilityRole="button"
          accessibilityLabel="Create Space"
          accessibilityHint="Navigate to create a new space screen">
          <FontAwesome name="plus" size={12} color={colors.primary} />
          <Text style={[styles.createButtonText, dynamicStyles.createButtonText]}>Create</Text>
        </Pressable>
      </View>

      {/* Space Cards List */}
      <FlatList
        data={dedupedSpaces}
        style={styles.listContainer}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        renderItem={({ item: space }) => (
          <Pressable
            style={[styles.spaceCard, dynamicStyles.spaceCard]}
            onPress={() => router.push(`/spaces/${space.id}`)}
            accessibilityRole="button"
            accessibilityLabel={`${space.name} space`}
            accessibilityHint={`View details for ${space.name}`}>
            {/* Cover Image */}
            {space.cover_image_url ? (
              <Image
                source={{ uri: space.cover_image_url }}
                style={styles.cardCover}
                contentFit="cover"
                transition={200}
              />
            ) : (
              <LinearGradient
                colors={gradients.brand}
                style={styles.cardCoverPlaceholder}>
                <FontAwesome name="group" size={32} color="rgba(255,255,255,0.5)" />
              </LinearGradient>
            )}

            {/* Card Content */}
            <View style={styles.cardBody}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleRow}>
                  <Text style={[styles.cardTitle, dynamicStyles.cardTitle]} numberOfLines={1}>
                    {space.name}
                  </Text>
                  {!!space.org_type && (
                    <View style={[styles.orgBadge, { backgroundColor: colors.primaryLight }]}>
                      <Text style={[styles.orgBadgeText, { color: colors.primary }]}>{space.org_type}</Text>
                    </View>
                  )}
                </View>
              </View>

              {!!space.description && (
                <Text style={[styles.cardDescription, dynamicStyles.cardDescription]} numberOfLines={2}>
                  {space.description}
                </Text>
              )}

              {/* Announcement Preview (My Spaces only) */}
              {viewMode === 'mine' && latestAnnouncements[space.id] && (
                <View style={[styles.announcementBanner, dynamicStyles.announcementBanner]}>
                  <View style={[styles.announcementDot, { backgroundColor: colors.primary }]} />
                  <Text style={[styles.announcementText, { color: colors.primaryDark }]} numberOfLines={1}>
                    {latestAnnouncements[space.id].title}
                  </Text>
                </View>
              )}

              {/* Meta Row with Join Button */}
              <View style={styles.cardMeta}>
                <View style={styles.cardMetaLeft}>
                  {!!space.address && (
                    <View style={styles.metaItem}>
                      <FontAwesome name="map-marker" size={12} color={colors.textMuted} />
                      <Text style={[styles.metaText, dynamicStyles.metaText]} numberOfLines={1}>
                        {space.address}
                      </Text>
                    </View>
                  )}
                  <View style={styles.metaItem}>
                    <FontAwesome name="users" size={12} color={colors.textMuted} />
                    <Text style={[styles.metaText, dynamicStyles.metaText]}>
                      {memberCounts[space.id] || 0}
                    </Text>
                  </View>
                </View>
                <Pressable
                  style={[
                    styles.joinButton,
                    { backgroundColor: colors.primary },
                    memberships[space.id] && [styles.leaveButton, { backgroundColor: colors.surface, borderColor: colors.error }],
                  ]}
                  onPress={(e) => {
                    e.stopPropagation?.();
                    handleFollow(space.id);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={memberships[space.id] ? `Leave ${space.name}` : `Join ${space.name}`}>
                  <Text
                    style={[
                      styles.joinButtonText,
                      { color: colors.white },
                      memberships[space.id] && [styles.leaveButtonText, { color: colors.error }],
                    ]}>
                    {memberships[space.id] ? 'Leave' : 'Join'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        )}
        onEndReached={onLoadMore}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListFooterComponent={
          loading && !refreshing ? (
            <ActivityIndicator style={styles.loader} color={colors.primary} />
          ) : null
        }
        ListEmptyComponent={
          !loading && dedupedSpaces.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.primaryLight }]}>
                <FontAwesome name="moon-o" size={48} color={colors.primary} />
              </View>
              <Text style={[styles.emptyTitle, dynamicStyles.emptyTitle]}>
                {viewMode === 'mine'
                  ? 'The night has no stars'
                  : 'No new stars on the horizon'}
              </Text>
              <Text style={[styles.emptySubtitle, dynamicStyles.emptySubtitle]}>
                {viewMode === 'mine'
                  ? 'Join a space to light up your sky'
                  : 'Be the first to create a space for your community'}
              </Text>
            </View>
          ) : null
        }
      />

      {/* Category Bottom Sheet */}
      <BottomSheet
        ref={categorySheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        backgroundStyle={[styles.sheetBackground, dynamicStyles.sheetBackground]}
        handleIndicatorStyle={[styles.sheetHandle, dynamicStyles.sheetHandle]}>
        <BottomSheetView style={styles.sheetContent}>
          <Text style={[styles.sheetTitle, dynamicStyles.sheetTitle]}>Filter by Category</Text>
          {categories.map((category) => (
            <Pressable
              key={category}
              style={[
                styles.sheetOption,
                dynamicStyles.sheetOption,
                selectedCategory === category && [styles.sheetOptionActive, dynamicStyles.sheetOptionActive],
              ]}
              onPress={() => selectCategory(category)}>
              <Text
                style={[
                  styles.sheetOptionText,
                  dynamicStyles.sheetOptionText,
                  selectedCategory === category && styles.sheetOptionTextActive,
                ]}>
                {category}
              </Text>
              {selectedCategory === category && (
                <FontAwesome name="check" size={16} color={colors.primary} />
              )}
            </Pressable>
          ))}
        </BottomSheetView>
      </BottomSheet>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  createButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  segmentedControl: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  segmentTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentTabActive: {
    // backgroundColor set dynamically
  },
  segmentText: {
    fontSize: 15,
    fontWeight: '600',
  },
  segmentTextActive: {
    // color set dynamically
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  filterButtonText: {
    fontSize: 15,
    fontWeight: '500',
  },
  clearButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  clearButtonText: {
    fontSize: 15,
    fontWeight: '500',
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
    gap: 16,
  },
  spaceCard: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardCover: {
    width: '100%',
    height: 120,
  },
  cardCoverPlaceholder: {
    width: '100%',
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    flexWrap: 'wrap',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    flexShrink: 1,
  },
  orgBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 999,
  },
  orgBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardDescription: {
    fontSize: 15,
    marginTop: 6,
    lineHeight: 20,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  cardMetaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 13,
  },
  announcementBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  announcementDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  announcementText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  joinButton: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 999,
  },
  joinButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  leaveButton: {
    borderWidth: 1.5,
  },
  leaveButtonText: {
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 19,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 15,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  loader: {
    paddingVertical: 20,
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
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  sheetOptionActive: {
    // backgroundColor set dynamically
  },
  sheetOptionText: {
    fontSize: 16,
  },
  sheetOptionTextActive: {
    fontWeight: '600',
  },
});
