import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { useAppStore } from '../../store/useAppStore';
import {
  getProfiles, getClinicalData, getDailySummary,
  getJournalEntries,
} from '../../lib/database';
import { Profile, ClinicalData, DailySummary, JournalEntry } from '../../types';
import NutrientBar from '../../components/NutrientBar';
import AlertBadge from '../../components/AlertBadge';
import DisclaimerBanner from '../../components/DisclaimerBanner';
import { MEAL_LABELS } from '../../constants/Medical';

const todayISO = () => new Date().toISOString().split('T')[0];

export default function Dashboard() {
  const { activeProfileId, setActiveProfileId } = useAppStore();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [clinical, setClinical] = useState<ClinicalData | null>(null);
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const profiles = await getProfiles();
    if (profiles.length === 0) { router.replace('/profiles/create'); return; }

    const pid = activeProfileId ?? profiles[0].id;
    if (!activeProfileId) setActiveProfileId(pid);

    const p = profiles.find(x => x.id === pid) ?? profiles[0];
    const c = await getClinicalData(pid);
    const today = todayISO();
    const s = await getDailySummary(pid, today);
    const e = await getJournalEntries(pid, today);

    setProfile(p);
    setClinical(c);
    setSummary(s);
    setEntries(e.slice(-3).reverse());
  }, [activeProfileId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (!profile) return null;

  const formattedDate = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* Hero header */}
        <View style={styles.hero}>
          <View style={styles.heroRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroGreeting}>Bonjour 👋</Text>
              <Text style={styles.heroName}>{profile.nom}</Text>
              <Text style={styles.heroDate}>{formattedDate}</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/settings')} style={styles.heroSettingsBtn}>
              <Text style={{ fontSize: 18 }}>⚙️</Text>
            </TouchableOpacity>
          </View>

          {clinical && (
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeIcon}>🏥</Text>
              <Text style={styles.heroBadgeText}>
                IRC {clinical.stade_irc} · DFG {clinical.dfg_ml_min} mL/min
                {clinical.hypertension ? ' · HTA' : ''}
                {clinical.diabete_type ? ` · DT${clinical.diabete_type}` : ''}
              </Text>
            </View>
          )}
        </View>

        {/* CTA */}
        <TouchableOpacity style={styles.ctaBtn} onPress={() => router.push('/analyze')} activeOpacity={0.85}>
          <Text style={styles.ctaBtnIcon}>🔍</Text>
          <Text style={styles.ctaBtnText}>Analyser un aliment</Text>
        </TouchableOpacity>

        {/* Daily nutrients */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle}>Apports du jour</Text>
            <View style={styles.cardTitleBadge}>
              <Text style={styles.cardTitleBadgeText}>📊 Aujourd'hui</Text>
            </View>
          </View>
          {clinical ? (
            <>
              <NutrientBar label="Potassium" unit="mg" emoji="🫀"
                current={summary?.total_potassium_mg ?? 0}
                max={clinical.potassium_max_mg_jour} />
              <NutrientBar label="Phosphore" unit="mg" emoji="🦴"
                current={summary?.total_phosphore_mg ?? 0}
                max={clinical.phosphore_max_mg_jour} />
              <NutrientBar label="Sodium" unit="mg" emoji="🧂"
                current={summary?.total_sodium_mg ?? 0}
                max={clinical.sodium_max_mg_jour} />
              <NutrientBar label="Glucides" unit="g" emoji="🍬"
                current={summary?.total_glucides_g ?? 0}
                max={clinical.glucides_max_g_jour} />
            </>
          ) : (
            <TouchableOpacity onPress={() => router.push('/profiles/create')}>
              <Text style={styles.noClinical}>
                ⚙️ Configurez votre profil clinique pour activer le suivi
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Recent entries */}
        {entries.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Derniers ajouts</Text>
              <TouchableOpacity onPress={() => router.push('/journal')} style={styles.seeAllBtn}>
                <Text style={styles.seeAll}>Voir tout →</Text>
              </TouchableOpacity>
            </View>
            {entries.map((e, idx) => (
              <View key={e.id} style={[styles.entryRow, idx === entries.length - 1 && { borderBottomWidth: 0 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.entryName}>{e.aliment_nom}</Text>
                  <Text style={styles.entryMeta}>
                    {MEAL_LABELS[e.repas]} · {e.quantite_g}g · K: {e.potassium_mg.toFixed(0)}mg
                  </Text>
                </View>
                <AlertBadge level={e.verdict_global} size="sm" showLabel={false} />
              </View>
            ))}
          </View>
        )}

        <DisclaimerBanner />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },

  hero: {
    backgroundColor: Colors.primary,
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    elevation: 8,
    shadowColor: Colors.primary,
    shadowOpacity: 0.40,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  heroRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  heroGreeting: { fontSize: 13, color: 'rgba(255,255,255,0.70)', fontWeight: '500' },
  heroName: { fontSize: 26, fontWeight: '800', color: '#FFFFFF', lineHeight: 32, marginTop: 2 },
  heroDate: { fontSize: 12, color: 'rgba(255,255,255,0.60)', marginTop: 3, textTransform: 'capitalize' },
  heroSettingsBtn: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 12,
    padding: 10,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 14,
    alignSelf: 'flex-start',
  },
  heroBadgeIcon: { fontSize: 14 },
  heroBadgeText: { fontSize: 13, color: '#FFFFFF', fontWeight: '600' },

  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.primary,
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 24,
    marginBottom: 16,
    elevation: 6,
    shadowColor: Colors.primary,
    shadowOpacity: 0.40,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
  },
  ctaBtnIcon: { fontSize: 20 },
  ctaBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },

  card: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    elevation: 2,
    shadowColor: Colors.primary,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
  },
  cardTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: Colors.text },
  cardTitleBadge: { backgroundColor: Colors.primaryLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  cardTitleBadgeText: { fontSize: 12, color: Colors.primary, fontWeight: '700' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  seeAllBtn: { backgroundColor: Colors.primaryLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  seeAll: { color: Colors.primary, fontSize: 12, fontWeight: '700' },
  noClinical: { color: Colors.primary, fontSize: 14, textAlign: 'center', paddingVertical: 8 },

  entryRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 12,
  },
  entryName: { fontSize: 14, fontWeight: '700', color: Colors.text },
  entryMeta: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
});
