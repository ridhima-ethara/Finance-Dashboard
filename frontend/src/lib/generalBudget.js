const normalizeHeaderKey = (value = "") => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");

const createRowId = (prefix = "gb") => `${prefix}-${Math.random().toString(36).slice(2, 8)}`;

const parseNumericCell = (value) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const normalized = String(value ?? "")
    .replace(/[$,%\s]/g, "")
    .replace(/,/g, "")
    .trim();
  if (!normalized) return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const rowHasCellData = (cells = {}) => Object.values(cells || {}).some((value) => String(value || "").trim());

const uniqueLabels = (headers = []) => {
  const seen = new Map();
  return headers.map((header, index) => {
    const base = String(header || "").trim() || `Column ${index + 1}`;
    const key = base.toLowerCase();
    const count = seen.get(key) || 0;
    seen.set(key, count + 1);
    return count === 0 ? base : `${base} ${count + 1}`;
  });
};

export const GENERAL_BUDGET_TABLE_MODE = "custom-table";
export const DEFAULT_GENERAL_BUDGET_HEADERS = ["Line item", "Details"];
export const getGeneralBudgetColumnCellKey = (index = 0) => `__col_${index}`;
export const isGeneralBudgetCostHeader = (header = "") => {
  const key = normalizeHeaderKey(header);
  return key === "cost" || key === "amount" || key === "budget" || key.startsWith("costsection");
};

const readGeneralBudgetCellValue = (row = {}, header = "", index = 0) => String(
  row?.cells?.[getGeneralBudgetColumnCellKey(index)]
  ?? row?.cells?.[header]
  ?? row?.tableCells?.[getGeneralBudgetColumnCellKey(index)]
  ?? row?.tableCells?.[header]
  ?? row?.[header]
  ?? ""
).trim();

export const normalizeGeneralBudgetHeaders = (headers = DEFAULT_GENERAL_BUDGET_HEADERS) => {
  const source = Array.isArray(headers) && headers.length ? headers : DEFAULT_GENERAL_BUDGET_HEADERS;
  return uniqueLabels(source.map((header) => String(header || "").trim()).filter(Boolean));
};

export const getGeneralBudgetCostHeaders = (headers = DEFAULT_GENERAL_BUDGET_HEADERS) => (
  normalizeGeneralBudgetHeaders(headers).filter(isGeneralBudgetCostHeader)
);

export const calculateGeneralBudgetRowTotal = (row = {}, headers = DEFAULT_GENERAL_BUDGET_HEADERS) => {
  const safeHeaders = normalizeGeneralBudgetHeaders(headers);
  const hasCostSections = safeHeaders.some(isGeneralBudgetCostHeader);
  if (!hasCostSections) return Number(row?.estCost || row?.amount || 0);
  return Math.round(safeHeaders.reduce((sum, header, index) => (
    isGeneralBudgetCostHeader(header)
      ? sum + parseNumericCell(readGeneralBudgetCellValue(row, header, index))
      : sum
  ), 0) * 100) / 100;
};

export const buildEmptyGeneralBudgetTableRow = ({ phaseId = "", phaseName = "", headers = DEFAULT_GENERAL_BUDGET_HEADERS } = {}) => {
  const safeHeaders = normalizeGeneralBudgetHeaders(headers);
  return {
    id: createRowId("gb"),
    phaseId,
    phaseName,
    estCost: 0,
    cells: Object.fromEntries(safeHeaders.flatMap((header, index) => ([
      [header, ""],
      [getGeneralBudgetColumnCellKey(index), ""],
    ]))),
  };
};

export const normalizeGeneralBudgetRows = (rows = [], headers = DEFAULT_GENERAL_BUDGET_HEADERS) => {
  const safeHeaders = normalizeGeneralBudgetHeaders(headers);
  return (Array.isArray(rows) ? rows : []).map((row) => {
    const cells = Object.fromEntries(
      safeHeaders.flatMap((header, index) => {
        const value = readGeneralBudgetCellValue(row, header, index);
        return [
          [header, value],
          [getGeneralBudgetColumnCellKey(index), value],
        ];
      })
    );
    const normalizedRow = {
      id: row?.id || createRowId("gb"),
      phaseId: String(row?.phaseId || "").trim(),
      phaseName: String(row?.phaseName || "").trim(),
      cells,
    };
    return {
      ...normalizedRow,
      estCost: calculateGeneralBudgetRowTotal({ ...row, ...normalizedRow }, safeHeaders),
    };
  });
};

