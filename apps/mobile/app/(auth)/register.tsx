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
import { ArrowLeft, User, Phone, Lock, Eye, EyeOff } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import type { Role } from '@kaza/shared';

export default function RegisterScreen() {
  const router = useRouter();
  const [role, setRole] = useState<Role>('locataire');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!fullName.trim() || !phone.trim() || !password.trim()) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Erreur', 'Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    setLoading(true);
    try {
      const cleanPhone = phone.replace(/\s/g, '');
      const email = `${cleanPhone}@kaza.bj`;
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            phone: `+229${cleanPhone}`,
            role,
          },
        },
      });
      if (error) throw error;

      if (role === 'bailleur') {
        router.replace('/(auth)/onboarding');
      }
    } catch (err: any) {
      Alert.alert('Erreur', err.message ?? 'Inscription échouée.');
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
        contentContainerStyle={{ flexGrow: 1, padding: 24, paddingTop: 60 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Back */}
        <TouchableOpacity onPress={() => router.back()} className="mb-6">
          <ArrowLeft size={24} color="#0F172A" />
        </TouchableOpacity>

        <Text className="text-sm text-slate-500 mb-1">Créer un compte</Text>
        <Text className="text-2xl font-bold text-slate-900 italic mb-1">Rejoignez KAZA</Text>
        <Text className="text-sm text-slate-500 mb-6">
          Commencez votre expérience immobilière.
        </Text>

        {/* Role toggle */}
        <View className="flex-row bg-slate-100 rounded-xl p-1 mb-6">
          <TouchableOpacity
            onPress={() => setRole('locataire')}
            className={`flex-1 py-2.5 rounded-lg items-center ${role === 'locataire' ? 'bg-kaza-vert' : ''}`}
          >
            <Text className={`text-sm font-semibold ${role === 'locataire' ? 'text-white' : 'text-slate-600'}`}>
              Locataire
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setRole('bailleur')}
            className={`flex-1 py-2.5 rounded-lg items-center ${role === 'bailleur' ? 'bg-kaza-vert' : ''}`}
          >
            <Text className={`text-sm font-semibold ${role === 'bailleur' ? 'text-white' : 'text-slate-600'}`}>
              Propriétaire
            </Text>
          </TouchableOpacity>
        </View>

        {/* Name */}
        <Text className="text-sm font-medium text-slate-700 mb-1.5">Nom & Prénom</Text>
        <View className="flex-row items-center border border-slate-200 rounded-xl px-3 h-12 mb-4">
          <User size={18} color="#64748B" />
          <TextInput
            className="flex-1 text-sm text-slate-900 ml-2"
            placeholder="Jean Dupont"
            placeholderTextColor="#94A3B8"
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
          />
        </View>

        {/* Phone */}
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

        {/* Password */}
        <Text className="text-sm font-medium text-slate-700 mb-1.5">Mot de passe</Text>
        <View className="flex-row items-center border border-slate-200 rounded-xl px-3 h-12 mb-6">
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

        {/* Register button */}
        <TouchableOpacity
          onPress={handleRegister}
          disabled={loading}
          className="bg-kaza-vert h-12 rounded-xl items-center justify-center mb-4"
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text className="text-white text-base font-semibold">S'inscrire</Text>
          )}
        </TouchableOpacity>

        <View className="flex-row items-center justify-center mt-2 mb-8">
          <Text className="text-sm text-slate-500">Déjà un compte ? </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
            <Text className="text-sm font-semibold text-kaza-vert underline">Se connecter</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
