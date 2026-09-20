import { Text, View } from 'react-native';
import { colors, styles } from '../theme';

type Tone = 'info' | 'warning' | 'danger' | 'success';

const tones: Record<
  Tone,
  { background: string; border: string; text: string }
> = {
  info: { background: '#16203a', border: '#2b4373', text: colors.accent },
  warning: { background: '#2e2416', border: '#5c4620', text: colors.warning },
  danger: { background: '#2e1919', border: '#5c2b2b', text: colors.danger },
  success: { background: '#162b23', border: '#265c46', text: colors.success },
};

/** A short, colour-coded status message. */
export function Banner({
  tone = 'info',
  title,
  children,
}: {
  tone?: Tone;
  title: string;
  children?: string;
}) {
  const palette = tones[tone];
  return (
    <View
      style={[
        styles.banner,
        { backgroundColor: palette.background, borderColor: palette.border },
      ]}
    >
      <Text style={[styles.bannerTitle, { color: palette.text }]}>{title}</Text>
      {children ? <Text style={styles.subtitle}>{children}</Text> : null}
    </View>
  );
}