export const sumGeneralBudgetRows = (rows = [], headers = DEFAULT_GENERAL_BUDGET_HEADERS) => (
  normalizeGeneralBudgetRows(rows, headers).reduce((sum, row) => sum + Number(row?.estCost || 0), 0)
);

export const sumGeneralBudgetRowsByPhase = (rows = [], headers = DEFAULT_GENERAL_BUDGET_HEADERS) => (
  normalizeGeneralBudgetRows(rows, headers).reduce((acc, row) => {
    const phaseId = String(row?.phaseId || "").trim() || "unassigned";
    acc[phaseId] = (acc[phaseId] || 0) + Number(row?.estCost || 0);
    return acc;
  }, {})
);

export const isGeneralBudgetTableLine = (line = {}) => (
  line?.tableMode === GENERAL_BUDGET_TABLE_MODE
  || (Array.isArray(line?.tableHeaders) && line.tableHeaders.length > 0)
  || Object.prototype.hasOwnProperty.call(line || {}, "tableCells")
);

export const serializeGeneralBudgetTableRows = (rows = [], headers = DEFAULT_GENERAL_BUDGET_HEADERS, phases = []) => {
  const safeHeaders = normalizeGeneralBudgetHeaders(headers);
  const phaseMap = new Map((Array.isArray(phases) ? phases : []).map((phase) => [phase.id, phase]));
  return normalizeGeneralBudgetRows(rows, safeHeaders)
    .filter((row) => rowHasCellData(row.cells) || Number(row.estCost || 0) > 0)
    .map((row, index) => {
      const phaseMeta = phaseMap.get(row.phaseId) || {};
      const phaseName = row.phaseName || phaseMeta.name || "";
      const descriptorValues = safeHeaders
        .map((header, cellIndex) => (
          isGeneralBudgetCostHeader(header)
            ? null
            : readGeneralBudgetCellValue(row, header, cellIndex)
        ))
        .filter(Boolean);
      const costSections = safeHeaders
        .map((header, cellIndex) => (
          isGeneralBudgetCostHeader(header)
            ? {
                header,
                amount: parseNumericCell(readGeneralBudgetCellValue(row, header, cellIndex)),
              }
            : null
        ))
        .filter(Boolean);
      const label = descriptorValues[0] || `${phaseName || "General"} row ${index + 1}`;
      const detail = [phaseName, ...descriptorValues.slice(1)].filter(Boolean).join(" · ");
      const costSummary = costSections
        .filter((entry) => entry.amount > 0)
        .map((entry) => `${entry.header}: ${entry.amount}`)
        .join(" · ");
      const amount = calculateGeneralBudgetRowTotal(row, safeHeaders);
      return {
        id: row.id || createRowId("gb"),
        label,
        optionLabel: label,
        note: [detail, costSummary].filter(Boolean).join(" · ") || "General budget table row",
        detail,
        estCost: amount,
        amount,
        phaseId: row.phaseId || phaseMeta.id || "",
        phaseName,
        costSections,
        tableMode: GENERAL_BUDGET_TABLE_MODE,
        tableHeaders: safeHeaders,
        tableCells: Object.fromEntries(
          safeHeaders.map((header, cellIndex) => [header, readGeneralBudgetCellValue(row, header, cellIndex)])
        ),
      };
    });
};

export const parseGeneralBudgetTable = (lines = []) => {
  const tableLines = (Array.isArray(lines) ? lines : []).filter(isGeneralBudgetTableLine);
  if (!tableLines.length) {
    return {
      isTableMode: false,
      headers: normalizeGeneralBudgetHeaders(DEFAULT_GENERAL_BUDGET_HEADERS),
      rows: [],
      phaseTotals: [],
      total: 0,
    };
  }

  const headers = normalizeGeneralBudgetHeaders(tableLines.find((line) => Array.isArray(line?.tableHeaders) && line.tableHeaders.length)?.tableHeaders);
  const costHeaders = headers.filter(isGeneralBudgetCostHeader);
  const rows = normalizeGeneralBudgetRows(tableLines.map((line) => ({
    id: line.id,
    phaseId: line.phaseId,
    phaseName: line.phaseName,
    estCost: Number(line.estCost || line.amount || 0),
    cells: line.tableCells || {},
  })), headers);
  const totalsByPhase = rows.reduce((acc, row) => {
    const phaseId = row.phaseId || "unassigned";
    const phaseName = row.phaseName || (phaseId === "unassigned" ? "Unassigned phase" : phaseId);
    acc[phaseId] = acc[phaseId] || { phaseId, phaseName, total: 0 };
    acc[phaseId].total += Number(row.estCost || 0);
    return acc;
  }, {});

  return {
    isTableMode: true,
    headers,
    costHeaders,
    hasCostSections: costHeaders.length > 0,
    rows,
    phaseTotals: Object.values(totalsByPhase),
    total: sumGeneralBudgetRows(rows, headers),
  };
};

