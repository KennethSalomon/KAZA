import { View, Text, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { MapPin, Bed, ShowerHead, Heart } from 'lucide-react-native';
import { formatFCFA } from '@kaza/shared';
import type { Residence } from '@kaza/shared';

interface PropertyCardProps {
  residence: Residence;
  onPress: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  verified?: boolean;
}

export function PropertyCard({
  residence,
  onPress,
  isFavorite,
  onToggleFavorite,
  verified,
}: PropertyCardProps) {
  const photo = residence.photos?.[0];
  const cautionMonths =
    residence.deposit && residence.price_monthly
      ? Math.round(Number(residence.deposit) / Number(residence.price_monthly))
      : 3;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className="bg-white rounded-2xl overflow-hidden mb-4"
      style={{
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 3,
      }}
    >
      {/* Photo */}
      <View className="h-52 bg-slate-200 relative">
        {photo ? (
          <Image
            source={{ uri: photo }}
            className="w-full h-full"
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View className="flex-1 items-center justify-center bg-slate-100">
            <MapPin size={32} color="#CBD5E1" />
          </View>
        )}

        {/* Caution badge */}
        <View className="absolute top-3 left-3 bg-kaza-amber/90 px-2.5 py-1 rounded-md">
          <Text className="text-xs font-semibold text-white">
            Caution {cautionMonths} mois
          </Text>
        </View>

        {/* Verified badge */}
        {verified && (
          <View className="absolute bottom-3 left-3 bg-kaza-vert/90 px-2 py-1 rounded-md flex-row items-center">
            <Text className="text-[10px] font-semibold text-white">Vérifié</Text>
          </View>
        )}

        {/* Favorite button */}
        {onToggleFavorite && (
          <TouchableOpacity
            onPress={(e) => { e.stopPropagation?.(); onToggleFavorite(); }}
            className="absolute top-3 right-3 w-9 h-9 bg-white/90 rounded-full items-center justify-center"
          >
            <Heart
              size={18}
              color={isFavorite ? '#EF4444' : '#64748B'}
              fill={isFavorite ? '#EF4444' : 'none'}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Info */}
      <View className="p-3.5">
        <Text className="text-base font-semibold text-slate-900" numberOfLines={1}>
          {residence.title}
        </Text>

        {(residence.city || residence.zone) && (
          <View className="flex-row items-center mt-1">
            <MapPin size={13} color="#64748B" />
            <Text className="text-xs text-slate-500 ml-1" numberOfLines={1}>
              {[residence.zone, residence.city].filter(Boolean).join(', ')}
            </Text>
          </View>
        )}

        <View className="flex-row items-center mt-1.5 gap-3">
          {residence.bedrooms > 0 && (
            <View className="flex-row items-center gap-1">
              <Bed size={13} color="#64748B" />
              <Text className="text-xs text-slate-500">{residence.bedrooms} pièces</Text>
            </View>
          )}
          {residence.bathrooms > 0 && (
            <View className="flex-row items-center gap-1">
              <ShowerHead size={13} color="#64748B" />
              <Text className="text-xs text-slate-500">{residence.bathrooms} SDB</Text>
            </View>
          )}
        </View>

        <View className="flex-row items-center justify-between mt-3">
          <Text className="text-lg font-bold text-kaza-vert">
            {formatFCFA(residence.price_monthly)}
            <Text className="text-xs font-normal text-slate-400"> / mois</Text>
          </Text>
          <TouchableOpacity
            onPress={onPress}
            className="bg-kaza-vert px-4 py-1.5 rounded-lg"
          >
            <Text className="text-xs font-semibold text-white">Voir l'annonce</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}
