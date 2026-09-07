import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Image } from 'expo-image';
import { Camera, Trash2, ChevronDown, X } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import type { Residence } from '@kaza/shared';

export default function EditResidenceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [residence, setResidence] = useState<Residence | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [isVisible, setIsVisible] = useState(true);
  const [cautionMonths, setCautionMonths] = useState('3');

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data } = await supabase.from('residences').select('*').eq('id', id).maybeSingle();
      if (data) {
        const r = data as unknown as Residence;
        setResidence(r);
        setTitle(r.title ?? '');
        setPrice(String(r.price_monthly ?? ''));
        setDescription(r.description ?? '');
        setPhotos(r.photos ?? []);
        setIsVisible((r as any).is_published ?? true);
        if (r.deposit && r.price_monthly) {
          setCautionMonths(String(Math.round(Number(r.deposit) / Number(r.price_monthly))));
        }
      }
      setLoading(false);
    })();
  }, [id]);

  const addPhotos = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 10 - photos.length,
    });
    if (!result.canceled) {
      const newUris = result.assets.map((a) => a.uri);
      setPhotos((prev) => [...prev, ...newUris].slice(0, 10));
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!id || !user) return;
    setSaving(true);
    try {
      const uploadedPhotos: string[] = [];
      for (const uri of photos) {
        if (uri.startsWith('http')) {
          uploadedPhotos.push(uri);
        } else {
          const fileName = `${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
          const response = await fetch(uri);
          const blob = await response.blob();
          await supabase.storage.from('residence-photos').upload(fileName, blob, { contentType: 'image/jpeg' });
          const { data: urlData } = supabase.storage.from('residence-photos').getPublicUrl(fileName);
          uploadedPhotos.push(urlData.publicUrl);
        }
      }

      const priceNum = Number(price);
      const cautionNum = Number(cautionMonths);
      const { error } = await supabase
        .from('residences')
        .update({
          title,
          price_monthly: priceNum,
          deposit: priceNum * cautionNum,
          description,
          photos: uploadedPhotos,
          is_published: isVisible,
        } as any)
        .eq('id', id);

      if (error) throw error;
      Alert.alert('Succès', 'Annonce mise à jour.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert('Erreur', err.message ?? 'Échec de la mise à jour.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Supprimer cette annonce',
      'Cette action est définitive et ne peut pas être annulée. Voulez-vous continuer ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.from('residences').delete().eq('id', id!);
            if (error) {
              Alert.alert('Erreur', error.message);
              return;
            }
            router.back();
          },
        },
      ],
    );
  };

  const cycleCaution = () => {
    const options = ['1', '2', '3', '6', '12'];
    const idx = options.indexOf(cautionMonths);
    setCautionMonths(options[(idx + 1) % options.length]);
  };

  if (loading) {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#0E4728" />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Modifier l\'annonce',
          headerStyle: { backgroundColor: '#FFF' },
          headerTintColor: '#0E4728',
          headerShadowVisible: false,
          headerTitleStyle: { fontWeight: '700', fontSize: 16, color: '#0F172A' },
          headerRight: () => (
            <TouchableOpacity onPress={handleDelete}>
              <Trash2 size={20} color="#EF4444" />
            </TouchableOpacity>
          ),
        }}
      />
      <ScrollView className="flex-1 bg-white" contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
        {/* Visibility toggle */}
        <Text className="text-sm font-medium text-slate-700 mb-2">Statut de visibilité de l'annonce</Text>
        <View className="flex-row items-center gap-3 mb-6">
          <TouchableOpacity
            onPress={() => setIsVisible(true)}
            className={`flex-row items-center px-4 py-2 rounded-xl border ${isVisible ? 'bg-kaza-vert/10 border-kaza-vert' : 'border-slate-200'}`}
          >
            <View className={`w-2 h-2 rounded-full mr-2 ${isVisible ? 'bg-kaza-mint' : 'bg-slate-300'}`} />
            <Text className={`text-sm font-medium ${isVisible ? 'text-kaza-vert' : 'text-slate-500'}`}>En ligne (Visible)</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setIsVisible(false)}
            className={`flex-row items-center px-4 py-2 rounded-xl border ${!isVisible ? 'bg-slate-100 border-slate-300' : 'border-slate-200'}`}
          >
            <View className={`w-2 h-2 rounded-full mr-2 ${!isVisible ? 'bg-slate-500' : 'bg-slate-300'}`} />
            <Text className={`text-sm font-medium ${!isVisible ? 'text-slate-700' : 'text-slate-500'}`}>En pause</Text>
          </TouchableOpacity>
        </View>

        {!isVisible && (
          <View className="bg-slate-50 rounded-xl p-3 mb-6 flex-row items-start">
            <Text className="text-xs text-slate-500 flex-1">
              Mettez en pause si vous avez trouvé un locataire pour ne plus recevoir d'appels.
            </Text>
          </View>
        )}

        {/* Title */}
        <Text className="text-sm font-medium text-slate-700 mb-1.5">Titre de l'annonce</Text>
        <View className="border border-slate-200 rounded-xl px-3 h-12 mb-4 justify-center">
          <TextInput
            className="text-sm text-slate-900"
            value={title}
            onChangeText={setTitle}
          />
        </View>

        {/* Description */}
        <Text className="text-sm font-medium text-slate-700 mb-1.5">Description</Text>
        <View className="border border-slate-200 rounded-xl px-3 py-2 mb-4 min-h-[80px]">
          <TextInput
            className="text-sm text-slate-900"
            value={description}
            onChangeText={setDescription}
            multiline
            textAlignVertical="top"
            placeholder="Décrivez votre bien..."
            placeholderTextColor="#94A3B8"
          />
        </View>

        {/* Price + Caution row */}
        <View className="flex-row gap-3 mb-4">
          <View className="flex-1">
            <Text className="text-sm font-medium text-slate-700 mb-1.5">Prix mensuel (FCFA)</Text>
            <View className="border border-slate-200 rounded-xl px-3 h-12 justify-center">
              <TextInput
                className="text-sm text-slate-900"
                keyboardType="numeric"
                value={price}
                onChangeText={setPrice}
              />
            </View>
          </View>
          <View className="flex-1">
            <Text className="text-sm font-medium text-slate-700 mb-1.5">Caution</Text>
            <TouchableOpacity
              onPress={cycleCaution}
              className="border border-slate-200 rounded-xl px-3 h-12 flex-row items-center justify-between"
            >
              <Text className="text-sm text-slate-900">{cautionMonths} mois</Text>
              <ChevronDown size={16} color="#94A3B8" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Photos */}
        <Text className="text-sm font-medium text-slate-700 mb-1.5">
          Photos de l'annonce <Text className="text-slate-400">{photos.length}/10</Text>
        </Text>
        <View className="flex-row flex-wrap gap-2 mb-6">
          {photos.map((uri, i) => (
            <View key={i} className="w-[30%] aspect-square rounded-xl overflow-hidden relative">
              <Image source={{ uri }} className="w-full h-full" contentFit="cover" />
              <TouchableOpacity
                onPress={() => removePhoto(i)}
                className="absolute top-1 right-1 w-6 h-6 bg-black/60 rounded-full items-center justify-center"
              >
                <X size={12} color="#FFF" />
              </TouchableOpacity>
            </View>
          ))}
          {photos.length < 10 && (
            <TouchableOpacity
              onPress={addPhotos}
              className="w-[30%] aspect-square border-2 border-dashed border-slate-200 rounded-xl items-center justify-center"
            >
              <Camera size={22} color="#94A3B8" />
              <Text className="text-[10px] text-slate-400 mt-1">Ajouter</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Bottom actions */}
      <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-slate-100 px-4 py-4 pb-8">
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          className="bg-kaza-vert h-12 rounded-xl items-center justify-center mb-2"
        >
          {saving ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text className="text-white font-semibold text-base">Enregistrer les modifications</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()} className="h-10 items-center justify-center">
          <Text className="text-sm text-slate-500">Annuler</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}