export const normalizeGeneralActualRows = (rows = [], headers = DEFAULT_GENERAL_BUDGET_HEADERS) => {
  const safeHeaders = normalizeGeneralBudgetHeaders(headers);
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    id: row?.id || createRowId("ga"),
    estCost: Number(row?.estCost || row?.amount || row?.cost || 0),
    cells: Object.fromEntries(
      safeHeaders.map((header) => [header, String(row?.cells?.[header] ?? row?.[header] ?? "").trim()])
    ),
  }));
};

export const getGeneralActualRowsCostTotal = (rows = []) => (
  (Array.isArray(rows) ? rows : []).reduce((sum, row) => sum + Number(row?.estCost || row?.amount || row?.cost || 0), 0)
);

export const getGeneralActualRowsCount = (rows = []) => (
  (Array.isArray(rows) ? rows : []).filter((row) => rowHasCellData(row?.cells) || Number(row?.estCost || row?.amount || row?.cost || 0) > 0).length
);

export const isGeneralActualLog = (log = {}) => String(log?.logType || "").trim() === "general-actual";

export const parseGeneralActualSheetGrid = (grid = [], templateHeaders = DEFAULT_GENERAL_BUDGET_HEADERS) => {
  const rows = (Array.isArray(grid) ? grid : [])
    .map((row) => (Array.isArray(row) ? row : [row]))
    .map((row) => row.map((cell) => (typeof cell === "string" ? cell.trim() : cell)))
    .filter((row) => row.some((cell) => String(cell ?? "").trim()));
  if (!rows.length) {
    return {
      headers: normalizeGeneralBudgetHeaders(templateHeaders),
      rows: [],
    };
  }

  const rawHeaderRow = rows[0].map((cell, index) => String(cell || "").trim() || `Column ${index + 1}`);
  const rawHeaderKeys = rawHeaderRow.map(normalizeHeaderKey);
  const looksLikeHeaderRow = rawHeaderRow.some((cell) => Number.isNaN(Number(String(cell || "").replace(/[$,\s]/g, ""))))
    || rawHeaderKeys.some((key) => ["cost", "costusd", "cost$", "amount", "phase", "phasename"].includes(key));
  const safeTemplateHeaders = normalizeGeneralBudgetHeaders(templateHeaders);
  const uploadedHeaders = looksLikeHeaderRow
    ? rawHeaderRow.filter((header, index) => !["cost", "costusd", "cost$", "amount", "phase", "phasename"].includes(rawHeaderKeys[index]))
    : [];
  const headers = normalizeGeneralBudgetHeaders(
    safeTemplateHeaders.length ? safeTemplateHeaders : (uploadedHeaders.length ? uploadedHeaders : DEFAULT_GENERAL_BUDGET_HEADERS)
  );
  const dataRows = looksLikeHeaderRow ? rows.slice(1) : rows;
  const headerLookup = new Map(rawHeaderKeys.map((key, index) => [key, index]));
  const costIndex = rawHeaderKeys.findIndex((key) => ["cost", "costusd", "cost$", "amount", "value", "total", "budget"].includes(key));

  const parsedRows = dataRows.map((cells) => {
    const cellMap = {};
    headers.forEach((header, index) => {
      const matchedIndex = headerLookup.get(normalizeHeaderKey(header));
      const sourceIndex = matchedIndex != null ? matchedIndex : index;
      cellMap[header] = String(cells[sourceIndex] ?? "").trim();
    });
    const fallbackCostIndex = costIndex >= 0 ? costIndex : headers.length;
    return {
      id: createRowId("ga"),
      estCost: parseNumericCell(cells[fallbackCostIndex] ?? 0),
      cells: cellMap,
    };
  }).filter((row) => rowHasCellData(row.cells) || Number(row.estCost || 0) > 0);

  return {
    headers,
    rows: normalizeGeneralActualRows(parsedRows, headers),
  };
};
