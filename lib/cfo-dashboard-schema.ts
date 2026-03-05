/**
 * CFO Dashboard – table schema and Fact_Margin field mapping
 * For use with GlobalFinanceData_v3_enhanced.xlsx / Fact_Margin
 */

export type TreeItemType = 'section' | 'line' | 'total';

export interface CFOTreeLine {
  id: string;
  label: string;
  /** Fact_Margin field name(s) – first match wins; totals can be calculated */
  fieldName: string;
  indent: number;
  type: TreeItemType;
  /** For section headers that contain children */
  sectionKey?: string;
  /** If true, value is calculated from children (sum) rather than from Fact_Margin */
  isCalculated?: boolean;
}

// ----- Income Statement (P&L) -----
export const INCOME_STATEMENT_TREE: CFOTreeLine[] = [
  { id: 'rev-section', label: 'Revenue', fieldName: 'TotalRevenue', indent: 0, type: 'section', sectionKey: 'Revenue', isCalculated: true },
  { id: 'mgmt-fee', label: 'Management Fee Revenue', fieldName: 'ManagementFeeRevenue', indent: 1, type: 'line' },
  { id: 'perf-fee', label: 'Performance Fee Revenue', fieldName: 'PerformanceFeeRevenue', indent: 1, type: 'line' },
  { id: 'txn-fee', label: 'Transaction Fee Revenue', fieldName: 'TransactionFeeRevenue', indent: 1, type: 'line' },
  { id: 'net-int', label: 'Net Interest Revenue', fieldName: 'NetInterestRevenue', indent: 1, type: 'line' },
  { id: 'other-rev', label: 'Other Revenue', fieldName: 'OtherRevenue', indent: 1, type: 'line' },
  { id: 'total-rev', label: 'Total Revenue', fieldName: 'TotalRevenue', indent: 0, type: 'total', isCalculated: true },

  { id: 'opex-section', label: 'Operating Expenses', fieldName: 'TotalOperatingExpense', indent: 0, type: 'section', sectionKey: 'OperatingExpenses', isCalculated: true },
  { id: 'comp', label: 'Compensation Expense', fieldName: 'CompensationExpense', indent: 1, type: 'line' },
  { id: 'benefits', label: 'Benefits Expense', fieldName: 'BenefitsExpense', indent: 1, type: 'line' },
  { id: 's&m', label: 'Sales & Marketing Expense', fieldName: 'SalesAndMarketingExpense', indent: 1, type: 'line' },
  { id: 'tech', label: 'Technology Expense', fieldName: 'TechnologyExpense', indent: 1, type: 'line' },
  { id: 'ga', label: 'G&A Expense', fieldName: 'G&AExpense', indent: 1, type: 'line' },
  { id: 'depr', label: 'Depreciation Expense', fieldName: 'DepreciationExpense', indent: 1, type: 'line' },
  { id: 'total-opex', label: 'Total Operating Expenses', fieldName: 'TotalOperatingExpense', indent: 0, type: 'total', isCalculated: true },

  { id: 'ebitda', label: 'EBITDA', fieldName: 'EBITDA', indent: 0, type: 'total' },
  { id: 'op-inc', label: 'Operating Income', fieldName: 'OperatingIncome', indent: 0, type: 'total' },
  { id: 'net-inc', label: 'Net Income', fieldName: 'NetIncome', indent: 0, type: 'total' },
];

// ----- Balance Sheet -----
export const BALANCE_SHEET_TREE: CFOTreeLine[] = [
  { id: 'assets-section', label: 'Assets', fieldName: 'TotalAssets', indent: 0, type: 'section', sectionKey: 'Assets', isCalculated: true },
  { id: 'cash', label: 'Cash and Cash Equivalents', fieldName: 'CashAndCashEquivalents', indent: 1, type: 'line' },
  { id: 'inv-sec', label: 'Investment Securities', fieldName: 'InvestmentSecurities', indent: 1, type: 'line' },
  { id: 'fee-rec', label: 'Fee Receivables', fieldName: 'FeeReceivables', indent: 1, type: 'line' },
  { id: 'goodwill', label: 'Goodwill', fieldName: 'Goodwill', indent: 1, type: 'line' },
  { id: 'intangibles', label: 'Intangible Assets', fieldName: 'IntangibleAssets', indent: 1, type: 'line' },
  { id: 'other-assets', label: 'Other Assets', fieldName: 'OtherAssets', indent: 1, type: 'line' },
  { id: 'total-assets', label: 'Total Assets', fieldName: 'TotalAssets', indent: 0, type: 'total', isCalculated: true },

  { id: 'liab-section', label: 'Liabilities', fieldName: 'TotalLiabilities', indent: 0, type: 'section', sectionKey: 'Liabilities', isCalculated: true },
  { id: 'accr-comp', label: 'Accrued Compensation', fieldName: 'AccruedCompensation', indent: 1, type: 'line' },
  { id: 'def-rev', label: 'Deferred Revenue', fieldName: 'DeferredRevenue', indent: 1, type: 'line' },
  { id: 'ltd', label: 'Long Term Debt', fieldName: 'LongTermDebt', indent: 1, type: 'line' },
  { id: 'other-liab', label: 'Other Liabilities', fieldName: 'OtherLiabilities', indent: 1, type: 'line' },
  { id: 'total-liab', label: 'Total Liabilities', fieldName: 'TotalLiabilities', indent: 0, type: 'total', isCalculated: true },

  { id: 'equity-section', label: 'Equity', fieldName: 'TotalEquity', indent: 0, type: 'section', sectionKey: 'Equity', isCalculated: true },
  { id: 'common-eq', label: 'Common Equity', fieldName: 'CommonEquity', indent: 1, type: 'line' },
  { id: 'ret-earn', label: 'Retained Earnings', fieldName: 'RetainedEarnings', indent: 1, type: 'line' },
  { id: 'total-equity', label: 'Total Equity', fieldName: 'TotalEquity', indent: 0, type: 'total', isCalculated: true },
];

