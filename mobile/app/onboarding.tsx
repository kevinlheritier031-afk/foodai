import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Colors } from '../constants/Colors';
import { recordConsent } from '../lib/database';
import { RGPD_VERSION } from '../constants/Medical';

const STEPS = [
  {
    emoji: '🍽️',
    title: 'Bienvenue sur FoodAI',
    body: "FoodAI vous aide à suivre votre alimentation en tenant compte de votre profil médical (IRC, diabète, HTA).\n\nChaque aliment est analysé par 3 modules spécialisés : rénal, glycémique et diététique.",
  },
  {
    emoji: '🔒',
    title: 'Vos données restent sur votre téléphone',
    body: "Toutes vos données de santé (DFG, kaliémie, journal alimentaire) sont stockées UNIQUEMENT sur votre appareil.\n\nAucune donnée médicale n'est envoyée à nos serveurs. Seul le nom d'un aliment transite pour l'analyse IA.",
  },
  {
    emoji: '⚠️',
    title: 'Information médicale importante',
    body: "FoodAI est un outil d'aide au suivi nutritionnel.\n\nIl NE pose aucun diagnostic, NE modifie aucun traitement et NE remplace PAS votre équipe soignante (néphrologue, diabétologue, diététicien).\n\nLes seuils utilisés sont ceux prescrits par votre médecin.",
  },
  {
    emoji: '📋',
    title: 'Consentement & données',
    body: "En utilisant FoodAI vous acceptez :\n\n• Le stockage local de vos données de santé sur cet appareil\n• L'envoi anonyme du nom des aliments à notre API pour analyse\n• Notre politique de confidentialité (conforme RGPD)\n\nVous pouvez supprimer toutes vos données à tout moment depuis les Paramètres.",
  },
];

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const isLast = step === STEPS.length - 1;

  const handleNext = async () => {
    if (isLast) {
      await recordConsent(RGPD_VERSION);
      router.replace('/(auth)/login');
    } else {
      setStep(step + 1);
    }
  };

  const { emoji, title, body } = STEPS[step];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.stepIndicator}>
          {STEPS.map((_, i) => (
            <View key={i} style={[styles.dot, i === step && styles.dotActive]} />
          ))}
        </View>

        <Text style={styles.emoji}>{emoji}</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>

        {isLast && (
          <TouchableOpacity onPress={() => Linking.openURL('https://foodai.app/privacy')}>
            <Text style={styles.link}>Lire la politique de confidentialité complète →</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {step > 0 && (
          <TouchableOpacity style={styles.backBtn} onPress={() => setStep(step - 1)}>
            <Text style={styles.backBtnText}>← Retour</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={[styles.nextBtn, isLast && styles.nextBtnGreen]} onPress={handleNext}>
          <Text style={styles.nextBtnText}>
            {isLast ? "✅ J'accepte et je commence" : 'Suivant →'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  container: { flexGrow: 1, padding: 28, alignItems: 'center', paddingTop: 40 },
  stepIndicator: { flexDirection: 'row', gap: 8, marginBottom: 40 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.border },
  dotActive: { width: 24, backgroundColor: Colors.primary },
  emoji: { fontSize: 72, marginBottom: 24 },
  title: { fontSize: 24, fontWeight: '800', color: Colors.text, textAlign: 'center', marginBottom: 20 },
  body: { fontSize: 15, color: Colors.textSecondary, lineHeight: 24, textAlign: 'center' },
  link: { color: Colors.primary, marginTop: 16, fontSize: 14, textDecorationLine: 'underline' },
  footer: {
    padding: 20, paddingBottom: 32, gap: 12,
    flexDirection: 'row', justifyContent: 'flex-end',
    borderTopWidth: 1, borderTopColor: Colors.border,
    backgroundColor: Colors.card,
  },
  backBtn: { paddingHorizontal: 20, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: Colors.border },
  backBtnText: { color: Colors.textSecondary, fontWeight: '600' },
  nextBtn: { flex: 1, backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  nextBtnGreen: { backgroundColor: Colors.vert },
  nextBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
