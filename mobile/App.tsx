import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider, useApp } from './src/AppContext';
import RegisterScreen from './src/screens/RegisterScreen';
import HomeScreen from './src/screens/HomeScreen';
import CallScreen from './src/screens/CallScreen';

function Root() {
  const { ready, session, call } = useApp();

  if (!ready) {
    return (
      <View style={styles.splash}>
        <Text style={styles.logo}>🔒</Text>
        <ActivityIndicator color="#2f6df6" style={{ marginTop: 20 }} />
      </View>
    );
  }

  if (!session) return <RegisterScreen />;

  const callActive = call.state !== 'idle' && call.state !== 'ended';

  return (
    <View style={{ flex: 1 }}>
      <HomeScreen />
      {callActive && <CallScreen />}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#0e1116" />
      <AppProvider>
        <Root />
      </AppProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, backgroundColor: '#0e1116', alignItems: 'center', justifyContent: 'center' },
  logo: { fontSize: 64 },
});
