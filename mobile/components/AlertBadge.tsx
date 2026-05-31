import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AlertLevel } from '../types';
import { alertColor } from '../constants/Colors';

const EMOJI: Record<AlertLevel, string> = { vert: '✅', orange: '⚠️', rouge: '🔴' };
const LABEL: Record<AlertLevel, string> = { vert: 'Compatible', orange: 'Modération', rouge: 'Déconseillé' };

interface Props {
  level: AlertLevel;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export default function AlertBadge({ level, size = 'md', showLabel = true }: Props) {
  const c = alertColor(level);
  const fontSize = size === 'sm' ? 11 : size === 'lg' ? 16 : 13;
  const padding = size === 'sm'
    ? { paddingHorizontal: 9, paddingVertical: 4 }
    : size === 'lg'
    ? { paddingHorizontal: 16, paddingVertical: 7 }
    : { paddingHorizontal: 12, paddingVertical: 5 };

  return (
    <View style={[styles.badge, padding, { backgroundColor: c.bg, borderColor: c.border }]}>
      <Text style={[styles.emoji, { fontSize: fontSize + 1 }]}>{EMOJI[level]}</Text>
      {showLabel && (
        <Text style={[styles.label, { color: c.text, fontSize }]}>{LABEL[level]}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 24,
    borderWidth: 1.5,
    alignSelf: 'flex-start',
  },
  emoji: { lineHeight: 20 },
  label: { fontWeight: '700' },
});
