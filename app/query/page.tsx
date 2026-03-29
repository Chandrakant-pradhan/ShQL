"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Table , Search, Trash2} from "lucide-react";
import { getDB } from "../lib/pglite";
import { useToast } from "../components/ToastProvider";
import Editor from "@monaco-editor/react";  

const SQL_KEYWORDS = [
  "SELECT","FROM","WHERE","INSERT","INTO","VALUES","UPDATE","SET",
  "DELETE","JOIN","LEFT JOIN","RIGHT JOIN","INNER JOIN",
  "GROUP BY","ORDER BY","LIMIT","OFFSET","AND","OR","NOT","NULL",
  "CREATE","TABLE","DROP","ALTER"
];

export default function QueryPage() {
  const [db, setDb] = useState<any>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [tables, setTables] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [corpus, setCorpus] = useState<string[]>([]);

  const monacoRef = useRef<any>(null);
  const providerRef = useRef<any>(null);

  const router = useRouter();
  const { showToast } = useToast();

  async function loadTables(database: any) {
    try {
      const result = await database.query(`
        SELECT tablename
        FROM pg_catalog.pg_tables
        WHERE schemaname='public'
        ORDER BY tablename
      `);

      const names = result.rows.map((r: any) => r.tablename);
      setTables(names);

      let allColumns: string[] = [];

      for (const table of names) {
        const colRes = await database.query(`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_name = '${table}'
        `);

        const cols = colRes.rows.map((r: any) => r.column_name);
        allColumns.push(...cols);
      }

      const fullCorpus = [
        ...SQL_KEYWORDS,
        ...names,
        ...allColumns,
      ];

      setCorpus(Array.from(new Set(fullCorpus)));

    } catch {
      showToast("Failed loading tables", "error");
    }
  }

  async function loadColumns(table: string) {
    if (!db) return;
  
    try {
      const result = await db.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = '${table}'
        ORDER BY ordinal_position
      `);
  
      const cols = result.rows.map((r: any) => r.column_name);
      setColumns(cols);
      setSelectedTable(table);
  
    } catch {
      showToast("Failed loading columns", "error");
    }
  }

  async function dropTable(tableName: string) {
    if (!db) return;
  
    try {
      await db.exec(`DROP TABLE IF EXISTS "${tableName}"`);
      showToast(`Table ${tableName} removed`, "success");
      await loadTables(db);
    } catch {
      showToast("Failed to drop table", "error");
    }
  }

  useEffect(() => {
    async function init() {
      const database = await getDB();
      setDb(database);
      await loadTables(database);
    }
    init();
  }, []);

  useEffect(() => {
    if (!monacoRef.current || corpus.length === 0) return;

    const monaco = monacoRef.current;

    if (providerRef.current) {
      providerRef.current.dispose();
    }

    providerRef.current =
      monaco.languages.registerCompletionItemProvider("sql", {
        triggerCharacters: [".", " ", "(", ","],

        provideCompletionItems: (model: any, position: any) => {
          const word = model.getWordUntilPosition(position);

          const suggestions = corpus.map((item) => ({
            label: item,
            kind: SQL_KEYWORDS.includes(item)
              ? monaco.languages.CompletionItemKind.Keyword
              : tables.includes(item)
              ? monaco.languages.CompletionItemKind.Class
              : monaco.languages.CompletionItemKind.Field,
            insertText: item,
            range: {
              startLineNumber: position.lineNumber,
              endLineNumber: position.lineNumber,
              startColumn: word.startColumn,
              endColumn: word.endColumn,
            },
          }));

          return { suggestions };
        },
      });

  }, [corpus, tables]);

  const runQuery = async () => {
    if (!db) return;

    setError(null);

    try {
      const result = await db.query(query);
      await loadTables(db);

      const resultRows = result.rows || [];

      if (resultRows.length === 0) {
        showToast("Query returned no rows", "info");
        return;
      }

      const headers = Object.keys(resultRows[0]);

      const rows: string[][] = [
        headers,
        ...resultRows.map((r: any) =>
          headers.map((h) => String(r[h] ?? ""))
        ),
      ];

      const queryTab = {
        name: "query_result",
        rows,
      };

      const existingRaw = sessionStorage.getItem("sheets");
      const existing = existingRaw ? JSON.parse(existingRaw) : [];

      const filtered = existing.filter(
        (t: any) => t.name !== "query_result"
      );

      const updated = [...filtered, queryTab];

      sessionStorage.setItem("sheets", JSON.stringify(updated));
      router.push("/tables");

    } catch (err: any) {
      setError(err?.message || "Query failed");
      showToast("Query execution failed", "error");
    }
  };

  const filteredTables = tables.filter((t) =>
    t.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex gap-6 items-start">

      <div className="max-w-4xl w-full">

        <h1 className="text-2xl font-bold text-slate-800">
          Query
        </h1>

        <p className="text-slate-500 mt-1 mb-6">
          Type and run SQL queries on the database
        </p>

        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            SQL Query
          </label>

          <div className="border border-slate-300 rounded-lg overflow-hidden">
            <Editor
              height="200px"
              defaultLanguage="sql"
              value={query}
              onChange={(val) => 
                setQuery(val || "")}
              onMount={(editor, monaco) => {
                monacoRef.current = monaco;
              }}
              theme="light"
              options={{
                fontSize: 14,
                minimap: { enabled: false },
                wordWrap: "on",
                scrollBeyondLastLine: false,
                quickSuggestions: true,
                suggestOnTriggerCharacters: true,
                padding: {
                  top: 10,
                },
              }}
            />
          </div>

          <div className="flex justify-end mt-4">
            <button
              onClick={runQuery}
              disabled={!db}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg
                         hover:bg-blue-700 transition disabled:opacity-50"
            >
              Run Query
            </button>
          </div>

          {error && (
            <p className="mt-3 text-sm text-red-600">
              {error}
            </p>
          )}
        </div>
      </div>

      <div className="flex-1 mt-12">

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">

          <h2 className="text-lg font-semibold text-slate-800 mb-4">
            Relations
          </h2>

          <div className="relative mb-5">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search tables..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="max-h-[420px] overflow-y-auto pr-2 space-y-3">

            {filteredTables.length === 0 && (
              <p className="text-slate-400 text-sm">
                No tables found
              </p>
            )}

            {filteredTables.map((t) => (
              <div
                key={t}
                onClick={() => {
                  setQuery(`SELECT * FROM ${t} LIMIT 100;`)
                  loadColumns(t);
                }}
                className="
                  group flex items-center gap-4 p-4 rounded-xl
                  border border-slate-200 bg-slate-50
                  hover:bg-white hover:border-blue-400
                  hover:shadow-md hover:-translate-y-0.5
                  transition-all duration-200 cursor-pointer
                "
              >

                <div className="p-2 bg-blue-100 rounded-lg">
                  <Table className="w-5 h-5 text-blue-600" />
                </div>

                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-800 truncate">
                    {t}
                  </p>

                  {selectedTable === t && columns.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {columns.map((col) => (
                        <span
                          key={col}
                          className="text-xs px-3 py-1 bg-blue-100 text-blue-700 rounded-full font-medium"
                        >
                          {col}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    dropTable(t);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-2 rounded-md hover:bg-red-100 transition"
                >
                  <Trash2 className="w-4 h-4 text-red-500" />
                </button>
                
              </div>
            ))}

          </div>

        </div>

      </div>
    </div>
  );
}