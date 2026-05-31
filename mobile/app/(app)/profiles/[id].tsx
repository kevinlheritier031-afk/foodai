import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, Switch, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '../../../constants/Colors';
import { useAppStore } from '../../../store/useAppStore';
import {
  getClinicalData, updateProfile, saveClinicalData,
  deleteProfile, getProfiles,
} from '../../../lib/database';
import { IRC_STAGES, IRC_STAGE_DEFAULTS, IrcStage } from '../../../constants/Medical';
import { ClinicalData, Profile } from '../../../types';
import { API_BASE } from '../../../lib/api';
const RELATIONS = ['moi', 'maman', 'papa', 'conjoint', 'enfant', 'autre'];

export default function EditProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { activeProfileId, setActiveProfileId } = useAppStore();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [analyzeLoading, setAnalyzeLoading] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [nom, setNom] = useState('');
  const [relation, setRelation] = useState('moi');
  const [stade, setStade] = useState<IrcStage>('4');
  const [dfg, setDfg] = useState('');
  const [kaliemie, setKaliemie] = useState('');
  const [diabeteType, setDiabeteType] = useState('Type 2');
  const [hypertension, setHypertension] = useState(false);
  const [noteRdv, setNoteRdv] = useState('');
  const [dateRdv, setDateRdv] = useState('');

  const [seuilK, setSeuilK] = useState('');
  const [seuilP, setSeuilP] = useState('');
  const [seuilNa, setSeuilNa] = useState('');
  const [seuilProt, setSeuilProt] = useState('');
  const [seuilGlucides, setSeuilGlucides] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const profiles = await getProfiles();
      const p = profiles.find(x => x.id === id);
      if (!p) { router.back(); return; }
      setProfile(p);
      setNom(p.nom);
      setRelation(p.relation);

      const clinical: ClinicalData | null = await getClinicalData(id);
      if (clinical) {
        setStade((clinical.stade_irc as IrcStage) || '4');
        setDfg(String(clinical.dfg_ml_min));
        setKaliemie(clinical.kaliemie_mmol_l != null ? String(clinical.kaliemie_mmol_l) : '');
        setDiabeteType(clinical.diabete_type);
        setHypertension(clinical.hypertension);
        setNoteRdv(clinical.note_rdv ?? '');
        setDateRdv(clinical.date_rdv ?? '');
        setSeuilK(String(clinical.potassium_max_mg_jour));
        setSeuilP(String(clinical.phosphore_max_mg_jour));
        setSeuilNa(String(clinical.sodium_max_mg_jour));
        setSeuilProt(String(clinical.proteines_max_g_kg_jour));
        setSeuilGlucides(String(clinical.glucides_max_g_jour ?? 150));
      } else {
        const defaults = IRC_STAGE_DEFAULTS['4'];
        setSeuilK(String(defaults.potassium_max_mg_jour));
        setSeuilP(String(defaults.phosphore_max_mg_jour));
        setSeuilNa(String(defaults.sodium_max_mg_jour));
        setSeuilProt(String(defaults.proteines_max_g_kg_jour));
        setSeuilGlucides(String(defaults.glucides_max_g_jour));
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

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
    if (!id) return;
    if (!nom.trim()) { Alert.alert('Prénom manquant', 'Entrez le prénom du patient.'); return; }
    if (!dfg) { Alert.alert('DFG manquant', 'Entrez le débit de filtration glomérulaire.'); return; }
    setSaving(true);
    try {
      await updateProfile(id, nom.trim(), relation);
      const defaults = IRC_STAGE_DEFAULTS[stade];
      await saveClinicalData(
        id,
        { dfg_ml_min: parseFloat(dfg), stade_irc: stade, kaliemie_mmol_l: kaliemie.trim() ? parseFloat(kaliemie) : null, diabete_type: diabeteType, hypertension },
        {
          potassium_max_mg_jour: parseFloat(seuilK),
          phosphore_max_mg_jour: parseFloat(seuilP),
          sodium_max_mg_jour: parseFloat(seuilNa),
          proteines_max_g_kg_jour: parseFloat(seuilProt),
          glucides_max_g_jour: parseFloat(seuilGlucides),
          potassium_alerte_mg_100g: defaults.potassium_alerte_mg_100g,
          potassium_danger_mg_100g: defaults.potassium_danger_mg_100g,
          phosphore_alerte_mg_100g: defaults.phosphore_alerte_mg_100g,
          sodium_alerte_mg_100g: defaults.sodium_alerte_mg_100g,
        },
        noteRdv.trim() || undefined,
        dateRdv.trim() || undefined,
      );
      router.back();
    } catch (e: any) {
      Alert.alert('Erreur', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!id || !profile) return;
    Alert.alert(
      'Supprimer le profil',
      `Supprimer "${profile.nom}" et toutes ses données (journal, données cliniques) ? Cette action est irréversible.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              if (activeProfileId === id) setActiveProfileId(null);
              await deleteProfile(id);
              router.replace('/(app)/profiles');
            } catch (e: any) {
              Alert.alert('Erreur', e.message);
            }
          },
        },
      ],
    );
  };

  const pickAndAnalyze = async (source: 'camera' | 'gallery') => {
    let imgs: { base64: string }[] = [];
    if (source === 'camera') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) { Alert.alert('Permission refusée', 'Autorisez l\'accès à la caméra.'); return; }
      const res = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.4 });
      if (res.canceled || !res.assets?.[0]?.base64) return;
      imgs = [{ base64: res.assets[0].base64! }];
    } else {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { Alert.alert('Permission refusée', 'Autorisez l\'accès à la galerie.'); return; }
      const res = await ImagePicker.launchImageLibraryAsync({
        base64: true, quality: 0.4,
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true, orderedSelection: true,
      });
      if (res.canceled || !res.assets?.length) return;
      imgs = res.assets.filter(a => a.base64).map(a => ({ base64: a.base64! }));
    }
    if (imgs.length === 0) return;
    setAnalyzeLoading(true);
    const ctrl = new AbortController();
    const timeoutId = setTimeout(() => ctrl.abort(), 90_000);
    try {
      const resp = await fetch(`${API_BASE}/api/analyze-bloodtest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: imgs.map(i => ({ base64: i.base64, mime_type: 'image/jpeg' })) }),
        signal: ctrl.signal,
      });
      clearTimeout(timeoutId);
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ detail: `Erreur ${resp.status}` }));
        throw new Error(err.detail ?? `Erreur ${resp.status}`);
      }
      const data = await resp.json();
      const v = data.valeurs ?? {};
      const filled: string[] = [];
      if (v.dfg != null)      { setDfg(String(v.dfg));           filled.push(`DFG : ${v.dfg} mL/min`); }
      if (v.kaliemie != null) { setKaliemie(String(v.kaliemie)); filled.push(`K⁺ : ${v.kaliemie} mmol/L`); }
      if (filled.length > 0) {
        Alert.alert('Valeurs importées', `${filled.join('\n')}\n\nVérifiez et enregistrez.`);
      } else {
        Alert.alert('Aucune valeur trouvée', 'DFG et K⁺ non lisibles. Essayez avec une meilleure photo.');
      }
    } catch (e: any) {
      clearTimeout(timeoutId);
      const msg = e?.name === 'AbortError'
        ? 'Délai dépassé (90s). Réessayez avec moins de photos ou une meilleure connexion.'
        : (e?.message ?? String(e));
      Alert.alert('Erreur analyse', msg);
    } finally {
      setAnalyzeLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator style={{ flex: 1 }} color={Colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Modifier le profil</Text>
        <Text style={styles.subtitle}>Mettez à jour les données après chaque rendez-vous médical.</Text>

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
          <Text style={styles.seuilsNote}>⚕️ Stade {stade} — modifiez selon prescription lors du prochain rendez-vous</Text>
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

        <Section title="Suivi médical (optionnel)">
          <Field label="Note rendez-vous">
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={noteRdv}
              onChangeText={setNoteRdv}
              placeholder="ex : Néphrologue a ajusté la restriction K à 1800 mg/j"
              multiline
              numberOfLines={3}
            />
          </Field>
          <Field label="Date du prochain RDV">
            <TextInput style={styles.input} value={dateRdv} onChangeText={setDateRdv} placeholder="ex : 2026-09-15" />
          </Field>
        </Section>

        <Section title="Importer une prise de sang">
          <Text style={styles.hint}>
            L'IA analysera vos résultats et remplira automatiquement le DFG et la kaliémie ci-dessus.
            Sélection multiple possible (plusieurs pages).
          </Text>
          {analyzeLoading ? (
            <View style={{ alignItems: 'center', paddingVertical: 16, gap: 8 }}>
              <ActivityIndicator color={Colors.primary} />
              <Text style={{ color: Colors.textSecondary, fontSize: 13 }}>Analyse en cours…</Text>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                style={[styles.labBtn]}
                onPress={() => pickAndAnalyze('camera')}
              >
                <Text style={{ fontSize: 26, textAlign: 'center' }}>📷</Text>
                <Text style={styles.labBtnText}>Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.labBtn]}
                onPress={() => pickAndAnalyze('gallery')}
              >
                <Text style={{ fontSize: 26, textAlign: 'center' }}>🖼️</Text>
                <Text style={styles.labBtnText}>Galerie</Text>
              </TouchableOpacity>
            </View>
          )}
        </Section>

        <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
          <Text style={styles.saveBtnText}>{saving ? 'Enregistrement…' : '✅ Enregistrer les modifications'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
          <Text style={styles.deleteBtnText}>Supprimer ce profil</Text>
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
  inputMultiline: { minHeight: 72, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.card },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600', textTransform: 'capitalize' },
  chipTextActive: { color: '#fff' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: Colors.text },
  seuilsNote: { fontSize: 12, color: Colors.textSecondary, marginBottom: 12, fontStyle: 'italic' },
  labBtn: {
    flex: 1, backgroundColor: Colors.primaryLight, borderRadius: 12,
    padding: 14, alignItems: 'center', gap: 6,
  },
  labBtnText: { fontSize: 13, fontWeight: '700', color: Colors.primary, textAlign: 'center' },
  saveBtn: { backgroundColor: Colors.primary, borderRadius: 14, padding: 18, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  deleteBtn: { marginTop: 16, borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: Colors.danger },
  deleteBtnText: { color: Colors.danger, fontWeight: '700', fontSize: 15 },
});

const sStyles = StyleSheet.create({
  section: { backgroundColor: Colors.card, borderRadius: 16, padding: 16, marginBottom: 16, elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: Colors.text, marginBottom: 14, borderBottomWidth: 1, borderBottomColor: Colors.border, paddingBottom: 10 },
  field: { marginBottom: 14 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6 },
});
