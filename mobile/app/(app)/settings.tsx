import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, Alert, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { deleteAllData, exportAllData, getProfiles } from '../../lib/database';
import { useAppStore } from '../../store/useAppStore';
import { Colors } from '../../constants/Colors';
import { DISCLAIMER, RGPD_VERSION } from '../../constants/Medical';
import DisclaimerBanner from '../../components/DisclaimerBanner';
import { Profile } from '../../types';

export default function Settings() {
  const { activeProfileId, setActiveProfileId } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);

  useEffect(() => {
    getProfiles().then(setProfiles);
  }, []);

  const handleExport = async () => {
    if (!activeProfileId) return;
    try {
      const data = await exportAllData(activeProfileId);
      await Share.share({ message: JSON.stringify(data, null, 2), title: 'FoodAI - Export données' });
    } catch (e: any) {
      Alert.alert('Erreur', e.message);
    }
  };

  const handleDeleteAll = () => {
    Alert.alert(
      '⚠️ Supprimer toutes les données',
      'Cette action est irréversible. Tous vos profils et votre journal alimentaire seront supprimés de cet appareil.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer définitivement', style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await deleteAllData();
              setActiveProfileId(null);
              Alert.alert('Données supprimées', 'Toutes vos données ont été effacées.');
              router.replace('/profiles/create');
            } catch (e: any) {
              Alert.alert('Erreur', e.message ?? 'Impossible de supprimer les données.');
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    );
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Section title="Profil actif">
          {profiles.map(p => (
            <TouchableOpacity
              key={p.id}
              style={[sStyles.row, activeProfileId === p.id && { backgroundColor: Colors.primaryLight, borderRadius: 10 }]}
              onPress={() => setActiveProfileId(p.id)}
            >
              <Text style={sStyles.emoji}>{activeProfileId === p.id ? '✅' : '👤'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[sStyles.label, activeProfileId === p.id && { color: Colors.primary, fontWeight: '700' }]}>{p.nom}</Text>
                <Text style={{ fontSize: 12, color: Colors.textMuted }}>{p.relation}</Text>
              </View>
            </TouchableOpacity>
          ))}
          <SettingRow label="Gérer les profils" emoji="✏️" onPress={() => router.push('/profiles')} />
        </Section>

        <Section title="Compte">
          <SettingRow label="Se déconnecter" emoji="🚪" onPress={handleLogout} />
        </Section>

        <Section title="Données personnelles (RGPD)">
          <Text style={styles.rgpdNote}>
            Vos données de santé sont stockées uniquement sur cet appareil.{'\n'}
            Version du consentement : {RGPD_VERSION}
          </Text>
          <SettingRow label="Exporter mes données" emoji="📤" onPress={handleExport} />
          <SettingRow
            label="Supprimer toutes mes données"
            emoji="🗑️"
            onPress={handleDeleteAll}
            danger
            loading={loading}
          />
        </Section>

        <Section title="Mentions légales">
          <View style={styles.disclaimer}>
            <Text style={styles.disclaimerText}>{DISCLAIMER}</Text>
          </View>
          <Text style={styles.version}>FoodAI v2.0.0 · Local-First · RGPD conforme</Text>
        </Section>

        <DisclaimerBanner />
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={sStyles.section}>
      <Text style={sStyles.title}>{title}</Text>
      {children}
    </View>
  );
}

function SettingRow({ label, emoji, onPress, danger, loading }: {
  label: string; emoji: string; onPress: () => void; danger?: boolean; loading?: boolean;
}) {
  return (
    <TouchableOpacity style={sStyles.row} onPress={onPress} disabled={loading}>
      <Text style={sStyles.emoji}>{emoji}</Text>
      <Text style={[sStyles.label, danger && sStyles.danger]}>
        {loading ? 'En cours…' : label}
      </Text>
      <Text style={sStyles.arrow}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '800', color: Colors.text, marginBottom: 20 },
  rgpdNote: { fontSize: 13, color: Colors.textSecondary, lineHeight: 21, marginBottom: 12 },
  disclaimer: { backgroundColor: '#FFFBEB', borderRadius: 12, padding: 12, marginBottom: 8 },
  disclaimerText: { fontSize: 12, color: '#78350F', lineHeight: 19 },
  version: { fontSize: 12, color: Colors.textMuted, textAlign: 'center', marginTop: 8 },
});
const sStyles = StyleSheet.create({
  section: { backgroundColor: Colors.card, borderRadius: 20, padding: 18, marginBottom: 14, elevation: 2, shadowColor: Colors.primary, shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } },
  title: { fontSize: 14, fontWeight: '800', color: Colors.textSecondary, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.border, paddingBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: Colors.border },
  emoji: { fontSize: 20, marginRight: 14 },
  label: { flex: 1, fontSize: 15, color: Colors.text, fontWeight: '500' },
  danger: { color: Colors.rouge },
  arrow: { fontSize: 22, color: Colors.textMuted, fontWeight: '300' },
});
