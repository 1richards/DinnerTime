import { Redirect, Tabs } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { SymbolIcon } from '../../components/ui/SymbolIcon';
import { useAuthStore } from '../../stores/authStore';
import { colors } from '../../design/tokens';

export default function TabLayout() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const isOnboarded = useAuthStore((s) => s.isOnboarded);

  if (!isLoggedIn) return <Redirect href="/(auth)/login" />;
  if (!isOnboarded) return <Redirect href="/onboarding" />;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopColor: colors.borderSubtle,
          borderTopWidth: StyleSheet.hairlineWidth,
        },
        headerStyle: {
          backgroundColor: colors.bg,
        },
        headerTintColor: colors.textPrimary,
        headerShadowVisible: false,
      }}
    >
      {/*
        Kitchen MUST be the first Tabs.Screen — expo-router resolves the
        /(tabs) group redirect to whichever screen is declared first. See
        12-RESEARCH.md Pitfall 1.
      */}
      <Tabs.Screen
        name="kitchen"
        options={{
          headerShown: false,
          title: 'Kitchen',
          tabBarLabel: 'Kitchen',
          tabBarIcon: ({ color, size, focused }) => (
            // Wrap SymbolIcon in a sized View (15-RESEARCH Pitfall 1) so SF
            // Symbol glyphs align vertically in the tab bar.
            <View style={{ width: size, height: size }}>
              <SymbolIcon
                name={focused ? 'fork.knife.circle.fill' : 'fork.knife'}
                size={size}
                tintColor={color}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="plan"
        options={{
          headerShown: false,
          title: 'Plan',
          tabBarLabel: 'Plan',
          tabBarIcon: ({ color, size, focused }) => (
            <View style={{ width: size, height: size }}>
              <SymbolIcon
                name="calendar"
                size={size}
                weight={focused ? 'semibold' : 'regular'}
                tintColor={color}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="pantry"
        options={{
          headerShown: false,
          title: 'Pantry',
          tabBarLabel: 'Pantry',
          tabBarIcon: ({ color, size, focused }) => (
            <View style={{ width: size, height: size }}>
              <SymbolIcon
                name={focused ? 'basket.fill' : 'basket'}
                size={size}
                tintColor={color}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="shopping"
        options={{
          headerShown: false,
          title: 'Shopping',
          tabBarLabel: 'Shopping',
          tabBarIcon: ({ color, size, focused }) => (
            <View style={{ width: size, height: size }}>
              <SymbolIcon
                name={focused ? 'cart.fill' : 'cart'}
                size={size}
                tintColor={color}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          headerShown: false,
          title: 'Settings',
          tabBarLabel: 'Settings',
          tabBarIcon: ({ color, size, focused }) => (
            <View style={{ width: size, height: size }}>
              <SymbolIcon
                name={focused ? 'gearshape.fill' : 'gearshape'}
                size={size}
                tintColor={color}
              />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}
