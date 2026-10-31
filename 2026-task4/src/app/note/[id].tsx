import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Note } from '@/lib/notes';
import { confirm, useNotes } from '@/lib/notes-context';
import { s } from '@/lib/styles';

export default function NoteView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { repo } = useNotes();
  const [note, setNote] = useState<Note | null | undefined>(undefined);
  const [error, setError] = useState('');
  const [removing, setRemoving] = useState(false);
  const focused = useRef(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      focused.current = true;
      setError('');
      repo.get(id).then((n) => { if (active) setNote(n); })
        .catch(() => { if (active) setError('Не удалось открыть заметку. Вернитесь к списку и повторите.'); });
      return () => { active = false; focused.current = false; };
    }, [repo, id])
  );

  if (note === undefined) return <View style={[s.screen, s.content]}><Text style={s.text}>{error || 'Загрузка…'}</Text></View>;
  if (note === null) {
    return (
      <View style={[s.screen, s.content]}>
        <Text style={s.text}>Заметка не найдена.</Text>
      </View>
    );
  }

  const remove = async () => {
    if (removing) return;
    if (await confirm(`Удалить заметку «${note.title}»?`)) {
      setRemoving(true);
      try {
        await repo.remove(note.id);
        if (focused.current) router.back();
      } catch { setError('Не удалось удалить заметку. Данные сохранены.'); }
      finally { setRemoving(false); }
    }
  };

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <View style={s.card}>
        <Text style={[s.title, { fontSize: 20 }]}>{note.title}</Text>
        <Text style={[s.muted, { marginTop: 8 }]}>
          {note.type} · {note.date} · {note.time}
        </Text>
        {!!note.participants && (
          <Text style={[s.muted, { marginTop: 4 }]}>Участники: {note.participants}</Text>
        )}
      </View>

      <View style={s.card}>
        <Text style={s.text} selectable>
          {note.content || 'Текст заметки пуст'}
        </Text>
      </View>

      {!!error && <Text style={s.error}>{error}</Text>}
      <View style={[s.row, { marginTop: 6 }]}>
        <Pressable
          style={s.button}
          disabled={removing}
          onPress={() => router.push({ pathname: '/edit', params: { id: note.id } })}>
          <Text style={s.buttonText}>Изменить</Text>
        </Pressable>
        <Pressable style={[s.button, s.buttonDanger]} onPress={remove} disabled={removing}>
          <Text style={s.buttonText}>Удалить</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
