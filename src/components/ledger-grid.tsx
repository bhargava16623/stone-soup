"use client";

import { useMemo, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry, themeQuartz, type ColDef, type ValueFormatterParams } from "ag-grid-community";
import { formatUsd } from "@/lib/fees.ts";
import type { LedgerRow } from "@/lib/queries.ts";

ModuleRegistry.registerModules([AllCommunityModule]);

// Match the site palette (CSS variables switch for dark mode).
const theme = themeQuartz.withParams({
  accentColor: "var(--accent)",
  backgroundColor: "var(--surface)",
  foregroundColor: "var(--foreground)",
  borderColor: "var(--border)",
  chromeBackgroundColor: "var(--background)",
  headerTextColor: "var(--muted)",
  fontFamily: "inherit",
  wrapperBorderRadius: 16,
});

const money = (p: ValueFormatterParams<LedgerRow, number>) => (p.value == null ? "" : formatUsd(p.value));

const deliveryClass: Record<LedgerRow["delivery"], string> = {
  Delivered: "text-leaf font-medium",
  "Under review": "text-amber font-medium",
  "On its way": "text-muted",
};

export function LedgerGrid({ rows }: { rows: LedgerRow[] }) {
  const [quickFilter, setQuickFilter] = useState("");

  const columnDefs = useMemo<ColDef<LedgerRow>[]>(
    () => [
      {
        field: "date",
        headerName: "Date",
        sort: "desc",
        width: 110,
        floatingFilter: false,
        valueFormatter: (p) => (p.value ? new Date(p.value).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""),
        filter: "agDateColumnFilter",
        filterValueGetter: (p) => new Date(new Date(p.data!.date).toDateString()),
      },
      { field: "donor", headerName: "Donor", width: 110 },
      { field: "via", headerName: "Via", width: 130 },
      { field: "ngo", headerName: "Organisation", flex: 1, minWidth: 160 },
      {
        field: "item",
        headerName: "Gift",
        flex: 1.3,
        minWidth: 200,
        // The pinned totals row has no single item.
        valueGetter: (p) => (p.node?.rowPinned ? `${p.data!.units} items` : `${p.data!.units} × ${p.data!.item}`),
        cellRenderer: (p: { data: LedgerRow; value: string; node: { rowPinned?: string | null } }) =>
          p.node.rowPinned ? (
            <span className="font-medium">{p.value}</span>
          ) : (
            <a href={`/needs/${p.data.needId}`} className="hover:underline">
              {p.value}
            </a>
          ),
      },
      { field: "vendor", headerName: "Paid to", flex: 1, minWidth: 140 },
      { field: "amountCents", headerName: "Amount", width: 110, type: "rightAligned", valueFormatter: money, filter: "agNumberColumnFilter" },
      { field: "priceCheck", headerName: "Price check", width: 130 },
      {
        field: "delivery",
        headerName: "Delivery",
        width: 140,
        cellRenderer: (p: { value?: LedgerRow["delivery"] }) => (p.value ? <span className={deliveryClass[p.value]}>{p.value}</span> : null),
      },
      {
        field: "captureId",
        headerName: "PayPal capture",
        width: 190,
        cellClass: "font-mono text-xs",
        tooltipValueGetter: () => "PayPal capture ID for the payment to the supplier",
      },
    ],
    [],
  );

  const totals = useMemo(
    () => [
      {
        donor: `${rows.length} gifts`,
        units: rows.reduce((s, r) => s + r.units, 0),
        amountCents: rows.reduce((s, r) => s + r.amountCents, 0),
      } as Partial<LedgerRow>,
    ],
    [rows],
  );

  return (
    <div className="space-y-3">
      <input
        value={quickFilter}
        onChange={(e) => setQuickFilter(e.target.value)}
        placeholder="Search gifts, organisations, suppliers…"
        aria-label="Search the ledger"
        className="w-full max-w-sm rounded-full border border-border bg-surface px-4 py-2 text-sm"
      />
      <div style={{ height: 520 }}>
        <AgGridReact<LedgerRow>
          theme={theme}
          rowData={rows}
          columnDefs={columnDefs}
          defaultColDef={{ sortable: true, filter: true, floatingFilter: true, resizable: true }}
          quickFilterText={quickFilter}
          pinnedBottomRowData={totals}
          pagination
          paginationPageSize={20}
          paginationPageSizeSelector={[20, 50, 100]}
          tooltipShowDelay={300}
          overlayNoRowsTemplate="No gifts yet. Be the first to add to the pot."
        />
      </div>
    </div>
  );
}
