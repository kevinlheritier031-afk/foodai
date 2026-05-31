import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { hasConsented } from '../lib/database';
import { RGPD_VERSION } from '../constants/Medical';

export default function Index() {
  const [route, setRoute] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const consented = await hasConsented(RGPD_VERSION);
        if (!consented) { setRoute('/onboarding'); return; }
        const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
        setRoute(supabaseUrl.includes('placeholder') ? '/(app)' : '/(auth)/login');
      } catch (e: any) {
        setError(e?.message ?? String(e));
      }
    })();
  }, []);

  if (error) return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <Text style={{ color: 'red', textAlign: 'center' }}>{error}</Text>
    </View>
  );

  if (!route) return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" />
    </View>
  );

  return <Redirect href={route as any} />;
}
