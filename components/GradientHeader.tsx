import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/contexts/ThemeContext';

type GradientHeaderProps = {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: React.ReactNode;
};

export default function GradientHeader({
  title,
  subtitle,
  showBack = false,
  onBack,
  rightAction,
}: GradientHeaderProps) {
  const insets = useSafeAreaInsets();
  const { theme, colors, isDark } = useTheme();

  return (
    <LinearGradient
      colors={theme.gradients.header as unknown as string[]}
      style={[styles.container, { paddingTop: insets.top + 12 }]}
    >
      <View style={styles.content}>
        {/* Left side (back button or spacer) */}
        <View style={styles.leftSection}>
          {showBack && onBack ? (
            <Pressable onPress={onBack} style={styles.backButton}>
              <FontAwesome name="arrow-left" size={18} color={colors.white} />
            </Pressable>
          ) : (
            <View style={styles.spacer} />
          )}
        </View>

        {/* Center (title) */}
        <View style={styles.centerSection}>
          <Text style={styles.title}>{title}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>

        {/* Right side (action or spacer) */}
        <View style={styles.rightSection}>
          {rightAction || <View style={styles.spacer} />}
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 16,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  leftSection: {
    width: 44,
    alignItems: 'flex-start',
  },
  centerSection: {
    flex: 1,
    alignItems: 'center',
  },
  rightSection: {
    width: 44,
    alignItems: 'flex-end',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spacer: {
    width: 40,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
});
