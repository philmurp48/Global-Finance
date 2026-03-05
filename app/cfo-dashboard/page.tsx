'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import {
    ChevronDown,
    ChevronRight,
    LayoutGrid,
    FileText,
    Filter,
    TrendingUp,
    TrendingDown,
    DollarSign,
    Percent,
    PieChart,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ExcelDriverTreeData,
    joinFactWithDimension,
    getDimensionTableNames,
    FactMarginRecord,
    DimensionTables,
    type DimensionRecord,
} from '@/lib/excel-parser';
import { getCurrentUploadId } from '@/lib/uploadId';
import {
    INCOME_STATEMENT_TREE,
    BALANCE_SHEET_TREE,
    FACT_MARGIN_FIELD_VARIANTS,
    SLICER_DIMENSIONS,
    SCENARIO_OPTIONS,
    type CFOTreeLine,
    type ScenarioOption,
} from '@/lib/cfo-dashboard-schema';

// ----- Types -----
interface PeriodValues {
    [fieldName: string]: number;
}

interface RowData {
    [period: string]: PeriodValues;
}

interface CFODashboardData {
    [rowKey: string]: RowData;
}

const idFieldByDim: Record<string, string> = {
    CostCenter: 'CostCenterID',
    Geography: 'GeographyID',
    LegalEntity: 'LegalEntityID',
    LineOfBusiness: 'LOBID',
    ProductType: 'ProductTypeID',
    Scenario: 'Scenario',
};

const descFieldByDim: Record<string, string> = {
    CostCenter: 'CostCenter',
    Geography: 'Geography',
    LegalEntity: 'LegalEntity',
    LineOfBusiness: 'LineOfBusiness',
    ProductType: 'ProductType',
    Scenario: 'Scenario',
};

function normalizeField(s: string): string {
    return s
        .toLowerCase()
        .replace(/\$mm/g, '')
        .replace(/_bps|_pct|_annual|_fte/g, '')
        .replace(/[^a-z0-9]/g, '')
        .trim();
}

function getFieldValue(record: FactMarginRecord, fieldName: string): number | null {
    if (!record || !fieldName) return null;
    const variants = FACT_MARGIN_FIELD_VARIANTS[fieldName];
    if (variants) {
        for (const v of variants) {
            const val = record[v];
            if (val !== undefined && val !== null && val !== '') {
                const n = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^0-9.-]/g, ''));
                if (!isNaN(n)) return n;
            }
        }
    }
    const targetNorm = normalizeField(fieldName);
    for (const [key, value] of Object.entries(record)) {
        const k = key.toLowerCase();
        if (k.includes('id') || k.includes('period') || k.includes('date') || k.includes('quarter')) continue;
        if (normalizeField(key) === targetNorm) {
            const n = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.-]/g, ''));
            if (!isNaN(n)) return n;
        }
    }
    if (targetNorm.length > 3) {
        for (const [key, value] of Object.entries(record)) {
            const k = key.toLowerCase();
            if (k.includes('id') || k.includes('period') || k.includes('date') || k.includes('quarter')) continue;
            if (normalizeField(key).includes(targetNorm) || targetNorm.includes(normalizeField(key))) {
                const n = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.-]/g, ''));
                if (!isNaN(n)) return n;
            }
        }
    }
    return null;
}

function getDimensionDescription(
    dimName: string,
    idValue: unknown,
    dimensionTables: DimensionTables
): string | null {
    if (idValue === undefined || idValue === null) return null;
    const idStr = String(idValue).trim();
    if (!idStr) return null;
    const tableNames = [`Dim_${dimName}`, `DIM_${dimName}`];
    if (dimName === 'LineOfBusiness') tableNames.push('Dim_LOB', 'DIM_LOB');
    let dimTable: Map<string, any> | undefined;
    for (const tn of tableNames) {
        dimTable = dimensionTables.get(tn);
        if (dimTable) break;
    }
    if (!dimTable) {
        for (const [tName, t] of dimensionTables.entries()) {
            if (tableNames.some(tn => tName.toLowerCase() === tn.toLowerCase())) {
                dimTable = t;
                break;
            }
        }
    }
    if (!dimTable) return null;
    let rec = dimTable.get(idStr);
    if (!rec && !isNaN(Number(idStr))) rec = dimTable.get(String(Number(idStr)));
    if (!rec) return null;
    const displayKey = Object.keys(rec).find(
        (k) =>
            !k.toLowerCase().includes('id') &&
            (k.toLowerCase().includes('name') || k.toLowerCase().includes('description') || k.toLowerCase().includes('code'))
    ) || Object.keys(rec).find((k) => !k.toLowerCase().includes('id'));
    return displayKey ? String(rec[displayKey]) : null;
}

