import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Switch, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Lock,
  Shield,
  Globe,
  Bell,
  Palette,
  FileText,
  ChevronRight,
} from 'lucide-react-native';

const STORAGE_KEY_PUSH = 'kaza:settings:push';
const STORAGE_KEY_THEME = 'kaza:settings:theme';

export default function SettingsScreen() {
  const [pushEnabled, setPushEnabled] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    (async () => {
      const [pushStored, themeStored] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY_PUSH),
        AsyncStorage.getItem(STORAGE_KEY_THEME),
      ]);
      if (pushStored !== null) setPushEnabled(pushStored === 'true');
      if (themeStored === 'light' || themeStored === 'dark') setTheme(themeStored);
    })();
  }, []);

  const togglePush = async (v: boolean) => {
    setPushEnabled(v);
    await AsyncStorage.setItem(STORAGE_KEY_PUSH, String(v));
  };

  const cycleTheme = async () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    await AsyncStorage.setItem(STORAGE_KEY_THEME, next);
  };

  return (
    <ScrollView className="flex-1 bg-white" contentContainerStyle={{ padding: 20 }}>
      <Text className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
        Compte & Sécurité
      </Text>
      <View className="bg-white rounded-2xl border border-slate-100 mb-6">
        <SettingsRow icon={Lock} label="Changer de mot de passe" onPress={() => {}} />
        <SettingsRow icon={Shield} label="Sécurité du compte & OTP" onPress={() => {}} last />
      </View>

      <Text className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
        Préférences
      </Text>
      <View className="bg-white rounded-2xl border border-slate-100 mb-6">
        <SettingsRow icon={Globe} label="Langue" rightText="Français" onPress={() => {}} />
        <View className="flex-row items-center px-4 py-3.5 border-b border-slate-100">
          <Bell size={20} color="#64748B" />
          <Text className="flex-1 text-sm text-slate-700 ml-3">Notifications Push</Text>
          <Switch
            value={pushEnabled}
            onValueChange={togglePush}
            trackColor={{ false: '#E2E8F0', true: '#0E4728' }}
            thumbColor="#FFF"
          />
        </View>
        <SettingsRow
          icon={Palette}
          label="Thème d'affichage"
          rightText={theme === 'light' ? 'Clair' : 'Sombre'}
          onPress={cycleTheme}
          last
        />
      </View>

      <Text className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
        Légal & Compte
      </Text>
      <View className="bg-white rounded-2xl border border-slate-100 mb-6">
        <SettingsRow
          icon={FileText}
          label="Conditions Générales d'Utilisation"
          onPress={() => Linking.openURL('https://kaza.bj/cgu')}
        />
        <SettingsRow
          icon={Shield}
          label="Politique de confidentialité"
          onPress={() => Linking.openURL('https://kaza.bj/confidentialite')}
          last
        />
      </View>
    </ScrollView>
  );
}

function SettingsRow({
  icon: Icon,
  label,
  rightText,
  onPress,
  last,
}: {
  icon: any;
  label: string;
  rightText?: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className={`flex-row items-center px-4 py-3.5 ${last ? '' : 'border-b border-slate-100'}`}
    >
      <Icon size={20} color="#64748B" />
      <Text className="flex-1 text-sm text-slate-700 ml-3">{label}</Text>
      {rightText && <Text className="text-sm text-slate-400 mr-1">{rightText}</Text>}
      <ChevronRight size={18} color="#CBD5E1" />
    </TouchableOpacity>
  );
}
