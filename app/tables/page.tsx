"use client";

import { useEffect, useState } from "react";
import { RefreshCw, X, Database,Save, FileDown, CloudUpload} from "lucide-react";
import SpreadsheetViewer from "../components/SpreadsheetViewer";
import { useToast } from "../components/ToastProvider";
import { inferTable } from "../lib/inference";
import { getDB } from "../lib/pglite";
import { removeEmptyTopRows } from "../lib/removeEmptyRows";

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
  const [cleanedRows, setCleanedRows] = useState<string[][]>([]);
  const [loadingSchema, setLoadingSchema] = useState(false);
  const [openMenu, setOpenMenu] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);

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
    const { ddl, rows } = await inferTable(tab.rows, tableName);
    setSchema(ddl);
    setCleanedRows(rows);
    setSchemaKey(tableName);
    setShowSchema(true);
  }

  async function acceptSchema() {
    const activeTab = tabs[active];
    const tableName = getTableName(activeTab);
    setLoadingSchema(true);
    try {
      const db = await getDB();
      await db.exec(`DROP TABLE IF EXISTS "${tableName}"`);
      await db.exec(schema);
      for (const row of cleanedRows.slice(1)) {
        const values = row
          .map(v => {
            if (v === "" || v == null) return "NULL";
            return `'${String(v).replace(/'/g, "''")}'`;
          })
          .join(",");
        await db.exec(`INSERT INTO "${tableName}" VALUES (${values})`);
      }
      setShowSchema(false);
      showToast("Table loaded successfully", "success");
    } catch (err) {
      try {
        const db = await getDB();
        await db.exec(`DROP TABLE IF EXISTS "${tableName}"`);
      } catch {}
      showToast("Failed to load table into database", "error");
    } finally {
      setLoadingSchema(false);
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
          rows: removeEmptyTopRows(range.values || []),
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

  function exportCSV(tab: Tab) {
    const csvContent = tab.rows
      .map(row =>
        row
          .map(cell =>
            `"${String(cell ?? "").replace(/"/g, '""')}"`
          )
          .join(",")
      )
      .join("\n");
  
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  
    const url = URL.createObjectURL(blob);
  
    const link = document.createElement("a");
    link.href = url;
    link.download = `${getTableName(tab)}.csv`;
  
    document.body.appendChild(link);
    link.click();
  
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  
    showToast("CSV exported successfully", "success");
  }

  async function saveToDrive(tab: Tab) {
    setExporting(true); 
  
    const token = sessionStorage.getItem("accessToken");
  
    if (!token) {
      setExporting(false); 
      showToast("Google authentication missing", "error");
      return;
    }
  
    try {
      const folderName = "DBVisualizer";
  
      const search = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
  
      const searchData = await search.json();
      let folderId = searchData.files?.[0]?.id;
  
      if (!folderId) {
        const createFolder = await fetch(
          "https://www.googleapis.com/drive/v3/files",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              name: folderName,
              mimeType: "application/vnd.google-apps.folder"
            })
          }
        );
  
        const folder = await createFolder.json();
        folderId = folder.id;
      }
  
      const csvContent = tab.rows
        .map(row =>
          row
            .map(cell =>
              `"${String(cell ?? "").replace(/"/g, '""')}"`
            )
            .join(",")
        )
        .join("\n");
  
      const metadata = {
        name: `${getTableName(tab)}.csv`,
        parents: [folderId]
      };
  
      const form = new FormData();
      form.append(
        "metadata",
        new Blob([JSON.stringify(metadata)], { type: "application/json" })
      );
      form.append(
        "file",
        new Blob([csvContent], { type: "text/csv" })
      );
  
      const upload = await fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`
          },
          body: form
        }
      );
  
      const file = await upload.json();
  
      await fetch(
        `https://www.googleapis.com/drive/v3/files/${file.id}/permissions`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            role: "reader",
            type: "anyone"
          })
        }
      );
  
      const link = `https://drive.google.com/drive/folders/${folderId}`;
      await navigator.clipboard.writeText(link);
  
      showToast("Saved to Google Drive. Link copied!", "success");
    } catch (err) {
      showToast("Failed to save to Google Drive", "error");
    } finally {
      setExporting(false);
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

  return (
    <div className="p-6 h-full flex flex-col">

      <div className="flex items-center justify-between mb-4">

        <div className="flex gap-2 overflow-x-auto scrollbar-thin">
          {tabs.map((tab, i) => {
            const key = getTableName(tab);
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
                <span className="truncate max-w-[180px]">
                  {tab.name}
                </span>
                <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openSchema(tab);
                      }}
                      className="flex items-center justify-center w-7 h-7 rounded-md
                                bg-white/30 hover:bg-green-600 text-white
                                transition cursor-pointer"
                    >
                      <Database size={14} />
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenu(openMenu === i ? null : i);
                      }}
                      className="flex items-center justify-center w-7 h-7 rounded-md
                                bg-white/30 hover:bg-yellow-500 text-white 
                                transition cursor-pointer"
                    >
                      <Save size={14} />
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        closeTab(i);
                      }}
                      className="flex items-center justify-center w-7 h-7 rounded-md
                                bg-white/30 hover:bg-red-600 text-white
                                transition cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  </div>
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
                disabled={loadingSchema}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 cursor-pointer flex items-center gap-2"
              >
                {loadingSchema && (
                  <RefreshCw size={16} className="animate-spin" />
                )}
                {loadingSchema ? "Loading..." : "Load in DB"}
              </button>

            </div>

          </div>

        </div>
      )}

      {openMenu !== null && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
          onClick={() => setOpenMenu(null)}
        >
          <div
            className="bg-white w-[420px] rounded-xl shadow-lg border border-slate-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >

            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-800">
                Save Table
              </h2>
              <p className="text-xs text-slate-400 mt-1 truncate">
                {tabs[openMenu]?.name}
              </p>
            </div>

            <div className="p-6 space-y-3">
              <button
                onClick={() => {
                  exportCSV(tabs[openMenu]);
                  setOpenMenu(null);
                }}
                className="
                  w-full flex items-center gap-3
                  px-4 py-3 rounded-lg
                  border border-slate-200
                  hover:bg-slate-50 transition
                "
              >
                <div className="p-2 bg-slate-100 rounded-md">
                  <FileDown size={16} className="text-slate-600" />
                </div>

                <div className="text-left">
                  <p className="text-sm font-medium text-slate-700">
                    Export as CSV
                  </p>
                  <p className="text-xs text-slate-400">
                    Download the table locally
                  </p>
                </div>
              </button>

              <button
                onClick={() => {
                  saveToDrive(tabs[openMenu]);
                  setOpenMenu(null);
                }}
                className="
                  w-full flex items-center gap-3
                  px-4 py-3 rounded-lg
                  border border-slate-200
                  hover:bg-slate-50 transition
                "
              >
                <div className="p-2 bg-slate-100 rounded-md">
                  <CloudUpload size={16} className="text-slate-600" />
                </div>

                <div className="text-left">
                  <p className="text-sm font-medium text-slate-700">
                    Save to Google Drive
                  </p>
                  <p className="text-xs text-slate-400">
                    Upload CSV directly to Drive
                  </p>
                </div>
              </button>

            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setOpenMenu(null)}
                className="
                  px-4 py-2 text-sm
                  bg-gray-200 rounded
                  hover:bg-gray-300
                  transition
                "
              >
                Cancel
              </button>
            </div>

          </div>
        </div>
      )}

      {exporting && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30">
          
          <div className="flex flex-col items-center gap-3">
            
            <div className="w-10 h-10 border-4 border-slate-300 border-t-blue-600 rounded-full animate-spin"></div>

            <p className="text-sm text-white font-medium">
              Exporting to Drive
            </p>

          </div>

        </div>
      )}

    </div>
  );
}