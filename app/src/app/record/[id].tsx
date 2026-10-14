import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Button, Linking, StyleSheet, Text, View } from 'react-native';

import { persistClip } from '@/capture/audioFiles';
import { useDb } from '@/db/DbContext';
import type { WorkDay } from '@/db/types';
import { attachAudio, getWorkDay } from '@/db/workDays';

type Permission = 'unknown' | 'granted' | 'denied';

export default function Record() {
  const db = useDb();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const workDayId = Number(id);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  const [workDay, setWorkDay] = useState<WorkDay | null | undefined>(undefined);
  const [permission, setPermission] = useState<Permission>('unknown');
  const [clipUri, setClipUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const player = useAudioPlayer(clipUri);

  useEffect(() => {
    getWorkDay(db, workDayId).then(setWorkDay);
  }, [db, workDayId]);

  useEffect(() => {
    requestRecordingPermissionsAsync().then((response) => setPermission(response.granted ? 'granted' : 'denied'));
  }, []);

  const recording = recorderState.isRecording;

  async function toggleRecording() {
    setBusy(true);
    try {
      if (recording) {
        await recorder.stop();
        setClipUri(recorder.uri);
      } else {
        await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
        await recorder.prepareToRecordAsync();
        recorder.record();
      }
    } finally {
      setBusy(false);
    }
  }

  function play() {
    player.seekTo(0);
    player.play();
  }

  async function save() {
    if (!clipUri) {
      return;
    }
    setBusy(true);
    try {
      const path = persistClip(clipUri, workDayId);
      await attachAudio(db, workDayId, path);
      router.replace('/');
    } finally {
      setBusy(false);
    }
  }

  if (workDay === undefined) {
    return null;
  }

  if (workDay?.status !== 'needs_recording') {
    return (
      <View style={styles.container}>
        <Text>This dig day already has a recording</Text>
        <Button testID="back-button" title="Back to Today" onPress={() => router.replace('/')} />
      </View>
    );
  }

  if (permission === 'denied') {
    return (
      <View style={styles.container}>
        <Text testID="mic-denied">Microphone access is off</Text>
        <Button testID="open-settings" title="Open Settings" onPress={() => Linking.openSettings()} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Button
        testID="record-button"
        title={recording ? 'Stop' : 'Record'}
        disabled={busy || permission !== 'granted' || (!recording && clipUri !== null)}
        onPress={toggleRecording}
      />
      <Button testID="play-button" title="Play" disabled={!clipUri || recording} onPress={play} />
      <Button
        testID="rerecord-button"
        title="Re-record"
        disabled={!clipUri || recording}
        onPress={() => setClipUri(null)}
      />
      <Button testID="save-button" title="Save" disabled={!clipUri || recording || busy} onPress={save} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
});