// ----- Formatting -----
function formatMillions(value: number): string {
    if (value === null || value === undefined || isNaN(value)) return '—';
    const abs = Math.abs(value);
    const formatted = abs >= 1 ? `${(value / 1).toFixed(2)}` : value.toFixed(2);
    if (value < 0) return `(${formatted.replace('-', '')})`;
    return formatted;
}

function formatPct(value: number): string {
    if (value === null || value === undefined || isNaN(value)) return '—';
    const pct = (value * 100).toFixed(2);
    return value < 0 ? `(${pct})%` : `${pct}%`;
}

function VarianceSpan({ value, suffix = '%' }: { value: number; suffix?: string }) {
    const isPos = value >= 0;
    const text = `${isPos ? '+' : ''}${value.toFixed(1)}${suffix}`;
    return (
        <span className={`text-xs ${isPos ? 'text-emerald-600' : 'text-red-600'}`}>
            {text}
        </span>
    );
}

// ----- KPI Cards -----
function KPICards({
    data,
    rowKey,
    periods,
    currentPeriodIndex,
}: {
    data: CFODashboardData;
    rowKey: string;
    periods: string[];
    currentPeriodIndex: number;
}) {
    const row = data[rowKey] || {};
    const period = periods[currentPeriodIndex] || periods[0];
    const prevPeriod = currentPeriodIndex > 0 ? periods[currentPeriodIndex - 1] : null;
    const prevYearPeriod = currentPeriodIndex >= 4 ? periods[currentPeriodIndex - 4] : null;
    const pd = period && row[period] ? row[period] : {};
    const totalRevenue = pd['TotalRevenue'] ?? pd['TotalRevenue_$mm'] ?? 0;
    const ebitda = pd['EBITDA'] ?? pd['EBITDA_$mm'] ?? 0;
    const netIncome = pd['NetIncome'] ?? pd['NetIncome_$mm'] ?? 0;
    const totalEquity = pd['TotalEquity'] ?? pd['TotalEquity_$mm'] ?? 0;
    const aum = pd['AssetsUnderManagement'] ?? pd['AssetsUnderManagement_$mm'] ?? pd['AUM_$mm'] ?? 0;

    const ebitdaMarginPct = totalRevenue !== 0 ? (ebitda / totalRevenue) * 100 : 0;
    const roePct = totalEquity !== 0 ? (netIncome / totalEquity) * 100 : 0;

    const qoqRevenue = prevPeriod && row[prevPeriod]
        ? totalRevenue !== 0
            ? ((totalRevenue - (row[prevPeriod]['TotalRevenue'] ?? row[prevPeriod]['TotalRevenue_$mm'] ?? 0)) / totalRevenue) * 100
            : 0
        : null;
    const yoyRevenue = prevYearPeriod && row[prevYearPeriod]
        ? totalRevenue !== 0
            ? ((totalRevenue - (row[prevYearPeriod]['TotalRevenue'] ?? row[prevYearPeriod]['TotalRevenue_$mm'] ?? 0)) / totalRevenue) * 100
            : 0
        : null;

    const cards = [
        {
            label: 'Total Revenue',
            value: `$${formatMillions(totalRevenue)}M`,
            sub: qoqRevenue != null ? <VarianceSpan value={qoqRevenue} /> : null,
            icon: DollarSign,
        },
        {
            label: 'EBITDA Margin %',
            value: `${ebitdaMarginPct.toFixed(1)}%`,
            sub: null,
            icon: Percent,
        },
        {
            label: 'Net Income',
            value: `$${formatMillions(netIncome)}M`,
            sub: null,
            icon: DollarSign,
        },
        {
            label: 'ROE',
            value: `${roePct.toFixed(1)}%`,
            sub: null,
            icon: Percent,
        },
        {
            label: 'AUM',
            value: `$${formatMillions(aum)}M`,
            sub: yoyRevenue != null ? <VarianceSpan value={yoyRevenue} /> : null,
            icon: PieChart,
        },
    ];

    return (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            {cards.map((c) => {
                const Icon = c.icon;
                return (
                    <div
                        key={c.label}
                        className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm"
                    >
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                {c.label}
                            </span>
                            <Icon className="w-4 h-4 text-gray-400" />
                        </div>
                        <div className="text-xl font-bold text-gray-900">{c.value}</div>
                        {c.sub && <div className="mt-1 text-xs">{c.sub}</div>}
                    </div>
                );
            })}
        </div>
    );
}

