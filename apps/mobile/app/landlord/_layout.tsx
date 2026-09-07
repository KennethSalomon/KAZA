import { Stack } from 'expo-router';

export default function LandlordLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#FFFFFF' },
        headerTintColor: '#0E4728',
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '700', fontSize: 16, color: '#0F172A' },
        headerBackTitle: 'Retour',
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Gestion' }} />
      <Stack.Screen name="residences/new" options={{ title: 'Nouvelle annonce' }} />
      <Stack.Screen name="residences/[id]/edit" options={{ headerShown: false }} />
    </Stack>
  );
}
