import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { EVENT_TYPES, Note } from '@/lib/notes';
import { useNotes } from '@/lib/notes-context';
import { colors, s } from '@/lib/styles';

export default function NotesList() {
  const { repo, mode } = useNotes();
  const [notes, setNotes] = useState<Note[]>([]);
  const [query, setQuery] = useState('');
  const [type, setType] = useState('');
  const [error, setError] = useState('');

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setError('');
      repo.list(query, type).then((items) => {
        if (active) setNotes(items);
      }).catch(() => {
        if (active) {
          setNotes([]);
          setError('Не удалось загрузить заметки. Данные не изменены.');
        }
      });
      return () => { active = false; };
    }, [repo, query, type])
  );

  return (
    <View style={s.screen}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={() => router.push('/settings')} hitSlop={10}>
              <Text style={styles.headerBtn}>Настройки</Text>
            </Pressable>
          ),
        }}
      />

      <View style={[s.content, styles.top]}>
        <TextInput
          style={s.input}
          placeholder="Поиск: слово, дата (15.07.2026) или время"
          placeholderTextColor={colors.muted}
          value={query}
          onChangeText={setQuery}
          clearButtonMode="while-editing"
        />
        <View style={[s.chips, { marginTop: 10 }]}>
          {['', ...EVENT_TYPES].map((t) => (
            <Pressable
              key={t || 'all'}
              style={[s.chip, type === t && s.chipActive]}
              onPress={() => setType(t)}>
              <Text style={[s.chipText, type === t && s.chipTextActive]}>{t || 'Все'}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={[s.muted, { marginTop: 10 }]}>
          Хранилище: {mode === 'sqlite' ? 'база данных SQLite' : 'файлы'} · заметок: {notes.length}
        </Text>
      </View>

      <FlatList
        data={notes}
        keyExtractor={(n) => n.id}
        contentContainerStyle={[s.content, { paddingTop: 0, paddingBottom: 100 }]}
        ListHeaderComponent={error ? <Text style={s.error}>{error}</Text> : null}
        ListEmptyComponent={error ? null :
          <Text style={[s.muted, styles.empty]}>
            {query || type ? 'Ничего не найдено' : 'Заметок пока нет. Нажмите «+», чтобы создать первую.'}
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable style={s.card} onPress={() => router.push(`/note/${item.id}`)}>
            <Text style={s.title}>{item.title}</Text>
            <View style={[s.row, { marginVertical: 6 }]}>
              <Text style={styles.badge}>{item.type}</Text>
              <Text style={s.muted}>
                {item.date} · {item.time}
              </Text>
            </View>
            {!!item.content && (
              <Text style={s.muted} numberOfLines={2}>
                {item.content}
              </Text>
            )}
          </Pressable>
        )}
      />

      <Pressable
        style={styles.fab}
        onPress={() => router.push('/edit')}
        accessibilityLabel="Новая заметка">
        <Text style={styles.fabText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { paddingBottom: 8 },
  headerBtn: { color: '#fff', fontSize: 15, marginRight: 8 },
  empty: { textAlign: 'center', marginTop: 40, fontSize: 15 },
  badge: {
    fontSize: 12,
    color: colors.primary,
    backgroundColor: '#e3edff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: 'hidden',
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 32,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    boxShadow: '0 3px 8px rgba(0,0,0,0.25)',
  },
  fabText: { color: '#fff', fontSize: 32, lineHeight: 34 },
});
