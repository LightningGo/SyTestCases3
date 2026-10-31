const test = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { DatabaseSync } = require('node:sqlite');

function load(name, deps = {}) {
  const source = fs.readFileSync(path.join(__dirname, '../src/lib', name + '.ts'), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const result = { exports: {} };
  new Function('require', 'module', 'exports', code)((key) => {
    if (key in deps) return deps[key];
    throw new Error('Unexpected import: ' + key);
  }, result, result.exports);
  return result.exports;
}
const notes = load('notes');
test('calendar rejects year zero and impossible days', () => {
  assert.equal(notes.isValidDate('01.01.0000'), false);
  assert.equal(notes.isValidDate('29.02.2025'), false);
  assert.equal(notes.isValidDate('31.04.2026'), false);
  assert.equal(notes.isValidDate('29.02.2024'), true);
});
test('time validates boundaries', () => {
  for (const value of ['24:00', '12:60', '-1:00', '9:00']) assert.equal(notes.isValidTime(value), false);
  assert.equal(notes.isValidTime('23:59'), true);
});
test('search includes participants, date and time, sorted newest first', () => {
  const rows = [
    {id:'1',title:'План',content:'',participants:'Анна',date:'31.12.2025',time:'10:00',type:'Совещание'},
    {id:'2',title:'План',content:'',participants:'Анна',date:'01.01.2026',time:'11:00',type:'Другое'},
  ];
  assert.deepEqual(notes.filterNotes(rows, ' АННА ', '').map(n=>n.id), ['2','1']);
  assert.deepEqual(notes.filterNotes(rows, '10:00', '').map(n=>n.id), ['1']);
  assert.deepEqual(notes.filterNotes(rows, '01.01', 'Другое').map(n=>n.id), ['2']);
});
test('unknown saved mode falls back to sqlite', async () => {
  global.localStorage = { getItem: () => 'broken' };
  const storage = load('storage.web', {'./notes':notes});
  assert.equal(await storage.loadMode(), 'sqlite');
});
test('web repos persist edits and keep storage modes separate', async () => {
  const data = new Map();
  global.localStorage = { getItem:k=>data.get(k)??null, setItem:(k,v)=>data.set(k,v) };
  const storage = load('storage.web', {'./notes':notes});
  const repo = storage.getRepo('files');
  const note = {id:'x',title:'Встреча',date:'31.10.2026',time:'11:00',type:'Другое',participants:'',content:'Решение',updatedAt:1};
  await repo.save(note);
  assert.equal((await repo.get('x')).title,'Встреча');
  await repo.save({...note,title:'Изменено'});
  assert.equal((await repo.list('', '')).length,1);
  const reloaded = load('storage.web', {'./notes':notes});
  assert.equal((await reloaded.getRepo('files').get('x')).title,'Изменено');
  assert.equal(await reloaded.getRepo('sqlite').get('x'),null);
  await repo.remove('x');
  assert.deepEqual(await repo.list('', ''),[]);
});

test('native sqlite search treats percent and underscore literally', async () => {
  const db = new DatabaseSync(':memory:');
  const storage = load('storage', {
    './notes': notes,
    'expo-file-system': {},
    'expo-sqlite': { openDatabaseAsync: async () => ({
      execAsync: async sql => db.exec(sql),
      runAsync: async (sql, args) => db.prepare(sql).run(...args),
      getAllAsync: async (sql, args) => db.prepare(sql).all(...args),
      getFirstAsync: async (sql, args) => db.prepare(sql).get(...args) ?? null,
    }) },
  });
  const repo = storage.getRepo('sqlite');
  const note = {id:'1',title:'Скидка 10%',date:'31.10.2026',time:'12:00',type:'Другое',participants:'',content:'',updatedAt:1};
  await repo.save(note);
  await repo.save({...note,id:'2',title:'План_отдела'});
  assert.deepEqual((await repo.list('%','')).map(n=>n.id), ['1']);
  assert.deepEqual((await repo.list('_','')).map(n=>n.id), ['2']);
  assert.equal((await repo.get('1')).title,'Скидка 10%');
  await repo.remove('1');
  assert.equal(await repo.get('1'),null);
  db.close();
});

test('concurrent database calls wait for table initialization', async () => {
  let opened=0, ready=false;
  const storage=load('storage', {
    './notes':notes, 'expo-file-system':{},
    'expo-sqlite': {openDatabaseAsync:async()=>{
      opened++;
      return {execAsync:async()=>{await new Promise(r=>setTimeout(r,10));ready=true;},
        getAllAsync:async()=>{assert.equal(ready,true);return [];}};
    }},
  });
  const repo=storage.getRepo('sqlite');
  await Promise.all([repo.list('',''),repo.list('','')]);
  assert.equal(opened,1);
});
test('invalid native settings do not prevent app startup', async () => {
  for(const value of ['{bad json','{"mode":"broken"}']){
    class File {exists=true;async text(){return value;}}
    const storage=load('storage',{'./notes':notes,'expo-sqlite':{},'expo-file-system':{File,Paths:{document:'unused'}}});
    assert.equal(await storage.loadMode(),'sqlite');
  }
});

test('failed file write preserves existing notes and creates no broken json', async () => {
  const folder=fs.mkdtempSync(path.join(__dirname,'file-test-'));
  let failWrite=false;
  class Directory {
    constructor(...parts){this.uri=path.join(...parts.map(x=>x.uri??x));}
    get exists(){return fs.existsSync(this.uri);}
    create(){fs.mkdirSync(this.uri,{recursive:true});}
    list(){return fs.readdirSync(this.uri).map(n=>new File(this,n));}
  }
  class File {
    constructor(...parts){this.uri=path.join(...parts.map(x=>x.uri??x));}
    get name(){return path.basename(this.uri);}
    get exists(){return fs.existsSync(this.uri);}
    create(){fs.writeFileSync(this.uri,'',{flag:'wx'});}
    write(text){if(failWrite){fs.writeFileSync(this.uri,'');throw new Error('Disk full');}fs.writeFileSync(this.uri,text);}
    async text(){return fs.readFileSync(this.uri,'utf8');}
    delete(){fs.unlinkSync(this.uri);}
    async move(dest){fs.renameSync(this.uri,dest.uri);this.uri=dest.uri;}
  }
  try{
    const storage=load('storage',{'./notes':notes,'expo-sqlite':{},'expo-file-system':{File,Directory,Paths:{document:folder}}});
    const repo=storage.getRepo('files');
    const n={id:'1',title:'Исходная',date:'31.10.2026',time:'12:00',type:'Другое',participants:'',content:'',updatedAt:1};
    await repo.save(n);failWrite=true;
    await assert.rejects(repo.save({...n,title:'Не сохранилась'}));
    assert.equal((await repo.get('1')).title,'Исходная');
    await assert.rejects(repo.save({...n,id:'2'}));
    assert.deepEqual((await repo.list('','')).map(n=>n.id),['1']);
  }finally{fs.rmSync(folder,{recursive:true,force:true});}
});
