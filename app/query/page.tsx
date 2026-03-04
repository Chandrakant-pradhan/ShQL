"use client";

import { useState, useEffect } from "react";
import { getDB } from "../lib/pglite";

export default function QueryPage() {
  const [db, setDb] = useState<any>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    async function init() {
      const database = await getDB();
      setDb(database);
    }
    init();
  }, []);

  const runQuery = async () => {
    if (!db) return;

    setError(null);
    setRows([]);

    try {
      const result = await db.query(query);
      setRows(result.rows || []);
    } catch (err: any) {
      setError(err?.message || "Query failed");
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800">Query</h1>
      <p className="text-slate-500 mt-1 mb-6">
        Type and run SQL queries on the database
      </p>

      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm max-w-4xl">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          SQL Query
        </label>

        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          rows={6}
          className="w-full border border-slate-300 rounded-lg p-3 font-mono text-sm
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Enter Query ..."
        />

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
  );
}