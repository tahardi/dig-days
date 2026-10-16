import { useEffect, useState, type ReactNode } from 'react';
import { Button, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { NamePicker } from '@/components/NamePicker';
import { ToolsInput } from '@/components/ToolsInput';
import type { Feature, NameOrId, ReviewInput, Trail } from '@/db/types';
import { finalDuration, formToReviewInput, type FormValues } from '@/processing/draftToForm';

type Props = {
  initial: FormValues;
  trails: Trail[];
  featuresFor: (trailId: number) => Promise<Feature[]>;
  onSubmit: (input: ReviewInput) => Promise<void>;
  submitLabel: string;
  children?: ReactNode;
};

function proposedNameOf(value: NameOrId | null): string | null {
  return value !== null && 'newName' in value ? value.newName : null;
}

export function WorkDayForm({ initial, trails, featuresFor, onSubmit, submitLabel, children }: Props) {
  const [trail, setTrail] = useState(initial.trail);
  const [feature, setFeature] = useState(initial.feature);
  const [summary, setSummary] = useState(initial.summary);
  const [tools, setTools] = useState(initial.tools);
  const [baseDuration, setBaseDuration] = useState(initial.durationMinutes);
  const [subtractBreak, setSubtractBreak] = useState(false);
  const [loaded, setLoaded] = useState<{ trailId: number; items: Feature[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [proposedTrail] = useState(() => proposedNameOf(initial.trail));
  const [proposedFeature] = useState(() => proposedNameOf(initial.feature));

  const breakMinutes = initial.suggestedBreakMinutes;
  const current: FormValues = { ...initial, trail, feature, summary, tools, durationMinutes: baseDuration };
  const duration = finalDuration(current, subtractBreak);
  const trailId = trail !== null && 'id' in trail ? trail.id : null;
  const features = loaded !== null && loaded.trailId === trailId ? loaded.items : [];

  useEffect(() => {
    let cancelled = false;
    if (trailId !== null) {
      featuresFor(trailId).then((items) => {
        if (!cancelled) {
          setLoaded({ trailId, items });
        }
      });
    }
    return () => {
      cancelled = true;
    };
  }, [trailId, featuresFor]);

  function chooseTrail(value: NameOrId | null) {
    setTrail(value);
    setFeature((prev) => (prev !== null && 'id' in prev ? null : prev));
  }

  function changeDuration(text: string) {
    const typed = Number.parseInt(text, 10);
    const minutes = Number.isNaN(typed) ? 0 : typed;
    setBaseDuration(subtractBreak ? minutes + breakMinutes : minutes);
  }

  async function submit() {
    const result = formToReviewInput({ ...current, durationMinutes: duration });
    if ('error' in result) {
      setError(result.error);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await onSubmit(result);
    } catch {
      setError("Couldn't save. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <NamePicker
        testID="trail-picker"
        newInputTestID="trail-new-input"
        label="Trail"
        options={trails}
        selected={trail}
        proposedName={proposedTrail}
        onChange={chooseTrail}
      />
      <NamePicker
        testID="feature-picker"
        newInputTestID="feature-new-input"
        label="Feature"
        options={features}
        selected={feature}
        proposedName={proposedFeature}
        noneLabel="General"
        onChange={setFeature}
      />
      <View style={styles.field}>
        <Text style={styles.label}>Summary</Text>
        <TextInput
          testID="summary-input"
          style={[styles.input, styles.summary]}
          value={summary}
          multiline
          onChangeText={setSummary}
        />
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>Tools</Text>
        <ToolsInput tools={tools} onChange={setTools} />
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>Minutes</Text>
        <TextInput
          testID="duration-input"
          style={styles.input}
          keyboardType="numeric"
          value={String(duration)}
          onChangeText={changeDuration}
        />
      </View>
      {breakMinutes > 0 ? (
        <View style={styles.toggle}>
          <Text>{`Subtract ${breakMinutes} min break`}</Text>
          <Switch testID="break-toggle" value={subtractBreak} onValueChange={setSubtractBreak} />
        </View>
      ) : null}
      {error ? (
        <Text testID="form-error" style={styles.error}>
          {error}
        </Text>
      ) : null}
      <Button testID="form-submit" title={submitLabel} disabled={busy} onPress={submit} />
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16 },
  field: { gap: 8 },
  label: { fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: 8, padding: 8 },
  summary: { minHeight: 80 },
  toggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  error: { color: '#b91c1c' },
});
