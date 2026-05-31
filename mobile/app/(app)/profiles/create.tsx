import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Colors } from '../../../constants/Colors';
import { useAppStore } from '../../../store/useAppStore';
import { createProfile, saveClinicalData } from '../../../lib/database';
import { IRC_STAGES, IRC_STAGE_DEFAULTS, IrcStage } from '../../../constants/Medical';

const RELATIONS = ['moi', 'maman', 'papa', 'conjoint', 'enfant', 'autre'];

export default function CreateProfile() {
  const { setActiveProfileId } = useAppStore();
  const [nom, setNom] = useState('');
  const [relation, setRelation] = useState('moi');
  const [stade, setStade] = useState<IrcStage>('4');
  const [dfg, setDfg] = useState('');
  const [kaliemie, setKaliemie] = useState('');
  const [diabeteType, setDiabeteType] = useState('Type 2');
  const [hypertension, setHypertension] = useState(false);
  const [loading, setLoading] = useState(false);

  // Seuils — auto-remplis selon le stade, modifiables
  const defaults = IRC_STAGE_DEFAULTS[stade];
  const [seuilK, setSeuilK] = useState(String(defaults.potassium_max_mg_jour));
  const [seuilP, setSeuilP] = useState(String(defaults.phosphore_max_mg_jour));
  const [seuilNa, setSeuilNa] = useState(String(defaults.sodium_max_mg_jour));
  const [seuilProt, setSeuilProt] = useState(String(defaults.proteines_max_g_kg_jour));
  const [seuilGlucides, setSeuilGlucides] = useState(String(defaults.glucides_max_g_jour));

  const onStageChange = (s: IrcStage) => {
    setStade(s);
    const d = IRC_STAGE_DEFAULTS[s];
    setSeuilK(String(d.potassium_max_mg_jour));
    setSeuilP(String(d.phosphore_max_mg_jour));
    setSeuilNa(String(d.sodium_max_mg_jour));
    setSeuilProt(String(d.proteines_max_g_kg_jour));
    setSeuilGlucides(String(d.glucides_max_g_jour));
  };

  const handleSave = async () => {
    if (!nom.trim()) { Alert.alert('Prénom manquant', 'Entrez le prénom du patient.'); return; }
    if (!dfg) { Alert.alert('DFG manquant', 'Entrez le débit de filtration glomérulaire.'); return; }
    setLoading(true);
    try {
      const profile = await createProfile(nom.trim(), relation);
      await saveClinicalData(
        profile.id,
        { dfg_ml_min: parseFloat(dfg), stade_irc: stade, kaliemie_mmol_l: kaliemie.trim() ? parseFloat(kaliemie) : null, diabete_type: diabeteType, hypertension },
        { potassium_max_mg_jour: parseFloat(seuilK), phosphore_max_mg_jour: parseFloat(seuilP), sodium_max_mg_jour: parseFloat(seuilNa), proteines_max_g_kg_jour: parseFloat(seuilProt), glucides_max_g_jour: parseFloat(seuilGlucides), potassium_alerte_mg_100g: defaults.potassium_alerte_mg_100g, potassium_danger_mg_100g: defaults.potassium_danger_mg_100g, phosphore_alerte_mg_100g: defaults.phosphore_alerte_mg_100g, sodium_alerte_mg_100g: defaults.sodium_alerte_mg_100g },
      );
      setActiveProfileId(profile.id);
      router.replace('/(app)');
    } catch (e: any) {
      Alert.alert('Erreur', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Nouveau profil</Text>
        <Text style={styles.subtitle}>Les seuils sont pré-remplis selon le stade IRC.{'\n'}Modifiez-les selon les prescriptions du médecin.</Text>

        <Section title="Identité">
          <Field label="Prénom / Nom">
            <TextInput style={styles.input} value={nom} onChangeText={setNom} placeholder="Marie" />
          </Field>
          <Field label="Relation">
            <View style={styles.chips}>
              {RELATIONS.map(r => (
                <TouchableOpacity key={r} style={[styles.chip, relation === r && styles.chipActive]} onPress={() => setRelation(r)}>
                  <Text style={[styles.chipText, relation === r && styles.chipTextActive]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Field>
        </Section>

        <Section title="Données cliniques (médecin)">
          <Field label="Stade IRC">
            <View style={styles.chips}>
              {IRC_STAGES.map(s => (
                <TouchableOpacity key={s} style={[styles.chip, stade === s && styles.chipActive]} onPress={() => onStageChange(s)}>
                  <Text style={[styles.chipText, stade === s && styles.chipTextActive]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Field>
          <Field label="DFG (mL/min/1.73m²)">
            <TextInput style={styles.input} value={dfg} onChangeText={setDfg} keyboardType="numeric" placeholder="ex : 19" />
          </Field>
          <Field label="Kaliémie K⁺ (mmol/L) — optionnel">
            <TextInput style={styles.input} value={kaliemie} onChangeText={setKaliemie} keyboardType="numeric" placeholder="ex : 5.1  (laisser vide si inconnu)" />
            <Text style={styles.hint}>Valeur K⁺ sur votre dernière prise de sang (prescrite par le néphrologue).</Text>
          </Field>
          <Field label="Diabète">
            <View style={styles.chips}>
              {['Type 1', 'Type 2', 'Non'].map(t => (
                <TouchableOpacity key={t} style={[styles.chip, diabeteType === t && styles.chipActive]} onPress={() => setDiabeteType(t)}>
                  <Text style={[styles.chipText, diabeteType === t && styles.chipTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Field>
          <View style={styles.switchRow}>
            <Text style={styles.fieldLabel}>Hypertension artérielle</Text>
            <Switch value={hypertension} onValueChange={setHypertension} trackColor={{ true: Colors.primary }} />
          </View>
        </Section>

        <Section title="Seuils quotidiens (prescrits par le médecin)">
          <Text style={styles.seuilsNote}>⚕️ Valeurs par défaut stade {stade} — à ajuster selon prescription</Text>
          {[
            { label: 'Potassium max (mg/j)', value: seuilK, set: setSeuilK },
            { label: 'Phosphore max (mg/j)', value: seuilP, set: setSeuilP },
            { label: 'Sodium max (mg/j)', value: seuilNa, set: setSeuilNa },
            { label: 'Protéines max (g/kg/j)', value: seuilProt, set: setSeuilProt },
            { label: 'Glucides max (g/j)', value: seuilGlucides, set: setSeuilGlucides },
          ].map(f => (
            <Field key={f.label} label={f.label}>
              <TextInput style={styles.input} value={f.value} onChangeText={f.set} keyboardType="numeric" />
            </Field>
          ))}
        </Section>

        <TouchableOpacity style={[styles.saveBtn, loading && { opacity: 0.6 }]} onPress={handleSave} disabled={loading}>
          <Text style={styles.saveBtnText}>{loading ? 'Enregistrement…' : '✅ Créer le profil'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={sStyles.section}>
      <Text style={sStyles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={sStyles.field}>
      <Text style={sStyles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingBottom: 40 },
  back: { marginBottom: 20 },
  backText: { color: Colors.primary, fontWeight: '600', fontSize: 15 },
  title: { fontSize: 24, fontWeight: '800', color: Colors.text, marginBottom: 6 },
  subtitle: { fontSize: 13, color: Colors.textSecondary, lineHeight: 20, marginBottom: 24 },
  input: { backgroundColor: Colors.inputBg, borderRadius: 10, padding: 12, fontSize: 15, borderWidth: 1, borderColor: Colors.border, color: Colors.text },
  hint: { fontSize: 11, color: Colors.textSecondary, marginTop: 4, fontStyle: 'italic' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.card },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600', textTransform: 'capitalize' },
  chipTextActive: { color: '#fff' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: Colors.text },
  seuilsNote: { fontSize: 12, color: Colors.textSecondary, marginBottom: 12, fontStyle: 'italic' },
  saveBtn: { backgroundColor: Colors.primary, borderRadius: 14, padding: 18, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
const sStyles = StyleSheet.create({
  section: { backgroundColor: Colors.card, borderRadius: 16, padding: 16, marginBottom: 16, elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: Colors.text, marginBottom: 14, borderBottomWidth: 1, borderBottomColor: Colors.border, paddingBottom: 10 },
  field: { marginBottom: 14 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6 },
});
