import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { NameOrId } from '@/db/types';

type Option = { id: number; name: string };

type Props = {
  testID: string;
  newInputTestID: string;
  label: string;
  options: Option[];
  selected: NameOrId | null;
  proposedName: string | null;
  noneLabel?: string;
  onChange: (value: NameOrId | null) => void;
};

function isNewName(value: NameOrId | null): value is { newName: string } {
  return value !== null && 'newName' in value;
}

function Choice(props: { testID: string; label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      testID={props.testID}
      accessibilityRole="button"
      accessibilityState={{ selected: props.selected }}
      style={[styles.choice, props.selected && styles.choiceSelected]}
      onPress={props.onPress}
    >
      <Text>{props.label}</Text>
    </Pressable>
  );
}

export function NamePicker(props: Props) {
  const { testID, selected, proposedName, noneLabel, onChange } = props;
  const selectedName = isNewName(selected) ? selected.newName : null;
  const typed = selectedName !== null && selectedName !== proposedName ? selectedName : '';

  return (
    <View testID={testID} style={styles.container}>
      <Text style={styles.label}>{props.label}</Text>
      <View style={styles.choices}>
        {noneLabel ? (
          <Choice
            testID={`${testID}-none`}
            label={noneLabel}
            selected={selected === null}
            onPress={() => onChange(null)}
          />
        ) : null}
        {props.options.map((option) => (
          <Choice
            key={option.id}
            testID={`${testID}-option-${option.id}`}
            label={option.name}
            selected={selected !== null && 'id' in selected && selected.id === option.id}
            onPress={() => onChange({ id: option.id })}
          />
        ))}
        {proposedName ? (
          <Choice
            testID={`${testID}-new`}
            label={`New: ${proposedName}`}
            selected={selectedName === proposedName}
            onPress={() => onChange({ newName: proposedName })}
          />
        ) : null}
      </View>
      <TextInput
        testID={props.newInputTestID}
        style={styles.input}
        value={typed}
        placeholder="Or type a new name"
        onChangeText={(text) => onChange(text.trim() ? { newName: text } : null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  label: { fontWeight: '600' },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { borderWidth: 1, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12 },
  choiceSelected: { backgroundColor: '#cde4ff', borderColor: '#2563eb' },
  input: { borderWidth: 1, borderRadius: 8, padding: 8 },
});
