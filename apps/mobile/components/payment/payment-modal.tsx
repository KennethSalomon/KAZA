import { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { X, Smartphone, Banknote, ChevronRight } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { formatFCFA } from '@kaza/shared';
import { FedaPayWebView } from './fedapay-webview';
import type { Lease } from '@kaza/shared';

interface PaymentModalProps {
  visible: boolean;
  lease: Lease | null;
  onClose: () => void;
  onSuccess: () => void;
}

type PaymentMethod = 'mobile_money' | 'cash';

const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

export function PaymentModal({ visible, lease, onClose, onSuccess }: PaymentModalProps) {
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [loading, setLoading] = useState(false);
  const [fedapayUrl, setFedapayUrl] = useState<string | null>(null);

  if (!lease) return null;

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();

  const handlePay = async () => {
    if (!method) { Alert.alert('Erreur', 'Choisissez un mode de paiement'); return; }

    setLoading(true);
    try {
      if (method === 'mobile_money') {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Non authentifié');

        const { data, error } = await supabase.functions.invoke('fedapay-init', {
          body: {
            lease_id: lease.id,
            month_label: selectedMonth,
            amount: lease.monthly_rent,
          },
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (error) throw error;
        if (data?.payment_url) {
          setFedapayUrl(data.payment_url);
        }
      } else {
        const { error } = await supabase.from('payments').insert({
          lease_id: lease.id,
          amount: lease.monthly_rent,
          month_label: selectedMonth,
          method: 'cash',
          provider: 'cash',
          status: 'pending',
        });
        if (error) throw error;
        Alert.alert('Paiement déclaré', 'Le bailleur doit confirmer la réception.', [
          { text: 'OK', onPress: () => { onSuccess(); onClose(); } },
        ]);
      }
    } catch (err: any) {
      Alert.alert('Erreur', err.message ?? 'Paiement échoué');
    } finally {
      setLoading(false);
    }
  };

  const handleFedapaySuccess = () => {
    setFedapayUrl(null);
    Alert.alert('Paiement réussi', 'Votre paiement a été confirmé.', [
      { text: 'OK', onPress: () => { onSuccess(); onClose(); } },
    ]);
  };

  return (
    <>
      <Modal visible={visible && !fedapayUrl} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView className="flex-1 bg-white">
          <View className="flex-row items-center justify-between px-4 py-3 border-b border-slate-200">
            <Text className="text-lg font-bold text-slate-900">
              Payer le loyer
            </Text>
            <TouchableOpacity onPress={onClose}>
              <X size={20} color="#475569" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16 }}>
            {/* Amount */}
            <View className="bg-kaza-vert/5 rounded-xl p-4 mb-6 items-center">
              <Text className="text-sm text-slate-500">Montant du loyer</Text>
              <Text className="text-3xl font-bold text-kaza-vert mt-1">
                {formatFCFA(lease.monthly_rent)}
              </Text>
            </View>

            {/* Month selector */}
            <Text className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Mois concerné
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-6">
              <View className="flex-row gap-2">
                {MONTHS.map((name, i) => {
                  const val = `${currentYear}-${String(i + 1).padStart(2, '0')}`;
                  const isSelected = selectedMonth === val;
                  const isPast = i < currentMonth;
                  return (
                    <TouchableOpacity
                      key={val}
                      onPress={() => setSelectedMonth(val)}
                      className={`px-4 py-2 rounded-full border ${
                        isSelected ? 'bg-kaza-vert border-kaza-vert' :
                        isPast ? 'bg-slate-50 border-slate-100' : 'bg-white border-slate-200'
                      }`}
                    >
                      <Text className={`text-xs font-medium ${
                        isSelected ? 'text-white' : isPast ? 'text-slate-400' : 'text-slate-600'
                      }`}>
                        {name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            {/* Payment method */}
            <Text className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Mode de paiement
            </Text>
            <TouchableOpacity
              onPress={() => setMethod('mobile_money')}
              className={`flex-row items-center p-4 rounded-xl border mb-3 ${
                method === 'mobile_money' ? 'border-kaza-vert bg-kaza-vert/5' : 'border-slate-200'
              }`}
            >
              <View className="w-10 h-10 bg-kaza-amber/10 rounded-full items-center justify-center">
                <Smartphone size={20} color="#F59E0B" />
              </View>
              <View className="flex-1 ml-3">
                <Text className="text-sm font-semibold text-slate-900">Mobile Money</Text>
                <Text className="text-xs text-slate-500">MTN MoMo ou Moov Money via FedaPay</Text>
              </View>
              <ChevronRight size={16} color="#94A3B8" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setMethod('cash')}
              className={`flex-row items-center p-4 rounded-xl border mb-6 ${
                method === 'cash' ? 'border-kaza-vert bg-kaza-vert/5' : 'border-slate-200'
              }`}
            >
              <View className="w-10 h-10 bg-kaza-mint/10 rounded-full items-center justify-center">
                <Banknote size={20} color="#10B981" />
              </View>
              <View className="flex-1 ml-3">
                <Text className="text-sm font-semibold text-slate-900">Espèces</Text>
                <Text className="text-xs text-slate-500">Déclarer un paiement en main propre</Text>
              </View>
              <ChevronRight size={16} color="#94A3B8" />
            </TouchableOpacity>
          </ScrollView>

          {/* CTA */}
          <View className="px-4 pb-6">
            <TouchableOpacity
              onPress={handlePay}
              disabled={loading || !method}
              className={`h-12 rounded-xl items-center justify-center ${
                method ? 'bg-kaza-vert' : 'bg-slate-300'
              }`}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text className="text-white font-semibold text-base">
                  {method === 'cash' ? 'Déclarer le paiement' : 'Payer maintenant'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {fedapayUrl && (
        <FedaPayWebView
          visible
          paymentUrl={fedapayUrl}
          onClose={() => setFedapayUrl(null)}
          onSuccess={handleFedapaySuccess}
          onError={(msg) => { setFedapayUrl(null); Alert.alert('Erreur', msg); }}
        />
      )}
    </>
  );
}