// ----- Expandable tree table -----
function ExpandableTreeTable({
    tree,
    data,
    rowKey,
    periods,
    expandedSections,
    onToggleSection,
    showPctOfRevenue,
    rowDataByPeriod,
}: {
    tree: CFOTreeLine[];
    data: CFODashboardData;
    rowKey: string;
    periods: string[];
    expandedSections: Set<string>;
    onToggleSection: (key: string) => void;
    showPctOfRevenue: boolean;
    rowDataByPeriod: Record<string, PeriodValues>;
}) {
    const totalRevenueByPeriod: Record<string, number> = useMemo(() => {
        const out: Record<string, number> = {};
        periods.forEach((p) => {
            const d = rowDataByPeriod[p];
            out[p] = d?.['TotalRevenue'] ?? d?.['TotalRevenue_$mm'] ?? 0;
        });
        return out;
    }, [periods, rowDataByPeriod]);

    const visibleItems = useMemo(() => {
        const out: CFOTreeLine[] = [];
        let currentSection: string | null = null;
        for (const item of tree) {
            if (item.type === 'section' && item.sectionKey) {
                currentSection = item.sectionKey;
                out.push(item);
                continue;
            }
            if (item.type === 'total') {
                if (currentSection && expandedSections.has(currentSection)) out.push(item);
                else if (!currentSection) out.push(item);
                currentSection = null;
                continue;
            }
            if (currentSection && item.indent > 0) {
                if (expandedSections.has(currentSection)) out.push(item);
                continue;
            }
            out.push(item);
        }
        return out;
    }, [tree, expandedSections]);

    return (
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="w-full min-w-[800px]">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                    <tr>
                        <th className="text-left py-3 px-4 font-semibold text-gray-900 sticky left-0 bg-gray-50 min-w-[260px]">
                            Line Item
                        </th>
                        {showPctOfRevenue && (
                            <th className="text-right py-3 px-3 font-semibold text-gray-600 w-24">
                                % Rev
                            </th>
                        )}
                        {periods.map((p) => (
                            <th key={p} className="text-right py-3 px-3 font-semibold text-gray-900 min-w-[120px]">
                                {p}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {visibleItems.map((item, idx) => {
                        const isSection = item.type === 'section' && item.sectionKey;
                        const isTotal = item.type === 'total';
                        const isExpanded = item.sectionKey ? expandedSections.has(item.sectionKey) : false;
                        const indentPx = (item.indent || 0) * 20 + 16;

                        return (
                            <motion.tr
                                key={item.id}
                                layout
                                className={`${isTotal ? 'bg-gray-50 font-semibold border-t border-gray-200' : ''} hover:bg-gray-50/50`}
                            >
                                <td
                                    className="py-2.5 px-4 text-gray-900 sticky left-0 z-10 bg-inherit"
                                    style={{ paddingLeft: indentPx }}
                                >
                                    <div className="flex items-center gap-2">
                                        {isSection && item.sectionKey && (
                                            <button
                                                type="button"
                                                onClick={() => onToggleSection(item.sectionKey!)}
                                                className="p-0.5 rounded hover:bg-gray-200"
                                                aria-label={isExpanded ? 'Collapse' : 'Expand'}
                                            >
                                                {isExpanded ? (
                                                    <ChevronDown className="w-4 h-4 text-gray-600" />
                                                ) : (
                                                    <ChevronRight className="w-4 h-4 text-gray-600" />
                                                )}
                                            </button>
                                        )}
                                        {!isSection && <span className="w-5" />}
                                        <span>{item.label}</span>
                                    </div>
                                </td>
                                {showPctOfRevenue && (
                                    <td className="py-2.5 px-3 text-right text-gray-500 text-sm">
                                        {(() => {
                                            const p = periods[0];
                                            const rev = totalRevenueByPeriod[p] || 0;
                                            const val = rowDataByPeriod[p]?.[item.fieldName] ?? 0;
                                            return rev !== 0 ? `${((val / rev) * 100).toFixed(1)}%` : '—';
                                        })()}
                                    </td>
                                )}
                                {periods.map((p, pi) => {
                                    const d = rowDataByPeriod[p] || {};
                                    const val = d[item.fieldName] ?? 0;
                                    const prevVal = pi > 0 ? (rowDataByPeriod[periods[pi - 1]] || {})[item.fieldName] ?? 0 : null;
                                    const prevYearVal = pi >= 4 ? (rowDataByPeriod[periods[pi - 4]] || {})[item.fieldName] ?? 0 : null;
                                    const qoqPct = prevVal !== null && prevVal !== 0 ? ((val - prevVal) / Math.abs(prevVal)) * 100 : null;
                                    const yoyPct = prevYearVal !== null && prevYearVal !== 0 ? ((val - prevYearVal) / Math.abs(prevYearVal)) * 100 : null;

                                    return (
                                        <td key={p} className="py-2.5 px-3 text-right">
                                            <div>
                                                <span className={val < 0 ? 'text-red-700' : ''}>
                                                    ${formatMillions(val)}M
                                                </span>
                                                {(qoqPct != null || yoyPct != null) && (
                                                    <div className="flex flex-col text-xs text-gray-500 mt-0.5">
                                                        {qoqPct != null && (
                                                            <span className={qoqPct >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                                                                QoQ {qoqPct >= 0 ? '+' : ''}{qoqPct.toFixed(1)}%
                                                            </span>
                                                        )}
                                                        {yoyPct != null && (
                                                            <span className={yoyPct >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                                                                YoY {yoyPct >= 0 ? '+' : ''}{yoyPct.toFixed(1)}%
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    );
                                })}
                            </motion.tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

// ----- Main content -----
function CFODashboardContent() {
    const [excelData, setExcelData] = useState<ExcelDriverTreeData | null>(null);
    const [activeTab, setActiveTab] = useState<'income' | 'balance'>('income');
    const [viewByGeography, setViewByGeography] = useState(true);
    const [scenario, setScenario] = useState<ScenarioOption>('Actual');
    const [selectedQuarters, setSelectedQuarters] = useState<string[]>([]);
    const [slicerValues, setSlicerValues] = useState<Record<string, string[]>>({});
    const [expandedPL, setExpandedPL] = useState<Set<string>>(new Set(['Revenue', 'OperatingExpenses']));
    const [expandedBS, setExpandedBS] = useState<Set<string>>(new Set(['Assets', 'Liabilities', 'Equity']));
    const [dimensionValuesMap, setDimensionValuesMap] = useState<Record<string, { id: string; description: string }[]>>({});
    const [availableQuarters, setAvailableQuarters] = useState<string[]>([]);
    const [selectedRowKey, setSelectedRowKey] = useState<string>('Total');

    useEffect(() => {
        const load = async () => {
            const uploadId = getCurrentUploadId();
            if (!uploadId) return;
            try {
                const res = await fetch(`/api/excel-data?uploadId=${uploadId}`);
                if (!res.ok) return;
                const json = await res.json();
                if (!json.data) return;
                const d = json.data;
                const restored: ExcelDriverTreeData = {
                    tree: d.tree || [],
                    accountingFacts: new Map(d.accountingFacts || []),
                    factMarginRecords: d.factMarginRecords || [],
                    dimensionTables: new Map(
                        Object.entries(d.dimensionTables || {}).map(([k, v]) => [
                            k,
                            new Map(Object.entries((v as Record<string, DimensionRecord>) || {})) as Map<string, DimensionRecord>,
                        ])
                    ) as DimensionTables,
                    namingConventionRecords: d.namingConventionRecords || [],
                };
                setExcelData(restored);
            } catch (e) {
                console.error('CFO Dashboard load error', e);
            }
        };
        load();
    }, []);

    useEffect(() => {
        if (!excelData?.factMarginRecords?.length) return;
        const quarters = new Set<string>();
        excelData.factMarginRecords.forEach((r: FactMarginRecord) => {
            const q = r['Quarter'] ?? r['quarter'];
            if (q != null && q !== '') quarters.add(String(q));
        });
        const sorted = Array.from(quarters).sort();
        setAvailableQuarters(sorted);
        if (selectedQuarters.length === 0 && sorted.length) setSelectedQuarters(sorted);

        const dimTables = getDimensionTableNames(excelData.dimensionTables);
        const idToDim: Record<string, string> = {
            LOBID: 'LineOfBusiness',
            LegalEntityID: 'LegalEntity',
            CostCenterID: 'CostCenter',
            GeographyID: 'Geography',
            ProductTypeID: 'ProductType',
            Scenario: 'Scenario',
        };
        const map: Record<string, { id: string; description: string }[]> = {};
        SLICER_DIMENSIONS.forEach((dimName) => {
            const tableName = dimTables.find(
                (t) =>
                    t.toLowerCase().includes(dimName.toLowerCase()) ||
                    (dimName === 'LineOfBusiness' && t.toLowerCase().includes('lob'))
            );
            if (tableName) {
                const table = excelData.dimensionTables.get(tableName);
                if (table) {
                    const arr: { id: string; description: string }[] = [];
                    table.forEach((rec, id) => {
                        const displayKey = Object.keys(rec).find(
                            (k) =>
                                !k.toLowerCase().includes('id') &&
                                (k.toLowerCase().includes('name') ||
                                    k.toLowerCase().includes('description') ||
                                    k.toLowerCase().includes('code'))
                        ) || Object.keys(rec).find((k) => !k.toLowerCase().includes('id'));
                        arr.push({ id: String(id), description: displayKey ? String(rec[displayKey]) : String(id) });
                    });
                    map[dimName] = arr.sort((a, b) => a.description.localeCompare(b.description));
                }
            }
            if (!map[dimName] && excelData.factMarginRecords.length) {
                const idField: string = Object.entries(idToDim).find(([, v]) => v === dimName)?.[0] ?? `${dimName}ID`;
                const descField = descFieldByDim[dimName] || dimName;
                const seen = new Map<string, string>();
                excelData.factMarginRecords.forEach((r: FactMarginRecord) => {
                    const desc = r[descField];
                    const id = r[idField];
                    if (desc != null && desc !== '') seen.set(String(id ?? desc), String(desc));
                    else if (id != null && id !== '') seen.set(String(id), String(id));
                });
                map[dimName] = Array.from(seen.entries()).map(([id, description]) => ({ id, description })).sort((a, b) => a.description.localeCompare(b.description));
            }
        });
        setDimensionValuesMap(map);
    }, [excelData]);

    const rowKeys = useMemo(() => {
        if (!excelData || !viewByGeography) return ['Total'];
        const vals = dimensionValuesMap['Geography'] || [];
        if (vals.length === 0) return ['Total'];
        return [...vals.map((v) => v.description), 'Total'];
    }, [excelData, viewByGeography, dimensionValuesMap]);

    const dashboardData = useMemo((): CFODashboardData => {
        const out: CFODashboardData = {};
        if (!excelData?.factMarginRecords?.length || selectedQuarters.length === 0) return out;

        const periods = selectedQuarters;
        const allTree = [...INCOME_STATEMENT_TREE, ...BALANCE_SHEET_TREE];
        const fieldSet = new Set<string>();
        allTree.forEach((t) => fieldSet.add(t.fieldName));
        FACT_MARGIN_FIELD_VARIANTS['TotalRevenue']?.forEach((f) => fieldSet.add(f));
        FACT_MARGIN_FIELD_VARIANTS['TotalExpense_$mm'] = ['TotalExpense_$mm', 'TotalOperatingExpense', 'TotalOperatingExpense_$mm'];

        rowKeys.forEach((rk) => {
            out[rk] = {};
            periods.forEach((p) => {
                out[rk][p] = {};
                fieldSet.forEach((f) => (out[rk][p][f] = 0));
            });
        });

        const dimFilters = Object.entries(slicerValues).filter(([, v]) => v.length > 0);
        const scenarioFilter = scenario;

        excelData.factMarginRecords.forEach((record) => {
            const q = record['Quarter'] ?? record['quarter'];
            if (!q || !periods.includes(String(q))) return;
            const period = String(q);
            const scenarioVal = record['Scenario'] ?? record['scenario'];
            if (scenarioFilter && scenarioVal != null && String(scenarioVal).toLowerCase() !== scenario.toLowerCase()) return;

            const geographyDesc = record['Geography'] ?? getDimensionDescription('Geography', record['GeographyID'], excelData.dimensionTables);
            const geographyRowKey = geographyDesc ? String(geographyDesc) : 'Total';

            let skip = false;
            for (const [dimName, selected] of dimFilters) {
                const idField = idFieldByDim[dimName];
                const descField = descFieldByDim[dimName];
                const recVal = record[descField] ?? getDimensionDescription(dimName, record[idField], excelData.dimensionTables) ?? record[idField];
                const recStr = recVal != null ? String(recVal) : '';
                if (selected.length > 0 && !selected.includes(recStr)) {
                    skip = true;
                    break;
                }
            }
            if (skip) return;

            const rowsToUpdate = viewByGeography && geographyRowKey !== 'Total' ? [geographyRowKey, 'Total'] : ['Total'];
            rowsToUpdate.forEach((rowKey) => {
                if (!out[rowKey]) out[rowKey] = {};
                if (!out[rowKey][period]) out[rowKey][period] = {};
                const target = out[rowKey][period];
                allTree.forEach((item) => {
                    const val = getFieldValue(record, item.fieldName);
                    if (val !== null && !isNaN(val)) {
                        const key = item.fieldName;
                        if (target[key] === undefined) target[key] = 0;
                        target[key] += val;
                    }
                });
                ['TotalRevenue_$mm', 'TotalExpense_$mm', 'Margin_$mm', 'AssetsUnderManagement', 'AUM_$mm'].forEach((f) => {
                    const v = getFieldValue(record, f);
                    if (v !== null && !isNaN(v)) {
                        if (target[f] === undefined) target[f] = 0;
                        target[f] += v;
                    }
                });
            });
        });

        rowKeys.forEach((rk) => {
            periods.forEach((p) => {
                const d = out[rk][p];
                if (!d) return;
                const totalRev = d['TotalRevenue'] ?? d['TotalRevenue_$mm'] ?? 0;
                const totalOpex = d['TotalOperatingExpense'] ?? d['TotalOperatingExpense_$mm'] ?? d['TotalExpense_$mm'] ?? 0;
                if (totalRev !== 0 || totalOpex !== 0) {
                    if (d['EBITDA'] === undefined || d['EBITDA'] === 0) d['EBITDA'] = totalRev - totalOpex;
                    if (d['TotalRevenue'] === undefined) d['TotalRevenue'] = totalRev;
                    if (d['TotalOperatingExpense'] === undefined) d['TotalOperatingExpense'] = totalOpex;
                }
                const totalAssets = d['TotalAssets'] ?? d['TotalAssets_$mm'] ?? 0;
                const totalLiab = d['TotalLiabilities'] ?? d['TotalLiabilities_$mm'] ?? 0;
                const totalEq = d['TotalEquity'] ?? d['TotalEquity_$mm'] ?? 0;
                if (totalAssets === 0 && (totalLiab !== 0 || totalEq !== 0)) {
                    d['TotalAssets'] = totalLiab + totalEq;
                }
                if (totalLiab === 0 && totalAssets !== 0 && totalEq !== 0) {
                    d['TotalLiabilities'] = totalAssets - totalEq;
                }
                if (totalEq === 0 && totalAssets !== 0 && totalLiab !== 0) {
                    d['TotalEquity'] = totalAssets - totalLiab;
                }
            });
        });

        return out;
    }, [excelData, selectedQuarters, rowKeys, viewByGeography, slicerValues, scenario]);

    const balanceValidation = useMemo(() => {
        const rk = selectedRowKey || rowKeys[0];
        const row = dashboardData[rk];
        if (!row) return null;
        let totalA = 0;
        let totalL = 0;
        let totalE = 0;
        selectedQuarters.forEach((p) => {
            const d = row[p] || {};
            totalA += d['TotalAssets'] ?? d['TotalAssets_$mm'] ?? 0;
            totalL += d['TotalLiabilities'] ?? d['TotalLiabilities_$mm'] ?? 0;
            totalE += d['TotalEquity'] ?? d['TotalEquity_$mm'] ?? 0;
        });
        const diff = Math.abs(totalA - (totalL + totalE));
        const ok = diff < 0.01;
        return { totalA, totalL, totalE, diff, ok };
    }, [dashboardData, selectedRowKey, rowKeys, selectedQuarters]);

    const currentRowData = useMemo(() => {
        const rk = selectedRowKey || 'Total';
        const row = dashboardData[rk];
        if (!row) return {};
        const byPeriod: Record<string, PeriodValues> = {};
        selectedQuarters.forEach((p) => {
            byPeriod[p] = row[p] || {};
        });
        return byPeriod;
    }, [dashboardData, selectedRowKey, selectedQuarters]);

    if (!excelData) {
        return (
            <div className="p-8 flex items-center justify-center min-h-[400px]">
                <div className="text-center text-gray-500">
                    <p className="font-medium">No data loaded</p>
                    <p className="text-sm mt-1">Upload your Excel file (GlobalFinanceData_v3_enhanced.xlsx) from Data Upload to view the CFO dashboard.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-[1800px] mx-auto space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">CFO Dashboard</h1>
                        <p className="text-sm text-gray-500 mt-0.5">Income Statement & Balance Sheet · Driver-based measures from Fact_Margin</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                            <button
                                type="button"
                                onClick={() => setViewByGeography(true)}
                                className={`px-4 py-2 text-sm font-medium ${viewByGeography ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                            >
                                View by Geography
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setViewByGeography(false);
                                    setSelectedRowKey('Total');
                                }}
                                className={`px-4 py-2 text-sm font-medium ${!viewByGeography ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                            >
                                View Consolidated
                            </button>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500">Scenario:</span>
                            <select
                                value={scenario}
                                onChange={(e) => setScenario(e.target.value as ScenarioOption)}
                                className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
                            >
                                {SCENARIO_OPTIONS.map((s) => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Slicers */}
                <div className="border border-gray-200 rounded-lg p-4 mb-6 bg-gray-50/50">
                    <div className="flex items-center gap-2 mb-3">
                        <Filter className="w-4 h-4 text-gray-600" />
                        <span className="text-sm font-semibold text-gray-900">Filters</span>
                    </div>
                    <div className="flex flex-wrap gap-4">
                        <div>
                            <span className="text-xs font-medium text-gray-500 block mb-1">Quarters</span>
                            <div className="flex flex-wrap gap-2">
                                {availableQuarters.map((q) => (
                                    <button
                                        key={q}
                                        type="button"
                                        onClick={() =>
                                            setSelectedQuarters((prev) =>
                                                prev.includes(q) ? prev.filter((x) => x !== q) : [...prev, q].sort()
                                            )
                                        }
                                        className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                                            selectedQuarters.includes(q) ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                                        }`}
                                    >
                                        {q}
                                    </button>
                                ))}
                            </div>
                        </div>
                        {SLICER_DIMENSIONS.map((dim) => {
                            const options = dimensionValuesMap[dim] || [];
                            if (options.length === 0) return null;
                            const selected = slicerValues[dim] || [];
                            return (
                                <div key={dim}>
                                    <span className="text-xs font-medium text-gray-500 block mb-1">{dim}</span>
                                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                                        {options.slice(0, 8).map((opt) => {
                                            const isSelected = selected.length === 0 || selected.includes(opt.description);
                                            return (
                                                <button
                                                    key={opt.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setSlicerValues((prev) => {
                                                            const next = { ...prev };
                                                            const list = next[dim] || [];
                                                            if (list.includes(opt.description)) {
                                                                next[dim] = list.filter((x) => x !== opt.description);
                                                            } else {
                                                                next[dim] = [...list, opt.description];
                                                            }
                                                            return next;
                                                        });
                                                    }}
                                                    className={`px-2 py-1 rounded text-xs ${
                                                        isSelected ? 'bg-gray-800 text-white' : 'bg-white border border-gray-200 text-gray-600'
                                                    }`}
                                                >
                                                    {opt.description.length > 12 ? opt.description.slice(0, 12) + '…' : opt.description}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Row selector when view by Geography */}
                {viewByGeography && rowKeys.length > 1 && (
                    <div className="mb-4">
                        <span className="text-sm text-gray-500 mr-2">Show:</span>
                        <div className="flex flex-wrap gap-2">
                            {rowKeys.map((rk) => (
                                <button
                                    key={rk}
                                    type="button"
                                    onClick={() => setSelectedRowKey(rk)}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                                        selectedRowKey === rk ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                                >
                                    {rk}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Tabs */}
                <div className="flex border-b border-gray-200 mb-6">
                    <button
                        type="button"
                        onClick={() => setActiveTab('income')}
                        className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 -mb-px ${
                            activeTab === 'income' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        <FileText className="w-4 h-4" />
                        Income Statement
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('balance')}
                        className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 -mb-px ${
                            activeTab === 'balance' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        <LayoutGrid className="w-4 h-4" />
                        Balance Sheet
                    </button>
                </div>

                {activeTab === 'income' && (
                    <>
                        <KPICards
                            data={dashboardData}
                            rowKey={selectedRowKey || 'Total'}
                            periods={selectedQuarters}
                            currentPeriodIndex={Math.max(0, selectedQuarters.length - 1)}
                        />
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-medium text-gray-700">Expand / collapse:</span>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setExpandedPL(new Set(['Revenue', 'OperatingExpenses']))}
                                    className="text-xs text-gray-600 hover:text-gray-900"
                                >
                                    Expand all
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setExpandedPL(new Set())}
                                    className="text-xs text-gray-600 hover:text-gray-900"
                                >
                                    Collapse all
                                </button>
                            </div>
                        </div>
                        <ExpandableTreeTable
                            tree={INCOME_STATEMENT_TREE}
                            data={dashboardData}
                            rowKey={selectedRowKey || 'Total'}
                            periods={selectedQuarters}
                            expandedSections={expandedPL}
                            onToggleSection={(k) => setExpandedPL((prev) => (prev.has(k) ? new Set([...prev].filter((x) => x !== k)) : new Set([...prev, k])))}
                            showPctOfRevenue={true}
                            rowDataByPeriod={currentRowData}
                        />
                    </>
                )}

                {activeTab === 'balance' && (
                    <>
                        {balanceValidation && !balanceValidation.ok && (
                            <div className="mb-4 p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
                                <strong>Balance check:</strong> Total Assets (${formatMillions(balanceValidation.totalA)}M) ≠ Total Liabilities + Total Equity (${formatMillions(balanceValidation.totalL + balanceValidation.totalE)}M). Difference: ${formatMillions(balanceValidation.diff)}M. Please reconcile source data.
                            </div>
                        )}
                        {balanceValidation?.ok && (
                            <div className="mb-4 p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">
                                <strong>Balance check:</strong> Total Assets = Total Liabilities + Total Equity (${formatMillions(balanceValidation!.totalA)}M).
                            </div>
                        )}
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-medium text-gray-700">Expand / collapse:</span>
                            <div className="flex gap-2">
                                <button type="button" onClick={() => setExpandedBS(new Set(['Assets', 'Liabilities', 'Equity']))} className="text-xs text-gray-600 hover:text-gray-900">Expand all</button>
                                <button type="button" onClick={() => setExpandedBS(new Set())} className="text-xs text-gray-600 hover:text-gray-900">Collapse all</button>
                            </div>
                        </div>
                        <ExpandableTreeTable
                            tree={BALANCE_SHEET_TREE}
                            data={dashboardData}
                            rowKey={selectedRowKey || 'Total'}
                            periods={selectedQuarters}
                            expandedSections={expandedBS}
                            onToggleSection={(k) => setExpandedBS((prev) => (prev.has(k) ? new Set([...prev].filter((x) => x !== k)) : new Set([...prev, k])))}
                            showPctOfRevenue={false}
                            rowDataByPeriod={currentRowData}
                        />
                    </>
                )}
            </div>
        </div>
    );
}

export default function CFODashboardPage() {
    return (
        <Suspense
            fallback={
                <div className="flex justify-center items-center min-h-[60vh]">
                    <div className="text-center">
                        <div className="w-10 h-10 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin mx-auto mb-3" />
                        <p className="text-gray-600">Loading CFO Dashboard...</p>
                    </div>
                </div>
            }
        >
            <CFODashboardContent />
        </Suspense>
    );
}
