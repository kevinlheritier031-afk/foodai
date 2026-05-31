import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { useAppStore } from '../../store/useAppStore';
import { getJournalEntries, getDailySummary, deleteJournalEntry, getClinicalData } from '../../lib/database';
import { JournalEntry, DailySummary, ClinicalData, MealType } from '../../types';
import AlertBadge from '../../components/AlertBadge';
import NutrientBar from '../../components/NutrientBar';
import { MEAL_LABELS, MEAL_ICONS } from '../../constants/Medical';

const DAYS = ['Aujourd\'hui', 'Hier', 'Avant-hier'];

function dateOffset(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  return d.toISOString().split('T')[0];
}

export default function Journal() {
  const { activeProfileId } = useAppStore();
  const [dayOffset, setDayOffset] = useState(0);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [clinical, setClinical] = useState<ClinicalData | null>(null);

  const load = useCallback(async () => {
    if (!activeProfileId) return;
    const date = dateOffset(dayOffset);
    const [e, s, c] = await Promise.all([
      getJournalEntries(activeProfileId, date),
      getDailySummary(activeProfileId, date),
      getClinicalData(activeProfileId),
    ]);
    setEntries(e);
    setSummary(s);
    setClinical(c);
  }, [activeProfileId, dayOffset]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const byMeal = (meal: MealType) => entries.filter(e => e.repas === meal);

  const handleDelete = (entry: JournalEntry) => {
    Alert.alert('Supprimer ?', `Supprimer ${entry.aliment_nom} du journal ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive',
        onPress: async () => {
          await deleteJournalEntry(entry.id, entry.profile_id, entry.date);
          load();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Day selector */}
      <View style={styles.daySelector}>
        {DAYS.map((label, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.dayBtn, dayOffset === i && styles.dayBtnActive]}
            onPress={() => setDayOffset(i)}
          >
            <Text style={[styles.dayBtnText, dayOffset === i && styles.dayBtnTextActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Daily summary bars */}
        {clinical && summary && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>📊 Bilan de la journée</Text>
            <NutrientBar label="Potassium" unit="mg" emoji="🫀"
              current={summary.total_potassium_mg}
              max={clinical.potassium_max_mg_jour} />
            <NutrientBar label="Phosphore" unit="mg" emoji="🦴"
              current={summary.total_phosphore_mg}
              max={clinical.phosphore_max_mg_jour} />
            <NutrientBar label="Sodium" unit="mg" emoji="🧂"
              current={summary.total_sodium_mg}
              max={clinical.sodium_max_mg_jour} />
            <NutrientBar label="Glucides" unit="g" emoji="🍬"
              current={summary.total_glucides_g}
              max={clinical.glucides_max_g_jour} />
          </View>
        )}

        {/* Entries by meal */}
        {(Object.keys(MEAL_LABELS) as MealType[]).map(meal => {
          const mealEntries = byMeal(meal);
          return (
            <View key={meal} style={styles.mealSection}>
              <View style={styles.mealHeader}>
                <Text style={styles.mealIcon}>{MEAL_ICONS[meal]}</Text>
                <Text style={styles.mealTitle}>{MEAL_LABELS[meal]}</Text>
                {mealEntries.length > 0 && (
                  <View style={styles.mealCount}>
                    <Text style={styles.mealCountText}>{mealEntries.length}</Text>
                  </View>
                )}
              </View>
              {mealEntries.length === 0 ? (
                <View style={styles.emptyMeal}>
                  <Text style={styles.empty}>Aucun aliment ajouté</Text>
                </View>
              ) : (
                mealEntries.map(e => (
                  <View key={e.id} style={styles.entryRow}>
                    <View style={{ flex: 1 }}>
                      <View style={styles.entryHeader}>
                        <Text style={styles.entryName}>{e.aliment_nom}</Text>
                        <AlertBadge level={e.verdict_global} size="sm" showLabel={false} />
                      </View>
                      <Text style={styles.entryMeta}>
                        {e.quantite_g}g · K: {e.potassium_mg.toFixed(0)}mg · P: {e.phosphore_mg.toFixed(0)}mg · Na: {e.sodium_mg.toFixed(0)}mg
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => handleDelete(e)} style={styles.deleteBtn}>
                      <Text style={styles.deleteBtnText}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>
          );
        })}

        <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/analyze')} activeOpacity={0.85}>
          <Text style={styles.addBtnIcon}>🔍</Text>
          <Text style={styles.addBtnText}>Ajouter un aliment</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  daySelector: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    elevation: 2,
    shadowColor: Colors.primary,
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  dayBtn: {
    flex: 1, paddingVertical: 9, alignItems: 'center',
    borderRadius: 12, borderWidth: 1.5, borderColor: 'transparent',
  },
  dayBtnActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  dayBtnText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600' },
  dayBtnTextActive: { color: Colors.primary, fontWeight: '800' },

  content: { padding: 16, paddingBottom: 40 },

  card: {
    backgroundColor: Colors.card, borderRadius: 20, padding: 18,
    marginBottom: 16, elevation: 2,
    shadowColor: Colors.primary, shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 3 },
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: Colors.text, marginBottom: 14 },

  mealSection: { marginBottom: 14 },
  mealHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  mealIcon: { fontSize: 20 },
  mealTitle: { fontSize: 15, fontWeight: '800', color: Colors.text, flex: 1 },
  mealCount: {
    backgroundColor: Colors.primaryLight, borderRadius: 12,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  mealCountText: { fontSize: 12, color: Colors.primary, fontWeight: '700' },

  emptyMeal: {
    backgroundColor: Colors.card, borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: Colors.border, borderStyle: 'dashed',
    alignItems: 'center',
  },
  empty: { fontSize: 13, color: Colors.textMuted, fontStyle: 'italic' },

  entryRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.card, borderRadius: 14, padding: 13, marginBottom: 6,
    elevation: 1, shadowColor: Colors.primary, shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  entryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5, gap: 8 },
  entryName: { fontSize: 14, fontWeight: '700', color: Colors.text, flex: 1 },
  entryMeta: { fontSize: 12, color: Colors.textSecondary },
  deleteBtn: { paddingLeft: 10, paddingVertical: 4 },
  deleteBtnText: { fontSize: 18 },

  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    marginTop: 4,
    elevation: 4,
    shadowColor: Colors.primary,
    shadowOpacity: 0.38,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  addBtnIcon: { fontSize: 18 },
  addBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
