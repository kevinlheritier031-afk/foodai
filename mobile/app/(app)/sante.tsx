import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, Modal, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Colors } from '../../constants/Colors';
import { useAppStore } from '../../store/useAppStore';
import {
  addBloodPressure, getBloodPressures, deleteBloodPressure,
  addGlycemieEntry, getGlycemieEntries, deleteGlycemieEntry,
  getClinicalData, getDailySummary, addChatMessage, getProfileById,
} from '../../lib/database';
import { sendAriaMessage } from '../../lib/api';
import { BloodPressure, GlycemieEntry, MomentGlycemie } from '../../types';

const todayISO = () => new Date().toISOString().split('T')[0];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
    + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function bpColor(sys: number, dia: number): string {
  if (sys >= 180 || dia >= 110) return Colors.rouge;
  if (sys >= 140 || dia >= 90)  return Colors.orange;
  return Colors.vert;
}

function bpLabel(sys: number, dia: number): string {
  if (sys >= 180 || dia >= 110) return 'Urgence';
  if (sys >= 140 || dia >= 90)  return 'Élevée';
  if (sys < 90  || dia < 60)   return 'Basse';
  return 'Normale';
}

function glycemieColor(val: number): string {
  if (val < 70)  return Colors.rouge;
  if (val > 180) return Colors.orange;
  return Colors.vert;
}

function glycemieLabel(val: number): string {
  if (val < 70)  return 'HYPO';
  if (val > 180) return 'HYPER';
  return 'Normal';
}

