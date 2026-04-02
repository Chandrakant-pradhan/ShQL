"use client";

import { useState } from "react";
import { getDB, createDB } from "../lib/pglite";
import { useToast } from "../components/ToastProvider";

export default function BackupAndRestore() {
  const [loading, setLoading] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const { showToast } = useToast();

  async function handleExport() {
    try {
      setLoading("export");

      const db = await getDB();
      const blob = await db.dumpDataDir("gzip");

      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "pglite-backup.tar.gz";
      a.click();

      URL.revokeObjectURL(url);

    } catch {
      showToast("Backup failed", "error");
    } finally {
      setLoading(null);
    }
  }

  async function handleImport(file: File) {
    try {
      setLoading("import");
      setSuccessMsg(null);

      const name = await createDB(file);

      setSuccessMsg(`File loaded in new database "${name}" successfully`);
    } catch {
      showToast("Restore failed", "error");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="p-6">
      <div className="max-w-5xl space-y-6">

        <h1 className="text-2xl font-bold text-slate-800">
          Database Backup & Restore
        </h1>

        <div className="grid md:grid-cols-2 gap-6">

          <div className="border rounded-xl p-5 shadow-sm space-y-4 bg-white">
            <h2 className="text-lg font-semibold text-slate-700">
              Export Database
            </h2>

            <p className="text-sm text-slate-500">
              Download your current database as a backup file.
            </p>

            <button
              onClick={handleExport}
              disabled={loading !== null}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading === "export" ? "Exporting..." : "Download Backup"}
            </button>
          </div>

          <div className="border rounded-xl p-5 shadow-sm space-y-4 bg-white">
            <h2 className="text-lg font-semibold text-slate-700">
              Import Database
            </h2>

            <p className="text-sm text-slate-500">
              Upload a backup file to create a new database.
            </p>

            <div className="flex items-center gap-3">
              <label className="px-3 py-2 bg-slate-100 border rounded cursor-pointer hover:bg-slate-200 text-sm">
                Upload File
                <input
                  type="file"
                  accept=".tar.gz"
                  disabled={loading !== null}
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImport(file);
                  }}
                />
              </label>

              <span className="text-sm text-slate-500">
                .tar.gz only
              </span>
            </div>

            {loading === "import" && (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                Importing database...
              </div>
            )}

            {successMsg && (
              <div className="text-sm text-green-600 font-medium">
                {successMsg}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}