import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import { useAppStore } from '../../store/useAppStore';
import { getClinicalData, addJournalEntry } from '../../lib/database';
import { analyzeFood, searchFoods, FoodSuggestion } from '../../lib/api';
import { AnalysisResult, MealType } from '../../types';
import VerdictCard from '../../components/VerdictCard';
import AlertBadge from '../../components/AlertBadge';
import DisclaimerBanner from '../../components/DisclaimerBanner';
import { Colors as C } from '../../constants/Colors';
import { MEAL_LABELS, MEAL_ICONS } from '../../constants/Medical';

const MEALS: MealType[] = ['petit_dejeuner', 'dejeuner', 'diner', 'collation'];
const todayISO = () => new Date().toISOString().split('T')[0];

export default function Analyze() {
  const { activeProfileId } = useAppStore();
  const [query, setQuery] = useState('');
  const [quantite, setQuantite] = useState('100');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState<MealType>('dejeuner');
  const [adding, setAdding] = useState(false);
  const [suggestions, setSuggestions] = useState<FoodSuggestion[]>([]);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  const handleQueryChange = (text: string) => {
    setQuery(text);
    clearTimeout(searchTimer.current);
    if (text.trim().length >= 2) {
      searchTimer.current = setTimeout(async () => {
        const results = await searchFoods(text);
        setSuggestions(results);
      }, 350);
    } else {
      setSuggestions([]);
    }
  };

  const handleSelectSuggestion = (nom: string) => {
    setQuery(nom);
    setSuggestions([]);
  };

  const handleAnalyze = async () => {
    if (!query.trim()) { Alert.alert('Aliment manquant', 'Saisissez un aliment à analyser.'); return; }
    if (!activeProfileId) { Alert.alert('Aucun profil actif', 'Sélectionnez un profil dans l\'onglet Profils.'); return; }

    setLoading(true);
    setResult(null);
    setSuggestions([]);
    try {
      const clinical = await getClinicalData(activeProfileId);
      if (!clinical) { Alert.alert('Profil incomplet', 'Configurez d\'abord les données cliniques dans votre profil.'); setLoading(false); return; }

      const res = await analyzeFood({
        aliment: query.trim(),
        quantite_g: parseFloat(quantite) || 100,
        profil: {
          dfg_ml_min: clinical.dfg_ml_min,
          stade_irc: clinical.stade_irc,
          kaliemie_mmol_l: clinical.kaliemie_mmol_l,
          phosphoremie_mg_l: clinical.phosphoremie_mg_l,
          diabete_type: clinical.diabete_type,
          hypertension: Boolean(clinical.hypertension),
        },
        seuils: {
          potassium_max_mg_jour:    clinical.potassium_max_mg_jour,
          phosphore_max_mg_jour:    clinical.phosphore_max_mg_jour,
          sodium_max_mg_jour:       clinical.sodium_max_mg_jour,
          proteines_max_g_kg_jour:  clinical.proteines_max_g_kg_jour,
          potassium_alerte_mg_100g: clinical.potassium_alerte_mg_100g,
          potassium_danger_mg_100g: clinical.potassium_danger_mg_100g,
          phosphore_alerte_mg_100g: clinical.phosphore_alerte_mg_100g,
          sodium_alerte_mg_100g:    clinical.sodium_alerte_mg_100g,
        },
      });
      setResult(res);
    } catch (e: any) {
      Alert.alert('Erreur', e.message ?? 'Impossible d\'analyser cet aliment.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddToJournal = async () => {
    if (!result || !activeProfileId) return;
    setAdding(true);
    const q = parseFloat(quantite) || 100;
    const f = q / 100;
    try {
      await addJournalEntry(activeProfileId, todayISO(), selectedMeal, {
        aliment_nom: result.aliment.nom,
        quantite_g: q,
        energie_kcal: result.aliment.energie_kcal * f,
        potassium_mg: result.aliment.potassium_mg * f,
        phosphore_mg: result.aliment.phosphore_mg * f,
        sodium_mg: result.aliment.sodium_mg * f,
        glucides_g: result.aliment.glucides_g * f,
        proteines_g: result.aliment.proteines_g * f,
        verdict_global: result.verdict_global,
        verdict_json: result,
      });
      setAddModalVisible(false);
      Alert.alert('✅ Ajouté !', `${result.aliment.nom} ajouté au ${MEAL_LABELS[selectedMeal].toLowerCase()}.`);
    } catch (e: any) {
      Alert.alert('Erreur', e.message);
    } finally {
      setAdding(false);
    }
  };

  const q = parseFloat(quantite) || 100;
  const f = q / 100;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* Search card */}
        <View style={styles.searchCard}>
          <Text style={styles.searchLabel}>Aliment</Text>
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={handleQueryChange}
            placeholder="Banane, cabillaud, pâtes…"
            placeholderTextColor={Colors.textMuted}
            onSubmitEditing={handleAnalyze}
            returnKeyType="search"
          />

          {suggestions.length > 0 && (
            <View style={styles.suggestionsBox}>
              {suggestions.map((s, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.suggestionRow, i < suggestions.length - 1 && styles.suggestionRowBorder]}
                  onPress={() => handleSelectSuggestion(s.nom)}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.suggestionName} numberOfLines={1}>{s.nom}</Text>
                    <Text style={styles.suggestionMeta}>
                      {s.energie_kcal.toFixed(0)} kcal · K⁺ {s.potassium_mg.toFixed(0)} mg · P {s.phosphore_mg.toFixed(0)} mg
                    </Text>
                  </View>
                  <Text style={styles.suggestionArrow}>›</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={styles.searchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.searchLabel}>Quantité</Text>
              <View style={styles.quantityRow}>
                <TextInput
                  style={[styles.searchInput, styles.quantityInput]}
                  value={quantite}
                  onChangeText={setQuantite}
                  keyboardType="numeric"
                  placeholder="100"
                  placeholderTextColor={Colors.textMuted}
                />
                <View style={styles.unitBadge}>
                  <Text style={styles.unitText}>g</Text>
                </View>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.analyzeBtn, loading && styles.analyzeBtnDisabled]}
            onPress={handleAnalyze}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <>
                  <Text style={styles.analyzeBtnIcon}>🔍</Text>
                  <Text style={styles.analyzeBtnText}>Analyser</Text>
                </>
            }
          </TouchableOpacity>
        </View>

        {result && (
          <>
            {/* Global verdict */}
            <View style={styles.verdictHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.alimentName}>{result.aliment.nom}</Text>
                <Text style={styles.alimentQty}>{q}g · {(result.aliment.energie_kcal * f).toFixed(0)} kcal</Text>
              </View>
              <AlertBadge level={result.verdict_global} size="lg" />
            </View>

            {/* Nutrition grid */}
            <View style={styles.nutritionGrid}>
              {[
                { label: 'Énergie',   value: `${(result.aliment.energie_kcal * f).toFixed(0)} kcal`, accent: Colors.primary },
                { label: 'Potassium', value: `${(result.aliment.potassium_mg * f).toFixed(0)} mg`,   accent: Colors.renal, highlight: true },
                { label: 'Phosphore', value: `${(result.aliment.phosphore_mg * f).toFixed(0)} mg`,   accent: Colors.dietetic },
                { label: 'Sodium',    value: `${(result.aliment.sodium_mg * f).toFixed(0)} mg`,      accent: Colors.orange },
                { label: 'Glucides',  value: `${(result.aliment.glucides_g * f).toFixed(1)} g`,      accent: Colors.glycemic },
                { label: 'Protéines', value: `${(result.aliment.proteines_g * f).toFixed(1)} g`,     accent: Colors.secondary },
              ].map(n => (
                <View key={n.label} style={[styles.nutritionCell, n.highlight && styles.nutritionCellHighlight]}>
                  <View style={[styles.nutritionDot, { backgroundColor: n.accent }]} />
                  <Text style={[styles.nutritionValue, { color: n.accent }]}>{n.value}</Text>
                  <Text style={styles.nutritionLabel}>{n.label}</Text>
                </View>
              ))}
            </View>

            <VerdictCard
              title="Rénal" emoji="🫀" accentColor={C.renal} level={result.verdict_nephrologue.niveau_alerte}
              message={result.verdict_nephrologue.message}
              details={[
                { label: 'Potassium', value: result.verdict_nephrologue.potassium_evaluation },
                { label: 'Phosphore', value: result.verdict_nephrologue.phosphore_evaluation },
                { label: 'Sodium',    value: result.verdict_nephrologue.sodium_evaluation },
              ]}
            />
            <VerdictCard
              title="Glycémie" emoji="🩸" accentColor={C.glycemic} level={result.verdict_diabetologue.niveau_alerte}
              message={result.verdict_diabetologue.message}
              details={[
                { label: 'Index glycémique', value: result.verdict_diabetologue.index_glycemique_estime },
                { label: 'Charge glucidique', value: `${result.verdict_diabetologue.charge_glucidique_g.toFixed(1)} g` },
                ...(result.verdict_diabetologue.recommandation_portion
                  ? [{ label: 'Portion conseillée', value: result.verdict_diabetologue.recommandation_portion }]
                  : []),
              ]}
            />
            <VerdictCard
              title="Diététique" emoji="🥗" accentColor={C.dietetic} level={result.verdict_dieteticien.niveau_alerte}
              message={result.verdict_dieteticien.message}
              details={[{ label: 'Portion', value: result.verdict_dieteticien.conseil_portion }]}
              extras={[
                ...result.verdict_dieteticien.astuces_preparation.map(a => `💡 ${a}`),
                ...result.verdict_dieteticien.alternatives_proposees.map(a => `🔄 ${a}`),
              ]}
            />

            <TouchableOpacity style={styles.addBtn} onPress={() => setAddModalVisible(true)} activeOpacity={0.85}>
              <Text style={styles.addBtnIcon}>📋</Text>
              <Text style={styles.addBtnText}>Ajouter au journal</Text>
            </TouchableOpacity>

            <DisclaimerBanner />
          </>
        )}
      </ScrollView>

      <Modal visible={addModalVisible} transparent animationType="slide" onRequestClose={() => setAddModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Pour quel repas ?</Text>
            {MEALS.map(m => (
              <TouchableOpacity
                key={m}
                style={[styles.mealOption, selectedMeal === m && styles.mealOptionActive]}
                onPress={() => setSelectedMeal(m)}
              >
                <Text style={styles.mealOptionIcon}>{MEAL_ICONS[m]}</Text>
                <Text style={[styles.mealOptionText, selectedMeal === m && styles.mealOptionTextActive]}>
                  {MEAL_LABELS[m]}
                </Text>
                {selectedMeal === m && <Text style={styles.mealCheckmark}>✓</Text>}
              </TouchableOpacity>
            ))}
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setAddModalVisible(false)} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleAddToJournal} style={styles.confirmBtn} disabled={adding}>
                {adding ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmBtnText}>Confirmer</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 40 },

  searchCard: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    elevation: 2,
    shadowColor: Colors.primary,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
  },
  searchLabel: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  searchInput: {
    backgroundColor: Colors.inputBg,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 15,
    borderWidth: 1.5,
    borderColor: Colors.border,
    color: Colors.text,
    marginBottom: 14,
  },
  searchRow: { flexDirection: 'row', gap: 10 },
  quantityRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  quantityInput: { flex: 1, marginBottom: 0 },
  unitBadge: { backgroundColor: Colors.primaryLight, paddingHorizontal: 14, paddingVertical: 13, borderRadius: 14 },
  unitText: { color: Colors.primary, fontWeight: '700', fontSize: 15 },

  suggestionsBox: {
    backgroundColor: Colors.inputBg,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    marginBottom: 14,
    overflow: 'hidden',
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 8,
  },
  suggestionRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  suggestionName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  suggestionMeta: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  suggestionArrow: {
    fontSize: 20,
    color: Colors.primary,
    fontWeight: '300',
  },

  analyzeBtn: {
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
  analyzeBtnDisabled: { opacity: 0.6 },
  analyzeBtnIcon: { fontSize: 18 },
  analyzeBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },

  verdictHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.card, borderRadius: 18, padding: 16, marginBottom: 12,
    elevation: 2, shadowColor: Colors.primary, shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 3 },
  },
  alimentName: { fontSize: 18, fontWeight: '800', color: Colors.text },
  alimentQty: { fontSize: 13, color: Colors.textSecondary, marginTop: 3 },

  nutritionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  nutritionCell: {
    backgroundColor: Colors.card, borderRadius: 14, padding: 12,
    flex: 1, minWidth: '28%', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  nutritionCellHighlight: { borderColor: Colors.renal, backgroundColor: Colors.renalLight },
  nutritionDot: { width: 8, height: 8, borderRadius: 4, marginBottom: 5 },
  nutritionValue: { fontSize: 15, fontWeight: '800' },
  nutritionLabel: { fontSize: 11, color: Colors.textSecondary, marginTop: 3, fontWeight: '600' },

  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.vert,
    borderRadius: 16,
    paddingVertical: 16,
    marginBottom: 12,
    elevation: 4,
    shadowColor: Colors.vert,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  addBtnIcon: { fontSize: 18 },
  addBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 32 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.text, marginBottom: 18, textAlign: 'center' },
  mealOption: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 14, borderWidth: 1.5, borderColor: Colors.border, marginBottom: 8,
  },
  mealOptionActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  mealOptionIcon: { fontSize: 22 },
  mealOptionText: { flex: 1, fontSize: 16, color: Colors.text, fontWeight: '600' },
  mealOptionTextActive: { color: Colors.primary, fontWeight: '700' },
  mealCheckmark: { fontSize: 16, color: Colors.primary, fontWeight: '800' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelBtn: { flex: 1, padding: 15, borderRadius: 14, borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center' },
  cancelBtnText: { color: Colors.textSecondary, fontWeight: '700', fontSize: 15 },
  confirmBtn: { flex: 1, backgroundColor: Colors.primary, borderRadius: 14, padding: 15, alignItems: 'center', elevation: 3, shadowColor: Colors.primary, shadowOpacity: 0.35, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
  confirmBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
