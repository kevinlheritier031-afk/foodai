import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { AlertLevel } from '../types';
import { alertColor, Colors } from '../constants/Colors';

interface Props {
  title: string;
  emoji: string;
  accentColor: string;
  level: AlertLevel;
  message: string;
  details?: { label: string; value: string }[];
  extras?: string[];
}

export default function VerdictCard({ title, emoji, accentColor, level, message, details, extras }: Props) {
  const [expanded, setExpanded] = useState(false);
  const c = alertColor(level);

  return (
    <View style={[styles.card, { borderLeftColor: accentColor }]}>
      <TouchableOpacity onPress={() => setExpanded(!expanded)} activeOpacity={0.7}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <View style={[styles.iconWrap, { backgroundColor: accentColor + '18' }]}>
              <Text style={styles.emoji}>{emoji}</Text>
            </View>
            <Text style={[styles.title, { color: accentColor }]}>{title}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: c.bg, borderColor: c.border }]}>
            <Text style={[styles.badgeText, { color: c.text }]}>
              {level === 'vert' ? '✅' : level === 'orange' ? '⚠️' : '🔴'} {level.toUpperCase()}
            </Text>
          </View>
        </View>

        <Text style={styles.message} numberOfLines={expanded ? undefined : 2}>
          {message}
        </Text>

        {(details || extras) && (
          <Text style={[styles.toggleHint, { color: accentColor }]}>
            {expanded ? '▲ Réduire' : '▼ Voir les détails'}
          </Text>
        )}
      </TouchableOpacity>

      {expanded && (
        <View style={[styles.details, { borderTopColor: accentColor + '30' }]}>
          {details?.map((d, i) => (
            <View key={i} style={styles.detailRow}>
              <Text style={styles.detailLabel}>{d.label}</Text>
              <Text style={styles.detailValue}>{d.value}</Text>
            </View>
          ))}
          {extras?.map((e, i) => (
            <Text key={i} style={styles.extra}>{e}</Text>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    elevation: 2,
    shadowColor: '#6D28D9',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconWrap: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 18 },
  title: { fontSize: 15, fontWeight: '700' },
  badge: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 24, borderWidth: 1.5,
  },
  badgeText: { fontSize: 11, fontWeight: '700' },
  message: { fontSize: 14, color: Colors.text, lineHeight: 21 },
  toggleHint: { fontSize: 12, marginTop: 8, fontWeight: '700' },
  details: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, gap: 8 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between' },
  detailLabel: { fontSize: 13, color: Colors.textSecondary, flex: 1 },
  detailValue: { fontSize: 13, color: Colors.text, fontWeight: '600', flex: 2, textAlign: 'right' },
  extra: { fontSize: 13, color: Colors.text, lineHeight: 20 },
});
