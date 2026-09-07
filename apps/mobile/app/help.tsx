import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Linking,
} from 'react-native';
import { Search, MessageCircle, ChevronDown, ChevronUp } from 'lucide-react-native';

const FAQ_ITEMS = [
  {
    question: 'Pourquoi payer un Pass Locataire de 1 000 FCFA ?',
    answer:
      'Le Pass vous permet d\'accéder aux numéros directs des propriétaires de manière illimitée pendant 30 jours. Vous économisez jusqu\'à 1 mois de loyer entier en évitant les commissions de démarcheur.',
  },
  {
    question: 'Comment s\'effectue le paiement par MTN MoMo ?',
    answer:
      'Lors du paiement, vous serez redirigé vers la plateforme sécurisée FedaPay. Sélectionnez MTN MoMo, entrez votre numéro et validez la transaction. Le paiement est instantané.',
  },
  {
    question: 'Comment publier une annonce gratuitement ?',
    answer:
      'Avec le plan Gratuit, vous pouvez publier 1 annonce. Créez un compte Propriétaire, allez dans "Publier", ajoutez vos photos et informations. L\'annonce sera visible après vérification.',
  },
  {
    question: 'Comment signaler un litige ou une fausse annonce ?',
    answer:
      'Contactez-nous directement sur WhatsApp via le bouton ci-dessus, ou envoyez un email à support@kaza.bj. Nous traiterons votre signalement sous 24h.',
  },
];

export default function HelpScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);

  const filteredFaq = FAQ_ITEMS.filter(
    (item) =>
      item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const toggleExpand = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  return (
    <ScrollView className="flex-1 bg-white" contentContainerStyle={{ padding: 20 }}>
      {/* Search */}
      <View className="flex-row items-center bg-slate-100 rounded-xl px-3 h-11 mb-6">
        <Search size={18} color="#94A3B8" />
        <TextInput
          className="flex-1 ml-2 text-sm text-slate-900"
          placeholder="Rechercher une question (ex: Pass...)"
          placeholderTextColor="#94A3B8"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* WhatsApp CTA */}
      <View className="bg-kaza-vert rounded-2xl p-5 items-center mb-6">
        <MessageCircle size={28} color="#FFF" />
        <Text className="text-sm text-white/90 text-center mt-2 mb-3">
          Une question urgente ? Contactez l'équipe KAZA sur WhatsApp
        </Text>
        <TouchableOpacity
          onPress={() => Linking.openURL('https://wa.me/22997000000?text=Bonjour%20KAZA')}
          className="bg-kaza-mint h-11 rounded-xl items-center justify-center px-6 w-full"
          activeOpacity={0.8}
        >
          <Text className="text-white font-semibold text-sm">Nous contacter sur WhatsApp</Text>
        </TouchableOpacity>
      </View>

      {/* FAQ */}
      <Text className="text-lg font-bold text-slate-900 mb-4">Foire aux questions</Text>

      {filteredFaq.map((item, index) => {
        const isExpanded = expandedIndex === index;
        return (
          <View key={index} className="border border-slate-100 rounded-xl mb-2 overflow-hidden">
            <TouchableOpacity
              onPress={() => toggleExpand(index)}
              className="flex-row items-center justify-between p-4"
            >
              <Text className="flex-1 text-sm font-medium text-slate-800 mr-3">
                {item.question}
              </Text>
              {isExpanded ? (
                <ChevronUp size={18} color="#64748B" />
              ) : (
                <ChevronDown size={18} color="#64748B" />
              )}
            </TouchableOpacity>
            {isExpanded && (
              <View className="px-4 pb-4 -mt-1">
                <Text className="text-sm text-slate-600 leading-5">{item.answer}</Text>
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}
