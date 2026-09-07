import { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { X, AlertTriangle } from 'lucide-react-native';

interface FedaPayWebViewProps {
  visible: boolean;
  paymentUrl: string;
  onClose: () => void;
  onSuccess: () => void;
  onError: (msg: string) => void;
}

export function FedaPayWebView({ visible, paymentUrl, onClose, onSuccess, onError }: FedaPayWebViewProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const handleNavigationChange = (event: { url: string }) => {
    const url = event.url.toLowerCase();
    if (url.includes('callback') && url.includes('status=approved')) {
      onSuccess();
    } else if (url.includes('callback') && url.includes('status=declined')) {
      onError('Paiement refusé');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView className="flex-1 bg-white">
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-slate-200">
          <Text className="text-base font-semibold text-slate-900">Paiement Mobile Money</Text>
          <TouchableOpacity onPress={onClose} className="w-8 h-8 items-center justify-center">
            <X size={20} color="#475569" />
          </TouchableOpacity>
        </View>

        {/* Loading */}
        {loading && (
          <View className="absolute inset-0 z-10 items-center justify-center bg-white/80" style={{ top: 50 }}>
            <ActivityIndicator size="large" color="#0E4728" />
            <Text className="text-sm text-slate-500 mt-3">Chargement du paiement...</Text>
          </View>
        )}

        {/* Error */}
        {error ? (
          <View className="flex-1 items-center justify-center px-6">
            <AlertTriangle size={48} color="#EF4444" />
            <Text className="text-lg font-semibold text-slate-900 mt-4">Erreur de chargement</Text>
            <Text className="text-sm text-slate-500 mt-2 text-center">
              Impossible de charger la page de paiement. Vérifiez votre connexion internet.
            </Text>
            <TouchableOpacity onPress={onClose} className="bg-kaza-vert px-6 py-3 rounded-xl mt-6">
              <Text className="text-white font-semibold">Fermer</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <WebView
            source={{ uri: paymentUrl }}
            onLoadEnd={() => setLoading(false)}
            onError={() => { setLoading(false); setError(true); }}
            onNavigationStateChange={handleNavigationChange}
            startInLoadingState
            javaScriptEnabled
            domStorageEnabled
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}
