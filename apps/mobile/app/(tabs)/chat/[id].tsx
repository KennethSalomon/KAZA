import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { Send, Camera, Check, CheckCheck } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import type { Message } from '@kaza/shared';

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [otherName, setOtherName] = useState('');
  const flatListRef = useRef<FlatList>(null);

  const loadMessages = useCallback(async () => {
    if (!id) return;
    try {
      const { data: convData } = await supabase
        .from('conversations')
        .select('*, tenant:profiles!tenant_id(full_name), landlord:profiles!landlord_id(full_name)')
        .eq('id', id)
        .single();

      if (convData && user) {
        const isTenant = convData.tenant_id === user.id;
        setOtherName(
          isTenant
            ? (convData as any).landlord?.full_name ?? 'Bailleur'
            : (convData as any).tenant?.full_name ?? 'Locataire',
        );
      }

      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setMessages((data ?? []) as unknown as Message[]);

      await supabase.rpc('mark_conversation_read', { p_conversation_id: id });
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [id, user]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  // Realtime subscription
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`messages:${id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` },
        (payload) => {
          const msg = payload.new as unknown as Message;
          setMessages((prev) => [...prev, msg]);
          supabase.rpc('mark_conversation_read', { p_conversation_id: id });
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id]);

  const handleSend = async () => {
    if (!text.trim() || !id || !user) return;
    const body = text.trim();
    setText('');
    setSending(true);

    try {
      const { error } = await supabase.from('messages').insert({
        conversation_id: id,
        sender_id: user.id,
        body,
        kind: 'text',
      });
      if (error) throw error;
    } catch {
      setText(body);
    } finally {
      setSending(false);
    }
  };

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0] || !id || !user) return;

    const asset = result.assets[0];
    const ext = asset.uri.split('.').pop() ?? 'jpg';
    const path = `${id}/${Date.now()}.${ext}`;

    try {
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const { error: uploadError } = await supabase.storage.from('chat-files').upload(path, blob);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('chat-files').getPublicUrl(path);

      await supabase.from('messages').insert({
        conversation_id: id,
        sender_id: user.id,
        body: urlData.publicUrl,
        kind: 'image',
      });
    } catch {
      // silent
    }
  };

  const isMe = (msg: Message) => msg.sender_id === user?.id;

  if (loading) {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#0E4728" />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: otherName || 'Chat' }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 bg-slate-50"
        keyboardVerticalOffset={90}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 12, gap: 6 }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => (
            <View className={`max-w-[80%] ${isMe(item) ? 'self-end' : 'self-start'}`}>
              <View
                className={`px-3 py-2 rounded-2xl ${
                  isMe(item) ? 'bg-kaza-vert rounded-br-sm' : 'bg-white border border-slate-200 rounded-bl-sm'
                }`}
              >
                <Text className={`text-sm ${isMe(item) ? 'text-white' : 'text-slate-900'}`}>
                  {item.body}
                </Text>
              </View>
              <View className={`flex-row items-center mt-0.5 gap-1 ${isMe(item) ? 'self-end' : 'self-start'}`}>
                <Text className="text-[10px] text-slate-400">
                  {new Date(item.created_at).toLocaleTimeString('fr-BJ', { hour: '2-digit', minute: '2-digit' })}
                </Text>
                {isMe(item) && (
                  item.read_at ? (
                    <CheckCheck size={12} color="#10B981" />
                  ) : (
                    <Check size={12} color="#94A3B8" />
                  )
                )}
              </View>
            </View>
          )}
        />

        {/* Input */}
        <View className="flex-row items-center bg-white border-t border-slate-200 px-3 py-2 gap-2">
          <TouchableOpacity onPress={handlePickImage} className="p-2">
            <Camera size={22} color="#64748B" />
          </TouchableOpacity>
          <TextInput
            className="flex-1 bg-slate-100 rounded-2xl px-4 py-2 text-sm text-slate-900"
            placeholder="Message..."
            placeholderTextColor="#94A3B8"
            value={text}
            onChangeText={setText}
            multiline
            maxLength={2000}
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={!text.trim() || sending}
            className={`w-10 h-10 rounded-full items-center justify-center ${
              text.trim() ? 'bg-kaza-vert' : 'bg-slate-200'
            }`}
          >
            <Send size={18} color={text.trim() ? '#FFF' : '#94A3B8'} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}
