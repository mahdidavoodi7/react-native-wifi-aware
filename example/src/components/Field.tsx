import { Text, View } from 'react-native';
import { styles } from '../theme';

/** A labelled read-only value. Renders an em dash when the platform reported nothing. */
export function Field({
  label,
  value,
}: {
  label: string;
  value: string | number | undefined;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value ?? '—'}</Text>
    </View>
  );
}