const MOMENT_LABELS: Record<MomentGlycemie, string> = {
  a_jeun:      'À jeun',
  avant_repas: 'Avant repas',
  apres_repas: 'Après repas',
  coucher:     'Coucher',
  autre:       'Autre',
};

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function Sante() {
  const { activeProfileId } = useAppStore();
  const [readings, setReadings]     = useState<BloodPressure[]>([]);
  const [glycemies, setGlycemies]   = useState<GlycemieEntry[]>([]);
  const [bpModalVisible, setBpModalVisible]           = useState(false);
  const [glycemieModalVisible, setGlycemieModalVisible] = useState(false);
  const [ariaThinking, setAriaThinking] = useState(false);
  const [exporting, setExporting]       = useState(false);

  const load = useCallback(async () => {
    if (!activeProfileId) return;
    const [bp, gly] = await Promise.all([
      getBloodPressures(activeProfileId),
      getGlycemieEntries(activeProfileId),
    ]);
    setReadings(bp);
    setGlycemies(gly);
  }, [activeProfileId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // ── Alerte automatique Aria ────────────────────────────────────────────────
  const sendAriaAlert = useCallback(async (triggerMsg: string) => {
    if (!activeProfileId) return;
    setAriaThinking(true);
    try {
      const [clinical, summary] = await Promise.all([
        getClinicalData(activeProfileId),
        getDailySummary(activeProfileId, todayISO()),
      ]);
      if (!clinical) return;

      const response = await sendAriaMessage({
        message: triggerMsg,
        profil: {
          dfg_ml_min:      clinical.dfg_ml_min,
          stade_irc:       clinical.stade_irc,
          kaliemie_mmol_l: clinical.kaliemie_mmol_l ?? null,
          diabete_type:    clinical.diabete_type,
          hypertension:    Boolean(clinical.hypertension),
        },
        seuils: {
          potassium_max_mg_jour:    clinical.potassium_max_mg_jour,
          phosphore_max_mg_jour:    clinical.phosphore_max_mg_jour,
          sodium_max_mg_jour:       clinical.sodium_max_mg_jour,
          proteines_max_g_kg_jour:  clinical.proteines_max_g_kg_jour,
          glucides_max_g_jour:      clinical.glucides_max_g_jour,
          potassium_alerte_mg_100g: clinical.potassium_alerte_mg_100g,
          potassium_danger_mg_100g: clinical.potassium_danger_mg_100g,
          phosphore_alerte_mg_100g: clinical.phosphore_alerte_mg_100g,
          sodium_alerte_mg_100g:    clinical.sodium_alerte_mg_100g,
        },
        resume_jour: summary ?? null,
        historique: [],
      });

      // Sauvegarder le message déclencheur + la réponse Aria dans le chat
      await addChatMessage(activeProfileId, 'user', triggerMsg);
      await addChatMessage(activeProfileId, 'assistant', response);
    } catch (e: any) {
      console.warn('Aria alert failed:', e?.message);
    } finally {
      setAriaThinking(false);
    }
  }, [activeProfileId]);

  // ── Export PDF ────────────────────────────────────────────────────────────
  const handleExportPDF = useCallback(async () => {
    if (!activeProfileId) return;
    setExporting(true);
    try {
      const [profile, clinical] = await Promise.all([
        getProfileById(activeProfileId),
        getClinicalData(activeProfileId),
      ]);
      const exportDate = new Date().toLocaleDateString('fr-FR', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      });
      const patientName = profile ? `${profile.nom} (${profile.relation})` : 'Patient';
      const stade = clinical ? `IRC Stade ${clinical.stade_irc} — DFG ${clinical.dfg_ml_min} mL/min` : '';

      const bpRows = readings.map(r => `
        <tr>
          <td>${formatDateTime(r.measured_at)}</td>
          <td style="color:${bpColor(r.systolique, r.diastolique)};font-weight:700">${r.systolique}/${r.diastolique} mmHg</td>
          <td style="color:${bpColor(r.systolique, r.diastolique)}">${bpLabel(r.systolique, r.diastolique)}</td>
          <td>${r.pouls ? r.pouls + ' bpm' : '—'}</td>
          <td>${r.note ?? '—'}</td>
        </tr>`).join('');

      const glyRows = glycemies.map(r => `
        <tr>
          <td>${formatDateTime(r.measured_at)}</td>
          <td style="color:${glycemieColor(r.glycemie_mg_dl)};font-weight:700">${Math.round(r.glycemie_mg_dl)} mg/dL</td>
          <td style="color:${glycemieColor(r.glycemie_mg_dl)}">${glycemieLabel(r.glycemie_mg_dl)}</td>
          <td>${MOMENT_LABELS[r.moment]}</td>
          <td>${r.note ?? '—'}</td>
        </tr>`).join('');

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>
  body { font-family: Arial, sans-serif; margin: 32px; color: #1a202c; font-size: 13px; }
  h1   { color: #2563EB; margin: 0; font-size: 22px; }
  h2   { color: #374151; font-size: 16px; margin-top: 28px; border-bottom: 2px solid #E5E7EB; padding-bottom: 6px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
  .logo   { font-size: 28px; }
  .meta   { color: #6B7280; font-size: 12px; line-height: 1.6; }
  .badge  { display: inline-block; background: #EFF6FF; color: #2563EB; border-radius: 6px; padding: 2px 10px; font-size: 12px; font-weight: 700; margin-top: 4px; }
  table   { width: 100%; border-collapse: collapse; margin-top: 12px; }
  th      { background: #F3F4F6; padding: 8px 10px; text-align: left; font-size: 12px; color: #6B7280; }
  td      { padding: 8px 10px; border-bottom: 1px solid #F3F4F6; }
  tr:hover td { background: #FAFAFA; }
  .empty  { color: #9CA3AF; font-style: italic; padding: 16px 0; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #E5E7EB; color: #9CA3AF; font-size: 11px; }
  .aria   { color: #7C3AED; font-weight: 700; }
</style></head><body>
<div class="header">
  <div>
    <h1>FoodAI — Carnet de santé</h1>
    <div class="meta">
      Patient : <strong>${patientName}</strong><br/>
      ${stade ? `Profil clinique : ${stade}<br/>` : ''}
      Exporté le : ${exportDate}
    </div>
    ${readings.length > 0 || glycemies.length > 0 ? `<span class="badge">${readings.length + glycemies.length} mesure(s)</span>` : ''}
  </div>
  <div class="logo">✦</div>
</div>

<h2>🩺 Tension artérielle</h2>
${readings.length === 0 ? '<p class="empty">Aucune mesure enregistrée.</p>' : `
<table>
  <thead><tr><th>Date & heure</th><th>Tension</th><th>Statut</th><th>Pouls</th><th>Note</th></tr></thead>
  <tbody>${bpRows}</tbody>
</table>`}

<h2>🩸 Glycémie capillaire</h2>
${glycemies.length === 0 ? '<p class="empty">Aucune mesure enregistrée.</p>' : `
<table>
  <thead><tr><th>Date & heure</th><th>Valeur</th><th>Statut</th><th>Moment</th><th>Note</th></tr></thead>
  <tbody>${glyRows}</tbody>
</table>`}

<div class="footer">
  Document généré par <span class="aria">FoodAI ✦ Aria</span> — outil d'accompagnement nutritionnel non médical.<br/>
  Ce document ne remplace pas un avis médical. À transmettre à votre équipe soignante.
</div>
</body></html>`;

      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Partager le carnet de santé',
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('PDF généré', `Fichier sauvegardé à :\n${uri}`);
      }
    } catch (e: any) {
      Alert.alert('Erreur export', e.message ?? 'Impossible de générer le PDF.');
    } finally {
      setExporting(false);
    }
  }, [activeProfileId, readings, glycemies]);

  const handleDeleteBP = (id: string) => {
    Alert.alert('Supprimer', 'Supprimer cette mesure de tension ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => { await deleteBloodPressure(id); load(); } },
    ]);
  };

  const handleDeleteGlycemie = (id: string) => {
    Alert.alert('Supprimer', 'Supprimer cette mesure de glycémie ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => { await deleteGlycemieEntry(id); load(); } },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      {ariaThinking && (
        <View style={styles.ariaBar}>
          <ActivityIndicator size="small" color="#7C3AED" />
          <Text style={styles.ariaBarText}>Aria analyse votre mesure…</Text>
        </View>
      )}

      <View style={styles.exportRow}>
        <Text style={styles.exportLabel}>Carnet de santé</Text>
        <TouchableOpacity
          style={[styles.exportBtn, exporting && { opacity: 0.6 }]}
          onPress={handleExportPDF}
          disabled={exporting}
        >
          {exporting
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.exportBtnText}>📄 Exporter PDF</Text>
          }
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>

        {/* ─── Tension artérielle ─── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>🩺 Tension artérielle</Text>
            <TouchableOpacity style={styles.addBtn} onPress={() => setBpModalVisible(true)}>
              <Text style={styles.addBtnText}>+ Ajouter</Text>
            </TouchableOpacity>
          </View>
          {readings.length === 0 ? (
            <Text style={styles.empty}>Aucune mesure enregistrée.</Text>
          ) : (
            readings.map(r => (
              <View key={r.id} style={styles.readingRow}>
                <View style={[styles.bpBadge, { backgroundColor: bpColor(r.systolique, r.diastolique) + '20' }]}>
                  <Text style={[styles.bpValue, { color: bpColor(r.systolique, r.diastolique) }]}>
                    {r.systolique}/{r.diastolique}
                  </Text>
                  <Text style={[styles.bpStatus, { color: bpColor(r.systolique, r.diastolique) }]}>
                    {bpLabel(r.systolique, r.diastolique)}
                  </Text>
                  <Text style={styles.bpUnit}>mmHg</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowDate}>{formatDateTime(r.measured_at)}</Text>
                  {r.pouls ? <Text style={styles.rowMeta}>❤️ {r.pouls} bpm</Text> : null}
                  {r.note ? <Text style={styles.rowNote}>{r.note}</Text> : null}
                </View>
                <TouchableOpacity onPress={() => handleDeleteBP(r.id)} style={styles.deleteBtn}>
                  <Text style={styles.deleteIcon}>🗑️</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        {/* ─── Glycémie capillaire ─── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>🩸 Glycémie capillaire</Text>
            <TouchableOpacity style={styles.addBtn} onPress={() => setGlycemieModalVisible(true)}>
              <Text style={styles.addBtnText}>+ Ajouter</Text>
            </TouchableOpacity>
          </View>
          {glycemies.length === 0 ? (
            <Text style={styles.empty}>Aucune mesure enregistrée.</Text>
          ) : (
            glycemies.map(r => (
              <View key={r.id} style={styles.readingRow}>
                <View style={[styles.glucoseBadge, { backgroundColor: glycemieColor(r.glycemie_mg_dl) + '20' }]}>
                  <Text style={[styles.glucoseValue, { color: glycemieColor(r.glycemie_mg_dl) }]}>
                    {Math.round(r.glycemie_mg_dl)}
                  </Text>
                  <Text style={[styles.glucoseStatus, { color: glycemieColor(r.glycemie_mg_dl) }]}>
                    {glycemieLabel(r.glycemie_mg_dl)}
                  </Text>
                  <Text style={styles.bpUnit}>mg/dL</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowDate}>{formatDateTime(r.measured_at)}</Text>
                  <Text style={styles.rowMeta}>{MOMENT_LABELS[r.moment]}</Text>
                  {r.note ? <Text style={styles.rowNote}>{r.note}</Text> : null}
                </View>
                <TouchableOpacity onPress={() => handleDeleteGlycemie(r.id)} style={styles.deleteBtn}>
                  <Text style={styles.deleteIcon}>🗑️</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        <View style={styles.ariaHint}>
          <Text style={styles.ariaHintText}>✦ Aria analyse automatiquement chaque nouvelle mesure et vous donne des conseils personnalisés dans l'onglet Aria.</Text>
        </View>

      </ScrollView>

      <AddBPModal
        visible={bpModalVisible}
        profileId={activeProfileId}
        onClose={() => setBpModalVisible(false)}
        onSaved={(msg) => { setBpModalVisible(false); load(); sendAriaAlert(msg); }}
      />

      <AddGlycemieModal
        visible={glycemieModalVisible}
        profileId={activeProfileId}
        onClose={() => setGlycemieModalVisible(false)}
        onSaved={(msg) => { setGlycemieModalVisible(false); load(); sendAriaAlert(msg); }}
      />
    </SafeAreaView>
  );
}

// ─── Modal ajout tension ──────────────────────────────────────────────────────

function AddBPModal({ visible, profileId, onClose, onSaved }: {
  visible: boolean; profileId: string | null;
  onClose: () => void; onSaved: (ariaMsg: string) => void;
}) {
  const [sys, setSys]     = useState('');
  const [dia, setDia]     = useState('');
  const [pouls, setPouls] = useState('');
  const [note, setNote]   = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => { setSys(''); setDia(''); setPouls(''); setNote(''); };

  const handleSave = async () => {
    if (!profileId) return;
    const s = parseInt(sys), d = parseInt(dia);
    if (!s || !d || s < 50 || s > 300 || d < 30 || d > 200) {
      Alert.alert('Valeurs invalides', 'Vérifiez les valeurs de tension (ex: 13/8).');
      return;
    }
    setSaving(true);
    try {
      const now = new Date();
      await addBloodPressure(profileId, s, d, pouls ? parseInt(pouls) : null, note.trim() || null, now.toISOString());
      const label = bpLabel(s, d);
      const time  = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      const poulsStr = pouls ? ` — pouls ${pouls} bpm` : '';
      const noteStr  = note.trim() ? ` — "${note.trim()}"` : '';
      reset();
      onSaved(`🩺 Nouvelle mesure de tension : ${s}/${d} mmHg (${label})${poulsStr} à ${time}${noteStr}. Merci d'analyser cette valeur et de me donner tes conseils personnalisés.`);
    } catch (e: any) {
      Alert.alert('Erreur', e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={modal.overlay}>
        <View style={modal.sheet}>
          <Text style={modal.title}>🩺 Nouvelle mesure</Text>
          <Text style={modal.dateText}>
            📅 {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            {' · '}{new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </Text>

          <View style={modal.row}>
            <View style={{ flex: 1 }}>
              <Text style={modal.label}>Systolique</Text>
              <TextInput style={modal.input} value={sys} onChangeText={setSys} keyboardType="numeric" placeholder="ex: 130" />
            </View>
            <Text style={modal.slash}>/</Text>
            <View style={{ flex: 1 }}>
              <Text style={modal.label}>Diastolique</Text>
              <TextInput style={modal.input} value={dia} onChangeText={setDia} keyboardType="numeric" placeholder="ex: 80" />
            </View>
          </View>

          <Text style={modal.label}>Pouls (bpm) — optionnel</Text>
          <TextInput style={modal.input} value={pouls} onChangeText={setPouls} keyboardType="numeric" placeholder="ex: 72" />

          <Text style={modal.label}>Note — optionnel</Text>
          <TextInput style={[modal.input, { minHeight: 60, textAlignVertical: 'top' }]}
            value={note} onChangeText={setNote} multiline
            placeholder="ex: au réveil, après effort…" />

          <View style={modal.actions}>
            <TouchableOpacity style={modal.cancelBtn} onPress={() => { reset(); onClose(); }}>
              <Text style={modal.cancelText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[modal.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
              <Text style={modal.saveText}>{saving ? 'Enregistrement…' : '✅ Enregistrer'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Modal ajout glycémie ─────────────────────────────────────────────────────

const MOMENTS: MomentGlycemie[] = ['a_jeun', 'avant_repas', 'apres_repas', 'coucher', 'autre'];

function AddGlycemieModal({ visible, profileId, onClose, onSaved }: {
  visible: boolean; profileId: string | null;
  onClose: () => void; onSaved: (ariaMsg: string) => void;
}) {
  const [valeur, setValeur]   = useState('');
  const [moment, setMoment]   = useState<MomentGlycemie>('a_jeun');
  const [note, setNote]       = useState('');
  const [saving, setSaving]   = useState(false);

  const reset = () => { setValeur(''); setMoment('a_jeun'); setNote(''); };

  const handleSave = async () => {
    if (!profileId) return;
    const v = parseFloat(valeur.replace(',', '.'));
    if (isNaN(v) || v < 10 || v > 600) {
      Alert.alert('Valeur invalide', 'Entrez une glycémie valide en mg/dL (ex: 120).');
      return;
    }
    setSaving(true);
    try {
      const now = new Date();
      await addGlycemieEntry(profileId, v, moment, note.trim() || null, now.toISOString());
      const status     = glycemieLabel(v);
      const momentStr  = MOMENT_LABELS[moment];
      const time       = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      const noteStr    = note.trim() ? ` — "${note.trim()}"` : '';
      reset();
      onSaved(`🩸 Nouvelle glycémie capillaire : ${Math.round(v)} mg/dL (${status}) — ${momentStr} à ${time}${noteStr}. Merci d'analyser cette valeur et de me donner tes conseils personnalisés.`);
    } catch (e: any) {
      Alert.alert('Erreur', e.message);
    } finally {
      setSaving(false);
    }
  };

  const color = valeur ? glycemieColor(parseFloat(valeur.replace(',', '.'))) : Colors.textMuted;
  const parsedVal = parseFloat(valeur.replace(',', '.'));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={modal.overlay}>
        <View style={modal.sheet}>
          <Text style={modal.title}>🩸 Glycémie capillaire</Text>
          <Text style={modal.dateText}>
            📅 {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            {' · '}{new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </Text>

          <Text style={modal.label}>Valeur (mg/dL)</Text>
          <View style={modal.glucoseRow}>
            <TextInput
              style={[modal.glucoseInput, { borderColor: !isNaN(parsedVal) && valeur ? color : Colors.border }]}
              value={valeur} onChangeText={setValeur}
              keyboardType="numeric" placeholder="ex: 120"
            />
            {!isNaN(parsedVal) && valeur ? (
              <View style={[modal.glucoseChip, { backgroundColor: color + '20' }]}>
                <Text style={[modal.glucoseChipText, { color }]}>{glycemieLabel(parsedVal)}</Text>
              </View>
            ) : null}
          </View>

          <Text style={modal.label}>Moment</Text>
          <View style={modal.momentRow}>
            {MOMENTS.map(m => (
              <TouchableOpacity
                key={m}
                style={[modal.momentBtn, moment === m && { backgroundColor: Colors.primary }]}
                onPress={() => setMoment(m)}
              >
                <Text style={[modal.momentText, moment === m && { color: '#fff' }]}>
                  {MOMENT_LABELS[m]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.hint}>Hypo &lt; 70 · Normal 70–180 · Hyper &gt; 180</Text>

          <Text style={modal.label}>Note — optionnel</Text>
          <TextInput style={[modal.input, { minHeight: 52, textAlignVertical: 'top' }]}
            value={note} onChangeText={setNote} multiline
            placeholder="ex: après sport, symptômes…" />

          <View style={modal.actions}>
            <TouchableOpacity style={modal.cancelBtn} onPress={() => { reset(); onClose(); }}>
              <Text style={modal.cancelText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[modal.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
              <Text style={modal.saveText}>{saving ? 'Enregistrement…' : '✅ Enregistrer'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 32 },
  section: {
    backgroundColor: Colors.card, borderRadius: 20, padding: 18, marginBottom: 16,
    elevation: 2, shadowColor: Colors.primary, shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 3 },
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: Colors.text },
  addBtn: { backgroundColor: Colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, elevation: 2, shadowColor: Colors.primary, shadowOpacity: 0.30, shadowRadius: 5, shadowOffset: { width: 0, height: 2 } },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  empty: { color: Colors.textMuted, textAlign: 'center', paddingVertical: 14, fontSize: 14 },
  readingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  bpBadge: { borderRadius: 14, padding: 10, alignItems: 'center', minWidth: 82 },
  bpValue: { fontSize: 20, fontWeight: '800' },
  bpStatus: { fontSize: 10, fontWeight: '700', marginTop: 1 },
  bpUnit: { fontSize: 11, color: Colors.textMuted },
  glucoseBadge: { borderRadius: 14, padding: 10, alignItems: 'center', minWidth: 82 },
  glucoseValue: { fontSize: 20, fontWeight: '800' },
  glucoseStatus: { fontSize: 11, fontWeight: '700', marginTop: 1 },
  rowDate: { fontSize: 13, fontWeight: '700', color: Colors.text, marginBottom: 2 },
  rowMeta: { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  rowNote: { fontSize: 12, color: Colors.textMuted, fontStyle: 'italic', marginTop: 2 },
  deleteBtn: { padding: 6, marginTop: 2 },
  deleteIcon: { fontSize: 18 },
  hint: { fontSize: 11, color: Colors.textMuted, textAlign: 'center', marginBottom: 12 },
  exportRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10, backgroundColor: Colors.card,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  exportLabel: { fontSize: 15, fontWeight: '700', color: Colors.text },
  exportBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.renal, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    minWidth: 44, justifyContent: 'center',
    elevation: 2, shadowColor: Colors.renal, shadowOpacity: 0.30, shadowRadius: 5, shadowOffset: { width: 0, height: 2 },
  },
  exportBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  ariaBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.primaryLight, paddingHorizontal: 16, paddingVertical: 10,
  },
  ariaBarText: { fontSize: 13, color: Colors.primary, fontWeight: '600' },
  ariaHint: {
    backgroundColor: Colors.primaryLight, borderRadius: 14, padding: 14, marginTop: 4,
  },
  ariaHintText: { fontSize: 13, color: Colors.primary, lineHeight: 20, textAlign: 'center' },
});

const modal = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '800', color: Colors.text, marginBottom: 4 },
  dateText: { fontSize: 13, color: Colors.textMuted, marginBottom: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  slash: { fontSize: 28, fontWeight: '800', color: Colors.textSecondary, marginTop: 18 },
  label: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: Colors.inputBg, borderRadius: 14, padding: 13, fontSize: 16, borderWidth: 1.5, borderColor: Colors.border, marginBottom: 14, color: Colors.text },
  actions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelBtn: { flex: 1, borderRadius: 14, padding: 15, alignItems: 'center', borderWidth: 1.5, borderColor: Colors.border },
  cancelText: { color: Colors.textSecondary, fontWeight: '700' },
  saveBtn: { flex: 1, backgroundColor: Colors.primary, borderRadius: 14, padding: 15, alignItems: 'center', elevation: 3, shadowColor: Colors.primary, shadowOpacity: 0.35, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
  saveText: { color: '#fff', fontWeight: '800' },
  glucoseRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  glucoseInput: { flex: 1, backgroundColor: Colors.inputBg, borderRadius: 14, padding: 13, fontSize: 22, fontWeight: '800', borderWidth: 2, textAlign: 'center', color: Colors.text },
  glucoseChip: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 },
  glucoseChipText: { fontSize: 14, fontWeight: '800' },
  momentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  momentBtn: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.inputBg },
  momentText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
});
