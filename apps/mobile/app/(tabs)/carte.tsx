import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Search, List, MapPin } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Callout } from 'react-native-maps';
import * as Location from 'expo-location';
import { supabase } from '@/lib/supabase';
import { formatFCFA } from '@kaza/shared';
import type { Residence } from '@kaza/shared';

const COTONOU_REGION = {
  latitude: 6.3654,
  longitude: 2.4183,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

export default function CarteScreen() {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const [residences, setResidences] = useState<Residence[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  const loadResidences = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('search_residences', {
        p_q: query || null,
        p_city: null,
        p_zone: null,
        p_type: null,
        p_max_price: null,
        p_lat: null,
        p_lng: null,
        p_radius_km: null,
        p_limit: 100,
        p_offset: 0,
      });
      if (error) throw error;
      setResidences((data ?? []) as unknown as Residence[]);
    } catch {
      setResidences([]);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    const t = setTimeout(loadResidences, 400);
    return () => clearTimeout(t);
  }, [loadResidences]);

  const centerOnUser = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    const loc = await Location.getCurrentPositionAsync({});
    mapRef.current?.animateToRegion({
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      {/* Search bar overlay */}
      <View className="absolute top-14 left-4 right-4 z-10">
        <View className="flex-row items-center bg-white rounded-xl px-3 h-11 shadow-md">
          <Search size={18} color="#94A3B8" />
          <TextInput
            className="flex-1 ml-2 text-sm text-slate-900"
            placeholder="Chercher sur la carte..."
            placeholderTextColor="#94A3B8"
            value={query}
            onChangeText={setQuery}
          />
        </View>
      </View>

      {/* Map */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#0E4728" />
        </View>
      ) : (
        <MapView
          ref={mapRef}
          className="flex-1"
          initialRegion={COTONOU_REGION}
          showsUserLocation
          showsMyLocationButton={false}
        >
          {residences
            .filter((r) => r.lat && r.lng)
            .map((r) => (
              <Marker
                key={r.id}
                coordinate={{ latitude: r.lat!, longitude: r.lng! }}
                onCalloutPress={() => router.push(`/residence/${r.id}`)}
              >
                <View className="bg-kaza-vert px-2 py-1 rounded-lg">
                  <Text className="text-xs font-bold text-white">
                    {formatFCFA(r.price_monthly)}
                  </Text>
                </View>
                <Callout>
                  <View style={{ width: 200 }}>
                    <Text className="text-sm font-semibold" numberOfLines={1}>{r.title}</Text>
                    <Text className="text-xs text-slate-500">{r.zone}, {r.city}</Text>
                    <Text className="text-sm font-bold text-kaza-vert mt-1">
                      {formatFCFA(r.price_monthly)}/mois
                    </Text>
                  </View>
                </Callout>
              </Marker>
            ))}
        </MapView>
      )}

      {/* Bottom controls */}
      <View className="absolute bottom-28 right-4 gap-2">
        <TouchableOpacity
          onPress={centerOnUser}
          className="w-11 h-11 bg-white rounded-full items-center justify-center shadow-md"
        >
          <MapPin size={20} color="#0E4728" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/accueil')}
          className="w-11 h-11 bg-kaza-vert rounded-full items-center justify-center shadow-md"
        >
          <List size={20} color="#FFF" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
