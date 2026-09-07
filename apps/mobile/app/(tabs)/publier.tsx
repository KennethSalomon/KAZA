import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import {
  ArrowLeft,
  Camera,
  X,
  Minus,
  Plus,
  ChevronDown,
  ArrowRight,
  MapPin,
  Phone,
  Check,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import type { ResidenceType } from '@kaza/shared';

const TYPE_OPTIONS: { label: string; value: ResidenceType }[] = [
  { label: 'Chambre salon', value: 'chambre' },
  { label: 'Appartement', value: 'appartement' },
  { label: 'Villa', value: 'villa' },
  { label: 'Boutique / Bureau', value: 'magasin' },
];

export default function PublierScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1
  const [photos, setPhotos] = useState<string[]>([]);
  const [type, setType] = useState<ResidenceType>('appartement');
  const [bedrooms, setBedrooms] = useState(1);
  const [bathrooms, setBathrooms] = useState(0);

  // Step 2
  const [price, setPrice] = useState('');
  const [cautionMonths, setCautionMonths] = useState('3');
  const [city, setCity] = useState('Cotonou');
  const [zone, setZone] = useState('');
  const [address, setAddress] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [whatsappActive, setWhatsappActive] = useState(true);

  const pickPhotos = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 8 - photos.length,
    });
    if (!result.canceled) {
      setPhotos((prev) => [...prev, ...result.assets.map((a) => a.uri)].slice(0, 8));
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePublish = async () => {
    if (!user) return;
    if (!price || !zone) {
      Alert.alert('Erreur', 'Veuillez remplir le prix et le quartier.');
      return;
    }

    setLoading(true);
    try {
      const uploadedUrls: string[] = [];
      for (const uri of photos) {
        const fileName = `${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
        const response = await fetch(uri);
        const blob = await response.blob();
        const { error } = await supabase.storage
          .from('residence-photos')
          .upload(fileName, blob, { contentType: 'image/jpeg' });
        if (!error) {
          const { data: urlData } = supabase.storage.from('residence-photos').getPublicUrl(fileName);
          uploadedUrls.push(urlData.publicUrl);
        }
      }

      const { error } = await supabase.from('residences').insert({
        owner_id: user.id,
        title: `${TYPE_OPTIONS.find((t) => t.value === type)?.label ?? type} - ${zone}`,
        type,
        price_monthly: Number(price),
        deposit: Number(price) * Number(cautionMonths),
        city,
        zone,
        address: address || null,
        bedrooms,
        bathrooms,
        photos: uploadedUrls,
        is_published: false,
      } as any);

      if (error) throw error;

      Alert.alert('Succès', 'Votre annonce a été publiée !', [
        { text: 'OK', onPress: () => { setStep(1); router.push('/(tabs)/dashboard'); } },
      ]);
    } catch (err: any) {
      Alert.alert('Erreur', err.message ?? 'Impossible de publier.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-slate-100">
        {step === 2 ? (
          <TouchableOpacity onPress={() => setStep(1)}>
            <ArrowLeft size={22} color="#0F172A" />
          </TouchableOpacity>
        ) : (
          <View className="w-6" />
        )}
        <Text className="text-base font-bold text-slate-900">Publier une annonce</Text>
        <View className="bg-slate-100 px-2.5 py-1 rounded-full">
          <Text className="text-xs font-medium text-slate-500">Étape {step} sur 2</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
        {step === 1 ? (
          <>
            {/* Photos */}
            <Text className="text-base font-bold text-slate-900 mb-1">Photos du logement</Text>
            <Text className="text-xs text-slate-500 mb-3">Recommandé : 3 à 8 photos</Text>
            <View className="flex-row flex-wrap gap-2 mb-6">
              <TouchableOpacity
                onPress={pickPhotos}
                className="w-[30%] aspect-square border-2 border-dashed border-slate-200 rounded-xl items-center justify-center"
              >
                <Camera size={24} color="#94A3B8" />
                <Text className="text-[10px] text-slate-400 mt-1 text-center">Ajouter des{'\n'}photos</Text>
                <Text className="text-[9px] text-slate-300">(Max 8)</Text>
              </TouchableOpacity>
              {photos.map((uri, i) => (
                <View key={i} className="w-[30%] aspect-square rounded-xl overflow-hidden relative">
                  <Image source={{ uri }} className="w-full h-full" contentFit="cover" />
                  <TouchableOpacity
                    onPress={() => removePhoto(i)}
                    className="absolute top-1 right-1 w-5 h-5 bg-kaza-red rounded-full items-center justify-center"
                  >
                    <X size={12} color="#FFF" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            {/* Type */}
            <Text className="text-base font-bold text-slate-900 mb-3">Type de logement</Text>
            <View className="flex-row flex-wrap gap-2 mb-6">
              {TYPE_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => setType(opt.value)}
                  className={`px-4 py-2.5 rounded-xl border ${
                    type === opt.value ? 'bg-kaza-vert border-kaza-vert' : 'bg-white border-slate-200'
                  }`}
                >
                  <Text className={`text-sm font-medium ${type === opt.value ? 'text-white' : 'text-slate-600'}`}>
                    {type === opt.value ? '✓ ' : ''}{opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Rooms */}
            <Text className="text-base font-bold text-slate-900 mb-3">Nombre de pièces</Text>
            <View className="mb-3">
              <CounterRow label="Nombre de chambres" value={bedrooms} onChange={setBedrooms} />
              <CounterRow label="Nombre de douches" value={bathrooms} onChange={setBathrooms} />
            </View>
          </>
        ) : (
          <>
            {/* Step 2: Price & Location */}
            <View className="flex-row items-center mb-4">
              <Text className="text-lg">💰</Text>
              <Text className="text-base font-bold text-slate-900 ml-2">Tarifs & Conditions</Text>
            </View>
            <Text className="text-sm font-medium text-slate-700 mb-1.5">Prix du loyer mensuel (FCFA)</Text>
            <View className="flex-row items-center border border-slate-200 rounded-xl px-3 h-12 mb-4">
              <TextInput
                className="flex-1 text-sm text-slate-900"
                placeholder="85 000"
                placeholderTextColor="#94A3B8"
                keyboardType="numeric"
                value={price}
                onChangeText={setPrice}
              />
              <Text className="text-sm text-slate-400">FCFA</Text>
            </View>

            <Text className="text-sm font-medium text-slate-700 mb-1.5">Nombre de mois de caution</Text>
            <View className="border border-slate-200 rounded-xl px-3 h-12 flex-row items-center justify-between mb-6">
              <Text className="text-sm text-slate-900">{cautionMonths} mois</Text>
              <ChevronDown size={18} color="#94A3B8" />
            </View>

            {/* Location */}
            <View className="flex-row items-center mb-4">
              <MapPin size={18} color="#0E4728" />
              <Text className="text-base font-bold text-slate-900 ml-2">Localisation</Text>
            </View>
            <Text className="text-sm font-medium text-slate-700 mb-1.5">Ville / Zone</Text>
            <View className="border border-slate-200 rounded-xl px-3 h-12 flex-row items-center justify-between mb-4">
              <Text className="text-sm text-slate-900">{city}</Text>
              <ChevronDown size={18} color="#94A3B8" />
            </View>

            <Text className="text-sm font-medium text-slate-700 mb-1.5">Quartier</Text>
            <View className="border border-slate-200 rounded-xl px-3 h-12 mb-4">
              <TextInput
                className="flex-1 text-sm text-slate-900"
                placeholder="Akpakpa"
                placeholderTextColor="#94A3B8"
                value={zone}
                onChangeText={setZone}
              />
            </View>

            <Text className="text-sm font-medium text-slate-700 mb-1.5">Adresse précise (Optionnel)</Text>
            <View className="border border-slate-200 rounded-xl px-3 h-12 mb-6">
              <TextInput
                className="flex-1 text-sm text-slate-900"
                placeholder="Ex: Rue 123..."
                placeholderTextColor="#94A3B8"
                value={address}
                onChangeText={setAddress}
              />
            </View>

            {/* Contact */}
            <View className="flex-row items-center mb-4">
              <Phone size={18} color="#0E4728" />
              <Text className="text-base font-bold text-slate-900 ml-2">Coordonnées de contact</Text>
            </View>
            <Text className="text-sm font-medium text-slate-700 mb-1.5">Numéro de téléphone</Text>
            <View className="flex-row items-center border border-slate-200 rounded-xl px-3 h-12 mb-4">
              <Text className="text-sm text-slate-500 mr-2">+229</Text>
              <TextInput
                className="flex-1 text-sm text-slate-900"
                placeholder="97000000"
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad"
                value={contactPhone}
                onChangeText={setContactPhone}
              />
            </View>

            <View className="flex-row items-center justify-between mb-6">
              <View className="flex-row items-center">
                <Text className="text-sm text-slate-700">Disponible sur WhatsApp</Text>
              </View>
              <TouchableOpacity
                onPress={() => setWhatsappActive(!whatsappActive)}
                className={`w-12 h-7 rounded-full justify-center px-0.5 ${whatsappActive ? 'bg-kaza-vert items-end' : 'bg-slate-200 items-start'}`}
              >
                <View className="w-6 h-6 bg-white rounded-full" />
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>

      {/* Bottom CTA */}
      <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-slate-100 px-4 py-4 pb-8">
        {step === 1 ? (
          <TouchableOpacity
            onPress={() => setStep(2)}
            className="bg-kaza-vert h-12 rounded-xl flex-row items-center justify-center"
            activeOpacity={0.8}
          >
            <Text className="text-white font-semibold text-base">Continuer vers l'étape 2</Text>
            <ArrowRight size={18} color="#FFF" style={{ marginLeft: 6 }} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={handlePublish}
            disabled={loading}
            className="bg-kaza-vert h-12 rounded-xl flex-row items-center justify-center"
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Text className="text-white font-semibold text-base">Publier l'annonce maintenant</Text>
                <ArrowRight size={18} color="#FFF" style={{ marginLeft: 6 }} />
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

function CounterRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <View className="flex-row items-center justify-between py-3">
      <Text className="text-sm text-slate-700">{label}</Text>
      <View className="flex-row items-center gap-3">
        <TouchableOpacity
          onPress={() => onChange(Math.max(0, value - 1))}
          className="w-8 h-8 bg-slate-100 rounded-full items-center justify-center"
        >
          <Minus size={16} color="#64748B" />
        </TouchableOpacity>
        <Text className="text-base font-semibold text-slate-900 w-6 text-center">{value}</Text>
        <TouchableOpacity
          onPress={() => onChange(value + 1)}
          className="w-8 h-8 bg-slate-100 rounded-full items-center justify-center"
        >
          <Plus size={16} color="#64748B" />
        </TouchableOpacity>
      </View>
    </View>
  );
}
