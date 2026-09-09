import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Heart, Search, Home } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import type { Residence } from '@kaza/shared';
import { PropertyCard } from '@/components/property/property-card';

export default function FavorisScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<Residence[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase.rpc('list_my_favorites');
      if (error) throw error;
      setFavorites((data ?? []) as unknown as Residence[]);
    } catch {
      setFavorites([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const removeFavorite = async (id: string) => {
    setFavorites((prev) => prev.filter((f) => f.id !== id));
    await supabase.rpc('toggle_favorite', { p_residence_id: id });
  };

  if (loading) {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#0E4728" />
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <View className="px-4 pt-2 pb-3 flex-row items-center justify-between">
        <Text className="text-xl font-bold text-slate-900">
          Mes Favoris ({favorites.length})
        </Text>
      </View>

      <FlatList
        data={favorites}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, flexGrow: 1 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#0E4728" />
        }
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center py-16">
            {/* Illustration placeholder */}
            <View className="w-24 h-24 items-center justify-center mb-4">
              <Home size={40} color="#0E4728" />
              <View className="absolute -top-1 -right-1">
                <Heart size={20} color="#CBD5E1" />
              </View>
              <View className="absolute bottom-0 right-0">
                <Search size={24} color="#94A3B8" />
              </View>
            </View>
            <Text className="text-lg font-bold text-slate-900 mb-2 text-center">
              Aucun favori pour le moment
            </Text>
            <Text className="text-sm text-slate-500 text-center px-8 mb-6">
              Explorez les annonces et cliquez sur l'icône en forme de cœur pour sauvegarder
              vos logements préférés ici.
            </Text>
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/accueil')}
              className="flex-row items-center bg-slate-100 rounded-xl px-5 py-3"
            >
              <Search size={16} color="#0E4728" />
              <Text className="text-sm font-semibold text-kaza-vert ml-2">Explorer les annonces</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => (
          <PropertyCard
            residence={item}
            onPress={() => router.push(`/residence/${item.id}`)}
            isFavorite={true}
            onToggleFavorite={() => removeFavorite(item.id)}
          />
        )}
      />
    </SafeAreaView>
  );
}
