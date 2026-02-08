import FontAwesome from '@expo/vector-icons/FontAwesome';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Modal,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    View,
} from 'react-native';

import { brand } from '@/constants/Brand';
import { useTheme } from '@/contexts/ThemeContext';
import ReportModal from '@/components/ReportModal';
import { useSession } from '@/hooks/useSession';
import { supabase } from '@/lib/supabase';
import type { Space, SpaceAnnouncement, SpaceEvent } from '@/lib/types';

export default function SpaceDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useSession();
  const { colors, isDark } = useTheme();
  const [space, setSpace] = useState<Space | null>(null);
  const [events, setEvents] = useState<SpaceEvent[]>([]);
  const [announcements, setAnnouncements] = useState<SpaceAnnouncement[]>([]);
  const [spaceAdmins, setSpaceAdmins] = useState<Array<{ user_id: string; role: string | null }>>(
    []
  );
  const [spaceMembers, setSpaceMembers] = useState<Array<{ user_id: string }>>([]);
  const [eventTitle, setEventTitle] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventDate, setEventDate] = useState<Date | null>(null);
  const [eventTimeSlot, setEventTimeSlot] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementBody, setAnnouncementBody] = useState('');
  const [editingAnnouncementId, setEditingAnnouncementId] = useState<string | null>(null);
  const [editingAnnouncementTitle, setEditingAnnouncementTitle] = useState('');
  const [editingAnnouncementBody, setEditingAnnouncementBody] = useState('');
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editingEventTitle, setEditingEventTitle] = useState('');
  const [editingEventDescription, setEditingEventDescription] = useState('');
  const [editingEventDate, setEditingEventDate] = useState<Date | null>(null);
  const [editingEventTimeSlot, setEditingEventTimeSlot] = useState('');
  const [editingEventLocation, setEditingEventLocation] = useState('');
  const [notifyMembers, setNotifyMembers] = useState(true);
  const [activeTab, setActiveTab] = useState<'announcements' | 'events'>('announcements');
  const [announcementFilter, setAnnouncementFilter] = useState<'all' | 'pinned'>('all');
  const [eventsView, setEventsView] = useState<'list' | 'calendar'>('list');
  const [dateTimePickerOpen, setDateTimePickerOpen] = useState(false);
  const [dateTimePickerTarget, setDateTimePickerTarget] = useState<'create' | 'edit' | null>(null);
  const [dateTimePickerMonth, setDateTimePickerMonth] = useState(new Date());
  const [dateTimePickerDate, setDateTimePickerDate] = useState<Date | null>(null);
  const [dateTimePickerTime, setDateTimePickerTime] = useState('');
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
  }, []);

  useEffect(() => {
    if (id) {
      loadSpaceDetails(id);
    }
  }, [id]);

  useEffect(() => {
    if (eventsView === 'calendar' && !selectedCalendarDate) {
      setSelectedCalendarDate(new Date());
    }
  }, [eventsView, selectedCalendarDate]);

  const timeSlots = useMemo(() => {
    const slots: string[] = [];
    for (let hour = 0; hour < 24; hour += 1) {
      for (let minute = 0; minute < 60; minute += 30) {
        const paddedHour = String(hour).padStart(2, '0');
        const paddedMinute = String(minute).padStart(2, '0');
        slots.push(`${paddedHour}:${paddedMinute}`);
      }
    }
    return slots;
  }, []);

  const formatDayKey = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const buildMonthMatrix = (baseDate: Date) => {
    const year = baseDate.getFullYear();
    const month = baseDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    const startWeekday = firstDayOfMonth.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const weeks: Array<Array<Date | null>> = [];
    let currentDay = 1 - startWeekday;
    while (currentDay <= daysInMonth) {
      const week: Array<Date | null> = [];
      for (let i = 0; i < 7; i += 1) {
        if (currentDay < 1 || currentDay > daysInMonth) {
          week.push(null);
        } else {
          week.push(new Date(year, month, currentDay));
        }
        currentDay += 1;
      }
      weeks.push(week);
    }
    return weeks;
  };

  const buildDateTime = (date: Date, timeSlot: string) => {
    const [hour, minute] = timeSlot.split(':').map((value) => Number(value));
    const next = new Date(date);
    next.setHours(hour, minute, 0, 0);
    return next;
  };

  const formatDateTimeLabel = (date: Date | null, timeSlot: string) => {
    if (!date || !timeSlot) return 'Select date & time';
    const localDate = buildDateTime(date, timeSlot);
    return localDate.toLocaleString();
  };

  const openDateTimePicker = (target: 'create' | 'edit') => {
    const baseDate = target === 'create' ? eventDate : editingEventDate;
    const baseTime = target === 'create' ? eventTimeSlot : editingEventTimeSlot;
    const nextDate = baseDate ?? new Date();
    setDateTimePickerTarget(target);
    setDateTimePickerDate(nextDate);
    setDateTimePickerTime(baseTime || '09:00');
    setDateTimePickerMonth(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1));
    setDateTimePickerOpen(true);
  };

  const applyDateTimePicker = () => {
    if (!dateTimePickerTarget || !dateTimePickerDate || !dateTimePickerTime) return;
    if (dateTimePickerTarget === 'create') {
      setEventDate(dateTimePickerDate);
      setEventTimeSlot(dateTimePickerTime);
    } else {
      setEditingEventDate(dateTimePickerDate);
      setEditingEventTimeSlot(dateTimePickerTime);
    }
    setDateTimePickerOpen(false);
  };

  const loadSpaceDetails = async (spaceId: string) => {
    setRefreshing(true);
    const [spaceResponse, eventsResponse, announcementsResponse, adminsResponse, membersResponse] =
      await Promise.all([
        supabase.from('spaces').select('*').eq('id', spaceId).single(),
        supabase
          .from('space_events')
          .select('*')
          .eq('space_id', spaceId)
          .order('event_time', { ascending: true }),
        supabase
          .from('space_announcements')
          .select('*')
          .eq('space_id', spaceId)
          .order('is_pinned', { ascending: false })
          .order('created_at', { ascending: false }),
        supabase
          .from('space_admins')
          .select('user_id, role')
          .eq('space_id', spaceId),
        supabase
          .from('space_members')
          .select('user_id')
          .eq('space_id', spaceId),
      ]);

    setRefreshing(false);
    if (spaceResponse.error) {
      Alert.alert('Unable to load space', spaceResponse.error.message);
      router.back();
      return;
    }
    setSpace(spaceResponse.data);

    if (eventsResponse.error) {
      Alert.alert('Unable to load events', eventsResponse.error.message);
    } else {
      setEvents(eventsResponse.data ?? []);
    }

    if (announcementsResponse.error) {
      Alert.alert('Unable to load announcements', announcementsResponse.error.message);
    } else {
      setAnnouncements(announcementsResponse.data ?? []);
    }

    if (!adminsResponse.error) {
      setSpaceAdmins(adminsResponse.data ?? []);
    } else {
      setSpaceAdmins([]);
    }

    if (!membersResponse.error) {
      setSpaceMembers(membersResponse.data ?? []);
    } else {
      setSpaceMembers([]);
    }
  };

  const handleDeleteSpace = async () => {
    if (!space) return;
    Alert.alert('Delete space?', 'This will remove the space and its content.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('spaces').delete().eq('id', space.id);
          if (error) {
            Alert.alert('Delete failed', error.message);
            return;
          }
          router.back();
        },
      },
    ]);
  };

  const handleJoinLeave = async () => {
    if (!user || !space) return;
    if (isMember) {
      const { error } = await supabase
        .from('space_members')
        .delete()
        .eq('space_id', space.id)
        .eq('user_id', user.id);
      if (error) {
        Alert.alert('Unable to leave', error.message);
        return;
      }
      loadSpaceDetails(space.id);
      return;
    }
    const { error } = await supabase.from('space_members').insert({
      space_id: space.id,
      user_id: user.id,
    });
    if (error) {
      Alert.alert('Unable to join', error.message);
      return;
    }
    loadSpaceDetails(space.id);
  };

  const adminIds = useMemo(() => {
    const ids = new Set<string>();
    spaceAdmins.forEach((admin) => ids.add(admin.user_id));
    if (space?.created_by) {
      ids.add(space.created_by);
    }
    return Array.from(ids);
  }, [spaceAdmins, space]);

  const memberIds = useMemo(() => {
    const admins = new Set(adminIds);
    return spaceMembers
      .map((member) => member.user_id)
      .filter((userId) => !admins.has(userId));
  }, [spaceMembers, adminIds]);

  const isMember = useMemo(() => {
    if (!user) return false;
    return spaceMembers.some((member) => member.user_id === user.id);
  }, [spaceMembers, user]);

  const isAdmin = useMemo(() => {
    if (!user) return false;
    return adminIds.includes(user.id);
  }, [adminIds, user]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, SpaceEvent[]>();
    events.forEach((event) => {
      if (!event.event_time) return;
      const dateKey = formatDayKey(new Date(event.event_time));
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)?.push(event);
    });
    return map;
  }, [events]);

  const selectedCalendarEvents = useMemo(() => {
    if (!selectedCalendarDate) return [];
    return eventsByDay.get(formatDayKey(selectedCalendarDate)) ?? [];
  }, [eventsByDay, selectedCalendarDate]);

  const visibleAnnouncements = useMemo(() => {
    if (announcementFilter === 'pinned') {
      return announcements.filter((announcement) => announcement.is_pinned);
    }
    return announcements;
  }, [announcements, announcementFilter]);

  const upcomingSections = useMemo(() => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const todayLabel = now.toDateString();
    const todayEvents = events.filter(
      (event) => event.event_time && new Date(event.event_time).toDateString() === todayLabel
    );
    const weekEvents = events.filter(
      (event) =>
        event.event_time &&
        new Date(event.event_time) > now &&
        new Date(event.event_time) <= endOfWeek
    );
    const monthEvents = events.filter(
      (event) =>
        event.event_time &&
        new Date(event.event_time) > endOfWeek &&
        new Date(event.event_time) <= endOfMonth
    );

    return [
      { label: 'Today', items: todayEvents },
      { label: 'This Week', items: weekEvents },
      { label: 'This Month', items: monthEvents },
    ];
  }, [events]);

  const handleCreateEvent = async () => {
    if (!user || !space) {
      Alert.alert('Missing info', 'Select a space first.');
      return;
    }
    if (!eventTitle.trim()) {
      Alert.alert('Missing info', 'Add an event title.');
      return;
    }
    if (!eventDate || !eventTimeSlot) {
      Alert.alert('Missing info', 'Select a date and time for the event.');
      return;
    }
    const parsedDate = buildDateTime(eventDate, eventTimeSlot);
    const { error } = await supabase.from('space_events').insert({
      space_id: space.id,
      title: eventTitle.trim(),
      description: eventDescription.trim() || null,
      event_time: parsedDate ? parsedDate.toISOString() : null,
      location: eventLocation.trim() || null,
      created_by: user.id,
    });
    if (error) {
      Alert.alert('Could not add event', error.message);
      return;
    }
    setEventTitle('');
    setEventDescription('');
    setEventDate(null);
    setEventTimeSlot('');
    setEventLocation('');
    setShowAddForm(false);
    loadSpaceDetails(space.id);
  };

  const handleEditEvent = (event: SpaceEvent) => {
    setEditingEventId(event.id);
    setEditingEventTitle(event.title);
    setEditingEventDescription(event.description ?? '');
    if (event.event_time) {
      const localDate = new Date(event.event_time);
      setEditingEventDate(localDate);
      setEditingEventTimeSlot(
        `${String(localDate.getHours()).padStart(2, '0')}:${String(localDate.getMinutes()).padStart(
          2,
          '0'
        )}`
      );
    } else {
      setEditingEventDate(null);
      setEditingEventTimeSlot('');
    }
    setEditingEventLocation(event.location ?? '');
  };

  const handleUpdateEvent = async () => {
    if (!editingEventId || !space) return;
    if (!editingEventTitle.trim()) {
      Alert.alert('Missing info', 'Add an event title.');
      return;
    }
    if (!editingEventDate || !editingEventTimeSlot) {
      Alert.alert('Missing info', 'Select a date and time for the event.');
      return;
    }
    const parsedDate = buildDateTime(editingEventDate, editingEventTimeSlot);
    const { error } = await supabase
      .from('space_events')
      .update({
        title: editingEventTitle.trim(),
        description: editingEventDescription.trim() || null,
        event_time: parsedDate ? parsedDate.toISOString() : null,
        location: editingEventLocation.trim() || null,
      })
      .eq('id', editingEventId);
    if (error) {
      Alert.alert('Unable to update event', error.message);
      return;
    }
    setEditingEventId(null);
    loadSpaceDetails(space.id);
  };

  const handleCreateAnnouncement = async () => {
    if (!user || !space) {
      Alert.alert('Missing info', 'Select a space first.');
      return;
    }
    if (!announcementTitle.trim() || !announcementBody.trim()) {
      Alert.alert('Missing info', 'Add a title and body.');
      return;
    }
    const { error } = await supabase.from('space_announcements').insert({
      space_id: space.id,
      title: announcementTitle.trim(),
      body: announcementBody.trim(),
      is_pinned: false,
      created_by: user.id,
    });
    if (error) {
      Alert.alert('Could not post announcement', error.message);
      return;
    }

    if (notifyMembers) {
      const permissions = await Notifications.requestPermissionsAsync();
      if (permissions.status === 'granted') {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: announcementTitle.trim(),
            body: announcementBody.trim(),
          },
          trigger: null,
        });
      }
    }

    setAnnouncementTitle('');
    setAnnouncementBody('');
    setShowAddForm(false);
    loadSpaceDetails(space.id);
  };

  const handleEditAnnouncement = (announcement: SpaceAnnouncement) => {
    setEditingAnnouncementId(announcement.id);
    setEditingAnnouncementTitle(announcement.title);
    setEditingAnnouncementBody(announcement.body);
  };

  const handleUpdateAnnouncement = async () => {
    if (!editingAnnouncementId || !space) return;
    if (!editingAnnouncementTitle.trim() || !editingAnnouncementBody.trim()) {
      Alert.alert('Missing info', 'Add a title and body.');
      return;
    }
    const { error } = await supabase
      .from('space_announcements')
      .update({
        title: editingAnnouncementTitle.trim(),
        body: editingAnnouncementBody.trim(),
      })
      .eq('id', editingAnnouncementId);
    if (error) {
      Alert.alert('Unable to update announcement', error.message);
      return;
    }
    setEditingAnnouncementId(null);
    loadSpaceDetails(space.id);
  };

  const handleTogglePin = async (announcement: SpaceAnnouncement) => {
    const { error } = await supabase
      .from('space_announcements')
      .update({ is_pinned: !announcement.is_pinned })
      .eq('id', announcement.id);
    if (error) {
      Alert.alert('Unable to update pin', error.message);
      return;
    }
    loadSpaceDetails(announcement.space_id);
  };

  const handleDeleteAnnouncement = async (announcementId: string) => {
    if (!space) return;
    const { error } = await supabase
      .from('space_announcements')
      .delete()
      .eq('id', announcementId);
    if (error) {
      Alert.alert('Unable to delete', error.message);
      return;
    }
    loadSpaceDetails(space.id);
  };

  const memberCount = adminIds.length + memberIds.length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: '', headerTransparent: true }} />
      {space ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadSpaceDetails(space.id)}
              tintColor={colors.primary}
            />
          }>
          {/* Hero Header */}
          <View style={styles.heroContainer}>
            {space.cover_image_url ? (
              <Image
                source={{ uri: space.cover_image_url }}
                style={styles.heroCover}
              />
            ) : (
              <LinearGradient
                colors={[colors.primary, colors.primaryDark]}
                style={styles.heroCover}
              />
            )}
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.35)', 'rgba(0,0,0,0.85)']}
              locations={[0, 0.4, 1]}
              style={styles.heroOverlay}
            />
            <View style={styles.heroContent}>
              <View style={styles.heroTitleRow}>
                <Text style={styles.heroTitle}>{space.name}</Text>
              </View>
              <View style={styles.heroBadgeRow}>
                {!!space.org_type && (
                  <View style={[styles.heroBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.9)' }]}>
                    <Text style={[styles.heroBadgeText, { color: isDark ? colors.white : colors.primary }]}>{space.org_type}</Text>
                  </View>
                )}
                <View style={styles.heroMemberPill}>
                  <FontAwesome name="users" size={10} color="rgba(255,255,255,0.9)" />
                  <Text style={styles.heroMemberText}>{memberCount}</Text>
                </View>
                <Pressable
                  style={[
                    styles.heroJoinButton,
                    { backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.95)' },
                    isMember && [styles.heroLeaveButton, { backgroundColor: colors.error }],
                  ]}
                  onPress={handleJoinLeave}>
                  <Text style={[styles.heroJoinButtonText, { color: isDark ? colors.white : colors.primary }, isMember && styles.heroLeaveButtonText]}>
                    {isMember ? 'Leave' : 'Join'}
                  </Text>
                </Pressable>
              </View>
              <View style={styles.heroDescriptionRow}>
                {!!space.description && (
                  <Text style={styles.heroDescription} numberOfLines={2}>
                    {space.description}
                  </Text>
                )}
                {!!space.address && (
                  <View style={styles.heroLocationRow}>
                    <FontAwesome name="map-marker" size={12} color="rgba(255,255,255,0.8)" />
                    <Text style={styles.heroLocationText} numberOfLines={1}>
                      {space.address}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* Segmented Tabs */}
          <View style={[styles.segmentedControl, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Pressable
              style={[
                styles.segmentTab,
                activeTab === 'announcements' && [styles.segmentTabActive, { backgroundColor: colors.primary }],
              ]}
              onPress={() => setActiveTab('announcements')}>
              <FontAwesome
                name="bullhorn"
                size={14}
                color={activeTab === 'announcements' ? colors.white : colors.primary}
              />
              <Text
                style={[
                  styles.segmentText,
                  { color: colors.primary },
                  activeTab === 'announcements' && [styles.segmentTextActive, { color: colors.white }],
                ]}>
                Announcements
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.segmentTab,
                activeTab === 'events' && [styles.segmentTabActive, { backgroundColor: colors.primary }],
              ]}
              onPress={() => setActiveTab('events')}>
              <FontAwesome
                name="calendar"
                size={14}
                color={activeTab === 'events' ? colors.white : colors.primary}
              />
              <Text
                style={[
                  styles.segmentText,
                  { color: colors.primary },
                  activeTab === 'events' && [styles.segmentTextActive, { color: colors.white }],
                ]}>
                Events
              </Text>
            </Pressable>
          </View>

          {/* Tab Content */}
          <View style={styles.tabContent}>
            {activeTab === 'announcements' ? (
              <>
                {/* Announcements Header */}
                <View style={styles.tabHeader}>
                  <Text style={[styles.tabTitle, { color: colors.textPrimary }]}>Announcements</Text>
                  <View style={styles.tabActions}>
                    <Pressable
                      style={[
                        styles.filterChip,
                        { backgroundColor: colors.backgroundAlt },
                        announcementFilter === 'pinned' && [styles.filterChipActive, { backgroundColor: colors.primary }],
                      ]}
                      onPress={() =>
                        setAnnouncementFilter((prev) => (prev === 'all' ? 'pinned' : 'all'))
                      }>
                      <FontAwesome
                        name="thumb-tack"
                        size={10}
                        color={announcementFilter === 'pinned' ? colors.white : colors.textMuted}
                      />
                      <Text
                        style={[
                          styles.filterChipText,
                          { color: colors.textMuted },
                          announcementFilter === 'pinned' && [styles.filterChipTextActive, { color: colors.white }],
                        ]}>
                        Pinned
                      </Text>
                    </Pressable>
                    {isAdmin && (
                      <Pressable
                        style={[styles.addButton, { borderColor: colors.primary, backgroundColor: colors.surface }]}
                        onPress={() => setShowAddForm(!showAddForm)}>
                        <FontAwesome name="plus" size={12} color={colors.primary} />
                        <Text style={[styles.addButtonText, { color: colors.primary }]}>New</Text>
                      </Pressable>
                    )}
                  </View>
                </View>

                {/* Add Announcement Form */}
                {showAddForm && activeTab === 'announcements' && (
                  <View style={[styles.formCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={[styles.formTitle, { color: colors.textPrimary }]}>Post Announcement</Text>
                    <TextInput
                      placeholder="Title"
                      style={[styles.input, { backgroundColor: colors.backgroundAlt, borderColor: colors.border, color: colors.textPrimary }]}
                      value={announcementTitle}
                      onChangeText={setAnnouncementTitle}
                      placeholderTextColor={colors.textDisabled}
                    />
                    <TextInput
                      placeholder="What would you like to share?"
                      style={[styles.input, styles.textArea, { backgroundColor: colors.backgroundAlt, borderColor: colors.border, color: colors.textPrimary }]}
                      value={announcementBody}
                      onChangeText={setAnnouncementBody}
                      multiline
                      placeholderTextColor={colors.textDisabled}
                    />
                    <View style={styles.switchRow}>
                      <Text style={[styles.switchLabel, { color: colors.textSecondary }]}>Send notification</Text>
                      <Switch
                        value={notifyMembers}
                        onValueChange={setNotifyMembers}
                        trackColor={{ true: colors.primary }}
                      />
                    </View>
                    <Pressable style={[styles.submitButton, { backgroundColor: colors.primary }]} onPress={handleCreateAnnouncement}>
                      <Text style={[styles.submitButtonText, { color: colors.white }]}>Post</Text>
                    </Pressable>
                  </View>
                )}

                {/* Announcements List */}
                {visibleAnnouncements.map((announcement) => (
                  <View key={announcement.id} style={[styles.announcementCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.announcementHeader}>
                      <Text style={[styles.announcementTitle, { color: colors.textPrimary }]}>{announcement.title}</Text>
                      {announcement.is_pinned && (
                        <View style={[styles.pinnedBadge, { backgroundColor: isDark ? colors.backgroundAlt : colors.primaryLight }]}>
                          <FontAwesome name="thumb-tack" size={10} color={colors.primary} />
                        </View>
                      )}
                    </View>
                    <Text style={[styles.announcementBody, { color: colors.textSecondary }]} numberOfLines={3}>
                      {announcement.body}
                    </Text>
                    <Text style={[styles.announcementMeta, { color: colors.textMuted }]}>
                      {new Date(announcement.created_at).toLocaleDateString()}
                    </Text>
                    {isAdmin && (
                      <View style={[styles.announcementActions, { borderTopColor: colors.border }]}>
                        <Pressable
                          style={[styles.actionChip, { backgroundColor: colors.backgroundAlt }]}
                          onPress={() => handleTogglePin(announcement)}>
                          <Text style={[styles.actionChipText, { color: colors.textSecondary }]}>
                            {announcement.is_pinned ? 'Unpin' : 'Pin'}
                          </Text>
                        </Pressable>
                        <Pressable
                          style={[styles.actionChip, { backgroundColor: colors.backgroundAlt }]}
                          onPress={() => handleEditAnnouncement(announcement)}>
                          <Text style={[styles.actionChipText, { color: colors.textSecondary }]}>Edit</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.actionChip, { backgroundColor: colors.errorLight }]}
                          onPress={() => handleDeleteAnnouncement(announcement.id)}>
                          <Text style={[styles.actionChipTextDanger, { color: colors.error }]}>Delete</Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                ))}

                {visibleAnnouncements.length === 0 && (
                  <View style={styles.emptyState}>
                    <FontAwesome name="bullhorn" size={32} color={colors.border} />
                    <Text style={[styles.emptyText, { color: colors.textMuted }]}>No announcements yet</Text>
                  </View>
                )}
              </>
            ) : (
              <>
                {/* Events Header */}
                <View style={styles.tabHeader}>
                  <Text style={[styles.tabTitle, { color: colors.textPrimary }]}>Events</Text>
                  <View style={styles.tabActions}>
                    <Pressable
                      style={[
                        styles.filterChip,
                        { backgroundColor: colors.backgroundAlt },
                        eventsView === 'calendar' && [styles.filterChipActive, { backgroundColor: colors.primary }],
                      ]}
                      onPress={() =>
                        setEventsView((prev) => (prev === 'list' ? 'calendar' : 'list'))
                      }>
                      <FontAwesome
                        name={eventsView === 'list' ? 'calendar' : 'list'}
                        size={10}
                        color={eventsView === 'calendar' ? colors.white : colors.textMuted}
                      />
                      <Text
                        style={[
                          styles.filterChipText,
                          { color: colors.textMuted },
                          eventsView === 'calendar' && [styles.filterChipTextActive, { color: colors.white }],
                        ]}>
                        {eventsView === 'list' ? 'Calendar' : 'List'}
                      </Text>
                    </Pressable>
                    {isAdmin && (
                      <Pressable
                        style={[styles.addButton, { borderColor: colors.primary, backgroundColor: colors.surface }]}
                        onPress={() => setShowAddForm(!showAddForm)}>
                        <FontAwesome name="plus" size={12} color={colors.primary} />
                        <Text style={[styles.addButtonText, { color: colors.primary }]}>New</Text>
                      </Pressable>
                    )}
                  </View>
                </View>

                {/* Add Event Form */}
                {showAddForm && activeTab === 'events' && (
                  <View style={[styles.formCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={[styles.formTitle, { color: colors.textPrimary }]}>Add Event</Text>
                    <TextInput
                      placeholder="Event title"
                      style={[styles.input, { backgroundColor: colors.backgroundAlt, borderColor: colors.border, color: colors.textPrimary }]}
                      value={eventTitle}
                      onChangeText={setEventTitle}
                      placeholderTextColor={colors.textDisabled}
                    />
                    <TextInput
                      placeholder="Description (optional)"
                      style={[styles.input, { backgroundColor: colors.backgroundAlt, borderColor: colors.border, color: colors.textPrimary }]}
                      value={eventDescription}
                      onChangeText={setEventDescription}
                      placeholderTextColor={colors.textDisabled}
                    />
                    <Pressable
                      style={[styles.dateTimeField, { backgroundColor: colors.backgroundAlt, borderColor: colors.border }]}
                      onPress={() => openDateTimePicker('create')}>
                      <FontAwesome name="calendar" size={14} color={colors.textMuted} />
                      <Text
                        style={[
                          styles.dateTimeText,
                          { color: colors.textPrimary },
                          !eventDate && [styles.dateTimePlaceholder, { color: colors.textDisabled }],
                        ]}>
                        {formatDateTimeLabel(eventDate, eventTimeSlot)}
                      </Text>
                    </Pressable>
                    <TextInput
                      placeholder="Location or link"
                      style={[styles.input, { backgroundColor: colors.backgroundAlt, borderColor: colors.border, color: colors.textPrimary }]}
                      value={eventLocation}
                      onChangeText={setEventLocation}
                      placeholderTextColor={colors.textDisabled}
                    />
                    <Pressable style={[styles.submitButton, { backgroundColor: colors.primary }]} onPress={handleCreateEvent}>
                      <Text style={[styles.submitButtonText, { color: colors.white }]}>Add Event</Text>
                    </Pressable>
                  </View>
                )}

                {/* Events Content */}
                {eventsView === 'list' ? (
                  upcomingSections.map((section) => (
                    <View key={section.label} style={styles.eventSection}>
                      <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{section.label}</Text>
                      {section.items.map((event) => (
                        <View key={event.id} style={[styles.eventCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                          <View style={[styles.eventDateBadge, { backgroundColor: isDark ? colors.backgroundAlt : colors.primaryLight }]}>
                            <Text style={[styles.eventDay, { color: colors.primary }]}>
                              {event.event_time
                                ? new Date(event.event_time).getDate()
                                : '?'}
                            </Text>
                            <Text style={[styles.eventMonth, { color: colors.primaryDark }]}>
                              {event.event_time
                                ? new Date(event.event_time).toLocaleString('default', {
                                    month: 'short',
                                  })
                                : ''}
                            </Text>
                          </View>
                          <View style={styles.eventDetails}>
                            <Text style={[styles.eventTitle, { color: colors.textPrimary }]}>{event.title}</Text>
                            {!!event.description && (
                              <Text style={[styles.eventDescription, { color: colors.textSecondary }]} numberOfLines={2}>
                                {event.description}
                              </Text>
                            )}
                            <View style={styles.eventMeta}>
                              {event.event_time && (
                                <View style={styles.eventMetaItem}>
                                  <FontAwesome name="clock-o" size={10} color={colors.textMuted} />
                                  <Text style={[styles.eventMetaText, { color: colors.textMuted }]}>
                                    {new Date(event.event_time).toLocaleTimeString([], {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </Text>
                                </View>
                              )}
                              {!!event.location && (
                                <View style={styles.eventMetaItem}>
                                  <FontAwesome name="map-marker" size={10} color={colors.textMuted} />
                                  <Text style={[styles.eventMetaText, { color: colors.textMuted }]} numberOfLines={1}>
                                    {event.location}
                                  </Text>
                                </View>
                              )}
                            </View>
                          </View>
                        </View>
                      ))}
                      {section.items.length === 0 && (
                        <Text style={[styles.noEventsText, { color: colors.textDisabled }]}>No events</Text>
                      )}
                    </View>
                  ))
                ) : (
                  <View style={[styles.calendarContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.calendarHeader}>
                      <Pressable
                        style={[styles.calendarNav, { backgroundColor: colors.backgroundAlt }]}
                        onPress={() =>
                          setCalendarMonth(
                            (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
                          )
                        }>
                        <FontAwesome name="chevron-left" size={14} color={colors.textPrimary} />
                      </Pressable>
                      <Text style={[styles.calendarMonthLabel, { color: colors.textPrimary }]}>
                        {calendarMonth.toLocaleString(undefined, {
                          month: 'long',
                          year: 'numeric',
                        })}
                      </Text>
                      <Pressable
                        style={[styles.calendarNav, { backgroundColor: colors.backgroundAlt }]}
                        onPress={() =>
                          setCalendarMonth(
                            (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
                          )
                        }>
                        <FontAwesome name="chevron-right" size={14} color={colors.textPrimary} />
                      </Pressable>
                    </View>
                    <View style={styles.calendarWeekdays}>
                      {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                        <Text key={`${day}-${i}`} style={[styles.calendarWeekday, { color: colors.textDisabled }]}>
                          {day}
                        </Text>
                      ))}
                    </View>
                    {buildMonthMatrix(calendarMonth).map((week, weekIndex) => (
                      <View key={`week-${weekIndex}`} style={styles.calendarWeek}>
                        {week.map((day, dayIndex) => {
                          if (!day) {
                            return <View key={`empty-${dayIndex}`} style={styles.calendarDayCell} />;
                          }
                          const dayKey = formatDayKey(day);
                          const hasEvents = eventsByDay.has(dayKey);
                          const isSelected =
                            selectedCalendarDate &&
                            formatDayKey(selectedCalendarDate) === dayKey;
                          return (
                            <Pressable
                              key={dayKey}
                              style={[
                                styles.calendarDayCell,
                                isSelected && [styles.calendarDayCellActive, { backgroundColor: colors.primary }],
                              ]}
                              onPress={() => setSelectedCalendarDate(day)}>
                              <Text
                                style={[
                                  styles.calendarDayText,
                                  { color: colors.textPrimary },
                                  isSelected && [styles.calendarDayTextActive, { color: colors.white }],
                                ]}>
                                {day.getDate()}
                              </Text>
                              {hasEvents && <View style={[styles.calendarDot, { backgroundColor: colors.primary }]} />}
                            </Pressable>
                          );
                        })}
                      </View>
                    ))}

                    {/* Selected Day Events */}
                    <View style={[styles.calendarEvents, { borderTopColor: colors.border }]}>
                      <Text style={[styles.calendarEventsTitle, { color: colors.textPrimary }]}>
                        {selectedCalendarDate
                          ? `Events on ${selectedCalendarDate.toLocaleDateString()}`
                          : 'Select a day'}
                      </Text>
                      {selectedCalendarEvents.map((event) => (
                        <View key={event.id} style={[styles.calendarEventItem, { borderBottomColor: colors.backgroundAlt }]}>
                          <Text style={[styles.calendarEventTitle, { color: colors.textPrimary }]}>{event.title}</Text>
                          <Text style={[styles.calendarEventTime, { color: colors.primary }]}>
                            {event.event_time
                              ? new Date(event.event_time).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : 'Time TBD'}
                          </Text>
                        </View>
                      ))}
                      {selectedCalendarDate && selectedCalendarEvents.length === 0 && (
                        <Text style={[styles.noEventsText, { color: colors.textDisabled }]}>No events this day</Text>
                      )}
                    </View>
                  </View>
                )}
              </>
            )}
          </View>

          {/* Admin Actions */}
          {isAdmin && (
            <View style={styles.adminActions}>
              <Pressable
                style={[styles.adminButton, { borderColor: colors.primary, backgroundColor: colors.surface }]}
                onPress={() => router.push(`/spaces/edit/${space.id}`)}>
                <FontAwesome name="edit" size={14} color={colors.primary} />
                <Text style={[styles.adminButtonText, { color: colors.primary }]}>Edit Space</Text>
              </Pressable>
              <Pressable
                style={[styles.adminButton, { borderColor: colors.error, backgroundColor: colors.surface }]}
                onPress={handleDeleteSpace}>
                <FontAwesome name="trash" size={14} color={colors.error} />
                <Text style={[styles.adminButtonTextDanger, { color: colors.error }]}>Delete</Text>
              </Pressable>
            </View>
          )}

          {/* Bottom Padding */}
          <View style={{ height: 100 }} />
        </ScrollView>
      ) : (
        <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading...</Text>
        </View>
      )}

      {space && (
        <ReportModal
          visible={reportModalVisible}
          onClose={() => setReportModalVisible(false)}
          targetType="space"
          targetId={space.id}
        />
      )}

      {/* Date Time Picker Modal */}
      <Modal visible={dateTimePickerOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setDateTimePickerOpen(false)}
          />
          <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Select date & time</Text>
            <View style={styles.calendarHeader}>
              <Pressable
                style={[styles.calendarNav, { backgroundColor: colors.backgroundAlt }]}
                onPress={() =>
                  setDateTimePickerMonth(
                    (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
                  )
                }>
                <FontAwesome name="chevron-left" size={14} color={colors.textPrimary} />
              </Pressable>
              <Text style={[styles.calendarMonthLabel, { color: colors.textPrimary }]}>
                {dateTimePickerMonth.toLocaleString(undefined, {
                  month: 'long',
                  year: 'numeric',
                })}
              </Text>
              <Pressable
                style={[styles.calendarNav, { backgroundColor: colors.backgroundAlt }]}
                onPress={() =>
                  setDateTimePickerMonth(
                    (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
                  )
                }>
                <FontAwesome name="chevron-right" size={14} color={colors.textPrimary} />
              </Pressable>
            </View>
            <View style={styles.calendarWeekdays}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                <Text key={`picker-${day}-${i}`} style={[styles.calendarWeekday, { color: colors.textDisabled }]}>
                  {day}
                </Text>
              ))}
            </View>
            {buildMonthMatrix(dateTimePickerMonth).map((week, weekIndex) => (
              <View key={`picker-week-${weekIndex}`} style={styles.calendarWeek}>
                {week.map((day, dayIndex) => {
                  if (!day) {
                    return <View key={`picker-empty-${dayIndex}`} style={styles.calendarDayCell} />;
                  }
                  const isSelected =
                    dateTimePickerDate && formatDayKey(dateTimePickerDate) === formatDayKey(day);
                  return (
                    <Pressable
                      key={`picker-day-${formatDayKey(day)}`}
                      style={[
                        styles.calendarDayCell,
                        isSelected && [styles.calendarDayCellActive, { backgroundColor: colors.primary }],
                      ]}
                      onPress={() => setDateTimePickerDate(day)}>
                      <Text
                        style={[
                          styles.calendarDayText,
                          { color: colors.textPrimary },
                          isSelected && [styles.calendarDayTextActive, { color: colors.white }],
                        ]}>
                        {day.getDate()}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
            <Text style={[styles.modalSectionLabel, { color: colors.textMuted }]}>Select time</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.timeSlotRow}>
              {timeSlots.map((slot) => (
                <Pressable
                  key={slot}
                  style={[
                    styles.timeSlotPill,
                    { backgroundColor: colors.backgroundAlt },
                    slot === dateTimePickerTime && [styles.timeSlotPillActive, { backgroundColor: colors.primary }],
                  ]}
                  onPress={() => setDateTimePickerTime(slot)}>
                  <Text
                    style={[
                      styles.timeSlotText,
                      { color: colors.textSecondary },
                      slot === dateTimePickerTime && [styles.timeSlotTextActive, { color: colors.white }],
                    ]}>
                    {slot}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalCancelButton, { backgroundColor: colors.backgroundAlt }]}
                onPress={() => setDateTimePickerOpen(false)}>
                <Text style={[styles.modalCancelText, { color: colors.textSecondary }]}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.modalConfirmButton, { backgroundColor: colors.primary }]} onPress={applyDateTimePicker}>
                <Text style={[styles.modalConfirmText, { color: colors.white }]}>Done</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
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
  heroContainer: {
    height: 320,
    position: 'relative',
  },
  heroCover: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  heroContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingVertical: 20,
    paddingTop: 28,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  heroHeaderActions: {
    position: 'absolute',
    top: -240, // Adjust based on header height
    right: 20,
    zIndex: 10,
  },
  reportButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  heroTitle: {
    fontSize: 27,
    fontWeight: '700',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  heroBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  heroBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  heroBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  heroMemberPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  heroMemberText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.95)',
  },
  heroJoinButton: {
    marginLeft: 'auto',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 999,
  },
  heroJoinButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  heroLeaveButton: {
    borderWidth: 0,
  },
  heroLeaveButtonText: {
    color: '#FFFFFF',
  },
  heroDescriptionRow: {
    marginTop: 10,
  },
  heroDescription: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 20,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  heroLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  heroLocationText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '500',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  segmentedControl: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  segmentTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  segmentTabActive: {
  },
  segmentText: {
    fontSize: 15,
    fontWeight: '600',
  },
  segmentTextActive: {
  },
  tabContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  tabHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  tabTitle: {
    fontSize: 19,
    fontWeight: '700',
  },
  tabActions: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  filterChipActive: {
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  filterChipTextActive: {
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  addButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  formCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  formTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 10,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  dateTimeField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  dateTimeText: {
    fontSize: 15,
  },
  dateTimePlaceholder: {
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 8,
  },
  switchLabel: {
    fontSize: 15,
  },
  submitButton: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  announcementCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  announcementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  announcementTitle: {
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
  },
  pinnedBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  announcementBody: {
    fontSize: 15,
    lineHeight: 22,
  },
  announcementMeta: {
    fontSize: 13,
    marginTop: 8,
  },
  announcementActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  actionChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  actionChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  actionChipDanger: {
  },
  actionChipTextDanger: {
    fontSize: 13,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 15,
    marginTop: 12,
  },
  eventSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  eventCard: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  eventDateBadge: {
    width: 50,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    marginRight: 12,
  },
  eventDay: {
    fontSize: 21,
    fontWeight: '700',
  },
  eventMonth: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  eventDetails: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  eventDescription: {
    fontSize: 14,
    marginTop: 4,
  },
  eventMeta: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  eventMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  eventMetaText: {
    fontSize: 12,
  },
  noEventsText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  calendarContainer: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  calendarNav: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarMonthLabel: {
    fontSize: 17,
    fontWeight: '700',
  },
  calendarWeekdays: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  calendarWeekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
  },
  calendarWeek: {
    flexDirection: 'row',
  },
  calendarDayCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  calendarDayCellActive: {
    borderRadius: 20,
  },
  calendarDayText: {
    fontSize: 15,
  },
  calendarDayTextActive: {
    fontWeight: '700',
  },
  calendarDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: 4,
  },
  calendarEvents: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  calendarEventsTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
  },
  calendarEventItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  calendarEventTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  calendarEventTime: {
    fontSize: 13,
    fontWeight: '600',
  },
  adminActions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    marginTop: 24,
  },
  adminButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  adminButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  adminButtonDanger: {
  },
  adminButtonTextDanger: {
    fontSize: 15,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    borderRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: '700',
    marginBottom: 16,
  },
  modalSectionLabel: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 10,
  },
  timeSlotRow: {
    gap: 8,
    paddingVertical: 4,
  },
  timeSlotPill: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  timeSlotPillActive: {
  },
  timeSlotText: {
    fontSize: 14,
    fontWeight: '600',
  },
  timeSlotTextActive: {
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 20,
  },
  modalCancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 999,
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '600',
  },
  modalConfirmButton: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 999,
  },
  modalConfirmText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
