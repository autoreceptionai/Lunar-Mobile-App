import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ReportModal from '@/components/ReportModal';
import { useTheme } from '@/contexts/ThemeContext';
import { useSession } from '@/hooks/useSession';
import { supabase } from '@/lib/supabase';
import type { BazaarConversation, BazaarMessage, BazaarPost, Profile } from '@/lib/types';
import { getDisplayName, getInitials } from '@/lib/types';

// Helper to format message time
const formatMessageTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  
  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

export default function ChatScreen() {
  const { id: conversationId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useSession();
  const { colors, isDark } = useTheme();
  const flatListRef = useRef<FlatList>(null);

  const [conversation, setConversation] = useState<BazaarConversation | null>(null);
  const [otherProfile, setOtherProfile] = useState<Profile | null>(null);
  const [post, setPost] = useState<BazaarPost | null>(null);
  const [messages, setMessages] = useState<BazaarMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);

  useEffect(() => {
    if (conversationId && user) {
      loadConversation();
      loadMessages();
      markMessagesAsRead();

      // Subscribe to new messages
      const subscription = supabase
        .channel(`messages:${conversationId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'bazaar_messages',
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload) => {
            const newMsg = payload.new as BazaarMessage;
            setMessages((prev) => [...prev, newMsg]);
            // Mark as read if not from current user
            if (newMsg.sender_id !== user.id) {
              markMessageAsRead(newMsg.id);
            }
          }
        )
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [conversationId, user]);

  const loadConversation = async () => {
    const { data, error } = await supabase
      .from('bazaar_conversations')
      .select('*')
      .eq('id', conversationId)
      .single();

    if (error || !data) {
      router.back();
      return;
    }

    setConversation(data);

    // Load other user's profile
    const otherUserId = data.buyer_id === user?.id ? data.seller_id : data.buyer_id;
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', otherUserId)
      .single();
    setOtherProfile(profileData);

    // Load post
    const { data: postData } = await supabase
      .from('bazaar_posts')
      .select('*')
      .eq('id', data.post_id)
      .single();
    setPost(postData);
  };

  const loadMessages = async () => {
    const { data, error } = await supabase
      .from('bazaar_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (!error && data) {
      setMessages(data);
    }
    setLoading(false);
  };

  const markMessagesAsRead = async () => {
    if (!user) return;
    await supabase
      .from('bazaar_messages')
      .update({ is_read: true })
      .eq('conversation_id', conversationId)
      .neq('sender_id', user.id)
      .eq('is_read', false);
  };

  const markMessageAsRead = async (messageId: string) => {
    await supabase
      .from('bazaar_messages')
      .update({ is_read: true })
      .eq('id', messageId);
  };

  const sendMessage = async () => {
    if (!user || !newMessage.trim() || sending) return;

    setSending(true);
    const messageContent = newMessage.trim();
    setNewMessage('');

    const { error } = await supabase.from('bazaar_messages').insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: messageContent,
    });

    setSending(false);

    if (error) {
      setNewMessage(messageContent);
    }
  };

  const renderMessage = ({ item }: { item: BazaarMessage }) => {
    const isOwnMessage = item.sender_id === user?.id;

    return (
      <View style={[styles.messageContainer, isOwnMessage && styles.ownMessageContainer]}>
        <View
          style={[
            styles.messageBubble,
            isOwnMessage
              ? [styles.ownMessageBubble, { backgroundColor: colors.primary }]
              : [styles.otherMessageBubble, { backgroundColor: colors.surface }],
            isDark && !isOwnMessage && { borderWidth: 1, borderColor: colors.border },
          ]}
        >
          <Text
            style={[
              styles.messageText,
              { color: isOwnMessage ? colors.white : colors.textPrimary },
            ]}
          >
            {item.content}
          </Text>
          <Text
            style={[
              styles.messageTime,
              { color: isOwnMessage ? 'rgba(255,255,255,0.7)' : colors.textMuted },
            ]}
          >
            {formatMessageTime(item.created_at)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={[styles.backButton, { backgroundColor: colors.background }]}>
          <FontAwesome name="arrow-left" size={20} color={colors.textPrimary} />
        </Pressable>
        
        <Pressable 
          style={styles.headerContent}
          onPress={() => post && router.push(`/bazaar/${post.id}`)}
        >
          <View style={[styles.headerAvatar, { backgroundColor: colors.primaryLight }]}>
            <Text style={[styles.headerAvatarText, { color: colors.primary }]}>
              {getInitials(otherProfile)}
            </Text>
          </View>
          <View style={styles.headerInfo}>
            <Text style={[styles.headerName, { color: colors.textPrimary }]} numberOfLines={1}>
              {getDisplayName(otherProfile)}
            </Text>
            {post && (
              <Text style={[styles.headerPost, { color: colors.textMuted }]} numberOfLines={1}>
                {post.title}
              </Text>
            )}
          </View>
        </Pressable>

        <View style={styles.headerSpacer} />
      </View>

      {/* Messages */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
          onLayout={() => flatListRef.current?.scrollToEnd()}
          ListEmptyComponent={
            <View style={styles.emptyMessages}>
              <FontAwesome name="comments-o" size={40} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                Start the conversation
              </Text>
            </View>
          }
        />
      )}

      {otherProfile && (
        <ReportModal
          visible={reportModalVisible}
          onClose={() => setReportModalVisible(false)}
          targetType="user"
          targetId={otherProfile.id}
        />
      )}

      {/* Input */}
      <View style={[styles.inputContainer, { backgroundColor: colors.surface, paddingBottom: insets.bottom + 8 }]}>
        <TextInput
          style={[
            styles.textInput,
            { backgroundColor: colors.background, color: colors.textPrimary, borderColor: colors.border },
          ]}
          placeholder="Type a message..."
          placeholderTextColor={colors.textMuted}
          value={newMessage}
          onChangeText={setNewMessage}
          multiline
          maxLength={1000}
        />
        <Pressable
          style={[
            styles.sendButton,
            { backgroundColor: colors.primary },
            (!newMessage.trim() || sending) && styles.sendButtonDisabled,
          ]}
          onPress={sendMessage}
          disabled={!newMessage.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <FontAwesome name="send" size={18} color={colors.white} />
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
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
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  headerAvatarText: {
    fontSize: 16,
    fontWeight: '700',
  },
  headerInfo: {
    flex: 1,
  },
  headerName: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerPost: {
    fontSize: 13,
  },
  reportButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    textAlign: 'center',
    marginTop: 100,
    fontSize: 16,
  },
  messagesList: {
    padding: 16,
    flexGrow: 1,
  },
  emptyMessages: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
  },
  messageContainer: {
    marginBottom: 8,
    flexDirection: 'row',
  },
  ownMessageContainer: {
    justifyContent: 'flex-end',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 18,
  },
  ownMessageBubble: {
    borderBottomRightRadius: 4,
  },
  otherMessageBubble: {
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  textInput: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});
