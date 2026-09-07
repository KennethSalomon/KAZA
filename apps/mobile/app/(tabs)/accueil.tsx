import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Search,
  MapPin,
  SlidersHorizontal,
  Bell,
  ChevronRight,
} from 'lucide-react-native';
import * as Location from 'expo-location';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { formatFCFA } from '@kaza/shared';
import type { Residence, ResidenceType } from '@kaza/shared';
import { PropertyCard } from '@/components/property/property-card';
import { useAuth } from '@/lib/auth-context';

const FILTER_CHIPS: { label: string; value: ResidenceType | 'all' }[] = [
  { label: 'Tous', value: 'all' },
  { label: 'Chambre salon', value: 'chambre' },
  { label: 'Appartement', value: 'appartement' },
  { label: 'Villa', value: 'villa' },
];

export default function AccueilScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Residence[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<ResidenceType | 'all'>('all');
  const [cityName, setCityName] = useState('Cotonou, Bénin');
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

  const search = useCallback(async () => {
    try {
      const params: Record<string, unknown> = {
        p_q: query || null,
        p_city: null,
        p_zone: null,
        p_type: activeFilter === 'all' ? null : activeFilter,
        p_max_price: null,
        p_lat: null,
        p_lng: null,
        p_radius_km: null,
        p_limit: 40,
        p_offset: 0,
      };
      const { data, error } = await supabase.rpc('search_residences', params);
      if (error) throw error;
      setResults((data ?? []) as unknown as Residence[]);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [query, activeFilter]);

  const loadFavorites = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await supabase.rpc('list_my_favorite_ids');
      if (data) setFavoriteIds(new Set(data as unknown as string[]));
    } catch {}
  }, [user]);

  useEffect(() => {
    const timeout = setTimeout(search, 400);
    return () => clearTimeout(timeout);
  }, [search]);

  useEffect(() => { loadFavorites(); }, [loadFavorites]);

  const toggleFavorite = async (id: string) => {
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    await supabase.rpc('toggle_favorite', { p_residence_id: id });
  };

  const onRefresh = () => { setRefreshing(true); search(); };

  const recentResults = results.slice(0, 10);

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      {/* Header */}
      <View className="px-4 pt-2 pb-3">
        <View className="flex-row items-center justify-between mb-3">
          <View>
            <Text className="text-xs text-slate-500">Lieu actuel</Text>
            <View className="flex-row items-center">
              <MapPin size={14} color="#0E4728" />
              <Text className="text-base font-bold text-slate-900 ml-1">{cityName}</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/notifications')}
            className="w-10 h-10 bg-slate-100 rounded-full items-center justify-center"
          >
            <Bell size={20} color="#0F172A" />
          </TouchableOpacity>
        </View>

        {/* Search bar */}
        <View className="flex-row items-center gap-2">
          <View className="flex-1 flex-row items-center bg-slate-100 rounded-xl px-3 h-11">
            <Search size={18} color="#94A3B8" />
            <TextInput
              className="flex-1 ml-2 text-sm text-slate-900"
              placeholder="Chercher un quartier, une ville..."
              placeholderTextColor="#94A3B8"
              value={query}
              onChangeText={setQuery}
              returnKeyType="search"
            />
          </View>
          <TouchableOpacity className="w-11 h-11 bg-kaza-vert rounded-xl items-center justify-center">
            <SlidersHorizontal size={18} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0E4728" />}
        showsVerticalScrollIndicator={false}
      >
        {/* Filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="px-4 mb-4"
          contentContainerStyle={{ gap: 8 }}
        >
          {FILTER_CHIPS.map((chip) => (
            <TouchableOpacity
              key={chip.value}
              onPress={() => setActiveFilter(chip.value)}
              className={`px-4 py-2 rounded-full border ${
                activeFilter === chip.value
                  ? 'bg-kaza-vert border-kaza-vert'
                  : 'bg-white border-slate-200'
              }`}
            >
              <Text
                className={`text-sm font-medium ${
                  activeFilter === chip.value ? 'text-white' : 'text-slate-600'
                }`}
              >
                {chip.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Promo banner */}
        <View className="mx-4 mb-5 bg-kaza-vert rounded-2xl p-4 flex-row items-center overflow-hidden">
          <View className="flex-1">
            <View className="bg-kaza-amber px-2 py-0.5 rounded self-start mb-2">
              <Text className="text-[10px] font-bold text-white">OFFRE SPÉCIALE</Text>
            </View>
            <Text className="text-lg font-bold text-white mb-1">
              Économisez 1 mois{'\n'}de loyer
            </Text>
            <Text className="text-xs text-white/80">✓ Zéro démarcheur</Text>
          </View>
          <View className="flex-row items-end gap-1.5 mr-2">
            <View className="w-3 h-10 bg-kaza-mint/60 rounded-sm" />
            <View className="w-3 h-16 bg-kaza-mint/80 rounded-sm" />
            <View className="w-3 h-12 bg-kaza-mint rounded-sm" />
          </View>
        </View>

        {/* Section title */}
        <View className="flex-row items-center justify-between px-4 mb-3">
          <Text className="text-lg font-bold text-slate-900">
            Annonces récentes à {cityName.split(',')[0]}
          </Text>
          <TouchableOpacity className="flex-row items-center">
            <Text className="text-sm text-kaza-vert font-medium">Voir tout</Text>
            <ChevronRight size={16} color="#0E4728" />
          </TouchableOpacity>
        </View>

        {/* Property list */}
        {loading ? (
          <View className="py-20 items-center">
            <ActivityIndicator size="large" color="#0E4728" />
          </View>
        ) : (
          <View className="px-4 pb-8">
            {recentResults.length === 0 ? (
              <View className="items-center py-16">
                <Search size={48} color="#CBD5E1" />
                <Text className="text-lg font-semibold text-slate-400 mt-4">
                  Aucune annonce trouvée
                </Text>
                <Text className="text-sm text-slate-400 mt-1">
                  Essayez de modifier vos filtres
                </Text>
              </View>
            ) : (
              recentResults.map((item) => (
                <PropertyCard
                  key={item.id}
                  residence={item}
                  onPress={() => router.push(`/residence/${item.id}`)}
                  isFavorite={favoriteIds.has(item.id)}
                  onToggleFavorite={() => toggleFavorite(item.id)}
                  verified={(item as any).is_verified}
                />
              ))
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
