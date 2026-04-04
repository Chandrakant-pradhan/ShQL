"use client";

import { useState, useEffect, useRef } from "react";
import { useGoogleLogin } from "@react-oauth/google";
import { LogOut, Cloud, Link2, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "../components/ToastProvider";
import { removeEmptyTopRows } from "../lib/removeEmptyRows";

function extractSheetId(input: string): string | null {
  const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match) return match[1];
  if (/^[a-zA-Z0-9-_]{30,}$/.test(input.trim())) return input.trim();
  return null;
}

export default function ConnectPage() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sheetLink, setSheetLink] = useState("");
  const [linkError, setLinkError] = useState("");
  const [userProfile, setUserProfile] = useState<{ name: string; email: string; picture: string } | null>(null)
  const pendingSheetId = useRef<string | null>(null);
  const { showToast } = useToast();
  const router = useRouter();

  const login = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      const token = tokenResponse.access_token;
      setAccessToken(token);
      sessionStorage.setItem("accessToken", token);
      const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const profile = { name: data.name, email: data.email, picture: data.picture };
      setUserProfile(profile);
      sessionStorage.setItem("userProfile", JSON.stringify(profile));
    },
    onError: () => showToast("Login Failed" , "error"),
  });



  const logout = () => {
    setAccessToken(null);
    setUserProfile(null);
    sessionStorage.removeItem("accessToken");
    sessionStorage.removeItem("userProfile");
  };

  useEffect(() => {
    const token = sessionStorage.getItem("accessToken");
    if (token) setAccessToken(token);
    const profile = sessionStorage.getItem("userProfile");
    if (profile) setUserProfile(JSON.parse(profile));
    setReady(true);
  }, []);

  async function openSheet(file: any, token?: string) {
    const authToken = token ?? accessToken;
    try {
      setLoading(true);

      const metaRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${file.id}`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      if (metaRes.status === 401 || metaRes.status === 403) {
        setLoading(false);
        showToast("Permission required — please grant access", "error");
        pendingSheetId.current = file.id;
        loginForSheet();
        return;
      }

      if (!metaRes.ok) {
        setLinkError("Could not access this sheet. Check the link and try again.");
        setLoading(false);
        return;
      }

      const meta = await metaRes.json();
      const fileName = meta.properties?.title ?? file.name ?? "Untitled";
      const sheetNames = meta.sheets.map(
        (s: any) => s.properties.title
      );

      const ranges = sheetNames
        .map((name: string) => `ranges=${encodeURIComponent(name)}`)
        .join("&");

      const dataRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${file.id}/values:batchGet?${ranges}`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      const data = await dataRes.json();

      const results = data.valueRanges.map(
        (range: any, i: number) => ({
          name: `${fileName} - ${sheetNames[i]}`,
          rows: removeEmptyTopRows(range.values || []),
        })
      );

      sessionStorage.setItem(
        "sheetSource",
        JSON.stringify({
          fileId: file.id,
          fileName,
        })
      );

      sessionStorage.setItem("sheets", JSON.stringify(results));

      router.push("/tables");

    } catch (err) {
      showToast("Error opening sheet" , "error");
    } finally {
      setLoading(false);
    }
  }

  const loginForSheet = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      const token = tokenResponse.access_token;
      setAccessToken(token);
      sessionStorage.setItem("accessToken", token);
      const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const profile = { name: data.name, email: data.email, picture: data.picture };
      setUserProfile(profile);
      sessionStorage.setItem("userProfile", JSON.stringify(profile));
      if (pendingSheetId.current) {
        await openSheet({ id: pendingSheetId.current, name: "" }, token);
        pendingSheetId.current = null;
      }
    },
    onError: () => showToast("Login Failed", "error"),
    scope: "https://www.googleapis.com/auth/spreadsheets.readonly https://www.googleapis.com/auth/drive.readonly",
    prompt: "consent",
  });

  async function handleSubmit() {
    setLinkError("");
    const fileId = extractSheetId(sheetLink);
    if (!fileId) {
      setLinkError("Please enter a valid Google Sheets URL.");
      return;
    }
    await openSheet({ id: fileId, name: "" });
  }

  if (!ready) return null;

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-bold mb-8 flex items-center gap-2">
        <Cloud className="w-6 h-6 text-blue-600" />
        Google Drive
      </h1>
      {!accessToken ? (
        <div className="bg-white p-8 rounded-2xl shadow-sm border max-w-md">
          <p className="text-slate-600 mb-6">
            Connect your Google account to open your Google Sheets.
          </p>
          <button
            onClick={() => login()}
            className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-slate-200
                       bg-white hover:bg-slate-50 hover:border-slate-300 transition-colors
                       text-sm font-medium text-slate-700 shadow-sm"
          >
            <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Sign in with Google
          </button>
        </div>
      ) : (
        <div className="bg-white p-6 rounded-2xl shadow-sm border max-w-xl">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              {userProfile?.picture ? (
                <img src={userProfile.picture} alt={userProfile.name} referrerPolicy="no-referrer"
                  className="w-9 h-9 rounded-full object-cover ring-2 ring-slate-100" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-blue-700 flex items-center justify-center text-sm font-semibold text-white">
                  {userProfile?.name?.charAt(0) ?? "?"}
                </div>
              )}
              <div>
                <p className="text-sm font-semibold text-slate-800 leading-none">{userProfile?.name ?? "Google Sheets"}</p>
                <p className="text-xs text-slate-400 mt-0.5">{userProfile?.email ?? ""}</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Disconnect
            </button>
          </div>

          <p className="text-sm text-slate-500 mb-4">
            Paste a Google Sheets link below. If the sheet is private, you'll be prompted to grant access.
          </p>

          <div className="space-y-3">
            <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all bg-slate-50
              ${linkError
                ? "border-red-300 ring-1 ring-red-200"
                : "border-slate-200 focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-100 focus-within:bg-white"
              }`}>
              <Link2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <input
                type="url"
                placeholder="https://docs.google.com/spreadsheets/d/..."
                value={sheetLink}
                onChange={(e) => { setSheetLink(e.target.value); setLinkError(""); }}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                className="flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
              />
              {sheetLink && (
                <button
                  onClick={() => { setSheetLink(""); setLinkError(""); }}
                  className="text-slate-300 hover:text-slate-500 text-lg leading-none transition-colors"
                >
                  ×
                </button>
              )}
            </div>

            {linkError && (
              <p className="text-xs text-red-500 pl-1">{linkError}</p>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl
                         bg-blue-600 hover:bg-blue-700 active:scale-[0.98]
                         text-white text-sm font-medium transition-all
                         disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
              ) : (
                <>
                  Open Sheet
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>

          <p className="text-xs text-slate-400 mt-4">
            Works with public sheets and private sheets you have access to.
          </p>
        </div>
      )}
    </div>
  );
}