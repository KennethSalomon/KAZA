import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, RefreshCw, Phone } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    if (!phone.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer votre numéro de téléphone.');
      return;
    }
    setLoading(true);
    try {
      const email = `${phone.replace(/\s/g, '')}@kaza.bj`;
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
      setSent(true);
    } catch (err: any) {
      Alert.alert('Erreur', err.message ?? 'Échec de l\'envoi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-white"
    >
      <View className="flex-1 px-6 pt-16">
        <TouchableOpacity onPress={() => router.back()} className="mb-8">
          <ArrowLeft size={24} color="#0E4728" />
        </TouchableOpacity>

        <View className="items-center mb-6">
          <View className="w-16 h-16 bg-kaza-vert/10 rounded-full items-center justify-center">
            <RefreshCw size={28} color="#0E4728" />
          </View>
        </View>

        <Text className="text-2xl font-bold text-slate-900 text-center mb-2">
          Mot de passe oublié ?
        </Text>
        <Text className="text-sm text-slate-500 text-center mb-8 px-4">
          Entrez votre numéro de téléphone. Nous vous enverrons un code de vérification SMS pour
          créer un nouveau mot de passe.
        </Text>

        {sent ? (
          <View className="items-center py-8">
            <View className="w-16 h-16 bg-kaza-mint/20 rounded-full items-center justify-center mb-4">
              <Text className="text-3xl">✓</Text>
            </View>
            <Text className="text-base font-semibold text-slate-900 mb-2">Code envoyé !</Text>
            <Text className="text-sm text-slate-500 text-center">
              Vérifiez vos SMS pour le code de réinitialisation.
            </Text>
          </View>
        ) : (
          <>
            <Text className="text-sm font-medium text-slate-700 mb-1.5">Numéro de téléphone</Text>
            <View className="flex-row items-center border border-slate-200 rounded-xl px-3 h-12 mb-6">
              <Phone size={18} color="#64748B" />
              <Text className="text-sm text-slate-500 ml-2 mr-1">+229</Text>
              <TextInput
                className="flex-1 text-sm text-slate-900 ml-1"
                placeholder="00 00 00 00"
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
              />
            </View>

            <TouchableOpacity
              onPress={handleSend}
              disabled={loading}
              className="bg-kaza-vert h-12 rounded-xl items-center justify-center"
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text className="text-white text-base font-semibold">Envoyer le code SMS</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
