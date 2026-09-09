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
import {
  Bell,
  Home,
  CreditCard,
  Tag,
  Crown,
  CheckCircle,
  ChevronRight,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import type { AppNotification } from '@kaza/shared';

const TABS = [
  { key: 'all', label: 'Toutes' },
  { key: 'annonces', label: 'Annonces' },
  { key: 'paiements', label: 'Paiements' },
  { key: 'abonnements', label: 'Abonnements' },
];

const ICON_MAP: Record<string, { icon: any; bg: string; color: string }> = {
  message: { icon: Home, bg: '#0E4728', color: '#FFF' },
  lease: { icon: Home, bg: '#0E4728', color: '#FFF' },
  visit: { icon: CheckCircle, bg: '#0E4728', color: '#FFF' },
  payment: { icon: CreditCard, bg: '#10B981', color: '#FFF' },
  receipt: { icon: Tag, bg: '#10B981', color: '#FFF' },
  overdue: { icon: CreditCard, bg: '#EF4444', color: '#FFF' },
  system: { icon: Crown, bg: '#F59E0B', color: '#FFF' },
};

export default function NotificationsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('all');
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      setNotifications((data ?? []) as unknown as AppNotification[]);
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const handleMarkAllRead = async () => {
    if (!user) return;
    await supabase.rpc('mark_all_notifications_read');
    setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
  };

  const handlePress = async (notif: AppNotification) => {
    if (!notif.read_at) {
      await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', notif.id);
      setNotifications((prev) => prev.map((n) => n.id === notif.id ? { ...n, read_at: new Date().toISOString() } : n));
    }
    const meta = notif.data as Record<string, string> | null;
    if (meta?.residence_id) router.push(`/residence/${meta.residence_id}`);
  };

  const getTimeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "à l'instant";
    if (mins < 60) return `Il y a ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Il y a ${hours}h`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'Hier';
    return `Il y a ${days}j`;
  };

  const filteredNotifications = notifications.filter((n) => {
    if (activeTab === 'all') return true;
    const type = (n.type ?? 'system') as string;
    if (activeTab === 'annonces') return ['message', 'lease', 'visit'].includes(type);
    if (activeTab === 'paiements') return ['payment', 'receipt', 'overdue'].includes(type);
    if (activeTab === 'abonnements') return type === 'system';
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  if (loading) {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#0E4728" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      {/* Tab bar + mark all read */}
      <View className="px-4 pb-2">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-xl font-bold text-slate-900">
            Notifications {unreadCount > 0 ? `(${unreadCount})` : ''}
          </Text>
          {unreadCount > 0 && (
            <TouchableOpacity onPress={handleMarkAllRead}>
              <Text className="text-sm text-kaza-vert font-medium">Tout marquer comme lu</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Tabs */}
        <View className="flex-row gap-2">
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              className={`px-3 py-1.5 rounded-full ${
                activeTab === tab.key ? 'bg-kaza-vert' : 'bg-slate-100'
              }`}
            >
              <Text className={`text-xs font-semibold ${
                activeTab === tab.key ? 'text-white' : 'text-slate-600'
              }`}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <FlatList
        data={filteredNotifications}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 16, paddingTop: 8 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#0E4728" />}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center py-20">
            <Bell size={48} color="#CBD5E1" />
            <Text className="text-lg font-semibold text-slate-400 mt-4">Aucune notification</Text>
          </View>
        }
        renderItem={({ item }) => {
          const type = (item.type ?? 'system') as string;
          const iconConfig = ICON_MAP[type] ?? ICON_MAP.system;
          const Icon = iconConfig.icon;
          const isUnread = !item.read_at;
          const meta = item.data as Record<string, string> | null;

          return (
            <TouchableOpacity
              onPress={() => handlePress(item)}
              className={`flex-row items-start p-3 rounded-xl mb-2 ${isUnread ? 'bg-slate-50' : 'bg-white'}`}
            >
              <View
                className="w-10 h-10 rounded-xl items-center justify-center mr-3"
                style={{ backgroundColor: iconConfig.bg }}
              >
                <Icon size={18} color={iconConfig.color} />
              </View>
              <View className="flex-1">
                <View className="flex-row items-center justify-between">
                  <Text className={`text-sm ${isUnread ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`} numberOfLines={1}>
                    {item.title}
                  </Text>
                  {isUnread && <View className="w-2 h-2 bg-kaza-amber rounded-full ml-2" />}
                </View>
                {item.body && (
                  <Text className="text-xs text-slate-500 mt-0.5" numberOfLines={2}>{item.body}</Text>
                )}
                <Text className="text-[10px] text-slate-400 mt-1">{getTimeAgo(item.created_at)}</Text>

                {/* Action button for some types */}
                {meta?.action_label && (
                  <TouchableOpacity className="self-start bg-kaza-vert px-3 py-1 rounded-lg mt-2">
                    <Text className="text-xs font-semibold text-white">{meta.action_label}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}
