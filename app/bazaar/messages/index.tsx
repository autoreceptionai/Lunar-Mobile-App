import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/contexts/ThemeContext';
import { useSession } from '@/hooks/useSession';
import { supabase } from '@/lib/supabase';
import type { BazaarConversation, BazaarMessage, BazaarPost, Profile } from '@/lib/types';
import { getDisplayName, getInitials } from '@/lib/types';

// Helper to format relative time
const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString();
};

type ConversationWithDetails = BazaarConversation & {
  post: BazaarPost;
  other_profile: Profile;
  last_message: BazaarMessage | null;
  unread_count: number;
};

export default function ConversationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useSession();
  const { colors, isDark } = useTheme();

  const [conversations, setConversations] = useState<ConversationWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 10;

  useFocusEffect(
    useCallback(() => {
      if (user) {
        loadConversations();
      }
    }, [user])
  );

  const loadConversations = async (pageNum = 0, shouldRefresh = false) => {
    if (!user) return;
    if (loading && !shouldRefresh) return;
    if (!hasMore && !shouldRefresh) return;

    setLoading(true);
    const from = pageNum * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    // Load conversations with joined details
    const { data: convData, error } = await supabase
      .from('bazaar_conversations')
      .select(`
        *,
        post:bazaar_posts(*),
        buyer:profiles!buyer_id(*),
        seller:profiles!seller_id(*),
        last_message:bazaar_messages(content, created_at, sender_id)
      `)
      .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
      .order('last_message_at', { ascending: false })
      .range(from, to);

    // Note: Supabase doesn't easily support "limit 1" on a joined collection in a single query
    // without a View or RPC. We'll still need to handle the last message specifically 
    // or use a View. For now, let's optimize the main joins.

    if (error) {
      console.error('Error loading conversations:', error);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (!convData || convData.length === 0) {
      if (shouldRefresh) setConversations([]);
      setHasMore(false);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    // Load related data for each conversation
    const conversationsWithDetails: ConversationWithDetails[] = [];

    for (const conv of convData) {
      const isBuyer = conv.buyer_id === user.id;
      const otherProfile = isBuyer ? conv.seller : conv.buyer;
      
      // Get the actual last message from the array (if any)
      const lastMsg = Array.isArray(conv.last_message) && conv.last_message.length > 0
        ? (conv.last_message as any[]).sort((a, b) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )[0]
        : null;

      // We still need unread count per conversation - this is better done with an RPC
      // but we can at least skip the post and profile queries now.
      const { count } = await supabase
        .from('bazaar_messages')
        .select('*', { count: 'exact', head: true })
        .eq('conversation_id', conv.id)
        .eq('is_read', false)
        .neq('sender_id', user.id);

      if (conv.post && otherProfile) {
        conversationsWithDetails.push({
          ...conv,
          post: conv.post,
          other_profile: otherProfile,
          last_message: lastMsg,
          unread_count: count || 0,
        });
      }
    }

    if (shouldRefresh) {
      setConversations(conversationsWithDetails);
      setPage(0);
    } else {
      setConversations((prev) => [...prev, ...conversationsWithDetails]);
      setPage(pageNum);
    }
    setHasMore(convData.length === PAGE_SIZE);
    setLoading(false);
    setRefreshing(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadConversations(0, true);
  };

  const onLoadMore = () => {
    if (!loading && hasMore) {
      loadConversations(page + 1);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border, paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={[styles.backButton, { backgroundColor: colors.background }]}>
          <FontAwesome name="arrow-left" size={20} color={colors.textPrimary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Messages</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : conversations.length === 0 ? (
        <View style={styles.emptyContainer}>
          <FontAwesome name="comments-o" size={48} color={colors.textMuted} />
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No messages yet</Text>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            Start a conversation by messaging a seller
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        >
          {conversations.map((conv) => (
            <Pressable
              key={conv.id}
              style={[
                styles.conversationItem,
                { backgroundColor: colors.surface },
                isDark && { borderBottomColor: colors.border, borderBottomWidth: 1 },
              ]}
              onPress={() => router.push(`/bazaar/messages/${conv.id}`)}
            >
              {/* Avatar */}
              <View style={[styles.avatar, { backgroundColor: colors.primaryLight }]}>
                <Text style={[styles.avatarText, { color: colors.primary }]}>
                  {getInitials(conv.other_profile)}
                </Text>
              </View>

              {/* Content */}
              <View style={styles.conversationContent}>
                <View style={styles.conversationHeader}>
                  <Text style={[styles.userName, { color: colors.textPrimary }]} numberOfLines={1}>
                    {getDisplayName(conv.other_profile)}
                  </Text>
                  <Text style={[styles.timeText, { color: colors.textMuted }]}>
                    {formatRelativeTime(conv.last_message?.created_at || conv.created_at)}
                  </Text>
                </View>
                <Text style={[styles.postTitle, { color: colors.textMuted }]} numberOfLines={1}>
                  {conv.post.title}
                </Text>
                {conv.last_message && (
                  <Text
                    style={[
                      styles.lastMessage,
                      { color: conv.unread_count > 0 ? colors.textPrimary : colors.textSecondary },
                      conv.unread_count > 0 && styles.lastMessageUnread,
                    ]}
                    numberOfLines={1}
                  >
                    {conv.last_message.sender_id === user.id ? 'You: ' : ''}
                    {conv.last_message.content}
                  </Text>
                )}
              </View>

              {/* Unread Badge */}
              {conv.unread_count > 0 && (
                <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]}>
                  <Text style={[styles.unreadBadgeText, { color: colors.white }]}>
                    {conv.unread_count > 9 ? '9+' : conv.unread_count}
                  </Text>
                </View>
              )}

              {/* Post Thumbnail */}
              {conv.post.photo_url && (
                <Image 
                  source={{ uri: conv.post.photo_url }} 
                  style={styles.postThumbnail} 
                  contentFit="cover"
                  transition={200}
                />
              )}
            </Pressable>
          ))}
          <View style={{ height: insets.bottom + 20 }} />
        </ScrollView>
      )}
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  signInButton: {
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  signInButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  timeText: {
    fontSize: 12,
    marginLeft: 8,
  },
  postTitle: {
    fontSize: 13,
    marginBottom: 2,
  },
  lastMessage: {
    fontSize: 14,
  },
  lastMessageUnread: {
    fontWeight: '600',
  },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  postThumbnail: {
    width: 50,
    height: 50,
    borderRadius: 8,
  },
  loader: {
    paddingVertical: 20,
  },
});