/** Fact_Margin numeric fields that may have _$mm or similar suffix in Excel */
export const FACT_MARGIN_FIELD_VARIANTS: Record<string, string[]> = {
  ManagementFeeRevenue: ['ManagementFeeRevenue', 'ManagementFeeRevenue_$mm'],
  PerformanceFeeRevenue: ['PerformanceFeeRevenue', 'PerformanceFeeRevenue_$mm'],
  TransactionFeeRevenue: ['TransactionFeeRevenue', 'TransactionFeeRevenue_$mm'],
  NetInterestRevenue: ['NetInterestRevenue', 'NetInterestRevenue_$mm'],
  OtherRevenue: ['OtherRevenue', 'OtherRevenue_$mm'],
  TotalRevenue: ['TotalRevenue', 'TotalRevenue_$mm'],
  CompensationExpense: ['CompensationExpense', 'CompensationExpense_$mm', 'Exp_Compensation_$mm'],
  BenefitsExpense: ['BenefitsExpense', 'BenefitsExpense_$mm', 'Exp_CompBenefits_$mm'],
  SalesAndMarketingExpense: ['SalesAndMarketingExpense', 'SalesAndMarketingExpense_$mm', 'Exp_SalesMktg_$mm'],
  TechnologyExpense: ['TechnologyExpense', 'TechnologyExpense_$mm', 'Exp_TechData_$mm'],
  'G&AExpense': ['G&AExpense', 'G&AExpense_$mm', 'Exp_GA_$mm', 'Exp_OpsProfSvcs_$mm'],
  DepreciationExpense: ['DepreciationExpense', 'DepreciationExpense_$mm'],
  TotalOperatingExpense: ['TotalOperatingExpense', 'TotalOperatingExpense_$mm', 'TotalExpense_$mm'],
  EBITDA: ['EBITDA', 'EBITDA_$mm'],
  OperatingIncome: ['OperatingIncome', 'OperatingIncome_$mm'],
  NetIncome: ['NetIncome', 'NetIncome_$mm'],
  CashAndCashEquivalents: ['CashAndCashEquivalents', 'CashAndCashEquivalents_$mm'],
  InvestmentSecurities: ['InvestmentSecurities', 'InvestmentSecurities_$mm'],
  FeeReceivables: ['FeeReceivables', 'FeeReceivables_$mm'],
  Goodwill: ['Goodwill', 'Goodwill_$mm'],
  IntangibleAssets: ['IntangibleAssets', 'IntangibleAssets_$mm'],
  OtherAssets: ['OtherAssets', 'OtherAssets_$mm'],
  TotalAssets: ['TotalAssets', 'TotalAssets_$mm'],
  AccruedCompensation: ['AccruedCompensation', 'AccruedCompensation_$mm'],
  DeferredRevenue: ['DeferredRevenue', 'DeferredRevenue_$mm'],
  LongTermDebt: ['LongTermDebt', 'LongTermDebt_$mm'],
  OtherLiabilities: ['OtherLiabilities', 'OtherLiabilities_$mm'],
  TotalLiabilities: ['TotalLiabilities', 'TotalLiabilities_$mm'],
  CommonEquity: ['CommonEquity', 'CommonEquity_$mm'],
  RetainedEarnings: ['RetainedEarnings', 'RetainedEarnings_$mm'],
  TotalEquity: ['TotalEquity', 'TotalEquity_$mm'],
  AssetsUnderManagement: ['AssetsUnderManagement', 'AssetsUnderManagement_$mm', 'AUM_$mm'],
};

export const SLICER_DIMENSIONS = [
  'CostCenter',
  'Geography',
  'LegalEntity',
  'LineOfBusiness',
  'ProductType',
  'Scenario',
] as const;

export type SlicerDimension = (typeof SLICER_DIMENSIONS)[number];

export const SCENARIO_OPTIONS = ['Actual', 'Budget', 'Forecast'] as const;
export type ScenarioOption = (typeof SCENARIO_OPTIONS)[number];
