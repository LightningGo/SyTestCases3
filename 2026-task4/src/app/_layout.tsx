import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { NotesProvider } from '@/lib/notes-context';
import { colors } from '@/lib/styles';

export default function RootLayout() {
  return (
    <NotesProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.primary },
          headerTintColor: '#fff',
          contentStyle: { backgroundColor: colors.bg },
        }}>
        <Stack.Screen name="index" options={{ title: 'Заметки встреч' }} />
        <Stack.Screen name="note/[id]" options={{ title: 'Заметка' }} />
        <Stack.Screen name="edit" options={{ title: 'Заметка' }} />
        <Stack.Screen name="settings" options={{ title: 'Настройки' }} />
      </Stack>
    </NotesProvider>
  );
}
