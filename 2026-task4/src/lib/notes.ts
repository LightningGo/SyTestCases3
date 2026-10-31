export type Note = {
  id: string;
  title: string;
  date: string; // ДД.ММ.ГГГГ
  time: string; // ЧЧ:ММ
  type: string;
  participants: string;
  content: string;
  updatedAt: number;
};

export type StorageMode = 'sqlite' | 'files';

export interface NotesRepo {
  list(query: string, type: string): Promise<Note[]>;
  get(id: string): Promise<Note | null>;
  save(note: Note): Promise<void>;
  remove(id: string): Promise<void>;
}

export const EVENT_TYPES = ['Совещание', 'Собрание', 'Конференция', 'Деловая встреча', 'Другое'];

export function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function today() {
  const d = new Date();
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

export function nowTime() {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function isValidDate(value: string) {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value);
  if (!m) return false;
  const d = new Date(+m[3], +m[2] - 1, +m[1]);
  return +m[3] > 0 && d.getFullYear() === +m[3]
    && d.getDate() === +m[1] && d.getMonth() === +m[2] - 1;
}

export function isValidTime(value: string) {
  const m = /^(\d{2}):(\d{2})$/.exec(value);
  return !!m && +m[1] < 24 && +m[2] < 60;
}

export function searchText(note: Note) {
  return [note.title, note.content, note.participants, note.date, note.time, note.type]
    .join(' ')
    .toLowerCase();
}

export function filterNotes(notes: Note[], query: string, type: string) {
  const q = query.trim().toLowerCase();
  return notes
    .filter((n) => (!type || n.type === type) && (!q || searchText(n).includes(q)))
    .sort((a, b) => sortKey(b).localeCompare(sortKey(a)));
}

function sortKey(n: Note) {
  const [d, m, y] = n.date.split('.');
  return `${y}${m}${d}${n.time}`;
}
