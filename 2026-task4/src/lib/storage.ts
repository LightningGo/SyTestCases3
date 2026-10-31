import * as SQLite from 'expo-sqlite';
import { Directory, File, Paths } from 'expo-file-system';

import { filterNotes, newId, Note, NotesRepo, searchText, StorageMode } from './notes';

// SQLite

let dbReady: Promise<SQLite.SQLiteDatabase> | null = null;

async function getDb() {
  if (!dbReady) {
    dbReady = (async () => {
      const db = await SQLite.openDatabaseAsync('notes.db');
      await db.execAsync(`CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      title TEXT, date TEXT, time TEXT, type TEXT,
      participants TEXT, content TEXT, updatedAt INTEGER,
      search TEXT
      )`);
      return db;
    })().catch((error) => {
      dbReady = null;
      throw error;
    });
  }
  return dbReady;
}

const sqliteRepo: NotesRepo = {
  async list(query, type) {
    const db = await getDb();
    const rows = await db.getAllAsync<Note>(
      `SELECT id, title, date, time, type, participants, content, updatedAt FROM notes
       WHERE instr(search, ?) > 0 AND (? = '' OR type = ?)
       ORDER BY substr(date, 7, 4) || substr(date, 4, 2) || substr(date, 1, 2) || time DESC`,
      [query.trim().toLowerCase(), type, type]
    );
    return rows;
  },
  async get(id) {
    const db = await getDb();
    return db.getFirstAsync<Note>('SELECT * FROM notes WHERE id = ?', [id]);
  },
  async save(n) {
    const db = await getDb();
    await db.runAsync(
      `INSERT OR REPLACE INTO notes (id, title, date, time, type, participants, content, updatedAt, search)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [n.id, n.title, n.date, n.time, n.type, n.participants, n.content, n.updatedAt, searchText(n)]
    );
  },
  async remove(id) {
    const db = await getDb();
    await db.runAsync('DELETE FROM notes WHERE id = ?', [id]);
  },
};

// В папке notes у каждой заметки свой JSON.

function notesDir() {
  const dir = new Directory(Paths.document, 'notes');
  if (!dir.exists) dir.create({ idempotent: true });
  return dir;
}

const filesRepo: NotesRepo = {
  async list(query, type) {
    const notes: Note[] = [];
    for (const item of notesDir().list()) {
      if (item instanceof File && item.name.endsWith('.json')) {
        notes.push(JSON.parse(await item.text()));
      }
    }
    return filterNotes(notes, query, type);
  },
  async get(id) {
    const file = new File(notesDir(), `${id}.json`);
    return file.exists ? JSON.parse(await file.text()) : null;
  },
  async save(note) {
    const dir = notesDir();
    const file = new File(dir, `${note.id}.json`);
    const tempName = `${note.id}-${newId()}.tmp`;
    const temp = new File(dir, tempName);
    try {
      temp.create();
      temp.write(JSON.stringify(note, null, 2));
      // Сначала дописываем новый файл, потом заменяем старый.
      await temp.move(file, { overwrite: true });
    } finally {
      const leftover = new File(dir, tempName);
      try { if (leftover.exists) leftover.delete(); } catch { /* Если .tmp остался, список его пропустит. */ }
    }
  },
  async remove(id) {
    const file = new File(notesDir(), `${id}.json`);
    if (file.exists) file.delete();
  },
};

export function getRepo(mode: StorageMode) {
  return mode === 'sqlite' ? sqliteRepo : filesRepo;
}

const settingsFile = () => new File(Paths.document, 'settings.json');

export async function loadMode(): Promise<StorageMode> {
  const file = settingsFile();
  if (!file.exists) return 'sqlite';
  const text = await file.text();
  try {
    return JSON.parse(text)?.mode === 'files' ? 'files' : 'sqlite';
  } catch {
    // Настройки сломались, но сами заметки не трогаем.
    return 'sqlite';
  }
}

export async function saveMode(mode: StorageMode) {
  const file = settingsFile();
  if (!file.exists) file.create();
  file.write(JSON.stringify({ mode }));
}

export const STORAGE_INFO = {
  sqlite: 'Заметки хранятся в локальной базе данных SQLite (файл notes.db).',
  files: 'Каждая заметка хранится отдельным JSON-файлом в папке notes на устройстве.',
};
