import { useState } from 'react';
import { Button, StyleSheet, Text, TextInput, View } from 'react-native';

type Props = {
  tools: string[];
  onChange: (tools: string[]) => void;
};

export function ToolsInput({ tools, onChange }: Props) {
  const [text, setText] = useState('');

  function add() {
    const name = text.trim();
    if (name && !tools.includes(name)) {
      onChange([...tools, name]);
    }
    setText('');
  }

  return (
    <View style={styles.container}>
      <View style={styles.chips}>
        {tools.map((tool) => (
          <View key={tool} style={styles.chip}>
            <Text>{tool}</Text>
            <Button
              testID={`tool-remove-${tool}`}
              title="✕"
              onPress={() => onChange(tools.filter((t) => t !== tool))}
            />
          </View>
        ))}
      </View>
      <View style={styles.addRow}>
        <TextInput
          testID="tool-add-input"
          style={styles.input}
          value={text}
          placeholder="Add a tool"
          onChangeText={setText}
          onSubmitEditing={add}
        />
        <Button testID="tool-add-button" title="Add" onPress={add} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 16, paddingLeft: 12 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { flex: 1, borderWidth: 1, borderRadius: 8, padding: 8 },
});
