import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { Alert, Platform, Pressable, Text, View } from 'react-native';
import { s } from './styles';

import { NotesRepo, StorageMode } from './notes';
import { getRepo, loadMode, saveMode } from './storage';

type NotesContextValue = {
  mode: StorageMode;
  setMode: (mode: StorageMode) => Promise<void>;
  repo: NotesRepo;
};

const NotesContext = createContext<NotesContextValue | null>(null);

export function NotesProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<StorageMode | null>(null);
  const [error, setError] = useState('');

  const load = () => {
    setError('');
    loadMode().then(setModeState).catch(() => setError('Не удалось открыть настройки хранилища.'));
  };

  useEffect(() => {
    load();
  }, []);

  const setMode = async (value: StorageMode) => {
    await saveMode(value);
    setModeState(value);
  };

  if (!mode) return <View style={[s.screen, s.content]}>
    <Text style={s.error}>{error || 'Загрузка…'}</Text>
    {!!error && <Pressable style={s.button} onPress={load}><Text style={s.buttonText}>Повторить</Text></Pressable>}
  </View>;

  return (
    <NotesContext.Provider value={{ mode, setMode, repo: getRepo(mode) }}>
      {children}
    </NotesContext.Provider>
  );
}

export function useNotes() {
  return useContext(NotesContext)!;
}

export function confirm(message: string): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(message));
  return new Promise((resolve) =>
    Alert.alert('Подтверждение', message, [
      { text: 'Отмена', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Удалить', style: 'destructive', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) })
  );
}
