/**
 * apps/mobile/src/app/(tabs)/_layout.tsx
 * PVOT Mobile — Bottom Tab Navigator
 */

import { Tabs }           from 'expo-router';
import { CalendarDays, Users, Settings } from 'lucide-react-native';
import { color }          from '@pvot/core/tokens';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown:           false,
        tabBarStyle: {
          backgroundColor:     color.base,
          borderTopColor:      color.divider,
          borderTopWidth:      1,
          height:              64,
          paddingBottom:       12,
          paddingTop:          8,
        },
        tabBarActiveTintColor:   color.blue500,
        tabBarInactiveTintColor: color.muted,
        tabBarLabelStyle: {
          fontFamily: 'IBMPlexSans-Medium',
          fontSize:   11,
          letterSpacing: 0.4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title:    'Today',
          tabBarIcon: ({ color: c, size }) => (
            <CalendarDays size={size} color={c} />
          ),
        }}
      />
      <Tabs.Screen
        name="accounts"
        options={{
          title:    'Accounts',
          tabBarIcon: ({ color: c, size }) => (
            <Users size={size} color={c} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title:    'Settings',
          tabBarIcon: ({ color: c, size }) => (
            <Settings size={size} color={c} />
          ),
        }}
      />
    </Tabs>
  );
}
