import { useState, useRef } from 'react';
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
import { Phone } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { isValidBeninPhone } from '@kaza/shared';

type Step = 'phone' | 'code';

export default function VerifyOtpScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('+229 ');
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const inputs = useRef<(TextInput | null)[]>([]);

  const handleSendOtp = async () => {
    const cleaned = phone.replace(/\s/g, '');
    if (!isValidBeninPhone(cleaned)) {
      Alert.alert('Erreur', 'Numéro béninois invalide');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone: cleaned });
      if (error) { Alert.alert('Erreur', error.message); return; }
      setStep('code');
    } catch {
      Alert.alert('Erreur', 'Impossible d\'envoyer le SMS');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    const pin = code.join('');
    if (pin.length !== 6) { Alert.alert('Erreur', 'Entrez le code à 6 chiffres'); return; }

    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        phone: phone.replace(/\s/g, ''),
        token: pin,
        type: 'sms',
      });
      if (error) { Alert.alert('Code invalide', error.message); return; }
      router.replace('/');
    } catch {
      Alert.alert('Erreur', 'Vérification échouée');
    } finally {
      setLoading(false);
    }
  };

  const handleCodeChange = (text: string, index: number) => {
    const next = [...code];
    next[index] = text;
    setCode(next);
    if (text && index < 5) inputs.current[index + 1]?.focus();
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !code[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-white justify-center px-6"
    >
      {step === 'phone' ? (
        <View>
          <Text className="text-2xl font-bold text-slate-900 mb-2">
            Connexion par SMS
          </Text>
          <Text className="text-sm text-slate-500 mb-6">
            Entrez votre numéro béninois pour recevoir un code de vérification.
          </Text>
          <View className="flex-row items-center bg-slate-50 border border-slate-200 rounded-xl px-3 h-12 mb-6">
            <Phone size={18} color="#64748B" />
            <TextInput
              className="flex-1 ml-2 text-sm text-slate-900"
              placeholder="+229 01 23 45 67 89"
              placeholderTextColor="#94A3B8"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
          </View>
          <TouchableOpacity
            onPress={handleSendOtp}
            disabled={loading}
            className="bg-kaza-vert h-12 rounded-xl items-center justify-center"
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text className="text-white font-semibold text-base">Envoyer le code</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <View>
          <Text className="text-2xl font-bold text-slate-900 mb-2">
            Vérification
          </Text>
          <Text className="text-sm text-slate-500 mb-6">
            Entrez le code à 6 chiffres envoyé au {phone}
          </Text>
          <View className="flex-row justify-between mb-6 gap-2">
            {code.map((digit, i) => (
              <TextInput
                key={i}
                ref={(ref) => { inputs.current[i] = ref; }}
                className="flex-1 h-14 bg-slate-50 border border-slate-200 rounded-xl text-center text-xl font-bold text-slate-900"
                maxLength={1}
                keyboardType="number-pad"
                value={digit}
                onChangeText={(text) => handleCodeChange(text, i)}
                onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, i)}
              />
            ))}
          </View>
          <TouchableOpacity
            onPress={handleVerify}
            disabled={loading}
            className="bg-kaza-vert h-12 rounded-xl items-center justify-center"
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text className="text-white font-semibold text-base">Vérifier</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSendOtp} className="mt-4 items-center">
            <Text className="text-sm text-kaza-vert">Renvoyer le code</Text>
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
