import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { generateIdentity } from '../crypto/identity';
import { register } from '../api/rest';
import { saveSession } from '../storage/secureStore';
import { useApp } from '../AppContext';

export default function RegisterScreen() {
  const { refreshSession } = useApp();
  const [userId, setUserId] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    if (!userId.trim() || !code.trim()) {
      Alert.alert('입력 필요', '아이디와 등록코드를 모두 입력하세요.');
      return;
    }
    setBusy(true);
    try {
      const identity = generateIdentity(); // 개인키는 기기를 벗어나지 않음
      const result = await register({
        userId: userId.trim(),
        registrationCode: code.trim(),
        publicKey: identity.publicKey,
      });
      await saveSession({
        userId: result.user_id,
        publicKey: identity.publicKey,
        secretKey: identity.secretKey,
        authToken: result.auth_token,
      });
      await refreshSession();
    } catch (e: any) {
      Alert.alert('가입 실패', e?.message ?? '알 수 없는 오류');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.logo}>🔒 SecretCall</Text>
      <Text style={styles.subtitle}>개인정보 없이, 아이디만으로{'\n'}종단간 암호화 통화</Text>

      <Text style={styles.label}>아이디</Text>
      <TextInput
        style={styles.input}
        placeholder="발급받은 아이디"
        placeholderTextColor="#888"
        autoCapitalize="none"
        autoCorrect={false}
        value={userId}
        onChangeText={setUserId}
      />

      <Text style={styles.label}>등록코드</Text>
      <TextInput
        style={styles.input}
        placeholder="1회용 등록코드"
        placeholderTextColor="#888"
        autoCapitalize="none"
        autoCorrect={false}
        value={code}
        onChangeText={setCode}
      />

      <TouchableOpacity style={styles.button} onPress={onSubmit} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>가입하고 시작</Text>}
      </TouchableOpacity>

      <Text style={styles.hint}>
        아이디와 등록코드는 관리자에게 발급받습니다.{'\n'}가입 시 이 기기에서 암호화 키가 생성됩니다.
      </Text>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0e1116', padding: 24, justifyContent: 'center' },
  logo: { fontSize: 34, fontWeight: '800', color: '#fff', textAlign: 'center' },
  subtitle: { color: '#9aa4b2', textAlign: 'center', marginTop: 8, marginBottom: 32, lineHeight: 20 },
  label: { color: '#c7d0da', marginBottom: 6, marginTop: 12, fontWeight: '600' },
  input: {
    backgroundColor: '#1a1f27',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#fff',
    fontSize: 16,
  },
  button: {
    backgroundColor: '#2f6df6',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 28,
  },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  hint: { color: '#6b7482', textAlign: 'center', marginTop: 24, fontSize: 12, lineHeight: 18 },
});
