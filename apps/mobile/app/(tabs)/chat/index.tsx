import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { MessageCircle, User } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import type { ConversationWithRelations } from '@kaza/shared';

export default function ChatListScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase.rpc('list_my_conversations');
      if (error) throw error;
      setConversations((data ?? []) as unknown as ConversationWithRelations[]);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const getTimeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'maintenant';
    if (mins < 60) return `${mins}min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}j`;
  };

  if (loading) {
    return (
      <View className="flex-1 bg-slate-50 items-center justify-center">
        <ActivityIndicator size="large" color="#0E4728" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-50">
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0E4728" />}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center py-20">
            <MessageCircle size={48} color="#CBD5E1" />
            <Text className="text-lg font-semibold text-slate-400 mt-4">Aucune conversation</Text>
            <Text className="text-sm text-slate-400 mt-1">
              Contactez un bailleur depuis une annonce
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const other = item.peer;
          const unread = item.unread_count > 0;
          return (
            <TouchableOpacity
              onPress={() => router.push(`/(tabs)/chat/${item.id}`)}
              className={`flex-row items-center px-4 py-3 border-b border-slate-100 ${unread ? 'bg-kaza-vert/5' : 'bg-white'}`}
              activeOpacity={0.7}
            >
              {/* Avatar */}
              <View className="w-12 h-12 rounded-full bg-slate-200 items-center justify-center overflow-hidden">
                {other?.avatar_url ? (
                  <Image source={{ uri: other.avatar_url }} className="w-full h-full" contentFit="cover" />
                ) : (
                  <User size={20} color="#94A3B8" />
                )}
              </View>
              {/* Content */}
              <View className="flex-1 ml-3">
                <View className="flex-row items-center justify-between">
                  <Text className={`text-sm ${unread ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`} numberOfLines={1}>
                    {other?.full_name ?? 'Utilisateur'}
                  </Text>
                  {item.last_message_at && (
                    <Text className="text-xs text-slate-400">{getTimeAgo(item.last_message_at)}</Text>
                  )}
                </View>
                <View className="flex-row items-center justify-between mt-0.5">
                  <Text className={`text-xs ${unread ? 'text-slate-700 font-medium' : 'text-slate-500'}`} numberOfLines={1} style={{ flex: 1 }}>
                    {item.last_message_preview ?? item.residence?.title ?? 'Nouvelle conversation'}
                  </Text>
                  {unread && (
                    <View className="w-2.5 h-2.5 bg-kaza-vert rounded-full ml-2" />
                  )}
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}
