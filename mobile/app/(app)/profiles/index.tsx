import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Colors } from '../../../constants/Colors';
import { useAppStore } from '../../../store/useAppStore';
import { getProfiles, getClinicalData } from '../../../lib/database';
import { Profile, ClinicalData } from '../../../types';
import ProfileCard from '../../../components/ProfileCard';

export default function Profiles() {
  const { activeProfileId, setActiveProfileId } = useAppStore();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [clinicals, setClinicals] = useState<Record<string, ClinicalData | null>>({});

  useFocusEffect(useCallback(() => {
    (async () => {
      const ps = await getProfiles();
      setProfiles(ps);
      const map: Record<string, ClinicalData | null> = {};
      await Promise.all(ps.map(async p => { map[p.id] = await getClinicalData(p.id); }));
      setClinicals(map);
    })();
  }, []));

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>👤 Profils</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/profiles/create')}>
            <Text style={styles.addBtnText}>+ Nouveau</Text>
          </TouchableOpacity>
        </View>

        {profiles.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>👤</Text>
            <Text style={styles.emptyTitle}>Aucun profil</Text>
            <Text style={styles.emptyText}>Créez un profil pour commencer le suivi nutritionnel.</Text>
            <TouchableOpacity style={styles.createBtn} onPress={() => router.push('/profiles/create')}>
              <Text style={styles.createBtnText}>Créer mon premier profil</Text>
            </TouchableOpacity>
          </View>
        ) : (
          profiles.map(p => (
            <ProfileCard
              key={p.id}
              profile={p}
              clinical={clinicals[p.id]}
              isActive={activeProfileId === p.id}
              onPress={() => setActiveProfileId(p.id)}
              onEdit={() => router.push(`/profiles/${p.id}`)}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 22, fontWeight: '800', color: Colors.text },
  addBtn: { backgroundColor: Colors.primary, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: Colors.text, marginBottom: 8 },
  emptyText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', marginBottom: 24 },
  createBtn: { backgroundColor: Colors.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 14 },
  createBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
