import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from '../context/AuthContext';
import { FleetProvider } from '../context/FleetContext';
import { UserManagementProvider } from '../context/UserManagementContext';

export default function RootLayout() {
  return (
    <AuthProvider>
      <FleetProvider>
      <UserManagementProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index"  options={{ headerShown: false }} />
          <Stack.Screen name="login"  options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="vehicle/[id]"
          options={{
            headerShown: true,
            headerTitle: 'Vehicle Details',
            headerBackTitle: 'Back',
            headerStyle: { backgroundColor: '#0A2463' },
            headerTintColor: '#FFFFFF',
            headerTitleStyle: { fontWeight: '700' },
          }}
        />
        <Stack.Screen
          name="trip/[id]"
          options={{
            headerShown: true,
            headerTitle: 'Trip Details',
            headerBackTitle: 'Back',
            headerStyle: { backgroundColor: '#0A2463' },
            headerTintColor: '#FFFFFF',
            headerTitleStyle: { fontWeight: '700' },
          }}
        />
        </Stack>
      </GestureHandlerRootView>
      </UserManagementProvider>
      </FleetProvider>
    </AuthProvider>
  );
}
