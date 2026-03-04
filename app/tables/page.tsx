"use client";

import { useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import SpreadsheetViewer from "../components/SpreadsheetViewer";

interface Tab {
  name: string;
  rows: string[][];
}

export default function TablesPage() {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [active, setActive] = useState<number>(0);
  const [syncing, setSyncing] = useState<boolean>(false);

  useEffect(() => {
    const stored = sessionStorage.getItem("sheets");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setTabs(parsed);
        }
      } catch {
        setTabs([]);
      }
    }
  }, []);


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
    } catch (err) {
      console.error("Sync failed", err);
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

  return (
    <div className="p-6 h-full flex flex-col">

      <div className="flex items-center justify-between mb-4">

        <div className="flex gap-2 overflow-x-auto scrollbar-thin">
          {tabs.map((tab, i) => (
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

              <X
                size={14}
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(i);
                }}
                className="hover:text-red-300"
              />
            </div>
          ))}
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
    </div>
  );
}