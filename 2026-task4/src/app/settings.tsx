import { Pressable, ScrollView, Text, View } from 'react-native';
import { useState } from 'react';

import { StorageMode } from '@/lib/notes';
import { useNotes } from '@/lib/notes-context';
import { STORAGE_INFO } from '@/lib/storage';
import { colors, s } from '@/lib/styles';

const OPTIONS: { mode: StorageMode; title: string }[] = [
  { mode: 'sqlite', title: 'База данных SQLite' },
  { mode: 'files', title: 'Файлы на устройстве' },
];

export default function Settings() {
  const { mode, setMode } = useNotes();
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const changeMode = async (value: StorageMode) => {
    if (saving) return;
    setSaving(true);
    setError('');
    try { await setMode(value); }
    catch { setError('Не удалось изменить хранилище. Выбран прежний режим.'); }
    finally { setSaving(false); }
  };

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <Text style={[s.label, { marginTop: 0 }]}>Где хранить заметки</Text>
      {OPTIONS.map((o) => (
        <Pressable
          key={o.mode}
          style={[s.card, mode === o.mode && { borderColor: colors.primary, borderWidth: 2 }]}
          disabled={saving}
          onPress={() => changeMode(o.mode)}>
          <View style={s.row}>
            <Text style={{ fontSize: 18, color: colors.primary }}>{mode === o.mode ? '◉' : '○'}</Text>
            <Text style={s.title}>{o.title}</Text>
          </View>
          <Text style={[s.muted, { marginTop: 6 }]}>{STORAGE_INFO[o.mode]}</Text>
        </Pressable>
      ))}
      {!!error && <Text style={s.error}>{error}</Text>}
      <Text style={s.muted}>
        Хранилища независимы: после переключения в списке будут заметки выбранного хранилища.
      </Text>

      <Text style={s.label}>О приложении</Text>
      <View style={s.card}>
        <Text style={s.text}>
          «Заметки встреч» — приложение для записей на совещаниях, собраниях, конференциях и деловых
          встречах. Версия 1.0.
        </Text>
      </View>
    </ScrollView>
  );
}
