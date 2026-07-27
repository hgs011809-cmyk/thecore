import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useApp } from '../AppContext';
import { CallState } from '../webrtc/CallManager';

const STATE_LABEL: Record<CallState, string> = {
  idle: '',
  outgoing: '전화 거는 중…',
  incoming: '수신 전화',
  connecting: '연결 중…',
  connected: '통화 중',
  ended: '통화 종료',
  failed: '통화 실패',
};

export default function CallScreen() {
  const { call, acceptCall, rejectCall, hangup, toggleMute } = useApp();
  const { state, peerId, safetyNumber, isMuted, error } = call;

  return (
    <View style={styles.overlay}>
      <View style={styles.top}>
        <Text style={styles.peer}>{peerId}</Text>
        <Text style={styles.state}>{error ?? STATE_LABEL[state]}</Text>
      </View>

      {state === 'connected' && safetyNumber ? (
        <View style={styles.safety}>
          <Text style={styles.safetyTitle}>🔒 안전번호</Text>
          <Text style={styles.safetyNum}>{safetyNumber}</Text>
          <Text style={styles.safetyHint}>
            상대와 이 번호가 같으면 도청·중간자 없이 안전하게 연결된 것입니다.
          </Text>
        </View>
      ) : (
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(peerId || '?')[0]?.toUpperCase()}</Text>
        </View>
      )}

      <View style={styles.controls}>
        {state === 'incoming' ? (
          <>
            <RoundBtn color="#e74c3c" label="거절" onPress={rejectCall} icon="✕" />
            <RoundBtn color="#2ecc71" label="받기" onPress={acceptCall} icon="📞" />
          </>
        ) : (
          <>
            <RoundBtn
              color={isMuted ? '#f39c12' : '#3a4250'}
              label={isMuted ? '음소거 해제' : '음소거'}
              onPress={toggleMute}
              icon={isMuted ? '🔇' : '🎙️'}
            />
            <RoundBtn color="#e74c3c" label="종료" onPress={hangup} icon="✕" />
          </>
        )}
      </View>
    </View>
  );
}

function RoundBtn({
  color,
  label,
  icon,
  onPress,
}: {
  color: string;
  label: string;
  icon: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.btnWrap}>
      <TouchableOpacity style={[styles.round, { backgroundColor: color }]} onPress={onPress}>
        <Text style={styles.icon}>{icon}</Text>
      </TouchableOpacity>
      <Text style={styles.btnLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0b0e13',
    paddingTop: 90,
    paddingBottom: 60,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  top: { alignItems: 'center' },
  peer: { color: '#fff', fontSize: 32, fontWeight: '800' },
  state: { color: '#9aa4b2', fontSize: 16, marginTop: 10 },
  avatar: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#232a35',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 56, fontWeight: '800' },
  safety: { alignItems: 'center', paddingHorizontal: 30 },
  safetyTitle: { color: '#2ecc71', fontSize: 15, fontWeight: '700', marginBottom: 12 },
  safetyNum: {
    color: '#fff',
    fontSize: 20,
    letterSpacing: 2,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    lineHeight: 30,
  },
  safetyHint: { color: '#6b7482', fontSize: 12, textAlign: 'center', marginTop: 16, lineHeight: 18 },
  controls: { flexDirection: 'row', gap: 40 },
  btnWrap: { alignItems: 'center' },
  round: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 28 },
  btnLabel: { color: '#c7d0da', marginTop: 10, fontSize: 13 },
});
