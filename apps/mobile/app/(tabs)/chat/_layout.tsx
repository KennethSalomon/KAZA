import { Stack } from 'expo-router';

export default function ChatLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#FFFFFF' },
        headerTintColor: '#0E4728',
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '700', fontSize: 18, color: '#0F172A' },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Messages' }} />
      <Stack.Screen name="[id]" options={{ title: 'Chat', headerBackTitle: 'Retour' }} />
    </Stack>
  );
}
