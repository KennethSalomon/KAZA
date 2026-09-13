/**
 * Configuration Expo dynamique.
 *
 * La clé Google Maps Android ne doit jamais être committée. Elle est injectée
 * au build depuis la variable d'environnement Expo `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`,
 * à définir dans EAS (Project settings > Environment variables, ou
 * eas.json build.<profil>.env). Sans cette variable, aucune clé n'est injectée
 * et les cartes Android resteront indisponibles.
 */
module.exports = ({ config }) => {
  const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

  return {
    ...config,
    android: {
      ...config.android,
      config: {
        ...config.android?.config,
        googleMaps: googleMapsApiKey ? { apiKey: googleMapsApiKey } : {},
      },
    },
  };
};
