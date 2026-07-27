import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useApp } from '../AppContext';

export default function HomeScreen() {
  const { session, connected, startCall, logout } = useApp();
  const [peerId, setPeerId] = useState('');
  const [busy, setBusy] = useState(false);

  const onCall = async () => {
    const id = peerId.trim();
    if (!id) return Alert.alert('입력 필요', '상대 아이디를 입력하세요.');
    if (id === session?.userId) return Alert.alert('오류', '자기 자신에게는 걸 수 없습니다.');
    if (!connected) return Alert.alert('연결 안 됨', '서버에 연결 중입니다. 잠시 후 다시 시도하세요.');
    setBusy(true);
    try {
      await startCall(id);
    } catch (e: any) {
      Alert.alert('통화 실패', e?.message ?? '알 수 없는 오류');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.hi}>내 아이디</Text>
          <Text style={styles.me}>{session?.userId}</Text>
        </View>
        <View style={[styles.dot, { backgroundColor: connected ? '#2ecc71' : '#e67e22' }]} />
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>상대 아이디로 전화 걸기</Text>
        <TextInput
          style={styles.input}
          placeholder="예: lee-02"
          placeholderTextColor="#888"
          autoCapitalize="none"
          autoCorrect={false}
          value={peerId}
          onChangeText={setPeerId}
          onSubmitEditing={onCall}
        />
        <TouchableOpacity style={styles.callBtn} onPress={onCall} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.callText}>📞 통화</Text>}
        </TouchableOpacity>
      </View>

      <Text style={styles.note}>
        통화는 두 기기 사이에서 종단간 암호화됩니다.{'\n'}연결되면 안전번호로 도청 여부를 확인할 수 있습니다.
      </Text>

      <TouchableOpacity style={styles.logout} onPress={logout}>
        <Text style={styles.logoutText}>로그아웃</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0e1116', padding: 24 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 40,
  },
  hi: { color: '#9aa4b2', fontSize: 13 },
  me: { color: '#fff', fontSize: 24, fontWeight: '800', marginTop: 2 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  card: { backgroundColor: '#161b22', borderRadius: 16, padding: 20 },
  label: { color: '#c7d0da', fontWeight: '600', marginBottom: 10 },
  input: {
    backgroundColor: '#0e1116',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#fff',
    fontSize: 18,
  },
  callBtn: {
    backgroundColor: '#2ecc71',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  callText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  note: { color: '#6b7482', textAlign: 'center', marginTop: 28, fontSize: 12, lineHeight: 18 },
  logout: { marginTop: 'auto', alignItems: 'center', paddingVertical: 16 },
  logoutText: { color: '#6b7482' },
});
