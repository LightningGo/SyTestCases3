import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { EVENT_TYPES, isValidDate, isValidTime, newId, nowTime, today } from '@/lib/notes';
import { useNotes } from '@/lib/notes-context';
import { colors, s } from '@/lib/styles';

export default function EditNote() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { repo } = useNotes();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(today());
  const [time, setTime] = useState(nowTime());
  const [type, setType] = useState(EVENT_TYPES[0]);
  const [participants, setParticipants] = useState('');
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const [ready, setReady] = useState(!id);
  const [saving, setSaving] = useState(false);
  const focused = useRef(true);
  useFocusEffect(useCallback(() => {
    focused.current = true;
    return () => { focused.current = false; };
  }, []));

  useEffect(() => {
    if (!id) return;
    let active = true;
    setReady(false);
    repo.get(id).then((n) => {
      if (!active) return;
      if (!n) { setError('Заметка не найдена. Вернитесь к списку.'); return; }
      setTitle(n.title);
      setDate(n.date);
      setTime(n.time);
      setType(n.type);
      setParticipants(n.participants);
      setContent(n.content);
      setReady(true);
    }).catch(() => { if (active) setError('Не удалось открыть заметку. Вернитесь к списку и повторите.'); });
    return () => { active = false; };
  }, [id, repo]);

  const save = async () => {
    if (!ready || saving) return;
    if (!title.trim()) return setError('Введите заголовок');
    if (!isValidDate(date)) return setError('Дата должна быть в формате ДД.ММ.ГГГГ, например 15.07.2026');
    if (!isValidTime(time)) return setError('Время должно быть в формате ЧЧ:ММ, например 10:30');
    setSaving(true);
    setError('');
    try {
      await repo.save({
      id: id ?? newId(),
      title: title.trim(),
      date,
      time,
      type,
      participants: participants.trim(),
      content: content.trim(),
      updatedAt: Date.now(),
      });
      if (focused.current) router.back();
    } catch {
      setError('Не удалось сохранить заметку. Проверьте доступ к хранилищу.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: id ? 'Редактирование' : 'Новая заметка' }} />
      <ScrollView contentContainerStyle={[s.content, { paddingBottom: 40 }]} keyboardShouldPersistTaps="handled">
        <Text style={[s.label, { marginTop: 0 }]}>Заголовок *</Text>
        <TextInput
          style={s.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Например: Планёрка отдела продаж"
          placeholderTextColor={colors.muted}
        />

        <Text style={s.label}>Тип мероприятия</Text>
        <View style={s.chips}>
          {EVENT_TYPES.map((t) => (
            <Pressable key={t} style={[s.chip, type === t && s.chipActive]} onPress={() => setType(t)}>
              <Text style={[s.chipText, type === t && s.chipTextActive]}>{t}</Text>
            </Pressable>
          ))}
        </View>

        <View style={s.row}>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Дата</Text>
            <TextInput
              style={s.input}
              value={date}
              onChangeText={setDate}
              placeholder="ДД.ММ.ГГГГ"
              placeholderTextColor={colors.muted}
              keyboardType="numbers-and-punctuation"
              maxLength={10}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Время</Text>
            <TextInput
              style={s.input}
              value={time}
              onChangeText={setTime}
              placeholder="ЧЧ:ММ"
              placeholderTextColor={colors.muted}
              keyboardType="numbers-and-punctuation"
              maxLength={5}
            />
          </View>
        </View>

        <Text style={s.label}>Участники</Text>
        <TextInput
          style={s.input}
          value={participants}
          onChangeText={setParticipants}
          placeholder="Через запятую"
          placeholderTextColor={colors.muted}
        />

        <Text style={s.label}>Содержание</Text>
        <TextInput
          style={[s.input, { minHeight: 160, textAlignVertical: 'top' }]}
          value={content}
          onChangeText={setContent}
          placeholder="Решения, задачи, сроки..."
          placeholderTextColor={colors.muted}
          multiline
        />

        {!!error && <Text style={s.error}>{error}</Text>}

        <View style={[s.row, { marginTop: 18 }]}>
          <Pressable style={[s.button, { backgroundColor: colors.muted }]} onPress={() => router.back()} disabled={saving}>
            <Text style={s.buttonText}>Отмена</Text>
          </Pressable>
          <Pressable style={s.button} onPress={save} disabled={!ready || saving}>
            <Text style={s.buttonText}>{saving ? 'Сохранение…' : 'Сохранить'}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
