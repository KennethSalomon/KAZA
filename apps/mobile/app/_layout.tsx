import '../global.css';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider } from '@/lib/auth-context';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="residence/[id]"
          options={{ headerShown: false }}
        />
        <Stack.Screen name="favorites" options={{ headerShown: false }} />
        <Stack.Screen name="landlord" options={{ headerShown: false }} />
        <Stack.Screen
          name="notifications"
          options={{
            headerShown: true,
            title: 'Notifications',
            headerBackTitle: 'Retour',
            headerStyle: { backgroundColor: '#FFF' },
            headerTintColor: '#0E4728',
            headerShadowVisible: false,
            headerTitleStyle: { fontWeight: '700', fontSize: 20, color: '#0F172A' },
          }}
        />
        <Stack.Screen
          name="alerts"
          options={{
            headerShown: true,
            title: 'Alertes Locataire',
            headerBackTitle: 'Retour',
            headerStyle: { backgroundColor: '#FFF' },
            headerTintColor: '#0E4728',
            headerShadowVisible: false,
            headerTitleStyle: { fontWeight: '700', fontSize: 20, color: '#0F172A' },
          }}
        />
        <Stack.Screen
          name="settings"
          options={{
            headerShown: true,
            title: 'Paramètres',
            headerBackTitle: 'Retour',
            headerStyle: { backgroundColor: '#FFF' },
            headerTintColor: '#0E4728',
            headerShadowVisible: false,
            headerTitleStyle: { fontWeight: '700', fontSize: 20, color: '#0F172A' },
          }}
        />
        <Stack.Screen
          name="help"
          options={{
            headerShown: true,
            title: 'Centre d\'Aide & FAQ',
            headerBackTitle: 'Retour',
            headerStyle: { backgroundColor: '#FFF' },
            headerTintColor: '#0E4728',
            headerShadowVisible: false,
            headerTitleStyle: { fontWeight: '700', fontSize: 18, color: '#0F172A' },
          }}
        />
        <Stack.Screen
          name="admin"
          options={{
            headerShown: true,
            title: 'Administration',
            headerBackTitle: 'Retour',
            headerStyle: { backgroundColor: '#FFF' },
            headerTintColor: '#0E4728',
            headerShadowVisible: false,
          }}
        />
      </Stack>
    </AuthProvider>
  );
}
