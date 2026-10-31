// В демо оба режима пишут в localStorage, каждый под своим ключом.
// SQLite и файлы устройства — в storage.ts.
import { filterNotes, Note, NotesRepo, StorageMode } from './notes';

// Начальные примеры для демо и теста удобства.
const DEMO: Note[] = [
  ['Планёрка отдела сопровождения 1С', '06.07.2026', '10:00', 'Совещание', 'Руководитель, консультанты 1С, стажёры',
    '1. Разобрать обращения клиентов за неделю\n2. Обновить 1С:Бухгалтерию у клиентов до 31.07\n3. Стажёрам подготовить инструкцию по настройке обмена'],
  ['Обучение стажёров', '10.07.2026', '14:00', 'Другое', 'Стажёры',
    'Тема: обмен данными между 1С:Управление торговлей и 1С:Бухгалтерией. Задание: настроить обмен на тестовой базе.'],
  ['Конференция «1С: цифровая трансформация»', '15.07.2026', '11:30', 'Конференция', '',
    'Доклады про облачные сервисы 1С и маркировку товаров. Записать контакты партнёров.'],
  ['Встреча с клиентом ООО «Ромашка»', '22.07.2026', '15:00', 'Деловая встреча', 'Директор и бухгалтер клиента',
    'Файловая база на 12 пользователей тормозит. Предложить перевод на клиент-серверный вариант. Коммерческое предложение до 27.07.'],
  ['Собрание по итогам месяца', '31.07.2026', '16:00', 'Собрание', 'Все сотрудники',
    'Итоги месяца по проектам, план на сентябрь, график отпусков.'],
].map(([title, date, time, type, participants, content], i) => ({
  id: `demo${i + 1}`, title, date, time, type, participants, content, updatedAt: 0,
}));

function makeRepo(key: string, demo: Note[] = []): NotesRepo {
  const read = (): Note[] => {
    const saved = localStorage.getItem(key);
    return saved === null ? demo : JSON.parse(saved);
  };
  const write = (notes: Note[]) => localStorage.setItem(key, JSON.stringify(notes));
  return {
    async list(query, type) {
      return filterNotes(read(), query, type);
    },
    async get(id) {
      return read().find((n) => n.id === id) ?? null;
    },
    async save(note) {
      write([...read().filter((n) => n.id !== note.id), note]);
    },
    async remove(id) {
      write(read().filter((n) => n.id !== id));
    },
  };
}

const repos = { sqlite: makeRepo('notes-sqlite', DEMO), files: makeRepo('notes-files') };

export function getRepo(mode: StorageMode) {
  return repos[mode];
}

export async function loadMode(): Promise<StorageMode> {
  return localStorage.getItem('storage-mode') === 'files' ? 'files' : 'sqlite';
}

export async function saveMode(mode: StorageMode) {
  localStorage.setItem('storage-mode', mode);
}

export const STORAGE_INFO = {
  sqlite: 'На телефоне заметки хранятся в базе SQLite. В веб-версии — в памяти браузера.',
  files: 'На телефоне каждая заметка — отдельный JSON-файл. В веб-версии — в памяти браузера.',
};
