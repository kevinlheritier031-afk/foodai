import { Tabs, router } from 'expo-router';
import { TouchableOpacity, Text, View, Keyboard, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { Colors } from '../../constants/Colors';

function SettingsButton() {
  return (
    <TouchableOpacity onPress={() => router.push('/settings')} style={{ paddingRight: 16 }}>
      <View style={styles.settingsWrap}>
        <Text style={{ fontSize: 18 }}>⚙️</Text>
      </View>
    </TouchableOpacity>
  );
}

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.45 }}>{emoji}</Text>
  );
}

function AriaTabIcon({ focused }: { focused: boolean }) {
  return (
    <View style={{
      width: 34, height: 34, borderRadius: 17,
      backgroundColor: focused ? Colors.primary : Colors.primaryLight,
      alignItems: 'center', justifyContent: 'center',
      shadowColor: Colors.primary,
      shadowOpacity: focused ? 0.55 : 0,
      shadowRadius: 10,
      elevation: focused ? 6 : 0,
    }}>
      <Text style={{ fontSize: 16, color: focused ? '#fff' : Colors.primary }}>✦</Text>
    </View>
  );
}

const styles = {
  settingsWrap: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 10,
    padding: 6,
  },
};

export default function AppLayout() {
  const insets = useSafeAreaInsets();
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: Colors.background },
        headerTitleStyle: { color: Colors.text, fontWeight: '800', fontSize: 18 },
        headerShadowVisible: false,
        headerRight: () => <SettingsButton />,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: keyboardVisible ? { display: 'none' } : {
          backgroundColor: Colors.card,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          height: 62 + insets.bottom,
          paddingBottom: 8 + insets.bottom,
          elevation: 10,
          shadowColor: Colors.primary,
          shadowOpacity: 0.10,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: -3 },
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700', marginTop: 2 },
      }}
    >
      <Tabs.Screen name="index"      options={{ title: 'Tableau de bord', headerShown: false, tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} /> }} />
      <Tabs.Screen name="analyze"    options={{ title: 'Analyser',         tabBarIcon: ({ focused }) => <TabIcon emoji="🔍" focused={focused} /> }} />
      <Tabs.Screen name="journal"    options={{ title: 'Journal',           tabBarIcon: ({ focused }) => <TabIcon emoji="📋" focused={focused} /> }} />
      <Tabs.Screen name="chat"       options={{
        title: 'Aria',
        tabBarIcon: ({ focused }) => <AriaTabIcon focused={focused} />,
        tabBarActiveTintColor: Colors.primary,
      }} />
      <Tabs.Screen name="sante"      options={{ title: 'Santé',             tabBarIcon: ({ focused }) => <TabIcon emoji="❤️" focused={focused} /> }} />
      <Tabs.Screen name="profiles/index" options={{ title: 'Profils',      tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} />, href: '/profiles' }} />
      <Tabs.Screen name="settings"        options={{ href: null }} />
      <Tabs.Screen name="profiles/create" options={{ href: null }} />
      <Tabs.Screen name="profiles/[id]"   options={{ href: null }} />
    </Tabs>
  );
}
