import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useTheme } from '@/contexts/ThemeContext';

export function OfflineBanner() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const isOffline = false; // This will be used in a wrapper or passed via props

  // We'll actually use the hook in the component that renders this banner
  return null; 
}

type Props = {
  isOffline: boolean;
};

export default function OfflineBannerComponent({ isOffline }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  if (!isOffline) return null;

  return (
    <View style={[styles.container, { backgroundColor: '#EF4444', top: insets.top }]}>
      <FontAwesome name="exclamation-triangle" size={14} color="#FFFFFF" />
      <Text style={styles.text}>You are currently offline</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
});
