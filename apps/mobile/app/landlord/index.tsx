import { Redirect } from 'expo-router';

export default function LandlordIndexRedirect() {
  return <Redirect href="/(tabs)/dashboard" />;
}
