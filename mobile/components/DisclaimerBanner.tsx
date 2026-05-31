import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../constants/Colors';
import { DISCLAIMER } from '../constants/Medical';

export default function DisclaimerBanner() {
  return (
    <View style={styles.banner}>
      <Text style={styles.icon}>⚕️</Text>
      <Text style={styles.text}>{DISCLAIMER}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#FFFBEB',
    borderLeftWidth: 3,
    borderLeftColor: Colors.warning,
    borderRadius: 14,
    padding: 14,
    marginVertical: 8,
  },
  icon: { fontSize: 16, marginTop: 1 },
  text: { flex: 1, fontSize: 12, color: '#78350F', lineHeight: 19 },
});
