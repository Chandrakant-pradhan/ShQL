"use client";

import { PGlite } from "@electric-sql/pglite";

const IDB_PREFIX = "/pglite/";
const DEFAULT_DB = "Default DB";

const instanceMap = new Map<string, PGlite>();
let activeDB: string | null = DEFAULT_DB;
let dbCounter = 0;

export async function fetchDBs(): Promise<string[]> {
  if (!indexedDB.databases) {
    return [DEFAULT_DB];
  }
  const all = await indexedDB.databases();
  const names = all
    .filter((db) => db.name?.startsWith(IDB_PREFIX))
    .map((db) => db.name!.slice(IDB_PREFIX.length));

  if (!names.includes(DEFAULT_DB)) {
    names.push(DEFAULT_DB);
  }

  for (const name of names) {
    const match = name.match(/^db(\d+)$/);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n >= dbCounter) dbCounter = n + 1;
    }
  }

  return names;
}

export function setActiveDB(name: string) {
  activeDB = name;
}

export function getActiveDB(): string | null {
  return activeDB;
}


export async function getDB(): Promise<PGlite> {
  if (!activeDB) throw new Error("No active database selected.");

  if (!instanceMap.has(activeDB)) {
    const instance = await PGlite.create({ dataDir: `idb://${activeDB}` });
    instanceMap.set(activeDB, instance);
  }

  return instanceMap.get(activeDB)!;
}



export async function createDB(file?: File): Promise<string> {
  const name = `db${dbCounter++}`;

  const instance = await PGlite.create({
    dataDir: `idb://${name}`,
    ...(file ? { loadDataDir: file } : {}),
  });

  instanceMap.set(name, instance);
  activeDB = name;

  return name;
}

export async function renameDB(newName: string): Promise<void> {
  if (!activeDB) throw new Error("No active database selected.");
  if (activeDB === newName) return;
  if (activeDB === DEFAULT_DB) {
    console.warn("Cannot rename Default DB");
    return;
  }

  const oldName = activeDB;
  const oldInstance = await getDB();

  const dump = await oldInstance.dumpDataDir("auto");
  await oldInstance.close();
  instanceMap.delete(oldName);

  const newInstance = await PGlite.create({
    dataDir: `idb://${newName}`,
    loadDataDir: dump,
  });
  instanceMap.set(newName, newInstance);

  indexedDB.deleteDatabase(`${IDB_PREFIX}${oldName}`);

  

  await new Promise((r) => setTimeout(r, 60));

  window.location.reload();

  activeDB = newName;
  fetchDBs();
}

export async function deleteDB(): Promise<void> {
  if (!activeDB) throw new Error("No active database selected.");

  if (activeDB === DEFAULT_DB) {
    console.warn("Cannot delete Default DB");
    return;
  }

  const name = activeDB;

  if (instanceMap.has(name)) {
    await instanceMap.get(name)!.close();
    instanceMap.delete(name);
  }

  indexedDB.deleteDatabase(`${IDB_PREFIX}${name}`);
  activeDB = DEFAULT_DB;

  await new Promise((r) => setTimeout(r, 60));

  window.location.reload();
  
  activeDB = DEFAULT_DB;
  fetchDBs();
}