import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Building2, CreditCard, FileText, ChevronRight, ChevronLeft } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';

const STEPS = [
  { icon: Building2, title: 'Identité', subtitle: 'Informations du bailleur' },
  { icon: CreditCard, title: 'Paiement', subtitle: 'Coordonnées de paiement' },
  { icon: FileText, title: 'Documents', subtitle: 'Pièces justificatives' },
] as const;

export default function OnboardingScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    business_name: '',
    ifu: '',
    address: '',
    momo_provider: 'mtn',
    momo_number: '',
    id_type: 'cni',
    id_number: '',
  });

  const update = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleFinish = async () => {
    if (!form.business_name.trim()) { Alert.alert('Erreur', 'Nom ou raison sociale requis'); return; }
    if (!form.momo_number.trim()) { Alert.alert('Erreur', 'Numéro Mobile Money requis'); return; }

    setLoading(true);
    try {
      const { error } = await supabase.rpc('complete_landlord_onboarding', {
        p_business_name: form.business_name.trim(),
        p_tax_id: form.ifu.trim() || null,
        p_momo_provider: form.momo_provider,
        p_momo_number: form.momo_number.replace(/\s/g, ''),
        p_bank_name: null,
        p_bank_iban: null,
      });
      if (error) { Alert.alert('Erreur', error.message); return; }
      router.replace('/(tabs)/dashboard');
    } catch {
      Alert.alert('Erreur', 'Impossible de compléter l\'onboarding');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-white">
      {/* Step indicator */}
      <View className="flex-row items-center px-6 pt-4 pb-2 gap-2">
        {STEPS.map((s, i) => (
          <View key={i} className="flex-1 items-center">
            <View
              className={`w-10 h-10 rounded-full items-center justify-center ${
                i <= step ? 'bg-kaza-vert' : 'bg-slate-200'
              }`}
            >
              <s.icon size={18} color={i <= step ? '#FFF' : '#94A3B8'} />
            </View>
            <Text className={`text-xs mt-1 ${i <= step ? 'text-kaza-vert font-semibold' : 'text-slate-400'}`}>
              {s.title}
            </Text>
          </View>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: 24 }} keyboardShouldPersistTaps="handled">
        {step === 0 && (
          <View>
            <Text className="text-lg font-bold text-slate-900 mb-4">
              Identité du bailleur
            </Text>
            <Field label="Nom ou raison sociale" value={form.business_name} onChange={(v) => update('business_name', v)} placeholder="Ex: SCI Immobilière du Golfe" />
            <Field label="Numéro IFU (optionnel)" value={form.ifu} onChange={(v) => update('ifu', v)} placeholder="Ex: 3201234567890" keyboardType="numeric" />
            <Field label="Adresse" value={form.address} onChange={(v) => update('address', v)} placeholder="Ex: Cotonou, Akpakpa" />
          </View>
        )}

        {step === 1 && (
          <View>
            <Text className="text-lg font-bold text-slate-900 mb-4">
              Coordonnées de paiement
            </Text>
            <Text className="text-sm font-medium text-slate-700 mb-1.5">Opérateur</Text>
            <View className="flex-row gap-2 mb-4">
              {['mtn', 'moov'].map((op) => (
                <TouchableOpacity
                  key={op}
                  onPress={() => update('momo_provider', op)}
                  className={`flex-1 h-12 rounded-xl items-center justify-center border ${
                    form.momo_provider === op ? 'bg-kaza-vert border-kaza-vert' : 'bg-white border-slate-200'
                  }`}
                >
                  <Text className={`font-semibold ${form.momo_provider === op ? 'text-white' : 'text-slate-600'}`}>
                    {op === 'mtn' ? 'MTN MoMo' : 'Moov Money'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Field label="Numéro Mobile Money" value={form.momo_number} onChange={(v) => update('momo_number', v)} placeholder="+229 01 23 45 67 89" keyboardType="phone-pad" />
          </View>
        )}

        {step === 2 && (
          <View>
            <Text className="text-lg font-bold text-slate-900 mb-4">
              Pièce d'identité
            </Text>
            <Text className="text-sm font-medium text-slate-700 mb-1.5">Type de pièce</Text>
            <View className="flex-row gap-2 mb-4">
              {[
                { key: 'cni', label: 'CNI' },
                { key: 'passport', label: 'Passeport' },
                { key: 'cip', label: 'CIP' },
              ].map((doc) => (
                <TouchableOpacity
                  key={doc.key}
                  onPress={() => update('id_type', doc.key)}
                  className={`flex-1 h-10 rounded-lg items-center justify-center border ${
                    form.id_type === doc.key ? 'bg-kaza-vert border-kaza-vert' : 'bg-white border-slate-200'
                  }`}
                >
                  <Text className={`text-sm font-medium ${form.id_type === doc.key ? 'text-white' : 'text-slate-600'}`}>
                    {doc.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Field label="Numéro de pièce (optionnel)" value={form.id_number} onChange={(v) => update('id_number', v)} placeholder="Ex: B12345678" />
          </View>
        )}
      </ScrollView>

      {/* Navigation */}
      <View className="flex-row items-center px-6 pb-6 pt-2 gap-3">
        {step > 0 && (
          <TouchableOpacity
            onPress={() => setStep(step - 1)}
            className="flex-row items-center justify-center h-12 px-6 rounded-xl border border-slate-200"
          >
            <ChevronLeft size={18} color="#475569" />
            <Text className="text-sm font-semibold text-slate-600 ml-1">Retour</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={step < 2 ? () => setStep(step + 1) : handleFinish}
          disabled={loading}
          className="flex-1 flex-row items-center justify-center bg-kaza-vert h-12 rounded-xl"
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Text className="text-white font-semibold text-base mr-1">
                {step < 2 ? 'Suivant' : 'Terminer'}
              </Text>
              {step < 2 && <ChevronRight size={18} color="#FFF" />}
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'numeric' | 'phone-pad' | 'email-address';
}) {
  return (
    <View className="mb-4">
      <Text className="text-sm font-medium text-slate-700 mb-1.5">{label}</Text>
      <TextInput
        className="bg-slate-50 border border-slate-200 rounded-xl px-3 h-12 text-sm text-slate-900"
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        value={value}
        onChangeText={onChange}
        keyboardType={keyboardType ?? 'default'}
      />
    </View>
  );
}
