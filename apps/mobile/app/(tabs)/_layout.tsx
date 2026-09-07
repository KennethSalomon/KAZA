import { Tabs, Redirect } from 'expo-router';
import {
  Home,
  Map,
  Heart,
  User,
  LayoutDashboard,
  PlusSquare,
  Crown,
} from 'lucide-react-native';
import { useAuth } from '@/lib/auth-context';
import { View, ActivityIndicator } from 'react-native';

export default function TabsLayout() {
  const { loading, user, role } = useAuth();

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#0E4728" />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  const isBailleur = role === 'bailleur';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#0E4728',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#F3F4F6',
          borderTopWidth: 1,
          height: 85,
          paddingBottom: 28,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        headerShown: false,
      }}
    >
      {/* Locataire tabs */}
      <Tabs.Screen
        name="accueil"
        options={{
          title: 'Accueil',
          href: isBailleur ? null : '/(tabs)/accueil',
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="carte"
        options={{
          title: 'Carte',
          href: isBailleur ? null : '/(tabs)/carte',
          tabBarIcon: ({ color, size }) => <Map size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="favoris"
        options={{
          title: 'Favoris',
          href: isBailleur ? null : '/(tabs)/favoris',
          tabBarIcon: ({ color, size }) => <Heart size={size} color={color} fill={color === '#0E4728' ? '#0E4728' : 'none'} />,
        }}
      />

      {/* Propriétaire tabs */}
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          href: isBailleur ? '/(tabs)/dashboard' : null,
          tabBarIcon: ({ color, size }) => <LayoutDashboard size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="publier"
        options={{
          title: 'Publier',
          href: isBailleur ? '/(tabs)/publier' : null,
          tabBarIcon: ({ color, size }) => <PlusSquare size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="abonnement"
        options={{
          title: 'Abonnement',
          href: isBailleur ? '/(tabs)/abonnement' : null,
          tabBarIcon: ({ color, size }) => <Crown size={size} color={color} />,
        }}
      />

      {/* Shared */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
        }}
      />

      {/* Hidden tabs (still routable, just not in tab bar) */}
      <Tabs.Screen name="explorer" options={{ href: null }} />
      <Tabs.Screen name="chat" options={{ href: null, headerShown: false }} />
    </Tabs>
  );
}
