import { SymbolView } from 'expo-symbols';
import { Alert, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function HomeScreen() {
  const theme = useTheme();

  function handleCreateGroup() {
    // TODO: navigate to the group creation flow once it exists.
    Alert.alert('Crear grupo', 'Esta función todavía no está disponible.');
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.header}>
          <ThemedText type="subtitle">Kachingga</ThemedText>
          <ThemedText themeColor="textSecondary">Dividí gastos en grupo sin vueltas.</ThemedText>
        </ThemedView>

        <ThemedView style={styles.emptyState}>
          <ThemedView type="backgroundElement" style={styles.iconCircle}>
            <SymbolView
              name={{ ios: 'person.2.fill', android: 'groups', web: 'groups' }}
              tintColor={theme.textSecondary}
              size={32}
            />
          </ThemedView>
          <ThemedText type="smallBold" style={styles.emptyTitle}>
            Todavía no tenés grupos
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.emptyDescription}>
            Creá tu primer grupo para cargar gastos y ver cuánto le debe cada uno.
          </ThemedText>
        </ThemedView>

        <Pressable
          onPress={handleCreateGroup}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: theme.primary },
            pressed && styles.pressed,
          ]}>
          <SymbolView
            name={{ ios: 'plus', android: 'add', web: 'add' }}
            tintColor={theme.onPrimary}
            size={18}
          />
          <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
            Crear grupo
          </ThemedText>
        </Pressable>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    alignSelf: 'stretch',
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.three,
    maxWidth: MaxContentWidth,
  },
  header: {
    paddingTop: Spacing.four,
    gap: Spacing.one,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.five,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  emptyTitle: {
    textAlign: 'center',
  },
  emptyDescription: {
    textAlign: 'center',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.five,
  },
  pressed: {
    opacity: 0.85,
  },
});
