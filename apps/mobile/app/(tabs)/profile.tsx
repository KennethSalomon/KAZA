import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Settings,
  History,
  Bookmark,
  HelpCircle,
  LogOut,
  ChevronRight,
  CheckCircle,
  CreditCard,
  Bell,
  Lock,
  Pencil,
  MapPin,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth-context';

export default function ProfileScreen() {
  const { user, role, isPremium, signOut } = useAuth();
  const router = useRouter();

  const handleSignOut = () => {
    Alert.alert('Déconnexion', 'Voulez-vous vraiment vous déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Déconnexion', style: 'destructive', onPress: signOut },
    ]);
  };

  if (!user) return null;

  const initials = (user.full_name ?? 'U').charAt(0).toUpperCase();
  const isBailleur = role === 'bailleur';

  if (isBailleur) {
    return (
      <SafeAreaView className="flex-1 bg-white" edges={['top']}>
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 20 }}>
          <View className="flex-row items-center mb-6">
            <View className="w-8 h-8 bg-kaza-vert rounded-lg items-center justify-center mr-2">
              <Text className="text-white text-sm font-bold">K</Text>
            </View>
            <Text className="text-lg font-bold text-kaza-vert">KAZA</Text>
          </View>

          <View className="items-center mb-6">
            <View className="w-20 h-20 bg-slate-200 rounded-full items-center justify-center mb-3">
              <Text className="text-2xl font-bold text-slate-500">{initials}</Text>
            </View>
            <Text className="text-xl font-bold text-slate-900">{user.full_name}</Text>
            {user.is_verified_landlord && (
              <View className="flex-row items-center mt-1">
                <CheckCircle size={14} color="#10B981" />
                <Text className="text-xs text-kaza-mint font-medium ml-1">Propriétaire Vérifié</Text>
              </View>
            )}
            <View className="flex-row items-center mt-0.5">
              <MapPin size={12} color="#94A3B8" />
              <Text className="text-xs text-slate-500 ml-1">Cotonou, Bénin</Text>
            </View>
            <TouchableOpacity className="mt-2">
              <View className="flex-row items-center">
                <Pencil size={12} color="#0E4728" />
                <Text className="text-xs text-kaza-vert font-medium ml-1">Modifier le profil</Text>
              </View>
            </TouchableOpacity>
          </View>

          <Text className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
            Informations personnelles
          </Text>
          <View className="bg-slate-50 rounded-2xl p-4 mb-6">
            <InfoRow label="Nom complet" value={user.full_name ?? '-'} />
            <InfoRow label="Téléphone principal" value={user.phone ?? '-'} />
            <InfoRow label="Adresse Email" value={user.email ?? '-'} />
            <InfoRow label="WhatsApp enregistré" value={user.phone ?? '-'} editable />
            <View className="flex-row items-center justify-between pt-3">
              <Text className="text-sm text-slate-600">Statut du compte</Text>
              <View className="flex-row items-center">
                <CheckCircle size={14} color="#10B981" />
                <Text className="text-sm font-medium text-kaza-mint ml-1">Vérifié</Text>
              </View>
            </View>
          </View>

          <Text className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
            Paramètres & Gestion
          </Text>
          <View className="bg-white rounded-2xl border border-slate-100 mb-6">
            <MenuItem icon={CreditCard} label="Gestion des abonnements & paiements" onPress={() => router.push('/(tabs)/abonnement')} />
            <MenuItem icon={Bell} label="Notifications de vues et messages" onPress={() => router.push('/notifications')} />
            <MenuItem icon={Lock} label="Changer de mot de passe" onPress={() => router.push('/settings')} />
            <MenuItem icon={HelpCircle} label="Aide & Support Propriétaire" onPress={() => router.push('/help')} last />
          </View>

          <TouchableOpacity onPress={handleSignOut} className="py-3">
            <Text className="text-base font-semibold text-kaza-red">Déconnexion</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 20 }}>
        <View className="flex-row items-center justify-between mb-6">
          <Text className="text-2xl font-bold text-slate-900">Profil</Text>
          <TouchableOpacity onPress={() => router.push('/settings')}>
            <Settings size={22} color="#64748B" />
          </TouchableOpacity>
        </View>

        <View className="flex-row items-center mb-4">
          <View className="w-16 h-16 bg-slate-200 rounded-full items-center justify-center">
            <Text className="text-xl font-bold text-slate-500">{initials}</Text>
          </View>
          <View className="ml-4 flex-1">
            <Text className="text-lg font-bold text-slate-900">{user.full_name}</Text>
            <Text className="text-sm text-slate-500">{user.phone ?? ''}</Text>
            <View className="self-start bg-kaza-vert/15 px-2.5 py-0.5 rounded-full mt-1">
              <Text className="text-xs font-semibold text-kaza-vert">Locataire</Text>
            </View>
          </View>
        </View>

        <View className="bg-kaza-vert/5 border border-kaza-vert/15 rounded-2xl p-4 flex-row items-center justify-between mb-6">
          <View className="flex-row items-center flex-1">
            <CheckCircle size={20} color="#0E4728" />
            <View className="ml-3">
              <Text className="text-sm font-bold text-slate-900">
                Pass Locataire : {isPremium ? 'Actif' : 'Inactif'}
              </Text>
              {isPremium && (
                <Text className="text-xs text-slate-500">Expire dans 18 jours</Text>
              )}
            </View>
          </View>
          <TouchableOpacity>
            <Text className="text-sm font-semibold text-kaza-vert">Renouveler</Text>
          </TouchableOpacity>
        </View>

        <View className="bg-white rounded-2xl border border-slate-100">
          <MenuItem icon={History} label="Historique des numéros débloqués" onPress={() => {}} />
          <MenuItem icon={Bookmark} label="Mes recherches sauvegardées" onPress={() => router.push('/alerts')} />
          <MenuItem icon={Settings} label="Paramètres du compte" onPress={() => router.push('/settings')} />
          <MenuItem icon={HelpCircle} label="Centre d'aide / FAQ" onPress={() => router.push('/help')} last />
        </View>

        <TouchableOpacity onPress={handleSignOut} className="mt-6 py-3">
          <Text className="text-base font-semibold text-kaza-red">Déconnexion</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ label, value, editable }: { label: string; value: string; editable?: boolean }) {
  return (
    <View className="flex-row items-center justify-between py-3 border-b border-slate-100">
      <Text className="text-sm text-slate-500">{label}</Text>
      <View className="flex-row items-center">
        <Text className="text-sm font-medium text-slate-900">{value}</Text>
        {editable && <Pencil size={12} color="#0E4728" style={{ marginLeft: 6 }} />}
      </View>
    </View>
  );
}

function MenuItem({ icon: Icon, label, onPress, last }: { icon: any; label: string; onPress: () => void; last?: boolean }) {
  return (
    <TouchableOpacity onPress={onPress} className={`flex-row items-center px-4 py-3.5 ${last ? '' : 'border-b border-slate-100'}`}>
      <Icon size={20} color="#64748B" />
      <Text className="flex-1 text-sm text-slate-700 ml-3">{label}</Text>
      <ChevronRight size={18} color="#CBD5E1" />
    </TouchableOpacity>
  );
}
