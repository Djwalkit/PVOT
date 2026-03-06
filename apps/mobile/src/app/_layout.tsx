/**
 * apps/mobile/src/app/_layout.tsx
 * PVOT Mobile — Root Expo Router Layout
 *
 * Bootstraps fonts, providers, and the bottom-tab navigator.
 * Injects the Expo SecureStore adapter into TokenStore so auth
 * tokens are stored in iOS Keychain / Android Keystore.
 */

import { useEffect }          from 'react';
import { Slot }               from 'expo-router';
import { StatusBar }          from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider }   from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import * as SecureStore       from 'expo-secure-store';
import * as Font              from 'expo-font';
import { createQueryClient }  from '@pvot/query/queryClient';
import { getTokenStore, createExpoSecureStoreAdapter } from '@pvot/core/auth/TokenStore';

// ── Inject Expo SecureStore as the token storage backend ──────────────────────
// Must run before any auth operations.
getTokenStore(createExpoSecureStoreAdapter(SecureStore));

const queryClient = createQueryClient();

export default function RootLayout() {
  const [fontsLoaded] = Font.useFonts({
    'DMSans':          require('../../assets/fonts/DMSans-Regular.ttf'),
    'DMSans-Medium':   require('../../assets/fonts/DMSans-Medium.ttf'),
    'DMSans-SemiBold': require('../../assets/fonts/DMSans-SemiBold.ttf'),
    'DMSans-Bold':     require('../../assets/fonts/DMSans-Bold.ttf'),
    'IBMPlexSans':     require('../../assets/fonts/IBMPlexSans-Regular.ttf'),
    'IBMPlexSans-Medium': require('../../assets/fonts/IBMPlexSans-Medium.ttf'),
    'IBMPlexMono':     require('../../assets/fonts/IBMPlexMono-Regular.ttf'),
    'IBMPlexMono-Medium': require('../../assets/fonts/IBMPlexMono-Medium.ttf'),
  });

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="light" backgroundColor="#080C14" />
          <Slot />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
