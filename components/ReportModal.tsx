import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/hooks/useSession';

const REASONS = [
  'Inappropriate content',
  'Spam or misleading',
  'Scam or fraud',
  'Harassment or hate speech',
  'Illegal items or activities',
  'Other',
];

type Props = {
  visible: boolean;
  onClose: () => void;
  targetType: 'listing' | 'space' | 'message' | 'user';
  targetId: string;
};

export default function ReportModal({ visible, onClose, targetType, targetId }: Props) {
  const { colors, isDark } = useTheme();
  const { user } = useSession();
  const [loading, setLoading] = useState(false);
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [details, setDetails] = useState('');

  const handleReport = async () => {
    if (!user) return;

    if (!selectedReason) {
      Alert.alert('Selection required', 'Please select a reason for reporting.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('reports').insert({
        reporter_id: user.id,
        target_type: targetType,
        target_id: targetId,
        reason: selectedReason,
        details: details.trim() || null,
      });

      if (error) throw error;

      Alert.alert(
        'Report Submitted',
        'Thank you for helping keep our community safe. We will review your report shortly.'
      );
      handleClose();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to submit report');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedReason(null);
    setDetails('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.backdrop}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>Report {targetType}</Text>
            <Pressable onPress={handleClose} style={styles.closeButton}>
              <FontAwesome name="times" size={20} color={colors.textMuted} />
            </Pressable>
          </View>

          <Text style={[styles.label, { color: colors.textSecondary }]}>Why are you reporting this?</Text>
          <View style={styles.reasonsGrid}>
            {REASONS.map((reason) => (
              <Pressable
                key={reason}
                style={[
                  styles.reasonButton,
                  { backgroundColor: colors.background, borderColor: colors.border },
                  selectedReason === reason && { backgroundColor: colors.primaryLight, borderColor: colors.primary },
                ]}
                onPress={() => setSelectedReason(reason)}
              >
                <Text
                  style={[
                    styles.reasonText,
                    { color: colors.textSecondary },
                    selectedReason === reason && { color: colors.primary, fontWeight: '600' },
                  ]}
                >
                  {reason}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.label, { color: colors.textSecondary, marginTop: 16 }]}>
            Additional details (optional)
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.background, color: colors.textPrimary, borderColor: colors.border }]}
            placeholder="Tell us more about the issue..."
            placeholderTextColor={colors.textDisabled}
            multiline
            numberOfLines={3}
            value={details}
            onChangeText={setDetails}
          />

          <Pressable
            style={[styles.submitButton, { backgroundColor: colors.primary }, loading && styles.submitButtonDisabled]}
            onPress={handleReport}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>Submit Report</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  card: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  closeButton: {
    padding: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  reasonsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reasonButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  reasonText: {
    fontSize: 13,
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    height: 80,
    textAlignVertical: 'top',
    fontSize: 14,
    marginBottom: 24,
  },
  submitButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
