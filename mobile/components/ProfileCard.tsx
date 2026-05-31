import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../constants/Colors';
import { Profile, ClinicalData } from '../types';

interface Props {
  profile: Profile;
  clinical?: ClinicalData | null;
  isActive?: boolean;
  onPress?: () => void;
  onEdit?: () => void;
}

const RELATION_EMOJI: Record<string, string> = {
  moi: '👤', maman: '👩', papa: '👨', conjoint: '💑',
  enfant: '👶', autre: '🧑',
};

export default function ProfileCard({ profile, clinical, isActive, onPress, onEdit }: Props) {
  return (
    <TouchableOpacity
      style={[styles.card, isActive && styles.cardActive]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={styles.left}>
        <View style={[styles.avatar, isActive && styles.avatarActive]}>
          <Text style={styles.avatarEmoji}>
            {RELATION_EMOJI[profile.relation] ?? '🧑'}
          </Text>
        </View>
        <View>
          <Text style={styles.name}>{profile.nom}</Text>
          <Text style={styles.relation}>{profile.relation}</Text>
          {clinical && (
            <Text style={styles.clinical}>
              IRC {clinical.stade_irc} · DFG {clinical.dfg_ml_min} mL/min
            </Text>
          )}
        </View>
      </View>

      <View style={styles.right}>
        {isActive && (
          <View style={styles.activeBadge}>
            <Text style={styles.activeBadgeText}>Actif</Text>
          </View>
        )}
        {onEdit && (
          <TouchableOpacity onPress={onEdit} style={styles.editBtn}>
            <Text style={styles.editBtnText}>✏️</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 2,
    borderColor: Colors.border,
    elevation: 1,
  },
  cardActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  left: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: Colors.border, alignItems: 'center', justifyContent: 'center',
  },
  avatarActive: { backgroundColor: Colors.primary },
  avatarEmoji: { fontSize: 24 },
  name: { fontSize: 16, fontWeight: '700', color: Colors.text },
  relation: { fontSize: 13, color: Colors.textSecondary, textTransform: 'capitalize' },
  clinical: { fontSize: 12, color: Colors.primary, marginTop: 2, fontWeight: '600' },
  right: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  activeBadge: {
    backgroundColor: Colors.primary, borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  activeBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  editBtn: { padding: 6 },
  editBtnText: { fontSize: 18 },
});
