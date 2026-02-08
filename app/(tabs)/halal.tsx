import FontAwesome from '@expo/vector-icons/FontAwesome';
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import MapView, { Marker } from 'react-native-maps';
import Carousel, { type ICarouselInstance } from 'react-native-reanimated-carousel';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import TabHeader from '@/components/TabHeader';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import type { Restaurant } from '@/lib/types';

type LocationState = {
  latitude: number;
  longitude: number;
};

const toRadians = (value: number) => (value * Math.PI) / 180;

const distanceKm = (from: LocationState, to: LocationState) => {
  const earthRadiusKm = 6371;
  const deltaLat = toRadians(to.latitude - from.latitude);
  const deltaLng = toRadians(to.longitude - from.longitude);
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2) * Math.cos(lat1) * Math.cos(lat2);
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export default function HalalFinderScreen() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 10;
  const [selectedCategoryKey, setSelectedCategoryKey] = useState<string | null>(null);
  const [selectedCuisineKey, setSelectedCuisineKey] = useState<string | null>(null);
  const [useMyLocation, setUseMyLocation] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<LocationState | null>(null);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [mapRegion, setMapRegion] = useState<{
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  } | null>(null);
  const mapRef = useRef<MapView | null>(null);
  const hasAutoFocusedNearest = useRef(false);
  const carouselRef = useRef<ICarouselInstance>(null);
  const certificationSheetRef = useRef<BottomSheet>(null);
  const cuisineSheetRef = useRef<BottomSheet>(null);
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const cardWidth = Math.min(screenWidth - 40, 420);

  const snapPoints = useMemo(() => ['50%', '80%'], []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      onRefresh();
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  useEffect(() => {
    if (!useMyLocation) {
      setCurrentLocation(null);
      return;
    }
    (async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Location needed', 'Enable location to sort by distance.');
        setUseMyLocation(false);
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setCurrentLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
    })();
  }, [useMyLocation]);

  const loadRestaurants = async (pageNum = 0, shouldRefresh = false) => {
    if (loading || (!hasMore && !shouldRefresh)) return;

    setLoading(true);
    const from = pageNum * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from('restaurants')
      .select('*')
      .order('name', { ascending: true });

    if (searchQuery.trim()) {
      query = query.textSearch('fts', searchQuery.trim().split(/\s+/).join(' & '));
    }

    const { data, error } = await query.range(from, to);

    setLoading(false);
    setRefreshing(false);

    if (error) {
      Alert.alert('Unable to load restaurants', error.message);
      return;
    }

    if (data) {
      if (shouldRefresh) {
        setRestaurants(data);
        setPage(0);
        setHasMore(data.length === PAGE_SIZE);
      } else {
        setRestaurants((prev) => [...prev, ...data]);
        setPage(pageNum);
        setHasMore(data.length === PAGE_SIZE);
      }
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadRestaurants(0, true);
  };

  const onLoadMore = () => {
    if (!loading && hasMore && viewMode === 'list') {
      loadRestaurants(page + 1);
    }
  };

  const normalizeCategory = (value: string) => value.trim().toLowerCase();

  const getCoords = (restaurant: Restaurant) => {
    const lat = Number(restaurant.lat);
    const lng = Number(restaurant.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return null;
    }
    return { latitude: lat, longitude: lng };
  };

  const filteredRestaurants = useMemo(() => {
    let filtered = restaurants;
    
    // Server-side search is handled in loadRestaurants, 
    // but we can still do client-side filtering for other fields
    
    if (selectedCategoryKey) {
      filtered = filtered.filter((restaurant) => {
        const raw = restaurant.verification_category ?? '';
        return normalizeCategory(raw) === selectedCategoryKey;
      });
    }
    if (selectedCuisineKey) {
      filtered = filtered.filter((restaurant) => {
        const raw = restaurant.cuisine ?? '';
        return normalizeCategory(raw) === selectedCuisineKey;
      });
    }
    if (useMyLocation && currentLocation) {
      filtered = [...filtered].sort((a, b) => {
        const coordsA = getCoords(a);
        const coordsB = getCoords(b);
        const distanceA = coordsA ? distanceKm(currentLocation, coordsA) : Number.POSITIVE_INFINITY;
        const distanceB = coordsB ? distanceKm(currentLocation, coordsB) : Number.POSITIVE_INFINITY;
        return distanceA - distanceB;
      });
    }
    return filtered;
  }, [restaurants, selectedCategoryKey, selectedCuisineKey, useMyLocation, currentLocation]);

  const categoryOptions = useMemo(() => {
    const unique = new Map<string, string>();
    restaurants.forEach((restaurant) => {
      const raw = restaurant.verification_category;
      if (!raw) return;
      const key = normalizeCategory(raw);
      if (!unique.has(key)) {
        unique.set(key, raw.trim());
      }
    });
    return Array.from(unique.entries())
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [restaurants]);

  const cuisineOptions = useMemo(() => {
    const unique = new Map<string, string>();
    restaurants.forEach((restaurant) => {
      const raw = restaurant.cuisine;
      if (!raw) return;
      const key = normalizeCategory(raw);
      if (!unique.has(key)) {
        unique.set(key, raw.trim());
      }
    });
    return Array.from(unique.entries())
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [restaurants]);

  useEffect(() => {
    const firstCoords = restaurants.length ? getCoords(restaurants[0]) : null;
    const base = currentLocation ?? firstCoords;
    if (!base) return;
    setMapRegion((prev) => {
      if (useMyLocation && currentLocation) {
        return {
          latitude: base.latitude,
          longitude: base.longitude,
          latitudeDelta: 0.2,
          longitudeDelta: 0.2,
        };
      }
      if (prev) return prev;
      return {
        latitude: base.latitude,
        longitude: base.longitude,
        latitudeDelta: 0.2,
        longitudeDelta: 0.2,
      };
    });
  }, [currentLocation, restaurants, useMyLocation]);

  useEffect(() => {
    if (!useMyLocation || !currentLocation) return;
    if (!filteredRestaurants.length) return;
    const closest = filteredRestaurants[0];
    if (!closest || hasAutoFocusedNearest.current) return;
    carouselRef.current?.scrollTo({ index: 0, animated: true });
    handleSelectCard(closest);
    setCurrentIndex(0);
    hasAutoFocusedNearest.current = true;
  }, [useMyLocation, currentLocation, filteredRestaurants, selectedRestaurantId]);

  useEffect(() => {
    if (!useMyLocation) {
      hasAutoFocusedNearest.current = false;
    }
  }, [useMyLocation]);

  const handleMarkerPress = (restaurant: Restaurant) => {
    setSelectedRestaurantId(restaurant.id);
    const index = filteredRestaurants.findIndex((item) => item.id === restaurant.id);
    if (index >= 0) {
      carouselRef.current?.scrollTo({ index, animated: true });
    }
    const coords = getCoords(restaurant);
    if (coords) {
      const delta = mapRegion ?? { latitudeDelta: 0.2, longitudeDelta: 0.2 };
      mapRef.current?.animateToRegion(
        {
          latitude: coords.latitude,
          longitude: coords.longitude,
          latitudeDelta: delta.latitudeDelta,
          longitudeDelta: delta.longitudeDelta,
        },
        450
      );
    }
  };

  const focusOnMap = (restaurant: Restaurant) => {
    setViewMode('map');
    setTimeout(() => handleMarkerPress(restaurant), 100);
  };

  const handleSelectCard = (restaurant: Restaurant) => {
    setSelectedRestaurantId(restaurant.id);
    const coords = getCoords(restaurant);
    if (!coords) return;
    const delta = mapRegion ?? { latitudeDelta: 0.2, longitudeDelta: 0.2 };
    mapRef.current?.animateToRegion(
      {
        latitude: coords.latitude,
        longitude: coords.longitude,
        latitudeDelta: delta.latitudeDelta,
        longitudeDelta: delta.longitudeDelta,
      },
      450
    );
  };

  const handleCardPress = (restaurant: Restaurant) => {
    router.push(`/halal/${restaurant.id}`);
  };

  const openCertificationSheet = () => {
    certificationSheetRef.current?.expand();
  };

  const closeCertificationSheet = () => {
    certificationSheetRef.current?.close();
  };

  const selectCategory = (key: string | null) => {
    setSelectedCategoryKey(key);
    closeCertificationSheet();
  };

  const openCuisineSheet = () => {
    cuisineSheetRef.current?.expand();
  };

  const closeCuisineSheet = () => {
    cuisineSheetRef.current?.close();
  };

  const selectCuisine = (key: string | null) => {
    setSelectedCuisineKey(key);
    closeCuisineSheet();
  };

  const clearAllFilters = () => {
    setSelectedCategoryKey(null);
    setSelectedCuisineKey(null);
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

  const renderCard = ({ item }: { item: Restaurant }) => {
    const coords = getCoords(item);
    const distance =
      useMyLocation && currentLocation && coords ? distanceKm(currentLocation, coords) : null;
    const isSelected = item.id === selectedRestaurantId;
    const rating = item.average_rating || 0;
    const reviewCount = item.review_count || 0;

    return (
      <Pressable
        onPress={() => {
          handleSelectCard(item);
          handleCardPress(item);
        }}
        style={[
          styles.card,
          { width: cardWidth, backgroundColor: colors.surface },
          isSelected && [styles.cardSelected, { borderColor: colors.primary }],
          isDark && { borderWidth: 1, borderColor: colors.border },
        ]}>
        <View style={styles.cardImageWrapper}>
          {item.cover_image_url ? (
            <Image source={{ uri: item.cover_image_url }} style={styles.cardImage} />
          ) : (
            <View style={[styles.cardImagePlaceholder, { backgroundColor: colors.backgroundAlt }]}>
              <FontAwesome name="cutlery" size={32} color={colors.textMuted} />
            </View>
          )}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.6)']}
            style={styles.cardGradient}
          />
          {/* Rating Badge */}
          <View style={[styles.ratingBadge, { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.95)' : 'rgba(255, 255, 255, 0.95)' }]}>
            <FontAwesome name="star" size={12} color={colors.star} />
            <Text style={[styles.ratingBadgeText, { color: colors.textPrimary }]}>{rating.toFixed(1)}</Text>
            <Text style={[styles.ratingBadgeCount, { color: colors.textMuted }]}>({reviewCount})</Text>
          </View>
        </View>
        <View style={[styles.cardContentPanel, { backgroundColor: colors.surface }]}>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]} numberOfLines={1}>{item.name}</Text>
          <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>{item.address}</Text>
          <View style={styles.cardMetaRow}>
            <Text style={[styles.cardMetaHighlight, { color: colors.primary }]}>
              {item.halal_type} · {item.verification_category}
            </Text>
            {distance !== null && (
              <Text style={[styles.cardDistance, { color: colors.textMuted }]}>{distance.toFixed(1)} km</Text>
            )}
          </View>
        </View>
      </Pressable>
    );
  };

  const selectedCategoryLabel =
    selectedCategoryKey === null
      ? 'All'
      : categoryOptions.find((option) => option.key === selectedCategoryKey)?.label ?? 'All';

  const selectedCuisineLabel =
    selectedCuisineKey === null
      ? 'All'
      : cuisineOptions.find((option) => option.key === selectedCuisineKey)?.label ?? 'All';

  const hasActiveFilters = selectedCategoryKey !== null || selectedCuisineKey !== null;

  // Helper to get distance for a restaurant
  const getRestaurantDistance = (restaurant: Restaurant) => {
    if (!useMyLocation || !currentLocation) return null;
    const coords = getCoords(restaurant);
    if (!coords) return null;
    return distanceKm(currentLocation, coords);
  };

  return (
    <GestureHandlerRootView style={[styles.root, { backgroundColor: colors.background }]}>
      <TabHeader title="Halal Finder" />

      <View style={[styles.root, { backgroundColor: colors.background }]}>
        {/* ========== LIST VIEW ========== */}
        {viewMode === 'list' && (
          <View style={styles.listViewContainer}>
            {/* List Header with Search */}
            <View style={[styles.listHeader, { backgroundColor: colors.surface }]}>
              {/* Search Bar */}
              <View style={[styles.searchContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <FontAwesome name="search" size={16} color={colors.textMuted} style={styles.searchIcon} />
                <TextInput
                  placeholder="Search restaurants..."
                  placeholderTextColor={colors.textMuted}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  style={[styles.searchInput, { color: colors.textPrimary }]}
                />
                {searchQuery.length > 0 && (
                  <Pressable onPress={() => setSearchQuery('')} style={styles.searchClear}>
                    <FontAwesome name="times-circle" size={18} color={colors.textMuted} />
                  </Pressable>
                )}
              </View>

              {/* Filter Row */}
              <View style={styles.listFilterRow}>
                <View style={styles.filterPillsLeft}>
                  {/* Certification Filter */}
                  <Pressable
                    style={[
                      styles.filterPill,
                      { backgroundColor: colors.background },
                      selectedCategoryKey !== null && { backgroundColor: colors.primary },
                    ]}
                    onPress={openCertificationSheet}
                    accessibilityRole="button"
                    accessibilityLabel={`Filter by certification: ${selectedCategoryLabel}`}
                    accessibilityHint="Opens certification type selection"
                  >
                    <FontAwesome
                      name="certificate"
                      size={12}
                      color={selectedCategoryKey !== null ? colors.white : colors.primary}
                    />
                    <Text
                      style={[
                        styles.filterPillText,
                        { color: colors.textPrimary },
                        selectedCategoryKey !== null && { color: colors.white },
                      ]}
                    >
                      {selectedCategoryLabel}
                    </Text>
                    <FontAwesome
                      name="chevron-down"
                      size={8}
                      color={selectedCategoryKey !== null ? colors.white : colors.textMuted}
                    />
                  </Pressable>

                  {/* Cuisine Filter */}
                  <Pressable
                    style={[
                      styles.filterPill,
                      { backgroundColor: colors.background },
                      selectedCuisineKey !== null && { backgroundColor: colors.primary },
                    ]}
                    onPress={openCuisineSheet}
                  >
                    <FontAwesome
                      name="cutlery"
                      size={12}
                      color={selectedCuisineKey !== null ? colors.white : colors.primary}
                    />
                    <Text
                      style={[
                        styles.filterPillText,
                        { color: colors.textPrimary },
                        selectedCuisineKey !== null && { color: colors.white },
                      ]}
                    >
                      {selectedCuisineLabel}
                    </Text>
                    <FontAwesome
                      name="chevron-down"
                      size={8}
                      color={selectedCuisineKey !== null ? colors.white : colors.textMuted}
                    />
                  </Pressable>

                  {/* Location Toggle */}
                  <Pressable
                    style={[
                      styles.filterPill,
                      { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.primary },
                      useMyLocation && { backgroundColor: colors.primary, borderColor: colors.primary },
                    ]}
                    onPress={() => setUseMyLocation((prev) => !prev)}
                    accessibilityRole="checkbox"
                    accessibilityLabel="Search near me"
                    accessibilityState={{ checked: useMyLocation }}
                  >
                    <FontAwesome
                      name="location-arrow"
                      size={12}
                      color={useMyLocation ? colors.white : colors.primary}
                    />
                    <Text style={[styles.filterPillText, { color: useMyLocation ? colors.white : colors.primary }]}>Near Me</Text>
                  </Pressable>
                </View>

                {/* Map Toggle Button */}
                <Pressable
                  style={[styles.viewToggleButton, { backgroundColor: colors.primary }]}
                  onPress={() => setViewMode('map')}
                  accessibilityRole="button"
                  accessibilityLabel="Switch to Map View"
                >
                  <FontAwesome name="map" size={14} color={colors.white} />
                  <Text style={[styles.viewToggleText, { color: colors.white }]}>Map</Text>
                </Pressable>
              </View>
            </View>

            {/* Restaurant List */}
            <FlatList
              data={filteredRestaurants}
              style={styles.listScrollView}
              contentContainerStyle={styles.listScrollContent}
              showsVerticalScrollIndicator={false}
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
              ListFooterComponent={
                loading && !refreshing ? (
                  <ActivityIndicator style={styles.loader} color={colors.primary} />
                ) : null
              }
              renderItem={({ item: restaurant }) => {
                const distance = getRestaurantDistance(restaurant);
                const rating = restaurant.average_rating || 0;
                const reviewCount = restaurant.review_count || 0;

                return (
                  <View
                    key={restaurant.id}
                    style={[
                      styles.listCard,
                      { backgroundColor: colors.surface },
                      isDark && { borderWidth: 1, borderColor: colors.border },
                    ]}
                  >
                    {/* Card Image - Full Width */}
                    {restaurant.cover_image_url ? (
                      <Image
                        source={{ uri: restaurant.cover_image_url }}
                        style={styles.listCardImage}
                        contentFit="cover"
                        transition={200}
                      />
                    ) : (
                      <View style={[styles.listCardImagePlaceholder, { backgroundColor: colors.backgroundAlt }]}>
                        <FontAwesome name="cutlery" size={32} color={colors.textMuted} />
                      </View>
                    )}

                    {/* Card Content */}
                    <View style={styles.listCardContent}>
                      <Text style={[styles.listCardTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                        {restaurant.name}
                      </Text>
                      <Text style={[styles.listCardAddress, { color: colors.textSecondary }]} numberOfLines={1}>
                        {restaurant.address}
                      </Text>
                      
                      <View style={styles.listCardMeta}>
                        <Text style={[styles.listCardMetaText, { color: colors.primary }]}>
                          {restaurant.halal_type} · {restaurant.verification_category}
                        </Text>
                        {distance !== null && (
                          <Text style={[styles.listCardDistance, { color: colors.textMuted }]}>
                            {distance.toFixed(1)} km
                          </Text>
                        )}
                      </View>

                      {/* Rating */}
                      <View style={styles.listCardRating}>
                        <FontAwesome name="star" size={12} color={colors.star} />
                        <Text style={[styles.listCardRatingText, { color: colors.textPrimary }]}>
                          {rating.toFixed(1)}
                        </Text>
                        <Text style={[styles.listCardReviewCount, { color: colors.textMuted }]}>
                          ({reviewCount})
                        </Text>
                      </View>

                      {/* Action Buttons */}
                      <View style={styles.listCardActions}>
                        <Pressable
                          style={[styles.findOnMapButton, { borderColor: colors.primary }]}
                          onPress={() => focusOnMap(restaurant)}
                        >
                          <FontAwesome name="map-marker" size={12} color={colors.primary} />
                          <Text style={[styles.findOnMapText, { color: colors.primary }]}>Find on Map</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.viewDetailsButton, { backgroundColor: colors.primary }]}
                          onPress={() => router.push(`/halal/${restaurant.id}`)}
                        >
                          <Text style={[styles.viewDetailsText, { color: colors.white }]}>View Details</Text>
                          <FontAwesome name="chevron-right" size={10} color={colors.white} />
                        </Pressable>
                      </View>
                    </View>
                  </View>
                );
              }}
              ListEmptyComponent={
                !loading && filteredRestaurants.length === 0 ? (
                  <View style={styles.listEmptyState}>
                    <FontAwesome name="cutlery" size={48} color={colors.textMuted} />
                    <Text style={[styles.listEmptyTitle, { color: colors.textPrimary }]}>No restaurants found</Text>
                    <Text style={[styles.listEmptySubtitle, { color: colors.textMuted }]}>
                      Try adjusting your search or filters
                    </Text>
                    {hasActiveFilters && (
                      <Pressable
                        style={[styles.clearFilterButton, { backgroundColor: colors.primary }]}
                        onPress={clearAllFilters}
                      >
                        <Text style={[styles.clearFilterText, { color: colors.white }]}>Clear filters</Text>
                      </Pressable>
                    )}
                  </View>
                ) : null
              }
              ListFooterComponentStyle={{ height: insets.bottom + 80 }}
            />
          </View>
        )}

        {/* ========== MAP VIEW ========== */}
        {viewMode === 'map' && (
          <>
            {mapRegion ? (
              <MapView
                ref={(ref) => {
                  mapRef.current = ref;
                }}
                style={StyleSheet.absoluteFill}
                region={mapRegion}
                showsUserLocation={useMyLocation}
                onRegionChangeComplete={setMapRegion}>
                {filteredRestaurants.map((restaurant) => {
                  const coords = getCoords(restaurant);
                  if (!coords) return null;
                  return (
                    <Marker
                      key={restaurant.id}
                      coordinate={coords}
                      title={restaurant.name}
                      description={restaurant.address}
                      onPress={() => handleMarkerPress(restaurant)}
                    />
                  );
                })}
              </MapView>
            ) : (
              <View style={[styles.mapFallback, { backgroundColor: colors.background }]}>
                <FontAwesome name="cutlery" size={48} color={colors.textMuted} />
                <Text style={[styles.mapFallbackText, { color: colors.textMuted }]}>Finding halal restaurants...</Text>
              </View>
            )}

            {/* Filter Pills Bar (Map View) */}
            <View style={[styles.filterBar, { paddingTop: 8 }]}>
              <View style={styles.filterRow}>
                {/* Left side - filter pills */}
                <View style={styles.filterPillsLeft}>
                  {/* Certification Filter */}
                  <Pressable
                    style={[
                      styles.filterPill,
                      { backgroundColor: colors.surface },
                      selectedCategoryKey !== null && { backgroundColor: colors.primary },
                    ]}
                    onPress={openCertificationSheet}
                  >
                    <FontAwesome
                      name="certificate"
                      size={14}
                      color={selectedCategoryKey !== null ? colors.white : colors.primary}
                    />
                    <Text
                      style={[
                        styles.filterPillText,
                        { color: colors.textPrimary },
                        selectedCategoryKey !== null && { color: colors.white },
                      ]}
                    >
                      {selectedCategoryLabel}
                    </Text>
                    <FontAwesome
                      name="chevron-down"
                      size={10}
                      color={selectedCategoryKey !== null ? colors.white : colors.textMuted}
                    />
                  </Pressable>

                  {/* Cuisine Filter */}
                  <Pressable
                    style={[
                      styles.filterPill,
                      { backgroundColor: colors.surface },
                      selectedCuisineKey !== null && { backgroundColor: colors.primary },
                    ]}
                    onPress={openCuisineSheet}
                  >
                    <FontAwesome
                      name="cutlery"
                      size={14}
                      color={selectedCuisineKey !== null ? colors.white : colors.primary}
                    />
                    <Text
                      style={[
                        styles.filterPillText,
                        { color: colors.textPrimary },
                        selectedCuisineKey !== null && { color: colors.white },
                      ]}
                    >
                      {selectedCuisineLabel}
                    </Text>
                    <FontAwesome
                      name="chevron-down"
                      size={10}
                      color={selectedCuisineKey !== null ? colors.white : colors.textMuted}
                    />
                  </Pressable>
                </View>

                {/* Right side - Location Toggle + List View Button */}
                <View style={styles.mapRightControls}>
                  <Pressable
                    style={[
                      styles.locationPill,
                      { backgroundColor: colors.surface, borderColor: colors.primary },
                      useMyLocation && { backgroundColor: colors.primary },
                    ]}
                    onPress={() => setUseMyLocation((prev) => !prev)}
                  >
                    <FontAwesome
                      name="location-arrow"
                      size={16}
                      color={useMyLocation ? colors.white : colors.primary}
                    />
                    {useMyLocation && (
                      <Text style={[styles.locationPillText, { color: colors.white }]}>Near Me</Text>
                    )}
                  </Pressable>

                  <Pressable
                    style={[styles.listViewToggle, { backgroundColor: colors.surface }]}
                    onPress={() => setViewMode('list')}
                  >
                    <FontAwesome name="list" size={14} color={colors.primary} />
                  </Pressable>
                </View>
              </View>
            </View>

            {/* Card Carousel */}
            <View style={styles.deckContainer}>
              {filteredRestaurants.length ? (
                <Carousel
                  ref={carouselRef}
                  width={screenWidth}
                  height={200}
                  data={filteredRestaurants}
                  mode="parallax"
                  pagingEnabled
                  snapEnabled
                  renderItem={({ item }) => renderCard({ item })}
                  onSnapToItem={(index) => {
                    const next = filteredRestaurants[index];
                    if (!next) return;
                    setCurrentIndex(index);
                    handleSelectCard(next);
                  }}
                />
              ) : (
                <View style={styles.emptyContainer}>
                  <Text style={[styles.emptyText, { color: colors.textMuted }]}>No restaurants found in this area</Text>
                  {hasActiveFilters && (
                    <Pressable
                      style={[styles.clearFilterButton, { backgroundColor: colors.primary }]}
                      onPress={clearAllFilters}
                    >
                      <Text style={[styles.clearFilterText, { color: colors.white }]}>Clear filters</Text>
                    </Pressable>
                  )}
                </View>
              )}

              {/* Navigation Arrows */}
              {filteredRestaurants.length > 1 && (
                <View style={styles.deckNavigation} pointerEvents="box-none">
                  <Pressable
                    style={[
                      styles.navArrow,
                      currentIndex === 0 && styles.navArrowDisabled,
                    ]}
                    onPress={() => {
                      const prevIndex = Math.max(currentIndex - 1, 0);
                      carouselRef.current?.scrollTo({ index: prevIndex, animated: true });
                    }}
                    disabled={currentIndex === 0}
                  >
                    <FontAwesome
                      name="chevron-left"
                      size={14}
                      color={currentIndex === 0 ? colors.textDisabled : colors.white}
                    />
                  </Pressable>
                  <Pressable
                    style={[
                      styles.navArrow,
                      currentIndex === filteredRestaurants.length - 1 && styles.navArrowDisabled,
                    ]}
                    onPress={() => {
                      const nextIndex = Math.min(currentIndex + 1, filteredRestaurants.length - 1);
                      carouselRef.current?.scrollTo({ index: nextIndex, animated: true });
                    }}
                    disabled={currentIndex === filteredRestaurants.length - 1}
                  >
                    <FontAwesome
                      name="chevron-right"
                      size={14}
                      color={
                        currentIndex === filteredRestaurants.length - 1
                          ? colors.textDisabled
                          : colors.white
                      }
                    />
                  </Pressable>
                </View>
              )}

              {/* Card Counter */}
              {filteredRestaurants.length > 0 && (
                <View style={styles.cardCounter}>
                  <Text style={[styles.cardCounterText, { color: colors.white }]}>
                    {currentIndex + 1} / {filteredRestaurants.length}
                  </Text>
                </View>
              )}
            </View>
          </>
        )}

        {/* Certification Bottom Sheet */}
        <BottomSheet
          ref={certificationSheetRef}
          index={-1}
          snapPoints={snapPoints}
          enablePanDownToClose
          backdropComponent={renderBackdrop}
          backgroundStyle={[styles.sheetBackground, { backgroundColor: colors.surface }]}
          handleIndicatorStyle={[styles.sheetHandle, { backgroundColor: colors.border }]}
        >
          <View style={[styles.sheetHeader, { borderBottomColor: colors.borderLight }]}>
            <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>Certification Type</Text>
            <Pressable onPress={closeCertificationSheet} style={[styles.sheetCloseButton, { backgroundColor: colors.background }]}>
              <FontAwesome name="times" size={18} color={colors.textMuted} />
            </Pressable>
          </View>
          <BottomSheetScrollView contentContainerStyle={styles.sheetContent}>
            <Pressable
              style={[
                styles.sheetOption,
                { backgroundColor: colors.background },
                selectedCategoryKey === null && { backgroundColor: colors.primary },
              ]}
              onPress={() => selectCategory(null)}
            >
              <Text
                style={[
                  styles.sheetOptionText,
                  { color: colors.textPrimary },
                  selectedCategoryKey === null && { color: colors.white },
                ]}
              >
                All Categories
              </Text>
              {selectedCategoryKey === null && (
                <FontAwesome name="check" size={16} color={colors.white} />
              )}
            </Pressable>
            {categoryOptions.map((category) => (
              <Pressable
                key={category.key}
                style={[
                  styles.sheetOption,
                  { backgroundColor: colors.background },
                  selectedCategoryKey === category.key && { backgroundColor: colors.primary },
                ]}
                onPress={() => selectCategory(category.key)}
              >
                <Text
                  style={[
                    styles.sheetOptionText,
                    { color: colors.textPrimary },
                    selectedCategoryKey === category.key && { color: colors.white },
                  ]}
                >
                  {category.label}
                </Text>
                {selectedCategoryKey === category.key && (
                  <FontAwesome name="check" size={16} color={colors.white} />
                )}
              </Pressable>
            ))}
          </BottomSheetScrollView>
        </BottomSheet>

        {/* Cuisine Bottom Sheet */}
        <BottomSheet
          ref={cuisineSheetRef}
          index={-1}
          snapPoints={snapPoints}
          enablePanDownToClose
          backdropComponent={renderBackdrop}
          backgroundStyle={[styles.sheetBackground, { backgroundColor: colors.surface }]}
          handleIndicatorStyle={[styles.sheetHandle, { backgroundColor: colors.border }]}
        >
          <View style={[styles.sheetHeader, { borderBottomColor: colors.borderLight }]}>
            <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>Cuisine Type</Text>
            <Pressable onPress={closeCuisineSheet} style={[styles.sheetCloseButton, { backgroundColor: colors.background }]}>
              <FontAwesome name="times" size={18} color={colors.textMuted} />
            </Pressable>
          </View>
          <BottomSheetScrollView contentContainerStyle={styles.sheetContent}>
            <Pressable
              style={[
                styles.sheetOption,
                { backgroundColor: colors.background },
                selectedCuisineKey === null && { backgroundColor: colors.primary },
              ]}
              onPress={() => selectCuisine(null)}
            >
              <Text
                style={[
                  styles.sheetOptionText,
                  { color: colors.textPrimary },
                  selectedCuisineKey === null && { color: colors.white },
                ]}
              >
                All Cuisines
              </Text>
              {selectedCuisineKey === null && (
                <FontAwesome name="check" size={16} color={colors.white} />
              )}
            </Pressable>
            {cuisineOptions.map((cuisine) => (
              <Pressable
                key={cuisine.key}
                style={[
                  styles.sheetOption,
                  { backgroundColor: colors.background },
                  selectedCuisineKey === cuisine.key && { backgroundColor: colors.primary },
                ]}
                onPress={() => selectCuisine(cuisine.key)}
              >
                <Text
                  style={[
                    styles.sheetOptionText,
                    { color: colors.textPrimary },
                    selectedCuisineKey === cuisine.key && { color: colors.white },
                  ]}
                >
                  {cuisine.label}
                </Text>
                {selectedCuisineKey === cuisine.key && (
                  <FontAwesome name="check" size={16} color={colors.white} />
                )}
              </Pressable>
            ))}
          </BottomSheetScrollView>
        </BottomSheet>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  mapFallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  mapFallbackText: {
    fontSize: 17,
  },
  // Filter Bar
  filterBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  filterPillsLeft: {
    flexDirection: 'row',
    gap: 10,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 24,
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  filterPillText: {
    fontSize: 15,
    fontWeight: '600',
  },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 24,
    borderWidth: 1.5,
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  locationPillText: {
    fontSize: 15,
    fontWeight: '600',
  },
  // Card Deck
  deckContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 24,
  },
  deckNavigation: {
    position: 'absolute',
    top: 75,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  navArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(17, 24, 39, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navArrowDisabled: {
    backgroundColor: 'rgba(17, 24, 39, 0.25)',
  },
  cardCounter: {
    position: 'absolute',
    bottom: -16,
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(17, 24, 39, 0.6)',
  },
  cardCounterText: {
    fontSize: 13,
    fontWeight: '600',
  },
  // Cards
  card: {
    alignSelf: 'center',
    borderRadius: 16,
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
    overflow: 'hidden',
  },
  cardSelected: {
    shadowOpacity: 0.2,
    shadowRadius: 20,
    borderWidth: 2,
  },
  cardImageWrapper: {
    position: 'relative',
    height: 110,
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
  cardGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 60,
  },
  ratingBadge: {
    position: 'absolute',
    bottom: 8,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  ratingBadgeText: {
    fontSize: 14,
    fontWeight: '700',
  },
  ratingBadgeCount: {
    fontSize: 12,
  },
  cardContentPanel: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  cardSubtitle: {
    marginTop: 2,
    fontSize: 14,
  },
  cardMetaRow: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardMetaHighlight: {
    fontSize: 13,
    fontWeight: '600',
  },
  cardDistance: {
    fontSize: 13,
    fontWeight: '500',
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 17,
  },
  clearFilterButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  clearFilterText: {
    fontSize: 15,
    fontWeight: '600',
  },
  // Bottom Sheet
  sheetBackground: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  sheetHandle: {
    width: 40,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  sheetTitle: {
    fontSize: 19,
    fontWeight: '700',
  },
  sheetCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetContent: {
    padding: 16,
    gap: 8,
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  sheetOptionText: {
    fontSize: 16,
    fontWeight: '500',
  },
  // List View Styles
  listViewContainer: {
    flex: 1,
  },
  listHeader: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10,
    gap: 10,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  searchIcon: {},
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 0,
  },
  searchClear: {
    padding: 2,
  },
  listFilterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  viewToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  viewToggleText: {
    fontSize: 14,
    fontWeight: '600',
  },
  mapRightControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  listViewToggle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  listScrollView: {
    flex: 1,
  },
  listScrollContent: {
    padding: 16,
    gap: 14,
  },
  listCard: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  listCardImage: {
    width: '100%',
    height: 140,
  },
  listCardImagePlaceholder: {
    width: '100%',
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listCardContent: {
    padding: 14,
    gap: 4,
  },
  listCardTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  listCardAddress: {
    fontSize: 14,
  },
  listCardMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  listCardMetaText: {
    fontSize: 13,
    fontWeight: '600',
  },
  listCardDistance: {
    fontSize: 13,
    fontWeight: '500',
  },
  listCardRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  listCardRatingText: {
    fontSize: 14,
    fontWeight: '600',
  },
  listCardReviewCount: {
    fontSize: 13,
  },
  listCardActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  findOnMapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 1,
  },
  findOnMapText: {
    fontSize: 13,
    fontWeight: '600',
  },
  viewDetailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  viewDetailsText: {
    fontSize: 13,
    fontWeight: '600',
  },
  listEmptyState: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 12,
  },
  listEmptyTitle: {
    fontSize: 19,
    fontWeight: '600',
  },
  listEmptySubtitle: {
    fontSize: 15,
    textAlign: 'center',
  },
  loader: {
    paddingVertical: 20,
  },
});
