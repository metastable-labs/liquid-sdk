import { Image, StyleSheet, Text } from 'react-native';
import { NativePassKeys, LiquidSDK } from '../../../../dist/native/index.native';

import { ThemedView } from '@/components/ThemedView';

export default function HomeScreen() {
  return (
    <ThemedView style={styles.container}>
      <Text style={styles.text}>Hello</Text>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingHorizontal: 16,
  },
  text: {
    marginTop: 56,
  },
});
