import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Link } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Colors } from '../../constants/Colors';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Champs manquants', 'Veuillez renseigner email et mot de passe.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) Alert.alert('Erreur de connexion', error.message);
    else router.replace('/(app)');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
        <Text style={styles.logo}>🍽️</Text>
        <Text style={styles.title}>FoodAI</Text>
        <Text style={styles.subtitle}>Suivi nutritionnel médical adapté</Text>

        <View style={styles.form}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="votre@email.fr"
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />

          <Text style={styles.label}>Mot de passe</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            autoComplete="password"
          />

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            <Text style={styles.btnText}>{loading ? 'Connexion…' : 'Se connecter'}</Text>
          </TouchableOpacity>

          <Link href="/(auth)/register" asChild>
            <TouchableOpacity style={styles.linkBtn}>
              <Text style={styles.linkText}>Pas encore de compte ? Créer un compte</Text>
            </TouchableOpacity>
          </Link>
        </View>

        <Text style={styles.disclaimer}>
          Vos données de santé restent sur votre appareil.
        </Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1, padding: 28, justifyContent: 'center' },
  logo: { fontSize: 64, textAlign: 'center', marginBottom: 8 },
  title: { fontSize: 32, fontWeight: '900', color: Colors.text, textAlign: 'center' },
  subtitle: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', marginBottom: 40 },
  form: { gap: 8 },
  label: { fontSize: 14, fontWeight: '600', color: Colors.text, marginTop: 8 },
  input: {
    backgroundColor: Colors.card, borderRadius: 12, padding: 14,
    fontSize: 15, borderWidth: 1, borderColor: Colors.border, color: Colors.text,
  },
  btn: {
    backgroundColor: Colors.primary, borderRadius: 12,
    padding: 16, alignItems: 'center', marginTop: 16,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  linkBtn: { padding: 12, alignItems: 'center' },
  linkText: { color: Colors.primary, fontSize: 14, fontWeight: '600' },
  disclaimer: {
    textAlign: 'center', fontSize: 12, color: Colors.textMuted, marginTop: 32,
  },
});
