"use client";

import { useMemo, useCallback } from "react";
import { AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  ModuleRegistry,
  themeQuartz,
  type ColDef,
  type GridReadyEvent,
} from "ag-grid-community";

ModuleRegistry.registerModules([AllCommunityModule]);

const gridTheme = themeQuartz.withParams({
  accentColor: "#2563eb",
  borderColor: "#e2e8f0",
  borderRadius: 0,
  browserColorScheme: "light",
  columnBorder: { style: "solid", width: 1, color: "#f1f5f9" },
  fontFamily: "system-ui, -apple-system, sans-serif",
  fontSize: 13,
  foregroundColor: "#1e293b",
  headerBackgroundColor: "#f1f5f9",
  headerFontSize: 12,
  headerFontWeight: 600,
  headerTextColor: "#475569",
  oddRowBackgroundColor: "#f8fafc",
  rowBorder: { style: "solid", width: 1, color: "#e2e8f0" },
  rowHeight: 34,
  headerHeight: 38,
  wrapperBorderRadius: 0,
  cellHorizontalPaddingScale: 0.8,
  spacing: 6,
});

interface Props {
  rows: string[][];
}

export default function SpreadsheetViewer({ rows }: Props) {
  if (!rows || rows.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400 text-sm">
        Empty sheet
      </div>
    );
  }

  const headers = rows[0];
  const rawData = rows.slice(1);

  // Build AG Grid column defs from header row
  const columnDefs = useMemo<ColDef[]>(
    () =>
      headers.map((h) => ({
        headerName: h,
        field: h,
        filter: true,           
        sortable: true,
        resizable: true,
        minWidth: 80,
        flex: 1,
      })),
    [headers]
  );

  // Convert string[][] → array of objects keyed by header name
  const rowData = useMemo(
    () =>
      rawData.map((row) =>
        Object.fromEntries(headers.map((h, i) => [h, row[i] ?? ""]))
      ),
    [rawData, headers]
  );

  const defaultColDef = useMemo<ColDef>(
    () => ({
      filter: "agTextColumnFilter",
      floatingFilter: true,    
      suppressMovable: false,
      wrapText: false,
    }),
    []
  );

  const onGridReady = useCallback((params: GridReadyEvent) => {
    params.api.sizeColumnsToFit();
  }, []);

  return (
    <div className="h-full w-full">
      <AgGridReact
        theme={gridTheme}
        rowData={rowData}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        onGridReady={onGridReady}
        enableCellTextSelection={true}
        ensureDomOrder={true}
        pagination={false}
        suppressPaginationPanel={true}
        domLayout="normal"
      />
    </div>
  );
}