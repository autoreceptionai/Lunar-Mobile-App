import FontAwesome from '@expo/vector-icons/FontAwesome';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { gradients } from '@/constants/Brand';

type Props = {
  title: string;
  rightContent?: React.ReactNode;
};

export default function TabHeader({ title, rightContent }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient
      colors={[...gradients.brand].reverse()}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <Text style={[styles.title, { color: '#FFFFFF' }]}>{title}</Text>
      <View style={styles.rightSection}>
        {rightContent}
        <Pressable
          style={[styles.profileButton, { backgroundColor: 'rgba(255,255,255,0.2)' }]}
          onPress={() => router.push('/profile')}>
          <FontAwesome name="user" size={18} color="#FFFFFF" />
        </Pressable>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  title: {
    fontSize: 29,
    fontWeight: '700',
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  profileButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
