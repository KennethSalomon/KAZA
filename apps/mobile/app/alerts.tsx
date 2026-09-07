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
  MapPin,
  MessageCircle,
  Bell,
  Home,
  Lightbulb,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

interface AlertItem {
  id: string;
  type: 'match' | 'update' | 'rented';
  title: string;
  body: string;
  created_at: string;
  read: boolean;
}

const MOCK_ALERTS: AlertItem[] = [
  {
    id: '1',
    type: 'match',
    title: '3 nouveaux logements à Haie Vive',
    body: 'De nouvelles offres correspondent à vos critères (Chambre salon < 80 000 FCFA).',
    created_at: new Date(Date.now() - 5 * 60000).toISOString(),
    read: false,
  },
  {
    id: '2',
    type: 'update',
    title: 'Le propriétaire a mis à jour son numéro',
    body: 'Vous pouvez désormais contacter le propriétaire de la maison à Cadjehoun.',
    created_at: new Date(Date.now() - 3 * 3600000).toISOString(),
    read: false,
  },
  {
    id: '3',
    type: 'rented',
    title: 'Annonce louée',
    body: "L'appartement que vous aviez mis en favori à Agla a été marqué comme loué.",
    created_at: new Date(Date.now() - 24 * 3600000).toISOString(),
    read: true,
  },
];

const ICON_MAP: Record<string, { icon: any; color: string }> = {
  match: { icon: MapPin, color: '#0E4728' },
  update: { icon: MessageCircle, color: '#0E4728' },
  rented: { icon: Home, color: '#64748B' },
};

export default function AlertsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<AlertItem[]>(MOCK_ALERTS);
  const [loading, setLoading] = useState(false);

  const handleMarkAllRead = () => {
    setAlerts((prev) => prev.map((a) => ({ ...a, read: true })));
  };

  const getTimeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "à l'instant";
    if (mins < 60) return `Il y a ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Il y a ${hours}h`;
    return `Il y a ${Math.floor(hours / 24)}j`;
  };

  return (
    <View className="flex-1 bg-white">
      {/* Header info */}
      <View className="px-4 pt-2 pb-3">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-xl font-bold text-slate-900">Alertes Locataire</Text>
          <TouchableOpacity onPress={handleMarkAllRead}>
            <Text className="text-sm text-kaza-vert font-medium">Tout marquer{'\n'}comme lu</Text>
          </TouchableOpacity>
        </View>

        {/* Info banner */}
        <View className="bg-kaza-vert/5 border border-kaza-vert/15 rounded-xl p-3 flex-row items-start mb-3">
          <Lightbulb size={16} color="#0E4728" style={{ marginTop: 1 }} />
          <Text className="text-xs text-slate-600 ml-2 flex-1">
            Recevez en temps réel les maisons publiées dans vos quartiers préférés.
          </Text>
        </View>
      </View>

      <FlatList
        data={alerts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, flexGrow: 1 }}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center py-20">
            <Bell size={48} color="#CBD5E1" />
            <Text className="text-lg font-semibold text-slate-400 mt-4">Aucune alerte</Text>
            <Text className="text-sm text-slate-400 mt-1 text-center px-8">
              Sauvegardez des recherches pour recevoir des alertes quand de nouveaux logements correspondent.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const iconConfig = ICON_MAP[item.type] ?? ICON_MAP.match;
          const Icon = iconConfig.icon;

          return (
            <TouchableOpacity
              className={`flex-row items-start p-3 rounded-xl mb-2 ${!item.read ? 'bg-slate-50' : 'bg-white'} border border-slate-100`}
            >
              <View className="w-10 h-10 rounded-full items-center justify-center mr-3" style={{ backgroundColor: `${iconConfig.color}15` }}>
                <Icon size={18} color={iconConfig.color} />
              </View>
              <View className="flex-1">
                <View className="flex-row items-start justify-between">
                  <Text className={`text-sm flex-1 mr-2 ${!item.read ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>
                    {item.title}
                  </Text>
                  {!item.read && <View className="w-2 h-2 bg-kaza-vert rounded-full mt-1.5" />}
                </View>
                <Text className="text-xs text-slate-500 mt-0.5" numberOfLines={2}>{item.body}</Text>
                <Text className="text-[10px] text-slate-400 mt-1">{getTimeAgo(item.created_at)}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}
