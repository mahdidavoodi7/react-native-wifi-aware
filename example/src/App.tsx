import { useState } from 'react';
import { Pressable, SafeAreaView, StatusBar, Text, View } from 'react-native';
import { ExperimentalScreen } from './screens/ExperimentalScreen';
import { SetupScreen } from './screens/SetupScreen';
import { TransferScreen } from './screens/TransferScreen';
import { colors, styles } from './theme';

const TABS = [
  { key: 'setup', label: 'Setup', Screen: SetupScreen },
  { key: 'transfer', label: 'Transfer', Screen: TransferScreen },
  { key: 'experimental', label: 'Experimental', Screen: ExperimentalScreen },
] as const;

export default function App() {
  const [active, setActive] = useState<(typeof TABS)[number]['key']>('setup');
  const Screen = TABS.find((tab) => tab.key === active)!.Screen;

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <View style={styles.fill}>
        <Screen />
      </View>
      <View style={styles.tabBar}>
        {TABS.map((tab) => (
          <Pressable
            key={tab.key}
            style={styles.tab}
            onPress={() => setActive(tab.key)}
          >
            <Text
              style={[
                styles.tabLabel,
                {
                  color: active === tab.key ? colors.accent : colors.textMuted,
                },
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}
