"use client";

import { useState, useEffect } from "react";
import { useGoogleLogin } from "@react-oauth/google";
import { LogOut, Cloud, FileSpreadsheet } from "lucide-react";

export default function ConnectPage() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  /* =========================
     Google Login
  ========================= */
  const login = useGoogleLogin({
    scope:
      "https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/spreadsheets",
    onSuccess: (tokenResponse) => {
      const token = tokenResponse.access_token;
      setAccessToken(token);
      sessionStorage.setItem("accessToken", token);
    },
    onError: () => alert("Login Failed"),
  });

  const logout = () => {
    setAccessToken(null);
    setFiles([]);
    sessionStorage.removeItem("accessToken");
  };

  /* =========================
     Restore token on refresh
  ========================= */
  useEffect(() => {
    const savedToken = sessionStorage.getItem("accessToken");
    if (savedToken) {
      setAccessToken(savedToken);
    }
  }, []);

  /* =========================
     Fetch Google Sheets
  ========================= */
  async function fetchDriveFiles(token: string) {
    setLoading(true);

    try {
      const res = await fetch(
        "https://www.googleapis.com/drive/v3/files?q=mimeType='application/vnd.google-apps.spreadsheet'&fields=files(id,name)",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await res.json();
      setFiles(data.files || []);
    } catch (err) {
      console.error("Failed to fetch files:", err);
    }

    setLoading(false);
  }

  useEffect(() => {
    if (accessToken) {
      fetchDriveFiles(accessToken);
    }
  }, [accessToken]);

  return (
    <div className="p-8 max-w-4xl">
      {/* Header */}
      <h1 className="text-2xl font-bold mb-8 flex items-center gap-2">
        <Cloud className="w-6 h-6 text-blue-600" />
        Google Drive
      </h1>

      {!accessToken ? (
        /* =========================
           Login Card
        ========================= */
        <div className="bg-white p-8 rounded-2xl shadow-sm border max-w-md">
          <p className="text-slate-600 mb-6">
            Connect your Google Drive to browse your Google Sheets.
          </p>

          <button
            onClick={() => login()}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-lg 
                       hover:bg-blue-700 transition font-medium"
          >
            Sign in with Google
          </button>
        </div>
      ) : (
        /* =========================
           Sheets Section
        ========================= */
        <div className="bg-white p-6 rounded-2xl shadow-sm border">
          {/* Section Header */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold">Google Sheets</h2>

            <button
              onClick={logout}
              className="flex items-center gap-2 text-red-500 hover:text-red-700 text-sm"
            >
              <LogOut className="w-4 h-4" />
              Disconnect
            </button>
          </div>

          {/* Loading Skeleton */}
          {loading && (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="h-14 bg-slate-200 rounded-xl animate-pulse"
                />
              ))}
            </div>
          )}

          {/* No Files */}
          {!loading && files.length === 0 && (
            <p className="text-slate-400">No sheets found</p>
          )}

          {/* Files Display */}
          {!loading && files.length > 0 && (
            <div className="max-h-[420px] overflow-y-auto pr-2 space-y-3">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="group flex items-center gap-4 p-4 rounded-xl
                             border border-slate-200 bg-slate-50
                             hover:bg-white hover:border-blue-400
                             hover:shadow-md hover:-translate-y-1
                             transition-all duration-200 cursor-pointer"
                >
                  <div className="p-2 bg-green-100 rounded-lg">
                    <FileSpreadsheet className="w-5 h-5 text-green-600" />
                  </div>

                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-800 truncate">
                      {file.name}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}