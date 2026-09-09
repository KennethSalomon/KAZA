import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  FlatList,
} from 'react-native';
import { Stack } from 'expo-router';
import {
  Users,
  Home,
  CreditCard,
  Shield,
  Check,
  X,
  Crown,
  Eye,
  Ban,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { formatFCFA } from '@kaza/shared';

interface AdminStats {
  total_users: number;
  total_residences: number;
  total_leases: number;
  total_payments_amount: number;
  pending_verifications: number;
}

export default function AdminScreen() {
  const { role } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [pendingResidences, setPendingResidences] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [tab, setTab] = useState<'overview' | 'residences' | 'users'>('overview');

  const load = useCallback(async () => {
    try {
      const [statsRes, resRes, usersRes] = await Promise.all([
        supabase.rpc('admin_stats'),
        supabase.from('residences').select('id, title, city, status, owner_id, is_published, is_verified, created_at').eq('is_published', true).eq('is_verified', false).order('created_at', { ascending: false }).limit(20),
        supabase.from('profiles').select('id, full_name, email, phone, role, is_premium, is_verified, created_at').order('created_at', { ascending: false }).limit(50),
      ]);
      if (statsRes.data) setStats(statsRes.data as unknown as AdminStats);
      if (resRes.data) setPendingResidences(resRes.data);
      if (usersRes.data) setUsers(usersRes.data);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const handleVerifyResidence = async (residenceId: string) => {
    try {
      const { error } = await supabase.rpc('admin_verify_residence', { p_residence_id: residenceId });
      if (error) throw error;
      load();
    } catch (err: any) {
      Alert.alert('Erreur', err.message);
    }
  };

  const handleUnpublishResidence = async (residenceId: string) => {
    try {
      const { error } = await supabase.rpc('admin_unpublish_residence', { p_residence_id: residenceId });
      if (error) throw error;
      load();
    } catch (err: any) {
      Alert.alert('Erreur', err.message);
    }
  };

  const handleTogglePremium = async (userId: string) => {
    try {
      const { error } = await supabase.rpc('admin_set_premium', { p_user_id: userId, p_is_premium: true });
      if (error) throw error;
      load();
    } catch (err: any) {
      Alert.alert('Erreur', err.message);
    }
  };

  const handleVerifyLandlord = async (userId: string) => {
    try {
      const { error } = await supabase.rpc('admin_set_landlord_verified', { p_user_id: userId, p_verified: true });
      if (error) throw error;
      load();
    } catch (err: any) {
      Alert.alert('Erreur', err.message);
    }
  };

  if (role !== 'admin') {
    return (
      <View className="flex-1 bg-white items-center justify-center px-6">
        <Shield size={48} color="#EF4444" />
        <Text className="text-lg font-bold text-slate-900 mt-4">Accès refusé</Text>
        <Text className="text-sm text-slate-500 mt-2 text-center">
          Cette section est réservée aux administrateurs.
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View className="flex-1 bg-slate-50 items-center justify-center">
        <ActivityIndicator size="large" color="#0E4728" />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Administration' }} />
      <ScrollView
        className="flex-1 bg-slate-50"
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0E4728" />}
      >
        {/* Tab selector */}
        <View className="flex-row bg-white rounded-xl p-1 mb-4 border border-slate-200">
          {(['overview', 'residences', 'users'] as const).map((t) => (
            <TouchableOpacity
              key={t}
              onPress={() => setTab(t)}
              className={`flex-1 py-2 rounded-lg items-center ${tab === t ? 'bg-kaza-vert' : ''}`}
            >
              <Text className={`text-xs font-semibold ${tab === t ? 'text-white' : 'text-slate-500'}`}>
                {t === 'overview' ? 'Aperçu' : t === 'residences' ? 'Résidences' : 'Utilisateurs'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {tab === 'overview' && stats && (
          <>
            <View className="flex-row gap-3 mb-3">
              <KpiCard icon={Users} label="Utilisateurs" value={String(stats.total_users)} color="#0E4728" />
              <KpiCard icon={Home} label="Résidences" value={String(stats.total_residences)} color="#3B82F6" />
            </View>
            <View className="flex-row gap-3 mb-3">
              <KpiCard icon={CreditCard} label="Volume paiements" value={formatFCFA(stats.total_payments_amount)} color="#10B981" />
              <KpiCard icon={Eye} label="En attente" value={String(stats.pending_verifications)} color="#F59E0B" />
            </View>
          </>
        )}

        {tab === 'residences' && (
          <>
            <Text className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">
              En attente de vérification ({pendingResidences.length})
            </Text>
            {pendingResidences.length === 0 ? (
              <EmptyCard text="Aucune résidence en attente" />
            ) : (
              pendingResidences.map((r) => (
                <View key={r.id} className="bg-white rounded-xl p-4 mb-3 border border-slate-100">
                  <Text className="text-sm font-semibold text-slate-900">{r.title}</Text>
                  <Text className="text-xs text-slate-500 mt-0.5">{r.city ?? 'N/A'}</Text>
                  <View className="flex-row gap-2 mt-3">
                    <TouchableOpacity
                      onPress={() => handleVerifyResidence(r.id)}
                      className="flex-1 flex-row items-center justify-center bg-kaza-mint/10 py-2 rounded-lg gap-1"
                    >
                      <Check size={14} color="#10B981" />
                      <Text className="text-xs font-semibold text-kaza-mint">Approuver</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleUnpublishResidence(r.id)}
                      className="flex-1 flex-row items-center justify-center bg-kaza-red/10 py-2 rounded-lg gap-1"
                    >
                      <Ban size={14} color="#EF4444" />
                      <Text className="text-xs font-semibold text-kaza-red">Refuser</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </>
        )}

        {tab === 'users' && (
          <>
            <Text className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Utilisateurs ({users.length})
            </Text>
            {users.map((u) => (
              <View key={u.id} className="bg-white rounded-xl p-4 mb-3 border border-slate-100">
                <View className="flex-row items-center justify-between">
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-slate-900">{u.full_name ?? 'Sans nom'}</Text>
                    <Text className="text-xs text-slate-500">{u.email}</Text>
                  </View>
                  <View className="flex-row items-center gap-1">
                    <View className={`px-2 py-0.5 rounded-full ${
                      u.role === 'admin' ? 'bg-purple-100' :
                      u.role === 'bailleur' ? 'bg-blue-50' : 'bg-slate-100'
                    }`}>
                      <Text className={`text-[10px] font-semibold ${
                        u.role === 'admin' ? 'text-purple-700' :
                        u.role === 'bailleur' ? 'text-blue-600' : 'text-slate-500'
                      }`}>
                        {u.role}
                      </Text>
                    </View>
                    {u.is_premium && (
                      <Crown size={12} color="#F59E0B" />
                    )}
                  </View>
                </View>
                <View className="flex-row gap-2 mt-3">
                  {u.role === 'bailleur' && (
                    <TouchableOpacity
                      onPress={() => handleVerifyLandlord(u.id)}
                      className="flex-row items-center bg-kaza-vert/10 px-3 py-1.5 rounded-lg gap-1"
                    >
                      <Shield size={12} color="#0E4728" />
                      <Text className="text-[10px] font-semibold text-kaza-vert">
                        {u.is_verified ? 'Vérifié' : 'Vérifier'}
                      </Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={() => handleTogglePremium(u.id)}
                    className="flex-row items-center bg-kaza-amber/10 px-3 py-1.5 rounded-lg gap-1"
                  >
                    <Crown size={12} color="#F59E0B" />
                    <Text className="text-[10px] font-semibold text-kaza-amber">
                      {u.is_premium ? 'Retirer Premium' : 'Passer Premium'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </>
  );
}

function KpiCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  return (
    <View className="flex-1 bg-white rounded-xl p-4 border border-slate-100">
      <Icon size={18} color={color} />
      <Text className="text-xl font-bold text-slate-900 mt-2" numberOfLines={1}>{value}</Text>
      <Text className="text-xs text-slate-500 mt-0.5">{label}</Text>
    </View>
  );
}

function EmptyCard({ text }: { text: string }) {
  return (
    <View className="bg-white rounded-xl p-6 items-center border border-slate-100">
      <Text className="text-sm text-slate-400">{text}</Text>
    </View>
  );
}
