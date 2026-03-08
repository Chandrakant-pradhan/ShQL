"use client";

import { useEffect, useState } from "react";
import { RefreshCw, X, Wand2 } from "lucide-react";
import SpreadsheetViewer from "../components/SpreadsheetViewer";
import { useToast } from "../components/ToastProvider";
import { inferTable } from "../lib/inference";

interface Tab {
  name: string;
  rows: string[][];
}

export default function TablesPage() {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [active, setActive] = useState<number>(0);
  const [syncing, setSyncing] = useState<boolean>(false);
  const { showToast } = useToast();
  const [showSchema, setShowSchema] = useState(false);
  const [schema, setSchema] = useState("");
  const [schemaKey, setSchemaKey] = useState("");

  useEffect(() => {
    const stored = sessionStorage.getItem("sheets");
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) setTabs(parsed);
    } catch {
      setTabs([]);
    }
  }, []);

  function getInferredSheets() {
    const stored = sessionStorage.getItem("inferredSheets");
    return stored ? JSON.parse(stored) : {};
  }

  function saveSchema(key: string, schema: string) {
    const inferred = getInferredSheets();
    inferred[key] = schema;
    sessionStorage.setItem(
      "inferredSheets",
      JSON.stringify(inferred)
    );
  }

  function getTableName(tab: any): string {
    const [fileName, sheetNameRaw] = tab.name.split(" - ");
    const sheetName = sheetNameRaw || "Sheet1";
    const tableName = `${fileName}_${sheetName}`
      .replace(/\s+/g, "_")
      .replace(/[^\w]/g, "")
      .toLowerCase();
      
    return tableName;
  }

  async function openSchema(tab: Tab) {
    const tableName = getTableName(tab);
    let schemaText = await inferTable(tab.rows, tableName);
    setSchema(schemaText);
    setSchemaKey(tableName);
    setShowSchema(true);
  }

  async function acceptSchema() {
    const activeTab = tabs[active];
    const tableName = getTableName(activeTab);
    try {
      // const db = await getDB();
      // await db.exec(schema);
      // for (const row of activeTab.rows.slice(1)) {
      //   const values = row.map(v => `'${v}'`).join(",");
      //   await db.exec(`INSERT INTO table_name VALUES (${values})`);
      // }
      saveSchema(schemaKey, schema);
      setShowSchema(false);
      showToast("Schema accepted", "success");
    } catch {
      // const db = await getDB();
      // await db.exec(`DROP TABLE IF EXISTS "${tableName}"`);
      showToast("Failed to load table into database", "error");
    }
  }

  async function syncSheets() {
    const token = sessionStorage.getItem("accessToken");
    const source = sessionStorage.getItem("sheetSource");

    if (!token || !source) return;

    setSyncing(true);

    const { fileId, fileName } = JSON.parse(source);

    try {
      const metaRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${fileId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const meta = await metaRes.json();
      const sheetNames = meta.sheets.map(
        (s: any) => s.properties.title
      );

      const ranges = sheetNames
        .map((name: string) => `ranges=${encodeURIComponent(name)}`)
        .join("&");

      const dataRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${fileId}/values:batchGet?${ranges}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const data = await dataRes.json();

      const results: Tab[] = data.valueRanges.map(
        (range: any, i: number) => ({
          name: `${fileName} - ${sheetNames[i]}`,
          rows: range.values || [],
        })
      );

      sessionStorage.setItem("sheets", JSON.stringify(results));
      setTabs(results);
    } catch {
      showToast("Error syncing data", "error");
    } finally {
      setSyncing(false);
    }
  }

  function closeTab(index: number) {
    const updated = tabs.filter((_, i) => i !== index);
    setTabs(updated);
    sessionStorage.setItem("sheets", JSON.stringify(updated));
    setActive(Math.max(0, index - 1));
  }

  if (!tabs.length) {
    return (
      <div className="flex items-center justify-center h-[60vh] text-slate-400 text-lg">
        No tables loaded
      </div>
    );
  }

  const activeTab = tabs[Math.min(active, tabs.length - 1)];
  const inferred = getInferredSheets();
  const source = sessionStorage.getItem("sheetSource");
  const fileId = source ? JSON.parse(source).fileId : "";

  return (
    <div className="p-6 h-full flex flex-col">

      <div className="flex items-center justify-between mb-4">

        <div className="flex gap-2 overflow-x-auto scrollbar-thin">
          {tabs.map((tab, i) => {
            const key = getTableName(tab);
            const hasSchema = inferred[key];
            return (
              <div
                key={i}
                onClick={() => setActive(i)}
                className={`
                  flex items-center gap-2 px-4 py-2 text-sm rounded-lg
                  cursor-pointer whitespace-nowrap transition-all
                  ${
                    active === i
                      ? "bg-blue-600 text-white shadow-md"
                      : "bg-slate-200 hover:bg-slate-300 text-slate-700"
                  }
                `}
              >
                <div
                  className={`w-2 h-2 rounded-full ${
                    hasSchema ? "bg-green-500" : "bg-red-500"
                  }`}
                />
                <span className="truncate max-w-[180px]">
                  {tab.name}
                </span>
                <Wand2
                  size={16}
                  className="cursor-pointer opacity-70 hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    openSchema(tab);
                  }}
                />

                <X
                  size={14}
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(i);
                  }}
                  className="hover:text-red-300"
                />
              </div>
            );
          })}
        </div>

        <button
          onClick={syncSheets}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2 rounded-lg 
                     bg-blue-600 text-white hover:bg-blue-700
                     disabled:opacity-50 transition"
        >
          <RefreshCw
            size={16}
            className={syncing ? "animate-spin" : ""}
          />
          {syncing ? "Syncing..." : "Sync"}
        </button>
      </div>

      <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <SpreadsheetViewer rows={activeTab.rows} />
      </div>
      
      {showSchema && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center">

          <div className="bg-white w-[700px] max-h-[80vh] overflow-y-auto rounded-xl shadow-lg p-6">

            <h2 className="text-lg font-semibold mb-4">
              SQL Schema
            </h2>

            <textarea
              value={schema}
              onChange={(e) => setSchema(e.target.value)}
              className="w-full h-64 font-mono text-sm border p-3 rounded resize-none"
            />

            <div className="flex justify-end gap-3 mt-4">

              <button
                onClick={() => setShowSchema(false)}
                className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 cursor-pointer"
              >
                Cancel
              </button>

              <button
                onClick={acceptSchema}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer"
              >
                Accept
              </button>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}