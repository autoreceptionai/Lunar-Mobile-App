import React, { useState, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  useWindowDimensions,
  Platform,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Carousel, { ICarouselInstance } from 'react-native-reanimated-carousel';
import { useTheme } from '@/contexts/ThemeContext';
import { brand } from '@/constants/Brand';

const SLIDES = [
  {
    title: 'Welcome to Lunar',
    description: 'Your community hub for spaces, halal discovery, and more.',
    icon: 'moon-o',
    color: '#1da294',
  },
  {
    title: 'Find Community Spaces',
    description: 'Join MSAs, mosques, and local groups to stay connected.',
    icon: 'group',
    color: '#3B82F6',
  },
  {
    title: 'Discover Halal Food',
    description: 'Use our map to find verified halal restaurants near you.',
    icon: 'cutlery',
    color: '#10B981',
  },
  {
    title: 'Bazaar Marketplace',
    description: 'Buy and sell items within your community safely.',
    icon: 'shopping-bag',
    color: '#F59E0B',
  },
];

type Props = {
  visible: boolean;
  onFinish: () => void;
};

export default function OnboardingModal({ visible, onFinish }: Props) {
  const { colors } = useTheme();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const carouselRef = useRef<ICarouselInstance>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      carouselRef.current?.scrollTo({ index: currentIndex + 1, animated: true });
    } else {
      onFinish();
    }
  };

  const renderItem = ({ item }: { item: typeof SLIDES[0] }) => (
    <View style={styles.slide}>
      <View style={[styles.iconContainer, { backgroundColor: item.color + '20' }]}>
        <FontAwesome name={item.icon as any} size={80} color={item.color} />
      </View>
      <Text style={[styles.title, { color: colors.textPrimary }]}>{item.title}</Text>
      <Text style={[styles.description, { color: colors.textSecondary }]}>{item.description}</Text>
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.content}>
          <Carousel
            ref={carouselRef}
            width={screenWidth}
            height={screenHeight * 0.6}
            data={SLIDES}
            onSnapToItem={setCurrentIndex}
            renderItem={renderItem}
            loop={false}
          />

          <View style={styles.footer}>
            <View style={styles.pagination}>
              {SLIDES.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    { backgroundColor: i === currentIndex ? brand.primary : colors.border },
                  ]}
                />
              ))}
            </View>

            <Pressable
              style={[styles.button, { backgroundColor: brand.primary }]}
              onPress={handleNext}
            >
              <Text style={styles.buttonText}>
                {currentIndex === SLIDES.length - 1 ? 'Get Started' : 'Next'}
              </Text>
            </Pressable>

            {currentIndex < SLIDES.length - 1 && (
              <Pressable style={styles.skipButton} onPress={onFinish}>
                <Text style={[styles.skipText, { color: colors.textMuted }]}>Skip</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  slide: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  iconContainer: {
    width: 160,
    height: 160,
    borderRadius: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  footer: {
    width: '100%',
    paddingHorizontal: 40,
    paddingBottom: Platform.OS === 'ios' ? 60 : 40,
    alignItems: 'center',
  },
  pagination: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 32,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  button: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  skipButton: {
    paddingVertical: 8,
  },
  skipText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
