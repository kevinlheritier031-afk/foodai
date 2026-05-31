import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Keyboard,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { useAppStore } from '../../store/useAppStore';
import {
  getClinicalData, getDailySummary,
  getChatMessages, addChatMessage, clearChatHistory,
} from '../../lib/database';
import { sendAriaMessage } from '../../lib/api';
import { ChatMessage, ClinicalData } from '../../types';

const ARIA_WELCOME = `Bonjour ! Je suis Aria, votre assistante diététique IA ✦\n\nJe connais votre profil clinique et ce que vous avez mangé aujourd'hui. Dites-moi ce que vous souhaitez manger, posez-moi une question sur un aliment, ou demandez-moi un conseil — je suis là pour vous aider !`;

const todayISO = () => new Date().toISOString().split('T')[0];

export default function ChatScreen() {
  const { activeProfileId } = useAppStore();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [clinical, setClinical] = useState<ClinicalData | null>(null);

  const load = useCallback(async () => {
    if (!activeProfileId) return;
    const [c, msgs] = await Promise.all([
      getClinicalData(activeProfileId),
      getChatMessages(activeProfileId),
    ]);
    setClinical(c);

    if (msgs.length === 0) {
      // First time — add welcome message
      const welcome = await addChatMessage(activeProfileId, 'assistant', ARIA_WELCOME);
      setMessages([welcome]);
    } else {
      setMessages(msgs);
    }
  }, [activeProfileId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidShow', () => {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 150);
    });
    return () => sub.remove();
  }, []);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || !activeProfileId || !clinical) return;

    setInput('');
    setSending(true);

    const userMsg = await addChatMessage(activeProfileId, 'user', text);
    setMessages(prev => [...prev, userMsg]);

    try {
      const summary = await getDailySummary(activeProfileId, todayISO());
      const history = messages.slice(-12).map(m => ({ role: m.role, content: m.content }));

      const response = await sendAriaMessage({
        message: text,
        profil: {
          dfg_ml_min:       clinical.dfg_ml_min,
          stade_irc:        clinical.stade_irc,
          kaliemie_mmol_l:  clinical.kaliemie_mmol_l ?? null,
          diabete_type:     clinical.diabete_type,
          hypertension:     Boolean(clinical.hypertension),
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
        historique: history,
      });

      const leaMsg = await addChatMessage(activeProfileId, 'assistant', response);
      setMessages(prev => [...prev, leaMsg]);
    } catch (e: any) {
      const errMsg = await addChatMessage(
        activeProfileId, 'assistant',
        `Désolée, je n'ai pas pu répondre 😕 (${e?.message ?? 'erreur réseau'}). Vérifiez votre connexion et réessayez.`,
      );
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setSending(false);
    }
  };

  const handleClear = () => {
    if (!activeProfileId) return;
    Alert.alert('Effacer la conversation', 'Supprimer tout l\'historique avec Léa ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Effacer', style: 'destructive',
        onPress: async () => {
          await clearChatHistory(activeProfileId);
          const welcome = await addChatMessage(activeProfileId, 'assistant', ARIA_WELCOME);
          setMessages([welcome]);
        },
      },
    ]);
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.msgRow, isUser ? styles.msgRowUser : styles.msgRowLea]}>
        {!isUser && (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>✦</Text>
          </View>
        )}
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleLea]}>
          <Text style={[styles.bubbleText, isUser ? styles.bubbleTextUser : styles.bubbleTextLea]}>
            {item.content}
          </Text>
        </View>
      </View>
    );
  };

  if (!activeProfileId || !clinical) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>💬</Text>
          <Text style={styles.emptyTitle}>Aucun profil actif</Text>
          <Text style={styles.emptyText}>Sélectionnez un profil pour discuter avec Aria.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={m => m.id}
          renderItem={renderMessage}
          contentContainerStyle={[styles.list, { paddingBottom: 12 }]}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        />

        {sending && (
          <View style={styles.typingRow}>
            <View style={styles.avatar}><Text style={styles.avatarText}>✦</Text></View>
            <View style={[styles.bubble, styles.bubbleLea, styles.typingBubble]}>
              <ActivityIndicator size="small" color={Colors.primary} />
            </View>
          </View>
        )}

        <View style={[styles.inputBar, { paddingBottom: 8 + insets.bottom }]}>
          <TextInput
            style={styles.inputField}
            value={input}
            onChangeText={setInput}
            placeholder="Demandez à Aria…"
            placeholderTextColor={Colors.textMuted}
            multiline
            maxLength={500}
            onSubmitEditing={handleSend}
            returnKeyType="send"
            blurOnSubmit
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!input.trim() || sending}
          >
            <Text style={styles.sendIcon}>➤</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  list: { padding: 14, gap: 4 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 6 },
  msgRowUser: { justifyContent: 'flex-end' },
  msgRowLea:  { justifyContent: 'flex-start' },

  avatar: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
    elevation: 3, shadowColor: Colors.primary, shadowOpacity: 0.40, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  avatarText: { color: '#fff', fontSize: 15 },

  bubble: { maxWidth: '78%', borderRadius: 20, paddingHorizontal: 15, paddingVertical: 11 },
  bubbleUser: { backgroundColor: Colors.primary, borderBottomRightRadius: 5 },
  bubbleLea:  { backgroundColor: Colors.card, borderBottomLeftRadius: 5, elevation: 2, shadowColor: Colors.primary, shadowOpacity: 0.07, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  bubbleText:     { fontSize: 15, lineHeight: 23 },
  bubbleTextUser: { color: '#fff' },
  bubbleTextLea:  { color: Colors.text },

  typingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingBottom: 6 },
  typingBubble: { paddingHorizontal: 18, paddingVertical: 13 },

  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 14, paddingTop: 10,
    backgroundColor: Colors.card, borderTopWidth: 1, borderTopColor: Colors.border,
    elevation: 8, shadowColor: Colors.primary, shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: -2 },
  },
  inputField: {
    flex: 1, backgroundColor: Colors.inputBg, borderRadius: 22, paddingHorizontal: 16,
    paddingTop: 11, paddingBottom: 11, fontSize: 15, maxHeight: 120, borderWidth: 1.5, borderColor: Colors.border,
    color: Colors.text,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
    elevation: 4, shadowColor: Colors.primary, shadowOpacity: 0.45, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendIcon: { color: '#fff', fontSize: 16, fontWeight: '800' },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 },
  emptyEmoji: { fontSize: 60 },
  emptyTitle: { fontSize: 22, fontWeight: '800', color: Colors.text },
  emptyText: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', lineHeight: 23 },
});
