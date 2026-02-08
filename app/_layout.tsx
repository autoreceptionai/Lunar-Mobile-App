import 'react-native-gesture-handler';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';

import AsyncStorage from '@react-native-async-storage/async-storage';

import OnboardingModal from '@/components/OnboardingModal';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { useSession } from '@/hooks/useSession';
import { useOffline } from '@/hooks/useOffline';
import { useNotifications } from '@/hooks/useNotifications';
import OfflineBanner from '@/components/OfflineBanner';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export {
  // Catch any errors thrown by the Layout component.
  // ErrorBoundary, // We'll use our own
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(auth)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <RootLayoutNav />
      </ThemeProvider>
    </ErrorBoundary>
  );
}

function RootLayoutNav() {
  const { isDark } = useTheme();
  const { user, loading } = useSession();
  const segments = useSegments();
  const router = useRouter();
  const isOffline = useOffline();
  useNotifications();

  const [onboardingVisible, setOnboardingVisible] = useState(false);

  useEffect(() => {
    const checkOnboarding = async () => {
      const shown = await AsyncStorage.getItem('onboarding_shown');
      if (!shown) {
        setOnboardingVisible(true);
      }
    };
    checkOnboarding();
  }, []);

  const handleFinishOnboarding = async () => {
    await AsyncStorage.setItem('onboarding_shown', 'true');
    setOnboardingVisible(false);
  };

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !inAuthGroup) {
      // Not signed in — redirect to login
      router.replace('/(auth)/login');
    } else if (user && inAuthGroup) {
      // Signed in but still on auth screen — send to main app
      router.replace('/(tabs)');
    }
  }, [user, loading, segments, router]);

  return (
    <NavigationThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
      <OfflineBanner isOffline={isOffline} />
      <OnboardingModal visible={onboardingVisible} onFinish={handleFinishOnboarding} />
      <Stack>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="spaces" options={{ headerShown: false }} />
        <Stack.Screen name="halal" options={{ headerShown: false }} />
        <Stack.Screen name="bazaar" options={{ headerShown: false }} />
        <Stack.Screen name="profile" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      </Stack>
    </NavigationThemeProvider>
  );
}
