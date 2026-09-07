import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import {
  Home,
  Eye,
  Phone,
  Plus,
  Bell,
  MoreVertical,
  Pencil,
  BarChart3,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { formatFCFA } from '@kaza/shared';
import type { Residence } from '@kaza/shared';

export default function DashboardScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [residences, setResidences] = useState<Residence[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({ active: 0, maxActive: 5, views: 0, contacts: 0 });

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('residences')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });

      const list = (data ?? []) as unknown as Residence[];
      setResidences(list);

      const active = list.filter((r) => (r as any).is_published === true).length;
      const totalViews = list.reduce((s, r) => s + (r.views_count ?? 0), 0);
      setStats({ active, maxActive: 5, views: totalViews, contacts: 0 });
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#0E4728" />
      </View>
    );
  }

  const hasResidences = residences.length > 0;

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#0E4728" />}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      >
        {/* Header */}
        <View className="flex-row items-center justify-between mb-5">
          <View className="flex-row items-center">
            <View className="w-10 h-10 bg-slate-200 rounded-full items-center justify-center mr-3">
              <Text className="text-lg font-bold text-slate-500">
                {(user?.full_name ?? 'P').charAt(0)}
              </Text>
            </View>
            <View>
              <Text className="text-lg font-bold text-slate-900">Tableau de bord</Text>
              <Text className="text-xs text-slate-500">
                Bonjour, {user?.full_name?.split(' ')[0] ?? 'Propriétaire'}
              </Text>
            </View>
          </View>
          <View className="flex-row items-center gap-2">
            <View className="bg-kaza-vert/15 px-2 py-0.5 rounded-full">
              <Text className="text-[10px] font-semibold text-kaza-vert">Compte Propriétaire</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/notifications')}>
              <Bell size={20} color="#64748B" />
            </TouchableOpacity>
          </View>
        </View>

        {/* KPI row */}
        <View className="flex-row gap-3 mb-4">
          <KPICard icon={Home} label="Annonces actives" value={`${stats.active} / ${stats.maxActive}`} subtext={`${stats.maxActive - stats.active} annonces restantes`} />
          <KPICard icon={Eye} label="Vues ce mois" value={`${stats.views}`} subtext="" />
          <KPICard icon={Phone} label="Contacts reçus" value={`${stats.contacts}`} subtext="" />
        </View>

        {/* Plan card */}
        <View className="bg-kaza-vert rounded-2xl p-4 mb-5">
          <View className="flex-row items-center justify-between">
            <View>
              <View className="flex-row items-center gap-2">
                <BarChart3 size={16} color="#FFF" />
                <Text className="text-base font-bold text-white">Plan Standard</Text>
              </View>
              <Text className="text-xs text-white/70 mt-1">2 000 FCFA/mois • Expire dans 14 jours</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/abonnement')}
            className="bg-white h-10 rounded-xl items-center justify-center mt-3"
          >
            <Text className="text-sm font-semibold text-kaza-vert">Gérer / Prolonger</Text>
          </TouchableOpacity>
        </View>

        {/* Annonces section */}
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-base font-bold text-slate-900">
            Mes Annonces {hasResidences ? `(${residences.length})` : ''}
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/publier')}
            className="flex-row items-center bg-kaza-vert px-3 py-1.5 rounded-lg"
          >
            <Plus size={14} color="#FFF" />
            <Text className="text-xs font-semibold text-white ml-1">Ajouter</Text>
          </TouchableOpacity>
        </View>

        {!hasResidences ? (
          <View className="items-center py-12 bg-slate-50 rounded-2xl">
            <Home size={40} color="#CBD5E1" />
            <Text className="text-base font-bold text-slate-900 mt-4 text-center">
              Vous n'avez encore publié{'\n'}aucune annonce
            </Text>
            <Text className="text-sm text-slate-500 text-center mt-2 px-6">
              Mettez votre bien en location dès aujourd'hui et touchez des centaines de locataires
              à Cotonou sans intermédiaire.
            </Text>
          </View>
        ) : (
          residences.map((r) => (
            <TouchableOpacity
              key={r.id}
              onPress={() => router.push(`/landlord/residences/${r.id}/edit`)}
              className="bg-white rounded-2xl overflow-hidden mb-3 border border-slate-100"
            >
              {r.photos?.[0] && (
                <View className="relative h-40">
                  <Image source={{ uri: r.photos[0] }} className="w-full h-full" contentFit="cover" />
                  <View className={`absolute top-3 left-3 px-2 py-0.5 rounded-md ${(r as any).is_published ? 'bg-kaza-mint' : 'bg-slate-400'}`}>
                    <Text className="text-[10px] font-bold text-white">
                      {(r as any).is_published ? '● Active' : '● En pause'}
                    </Text>
                  </View>
                </View>
              )}
              <View className="p-3">
                <Text className="text-sm font-semibold text-slate-900" numberOfLines={1}>
                  {r.title}
                </Text>
                <Text className="text-base font-bold text-kaza-vert mt-0.5">
                  {formatFCFA(r.price_monthly)}
                  <Text className="text-xs font-normal text-slate-400"> /mois</Text>
                </Text>
                <View className="flex-row items-center justify-between mt-2">
                  <View className="flex-row items-center">
                    <Eye size={12} color="#94A3B8" />
                    <Text className="text-xs text-slate-400 ml-1">{r.views_count ?? 0} vues</Text>
                  </View>
                  <View className="flex-row items-center gap-2">
                    <TouchableOpacity>
                      <Pencil size={16} color="#64748B" />
                    </TouchableOpacity>
                    <TouchableOpacity>
                      <MoreVertical size={16} color="#64748B" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function KPICard({ icon: Icon, label, value, subtext }: { icon: any; label: string; value: string; subtext: string }) {
  return (
    <View className="flex-1 bg-slate-50 rounded-xl p-3">
      <Icon size={16} color="#64748B" />
      <Text className="text-2xl font-bold text-slate-900 mt-1">{value}</Text>
      <Text className="text-[10px] text-slate-500 mt-0.5">{label}</Text>
    </View>
  );
}
