import { StyleSheet } from 'react-native';

export const colors = {
  background: '#0f1115',
  surface: '#181b22',
  surfaceAlt: '#20242e',
  border: '#2b3040',
  text: '#f2f4f8',
  textMuted: '#98a1b3',
  accent: '#4c8dff',
  success: '#3ddc97',
  warning: '#ffb84d',
  danger: '#ff6b6b',
} as const;

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 12, paddingBottom: 48 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  title: { color: colors.text, fontSize: 17, fontWeight: '700' },
  subtitle: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  label: {
    color: colors.textMuted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  value: { color: colors.text, fontSize: 15, fontVariant: ['tabular-nums'] },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  mono: { color: colors.text, fontSize: 12, fontFamily: 'Courier' },
  button: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  buttonSecondary: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  banner: {
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    gap: 4,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', gap: 2 },
  tabLabel: { fontSize: 12, fontWeight: '600' },
  peerRow: { gap: 6 },
  fill: { flex: 1 },
  bannerTitle: { fontWeight: '700', fontSize: 14 },
});
