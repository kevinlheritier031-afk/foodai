import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, Alert, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Link } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Colors } from '../../constants/Colors';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!email || !password || !confirm) {
      Alert.alert('Champs manquants', 'Veuillez remplir tous les champs.');
      return;
    }
    if (password !== confirm) {
      Alert.alert('Erreur', 'Les mots de passe ne correspondent pas.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Mot de passe trop court', 'Minimum 8 caractères.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) {
      Alert.alert('Erreur', error.message);
    } else {
      Alert.alert(
        'Compte créé !',
        'Vérifiez votre email pour confirmer votre compte.',
        [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }],
      );
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container}>
          <TouchableOpacity onPress={() => router.back()} style={styles.back}>
            <Text style={styles.backText}>← Retour</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Créer un compte</Text>
          <Text style={styles.subtitle}>
            Votre compte sert uniquement à sécuriser l'accès à l'app.{'\n'}
            Aucune donnée de santé n'est stockée sur nos serveurs.
          </Text>

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="votre@email.fr"
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Text style={styles.label}>Mot de passe</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Minimum 8 caractères"
            secureTextEntry
          />

          <Text style={styles.label}>Confirmer le mot de passe</Text>
          <TextInput
            style={styles.input}
            value={confirm}
            onChangeText={setConfirm}
            placeholder="••••••••"
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleRegister}
            disabled={loading}
          >
            <Text style={styles.btnText}>{loading ? 'Création…' : 'Créer mon compte'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  container: { padding: 28, paddingTop: 20 },
  back: { marginBottom: 24 },
  backText: { color: Colors.primary, fontWeight: '600', fontSize: 15 },
  title: { fontSize: 26, fontWeight: '800', color: Colors.text, marginBottom: 8 },
  subtitle: { fontSize: 13, color: Colors.textSecondary, lineHeight: 20, marginBottom: 28 },
  label: { fontSize: 14, fontWeight: '600', color: Colors.text, marginTop: 12, marginBottom: 6 },
  input: {
    backgroundColor: Colors.card, borderRadius: 12, padding: 14,
    fontSize: 15, borderWidth: 1, borderColor: Colors.border, color: Colors.text,
  },
  btn: {
    backgroundColor: Colors.primary, borderRadius: 12,
    padding: 16, alignItems: 'center', marginTop: 24,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
