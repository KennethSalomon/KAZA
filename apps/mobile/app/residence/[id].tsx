import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Alert,
  Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Image } from 'expo-image';
import {
  MapPin,
  Bed,
  ShowerHead,
  Heart,
  ChevronLeft,
  ChevronRight,
  Star,
  Lock,
  UtensilsCrossed,
  Fence,
  Car,
} from 'lucide-react-native';
import MapView, { Marker } from 'react-native-maps';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { formatFCFA } from '@kaza/shared';
import type { Residence, Review } from '@kaza/shared';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const AMENITY_ICONS: Record<string, any> = {
  Chambres: Bed,
  Douche: ShowerHead,
  Cuisine: UtensilsCrossed,
  Balcon: Fence,
  Garage: Car,
};

export default function ResidenceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, isPremium } = useAuth();
  const [residence, setResidence] = useState<Residence | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [numberUnlocked, setNumberUnlocked] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [resRes, favRes, reviewsRes] = await Promise.all([
        supabase.rpc('get_residence', { p_residence_id: id }),
        user ? supabase.rpc('list_my_favorite_ids') : Promise.resolve({ data: [] }),
        supabase.rpc('list_reviews', { p_residence_id: id }),
      ]);

      if (resRes.data) setResidence(resRes.data as unknown as Residence);
      if (favRes.data) setIsFavorite((favRes.data as string[]).includes(id));
      if (reviewsRes.data) setReviews((reviewsRes.data as unknown as Review[]) ?? []);

      supabase.rpc('increment_residence_views', { p_id: id });
    } catch {} finally {
      setLoading(false);
    }
  }, [id, user]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (isPremium) setNumberUnlocked(true);
  }, [isPremium]);

  const handleToggleFavorite = async () => {
    if (!user || !id) return;
    setIsFavorite(!isFavorite);
    try {
      await supabase.rpc('toggle_favorite', { p_residence_id: id });
    } catch {
      setIsFavorite(!isFavorite);
    }
  };

  const handleUnlockNumber = () => {
    Alert.alert(
      'Débloquer le numéro',
      'Achetez un Pass Locataire (1 000 FCFA) pour accéder aux numéros directs des propriétaires pendant 30 jours.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Acheter le Pass', onPress: () => setNumberUnlocked(true) },
      ],
    );
  };

  if (loading || !residence) {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#0E4728" />
      </View>
    );
  }

  const photos = residence.photos ?? [];
  const ownerPhone = (residence as any).owner_phone ?? '+229 97 00 00 00';
  const maskedPhone = ownerPhone.replace(/(\+\d{3}\s?\d{2})\s?.*/, '$1 ** ** **');
  const cautionMonths =
    residence.deposit && residence.price_monthly
      ? Math.round(Number(residence.deposit) / Number(residence.price_monthly))
      : 3;

  const amenityKeys = ['Chambres', 'Douche', 'Cuisine', 'Balcon', 'Garage'];

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView className="flex-1 bg-white">
        {/* Photo gallery */}
        <View className="relative" style={{ height: SCREEN_WIDTH * 0.72 }}>
          {photos.length > 0 ? (
            <Image
              source={{ uri: photos[photoIndex] }}
              style={{ width: SCREEN_WIDTH, height: SCREEN_WIDTH * 0.72 }}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <View className="flex-1 bg-slate-200 items-center justify-center">
              <MapPin size={48} color="#CBD5E1" />
            </View>
          )}

          {/* Back button */}
          <TouchableOpacity
            onPress={() => router.back()}
            className="absolute top-12 left-4 w-10 h-10 bg-white/90 rounded-full items-center justify-center"
          >
            <ChevronLeft size={22} color="#0F172A" />
          </TouchableOpacity>

          {/* Favorite */}
          <TouchableOpacity
            onPress={handleToggleFavorite}
            className="absolute top-12 right-4 w-10 h-10 bg-white/90 rounded-full items-center justify-center"
          >
            <Heart size={20} color={isFavorite ? '#EF4444' : '#94A3B8'} fill={isFavorite ? '#EF4444' : 'none'} />
          </TouchableOpacity>

          {/* Photo counter */}
          {photos.length > 1 && (
            <View className="absolute bottom-3 right-3 bg-black/50 px-2.5 py-1 rounded-full">
              <Text className="text-xs text-white font-medium">
                {photoIndex + 1}/{photos.length}
              </Text>
            </View>
          )}

          {/* Nav arrows */}
          {photoIndex > 0 && (
            <TouchableOpacity
              onPress={() => setPhotoIndex(photoIndex - 1)}
              className="absolute left-3 top-1/2 -mt-5 w-9 h-9 bg-black/30 rounded-full items-center justify-center"
            >
              <ChevronLeft size={20} color="#FFF" />
            </TouchableOpacity>
          )}
          {photoIndex < photos.length - 1 && (
            <TouchableOpacity
              onPress={() => setPhotoIndex(photoIndex + 1)}
              className="absolute right-3 top-1/2 -mt-5 w-9 h-9 bg-black/30 rounded-full items-center justify-center"
            >
              <ChevronRight size={20} color="#FFF" />
            </TouchableOpacity>
          )}
        </View>

        <View className="px-4 pt-4 pb-6">
          {/* Title */}
          <Text className="text-xl font-bold text-slate-900">{residence.title}</Text>

          {/* Price */}
          <Text className="text-xl font-bold text-kaza-vert mt-1">
            {formatFCFA(residence.price_monthly)}
            <Text className="text-sm font-normal text-slate-400"> / mois</Text>
          </Text>

          {/* Location */}
          <View className="flex-row items-center mt-2">
            <MapPin size={14} color="#64748B" />
            <Text className="text-sm text-slate-500 ml-1">
              {[residence.zone, residence.city].filter(Boolean).join(', ')}
            </Text>
          </View>

          {/* Caution badge */}
          <View className="self-start bg-kaza-amber/15 border border-kaza-amber/30 px-3 py-1 rounded-full mt-3">
            <Text className="text-xs font-medium text-kaza-amber">Caution : {cautionMonths} mois</Text>
          </View>

          {/* Amenity icons row */}
          <View className="flex-row items-center justify-around mt-5 py-3 border-y border-slate-100">
            {amenityKeys.map((key) => {
              const Icon = AMENITY_ICONS[key] ?? Bed;
              return (
                <View key={key} className="items-center gap-1">
                  <Icon size={20} color="#64748B" />
                  <Text className="text-[11px] text-slate-500">{key}</Text>
                </View>
              );
            })}
          </View>

          {/* Description */}
          {residence.description && (
            <View className="mt-5">
              <Text className="text-base font-bold text-slate-900 mb-2">Description</Text>
              <Text className="text-sm text-slate-600 leading-5">{residence.description}</Text>
            </View>
          )}

          {/* Map miniature */}
          {residence.lat && residence.lng && (
            <View className="mt-5 h-44 rounded-2xl overflow-hidden">
              <MapView
                style={{ width: '100%', height: '100%' }}
                initialRegion={{
                  latitude: residence.lat,
                  longitude: residence.lng,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }}
                scrollEnabled={false}
                zoomEnabled={false}
                pitchEnabled={false}
                rotateEnabled={false}
              >
                <Marker coordinate={{ latitude: residence.lat, longitude: residence.lng }}>
                  <View className="bg-kaza-vert px-2 py-1 rounded-lg">
                    <Text className="text-xs font-bold text-white">
                      {formatFCFA(residence.price_monthly)}
                    </Text>
                  </View>
                </Marker>
              </MapView>
            </View>
          )}

          {/* Contact section - locked */}
          <View className="mt-6 bg-kaza-amber/5 border border-kaza-amber/20 rounded-2xl p-4">
            <Text className="text-base font-bold text-slate-900 mb-3">
              Coordonnées du propriétaire
            </Text>
            <View className="flex-row items-center mb-3">
              <Lock size={16} color="#F59E0B" />
              <Text className="text-lg font-bold text-slate-900 ml-2 tracking-wider">
                {numberUnlocked ? ownerPhone : maskedPhone}
              </Text>
            </View>
            {!numberUnlocked && (
              <>
                <Text className="text-xs text-slate-500 mb-3">
                  Débloquez l'accès direct aux propriétaires sans commission de démarcheur.
                </Text>
                <TouchableOpacity
                  onPress={handleUnlockNumber}
                  className="bg-kaza-amber h-11 rounded-xl items-center justify-center"
                  activeOpacity={0.8}
                >
                  <Text className="text-white font-semibold text-sm">
                    Débloquer le numéro (1 000 FCFA / Pass)
                  </Text>
                </TouchableOpacity>
              </>
            )}
            {numberUnlocked && (
              <TouchableOpacity
                onPress={() => Linking.openURL(`tel:${ownerPhone}`)}
                className="bg-kaza-vert h-11 rounded-xl items-center justify-center"
              >
                <Text className="text-white font-semibold text-sm">Appeler le propriétaire</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Reviews */}
          {reviews.length > 0 && (
            <View className="mt-6">
              <Text className="text-base font-bold text-slate-900 mb-2">
                Avis ({reviews.length})
              </Text>
              {reviews.slice(0, 3).map((review) => (
                <View key={review.id} className="bg-slate-50 rounded-xl p-3 mb-2">
                  <View className="flex-row items-center gap-0.5 mb-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} size={12} color="#F59E0B" fill={i < review.rating ? '#F59E0B' : 'none'} />
                    ))}
                  </View>
                  {review.comment && <Text className="text-xs text-slate-600">{review.comment}</Text>}
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </>
  );
}
