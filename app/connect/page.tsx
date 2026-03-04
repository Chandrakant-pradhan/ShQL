"use client";

import { useState, useEffect } from "react";
import { useGoogleLogin } from "@react-oauth/google";
import { LogOut, Cloud, FileSpreadsheet } from "lucide-react";
import { useRouter } from "next/navigation";

export default function ConnectPage() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

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

  useEffect(() => {
    const savedToken = sessionStorage.getItem("accessToken");
    if (savedToken) setAccessToken(savedToken);
  }, []);

  async function fetchDriveFiles(token: string) {
    setLoading(true);
    try {
      const res = await fetch(
        "https://www.googleapis.com/drive/v3/files?q=mimeType='application/vnd.google-apps.spreadsheet'&fields=files(id,name)",
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const data = await res.json();
      setFiles(data.files || []);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (accessToken) fetchDriveFiles(accessToken);
  }, [accessToken]);

  async function openSheet(file: any) {
    try {
      setLoading(true);

      const metaRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${file.id}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
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
        `https://sheets.googleapis.com/v4/spreadsheets/${file.id}/values:batchGet?${ranges}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      const data = await dataRes.json();

      const results = data.valueRanges.map(
        (range: any, i: number) => ({
          name: `${file.name} - ${sheetNames[i]}`,
          rows: range.values || [],
        })
      );

      sessionStorage.setItem(
        "sheetSource",
        JSON.stringify({
          fileId: file.id,
          fileName: file.name,
        })
      );

      sessionStorage.setItem("sheets", JSON.stringify(results));

      router.push("/tables");

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-bold mb-8 flex items-center gap-2">
        <Cloud className="w-6 h-6 text-blue-600" />
        Google Drive
      </h1>
  
      {!accessToken ? (
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
        <div className="bg-white p-6 rounded-2xl shadow-sm border">
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
          {loading && (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="h-14 bg-slate-200 rounded-xl animate-pulse"
                />
              ))}
            </div>
          )}
          {!loading && files.length === 0 && (
            <p className="text-slate-400">No spreadsheets found</p>
          )}
          {!loading && files.length > 0 && (
            <div className="max-h-[420px] overflow-y-auto pr-2 space-y-3">
              {files.map((file) => (
                <div
                  key={file.id}
                  onClick={() => openSheet(file)}
                  className="
                    group flex items-center gap-4 p-4 rounded-xl
                    border border-slate-200 bg-slate-50
                    hover:bg-white hover:border-blue-400
                    hover:shadow-md hover:-translate-y-0.5
                    transition-all duration-200 cursor-pointer
                  "
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