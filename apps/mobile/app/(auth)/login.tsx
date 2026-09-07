import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Phone, Lock, Eye, EyeOff } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';

export default function LoginScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!phone.trim() || !password.trim()) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs.');
      return;
    }
    setLoading(true);
    try {
      const email = `${phone.replace(/\s/g, '')}@kaza.bj`;
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (err: any) {
      Alert.alert('Erreur', err.message ?? 'Identifiants incorrects.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-white"
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo */}
        <View className="items-center mb-8">
          <View className="w-14 h-14 bg-kaza-vert rounded-2xl items-center justify-center mb-4">
            <Text className="text-white text-xl font-bold">K</Text>
          </View>
          <Text className="text-2xl font-bold text-slate-900">Bon retour sur KAZA !</Text>
          <Text className="text-sm text-slate-500 mt-1 text-center">
            Connectez-vous pour accéder à vos annonces et contacts.
          </Text>
        </View>

        {/* Phone input */}
        <Text className="text-sm font-medium text-slate-700 mb-1.5">Numéro de téléphone</Text>
        <View className="flex-row items-center border border-slate-200 rounded-xl px-3 h-12 mb-4">
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

        {/* Password input */}
        <Text className="text-sm font-medium text-slate-700 mb-1.5">Mot de passe</Text>
        <View className="flex-row items-center border border-slate-200 rounded-xl px-3 h-12 mb-2">
          <Lock size={18} color="#64748B" />
          <TextInput
            className="flex-1 text-sm text-slate-900 ml-2"
            placeholder="••••••••"
            placeholderTextColor="#94A3B8"
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            {showPassword ? <Eye size={18} color="#64748B" /> : <EyeOff size={18} color="#64748B" />}
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={() => router.push('/(auth)/forgot-password')}
          className="self-end mb-6"
        >
          <Text className="text-sm text-slate-500">Mot de passe oublié ?</Text>
        </TouchableOpacity>

        {/* Login button */}
        <TouchableOpacity
          onPress={handleLogin}
          disabled={loading}
          className="bg-kaza-vert h-12 rounded-xl items-center justify-center mb-3"
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text className="text-white text-base font-semibold">Se connecter</Text>
          )}
        </TouchableOpacity>

        {/* OTP login */}
        <TouchableOpacity
          onPress={() => router.push('/(auth)/verify-otp')}
          className="border border-slate-200 h-12 rounded-xl items-center justify-center flex-row"
          activeOpacity={0.7}
        >
          <Phone size={16} color="#0E4728" />
          <Text className="text-kaza-vert text-sm font-semibold ml-2">
            Connexion rapide par SMS
          </Text>
        </TouchableOpacity>

        {/* Sign up link */}
        <View className="flex-row items-center justify-center mt-8">
          <Text className="text-sm text-slate-500">Pas encore de compte ? </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
            <Text className="text-sm font-semibold text-kaza-vert underline">S'inscrire</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
