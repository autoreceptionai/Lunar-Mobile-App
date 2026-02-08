import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { brand, brandGradient } from '@/constants/Brand';

type GradientButtonProps = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  style?: ViewStyle;
};

export default function GradientButton({
  title,
  onPress,
  disabled = false,
  style,
}: GradientButtonProps) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={style}>
      <LinearGradient colors={brandGradient} style={styles.button}>
        <Text style={styles.text}>{title}</Text>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  text: {
    color: brand.textOnBrand,
    fontWeight: '600',
  },
});
