import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../constants/Colors';

interface Props {
  label: string;
  unit: string;
  current: number;
  max: number;
  emoji?: string;
}

export default function NutrientBar({ label, unit, current, max, emoji }: Props) {
  const ratio = max > 0 ? Math.min(current / max, 1) : 0;
  const pct = Math.round(ratio * 100);

  const barColor =
    ratio >= 1 ? Colors.rouge :
    ratio >= 0.8 ? Colors.orange :
    Colors.vert;

  const barBg =
    ratio >= 1 ? '#FEE2E2' :
    ratio >= 0.8 ? '#FEF3C7' :
    '#D1FAE5';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>
          {emoji ? `${emoji} ` : ''}{label}
        </Text>
        <Text style={styles.values}>
          <Text style={{ color: barColor, fontWeight: '700' }}>
            {current.toFixed(0)}
          </Text>
          <Text style={styles.max}> / {max} {unit}</Text>
        </Text>
      </View>

      <View style={[styles.track, { backgroundColor: barBg }]}>
        <View style={[styles.fill, { width: `${pct}%` as any, backgroundColor: barColor }]} />
      </View>

      {ratio >= 0.8 && (
        <Text style={[styles.warning, { color: barColor }]}>
          {ratio >= 1 ? '⛔ Seuil dépassé' : `⚠️ ${100 - pct}% restant`}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  label: { fontSize: 14, color: Colors.text, fontWeight: '600' },
  values: { fontSize: 13 },
  max: { color: Colors.textMuted },
  track: {
    height: 10,
    borderRadius: 6,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 6 },
  warning: { fontSize: 11, marginTop: 4, fontWeight: '700' },
});
