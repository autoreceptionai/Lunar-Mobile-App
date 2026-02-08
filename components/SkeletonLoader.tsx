import React, { useEffect } from 'react';
import { View, StyleSheet, Animated, ViewStyle } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: ViewStyle;
}

export const Skeleton = ({ width, height, borderRadius = 4, style }: SkeletonProps) => {
  const { colors } = useTheme();
  const opacity = new Animated.Value(0.3);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: colors.border,
          opacity,
        },
        style,
      ]}
    />
  );
};

export const SpaceSkeleton = () => (
  <View style={styles.card}>
    <Skeleton width="100%" height={150} borderRadius={12} />
    <View style={styles.content}>
      <Skeleton width="60%" height={20} style={{ marginBottom: 8 }} />
      <Skeleton width="40%" height={14} />
    </View>
  </View>
);

export const RestaurantSkeleton = () => (
  <View style={styles.row}>
    <Skeleton width={80} height={80} borderRadius={8} />
    <View style={[styles.content, { marginLeft: 12 }]}>
      <Skeleton width="70%" height={18} style={{ marginBottom: 8 }} />
      <Skeleton width="50%" height={14} style={{ marginBottom: 4 }} />
      <Skeleton width="30%" height={12} />
    </View>
  </View>
);

export const BazaarSkeleton = () => (
  <View style={styles.gridItem}>
    <Skeleton width="100%" height={120} borderRadius={12} />
    <View style={styles.content}>
      <Skeleton width="80%" height={16} style={{ marginBottom: 6 }} />
      <Skeleton width="40%" height={14} />
    </View>
  </View>
);

const styles = StyleSheet.create({
  card: {
    padding: 16,
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
  },
  gridItem: {
    flex: 1,
    margin: 8,
    padding: 8,
  },
  content: {
    marginTop: 12,
  },
});
