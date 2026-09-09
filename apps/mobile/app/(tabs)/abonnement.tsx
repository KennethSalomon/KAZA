import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Check, Rocket, Crown } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const PLANS = [
  {
    name: 'Gratuit',
    price: '0',
    features: ['1 annonce'],
    current: false,
  },
  {
    name: 'Standard',
    price: '2 000',
    features: ['Jusqu\'à 5 annonces simultanées', 'Support prioritaire'],
    current: true,
    highlight: true,
  },
];

export default function AbonnementScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        {/* Header */}
        <View className="flex-row items-center justify-between mb-6">
          <Text className="text-xl font-bold text-slate-900">Mon Abonnement</Text>
        </View>

        {/* Current plan */}
        <View className="bg-white border border-slate-200 rounded-2xl p-4 mb-6">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-base font-bold text-slate-900">Plan Actuel : Standard</Text>
            </View>
            <View className="bg-kaza-mint/15 px-2.5 py-0.5 rounded-full">
              <Text className="text-xs font-semibold text-kaza-mint">Actif</Text>
            </View>
          </View>
          <View className="mt-3 gap-1.5">
            <View className="flex-row items-center">
              <Check size={14} color="#10B981" />
              <Text className="text-sm text-slate-600 ml-2">Jusqu'à 5 annonces simultanées</Text>
            </View>
            <View className="flex-row items-center">
              <Check size={14} color="#10B981" />
              <Text className="text-sm text-slate-600 ml-2">Support prioritaire</Text>
            </View>
          </View>
        </View>

        {/* Compare plans */}
        <Text className="text-base font-bold text-slate-900 mb-3">Comparer les offres</Text>
        <View className="flex-row gap-3 mb-6">
          {PLANS.map((plan) => (
            <View
              key={plan.name}
              className={`flex-1 rounded-2xl p-4 ${
                plan.highlight ? 'bg-kaza-vert' : 'bg-white border border-slate-200'
              }`}
            >
              <Text className={`text-lg font-bold ${plan.highlight ? 'text-white' : 'text-slate-900'}`}>
                {plan.name}
              </Text>
              <View className="flex-row items-baseline mt-1">
                <Text className={`text-2xl font-bold ${plan.highlight ? 'text-white' : 'text-slate-900'}`}>
                  {plan.price}
                </Text>
                <Text className={`text-xs ml-1 ${plan.highlight ? 'text-white/70' : 'text-slate-400'}`}>
                  FCFA
                </Text>
              </View>
              <View className="mt-3 gap-1.5">
                {plan.features.map((f, i) => (
                  <View key={i} className="flex-row items-center">
                    <Check size={12} color={plan.highlight ? '#FFF' : '#10B981'} />
                    <Text className={`text-xs ml-1.5 ${plan.highlight ? 'text-white/80' : 'text-slate-500'}`}>
                      {f}
                    </Text>
                  </View>
                ))}
              </View>
              <TouchableOpacity
                className={`mt-4 h-9 rounded-lg items-center justify-center ${
                  plan.highlight ? 'bg-white' : 'bg-slate-100'
                }`}
              >
                <Text className={`text-sm font-semibold ${plan.highlight ? 'text-kaza-vert' : 'text-slate-600'}`}>
                  {plan.current ? 'Plan actuel' : 'Choisir ce plan'}
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* Booster */}
        <View className="bg-kaza-amber/10 border border-kaza-amber/20 rounded-2xl p-5 items-center">
          <Rocket size={28} color="#F59E0B" />
          <Text className="text-base font-bold text-slate-900 mt-2">Booster votre annonce</Text>
          <Text className="text-sm text-slate-500 text-center mt-1">
            Booster votre annonce pour 500 FCFA / 7 jours
          </Text>
          <Text className="text-xs text-slate-400 text-center mt-0.5">
            (3x plus de visibilité en tête de liste)
          </Text>
          <TouchableOpacity className="bg-kaza-amber h-10 rounded-xl items-center justify-center px-6 mt-4 w-full">
            <Text className="text-white font-semibold text-sm">Mettre en avant une annonce</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
