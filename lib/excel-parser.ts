export interface PeriodData {
    value: number;
    period?: string;
}

export interface DriverTreeNode {
    id: string;
    name: string;
    level: number;
    parentId?: string;
    accountingAmount?: number;
    rateAmount?: number;
    rawAmount?: number; // Raw Amount from Fee Rate Fact (for calculation: Accounted Amount = Fee Rate × Raw Amount)
    feeRate?: number; // Fee Rate from Fee Rate Fact
    accountingPeriods?: PeriodData[];
    ratePeriods?: PeriodData[];
    accountingTrend?: number; // Percentage change from first to last period
    rateTrend?: number; // Percentage change from first to last period
    isFeeRateDriver?: boolean; // True if this driver comes from Fee Rate Fact tab
    children?: DriverTreeNode[];
}

export interface AccountingFactRecord {
    driverId: string;
    productId?: string;
    period: string;
    accountedAmount: number;
}

export interface ProductDIMRecord {
    productId: string;
    productSegment: string;
}

export interface ExcelDriverTreeData {
    tree: DriverTreeNode[];
    accountingFacts: Map<string, PeriodData[]>;
    rateFacts: Map<string, PeriodData[]> | Map<string, { feeRate: PeriodData[]; rawAmount: PeriodData[]; accountedAmount: PeriodData[] }>;
    accountingFactRecords?: AccountingFactRecord[]; // Full records with Product ID
    productDIM?: Map<string, ProductDIMRecord>; // Map of Product ID to Product DIM record
}

/**
 * Parse Excel file and extract Driver Tree structure with Accounting and Rate Facts
 */
export async function parseDriverTreeExcel(file: File): Promise<ExcelDriverTreeData> {
    // Dynamically import xlsx - handle both default and named exports
    let XLSX: any;
    try {
        const xlsxModule = await import('xlsx');
        XLSX = xlsxModule.default || xlsxModule;
    } catch (error) {
        throw new Error('Failed to load xlsx library. Please ensure it is installed.');
    }
    
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                if (!data) {
                    reject(new Error('Failed to read file'));
                    return;
                }

                if (!XLSX || typeof XLSX.read !== 'function') {
                    reject(new Error('XLSX library not properly loaded'));
                    return;
                }

                const workbook = XLSX.read(data, { type: 'binary' });
                
                // Parse Driver Tree tab
                const driverTreeSheet = workbook.Sheets['Driver Tree'] || workbook.Sheets[workbook.SheetNames.find((name: string) => name.toLowerCase().includes('driver')) || ''];
                if (!driverTreeSheet) {
                    reject(new Error('Driver Tree sheet not found. Please ensure a sheet named "Driver Tree" exists.'));
                    return;
                }

                // Parse Accounting Fact tab
                const accountingSheet = workbook.Sheets['Accounting Fact'] || workbook.Sheets[workbook.SheetNames.find((name: string) => name.toLowerCase().includes('accounting')) || ''];
                
                // Parse Product DIM tab
                const productDIMSheet = workbook.Sheets['Product DIM'] || workbook.Sheets[workbook.SheetNames.find((name: string) => name.toLowerCase().includes('product dim') || name.toLowerCase().includes('product_dim')) || ''];
                
                // Parse Fee Rate Fact tab (preferred) or Rate Fact tab
                const feeRateFactSheet = workbook.Sheets['Fee Rate Fact'] || workbook.Sheets[workbook.SheetNames.find((name: string) => name.toLowerCase().includes('fee rate')) || ''];
                const rateFactSheet = workbook.Sheets['Rate Fact'] || workbook.Sheets[workbook.SheetNames.find((name: string) => name.toLowerCase().includes('rate fact') && !name.toLowerCase().includes('fee')) || ''];

                // Extract driver tree structure
                const tree = parseDriverTreeSheet(driverTreeSheet, XLSX);
                
                // Extract accounting facts - look for 'Accounted Amount' column specifically
                const { accountingFacts, accountingFactRecords } = accountingSheet ? parseAccountingFactSheet(accountingSheet, XLSX) : { accountingFacts: new Map<string, PeriodData[]>(), accountingFactRecords: [] };
                
                // Extract Product DIM
                const productDIM = productDIMSheet ? parseProductDIMSheet(productDIMSheet, XLSX) : new Map<string, ProductDIMRecord>();
                
                // Extract rate facts - try Fee Rate Fact first, then Rate Fact
                let rateFacts: Map<string, PeriodData[]> | Map<string, { feeRate: PeriodData[]; rawAmount: PeriodData[]; accountedAmount: PeriodData[] }>;
                if (feeRateFactSheet) {
                    rateFacts = parseFeeRateFactSheet(feeRateFactSheet, XLSX);
                } else if (rateFactSheet) {
                    rateFacts = parseFactSheet(rateFactSheet, XLSX);
                } else {
                    rateFacts = new Map<string, PeriodData[]>();
                }

                // Map amounts to tree nodes
                mapAmountsToTree(tree, accountingFacts, rateFacts);

                resolve({
                    tree,
                    accountingFacts,
                    rateFacts,
                    accountingFactRecords,
                    productDIM
                });
            } catch (error) {
                reject(error);
            }
        };

        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsBinaryString(file);
    });
}

/**
 * Parse Driver Tree sheet to extract hierarchical structure
 * Expected format: columns for level indicators (Level 1, Level 2, Level 3, etc.)
 * or a single column with indentation/prefixes indicating hierarchy
 */
function parseDriverTreeSheet(sheet: any, XLSX: any): DriverTreeNode[] {
    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    
    if (!jsonData || jsonData.length === 0) {
        return [];
    }

    // Try to detect the structure
    const firstRow = jsonData[0] as any[];
    const hasLevelColumns = firstRow.some((cell: any) => 
        typeof cell === 'string' && cell.toLowerCase().includes('level')
    );

    if (hasLevelColumns) {
        return parseLevelColumns(jsonData);
    } else {
        // Try to parse as single column with hierarchy indicators
        return parseHierarchicalColumn(jsonData);
    }
}

/**
 * Parse when structure has explicit level columns (Level 1, Level 2, etc.)
 * Builds complete hierarchy by processing all levels in each row
 */
function parseLevelColumns(data: any[][]): DriverTreeNode[] {
    const tree: DriverTreeNode[] = [];
    const nodeMap = new Map<string, DriverTreeNode>(); // Map by name+level for deduplication
    let nodeIdCounter = 0;

    // Find level columns and sort them
    const headerRow = data[0] as any[];
    const levelColumns: { index: number; level: number }[] = [];
    headerRow.forEach((header, index) => {
        if (typeof header === 'string') {
            const levelMatch = header.toLowerCase().match(/level\s*(\d+)/);
            if (levelMatch) {
                levelColumns.push({ index, level: parseInt(levelMatch[1]) });
            } else if (header.toLowerCase().includes('level')) {
                // Fallback: assume order indicates level
                levelColumns.push({ index, level: levelColumns.length + 1 });
            }
        }
    });

    // Sort by level
    levelColumns.sort((a, b) => a.level - b.level);

    if (levelColumns.length === 0) {
        // If no level columns found, assume first column is the hierarchy
        return parseHierarchicalColumn(data);
    }

    // Process data rows (skip header)
    for (let i = 1; i < data.length; i++) {
        const row = data[i] as any[];
        if (!row || row.every(cell => !cell)) continue;

        let parentNode: DriverTreeNode | null = null;

        // Process each level from top to bottom to build the hierarchy
        for (let colIdx = 0; colIdx < levelColumns.length; colIdx++) {
            const { index: colIndex, level } = levelColumns[colIdx];
            const cellValue = row[colIndex];
            
            if (!cellValue || !String(cellValue).trim()) {
                // If this level is empty, skip remaining levels for this row
                break;
            }

            const nodeName = String(cellValue).trim();
            if (!nodeName) continue;

            // Create a unique key for this node (name + level + parent)
            const nodeKey = `${nodeName}|${level}|${parentNode?.id || 'root'}`;
            
            // Check if we've already created this node
            let currentNode: DriverTreeNode | undefined = nodeMap.get(nodeKey);
            
            if (!currentNode) {
                // Create new node
                const nodeId = `node-${nodeIdCounter++}`;
                currentNode = {
                    id: nodeId,
                    name: nodeName,
                    level: level,
                    parentId: parentNode ? parentNode.id : undefined,
                    children: []
                };
                nodeMap.set(nodeKey, currentNode);

                // Add to tree or parent
                if (parentNode) {
                    if (!parentNode.children) parentNode.children = [];
                    parentNode.children.push(currentNode);
                } else {
                    tree.push(currentNode);
                }
            }
            
            parentNode = currentNode;
        }
    }

    return tree;
}

/**
 * Parse when structure is a single column with hierarchy indicated by indentation or prefixes
 */
function parseHierarchicalColumn(data: any[][]): DriverTreeNode[] {
    const tree: DriverTreeNode[] = [];
    const nodeMap = new Map<string, DriverTreeNode>();
    let nodeIdCounter = 0;
    const stack: DriverTreeNode[] = [];

    // Process data rows
    for (let i = 0; i < data.length; i++) {
        const row = data[i] as any[];
        if (!row || row.length === 0) continue;

        const firstCell = row[0];
        if (!firstCell) continue;

        const cellValue = String(firstCell).trim();
        if (!cellValue) continue;

        // Detect level by indentation or prefix
        const indentMatch = cellValue.match(/^(\s*|-+|•+)/);
        const indentLevel = indentMatch ? Math.floor(indentMatch[1].length / 2) : 0;
        const cleanName = cellValue.replace(/^[\s\-•]+/, '').trim();

        if (!cleanName) continue;

        const nodeId = `node-${nodeIdCounter++}`;
        const node: DriverTreeNode = {
            id: nodeId,
            name: cleanName,
            level: indentLevel + 1,
            children: []
        };

        // Find parent based on level
        while (stack.length > 0 && stack[stack.length - 1].level >= node.level) {
            stack.pop();
        }

        if (stack.length > 0) {
            const parent = stack[stack.length - 1];
            node.parentId = parent.id;
            if (!parent.children) parent.children = [];
            parent.children.push(node);
        } else {
            tree.push(node);
        }

        stack.push(node);
        nodeMap.set(nodeId, node);
    }

    return tree;
}

/**
 * Parse Accounting Fact sheet - handles both formats:
 * 1. Multiple period columns (old format)
 * 2. Single Period column + Accounted Amount column (new format)
 * Also captures Product ID if present
 */
function parseAccountingFactSheet(sheet: any, XLSX: any): { accountingFacts: Map<string, PeriodData[]>; accountingFactRecords: AccountingFactRecord[] } {
    const facts = new Map<string, PeriodData[]>();
    const records: AccountingFactRecord[] = [];
    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    if (!jsonData || jsonData.length === 0) {
        return { accountingFacts: facts, accountingFactRecords: records };
    }

    const headerRow = jsonData[0] as any[];
    let idColumnIndex = -1;
    let productIdColumnIndex = -1;
    let periodColumnIndex = -1;
    let accountedAmountColumnIndex = -1;

    // Find identifier column (Driver ID)
    headerRow.forEach((header, index) => {
        const headerStr = String(header).toLowerCase().trim();
        if ((headerStr.includes('id') || headerStr.includes('name') || headerStr.includes('driver') || headerStr.includes('node')) && !headerStr.includes('product')) {
            if (idColumnIndex === -1) idColumnIndex = index;
        }
    });

    // Find Product ID column
    headerRow.forEach((header, index) => {
        const headerStr = String(header).toLowerCase().trim();
        if (headerStr.includes('product') && headerStr.includes('id')) {
            if (productIdColumnIndex === -1) productIdColumnIndex = index;
        }
    });

    // Check for new format: single Period column + Accounted Amount column
    headerRow.forEach((header, index) => {
        const headerStr = String(header).toLowerCase().trim();
        if (headerStr === 'period' || headerStr.includes('period')) {
            if (periodColumnIndex === -1) periodColumnIndex = index;
        }
        if (headerStr.includes('accounted amount') || (headerStr.includes('accounted') && headerStr.includes('amount'))) {
            if (accountedAmountColumnIndex === -1) accountedAmountColumnIndex = index;
        }
    });

    if (idColumnIndex === -1) idColumnIndex = 0;

    // New format: Period column + Accounted Amount column
    if (periodColumnIndex >= 0 && accountedAmountColumnIndex >= 0) {
        // Group by driver ID and collect period/amount pairs
        const driverData = new Map<string, PeriodData[]>();
        
        for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i] as any[];
            if (!row || row.length === 0) continue;

            const id = row[idColumnIndex];
            const productId = productIdColumnIndex >= 0 ? row[productIdColumnIndex] : undefined;
            const periodValue = row[periodColumnIndex];
            const amountValue = row[accountedAmountColumnIndex];

            if (!id || !periodValue || amountValue === undefined || amountValue === null || amountValue === '') continue;

            const idStr = String(id).trim();
            // Handle period value - if it's a number, it might be an Excel serial date
            let periodStr: string;
            if (typeof periodValue === 'number') {
                // Check if it's a reasonable Excel serial date (1 to ~50000)
                if (periodValue >= 1 && periodValue <= 100000) {
                    // Convert Excel serial date to date string
                    // Excel serial 1 = Jan 1, 1900
                    // Excel incorrectly treats 1900 as a leap year (it wasn't)
                    // Standard conversion: Excel epoch is Jan 1, 1900, but we use Dec 30, 1899
                    // and add (serial - 1) days, then add 1 day to account for the leap year bug
                    // Actually, the correct formula is: Dec 30, 1899 + serial days
                    const excelEpoch = new Date(1899, 11, 30); // Dec 30, 1899
                    const date = new Date(excelEpoch.getTime() + periodValue * 24 * 60 * 60 * 1000);
                    if (!isNaN(date.getTime())) {
                        // Format as YYYY-MM-DD
                        const year = date.getFullYear();
                        const month = String(date.getMonth() + 1).padStart(2, '0');
                        const day = String(date.getDate()).padStart(2, '0');
                        periodStr = `${year}-${month}-${day}`;
                    } else {
                        periodStr = String(periodValue).trim();
                    }
                } else {
                    periodStr = String(periodValue).trim();
                }
            } else {
                periodStr = String(periodValue).trim();
            }
            const productIdStr = productId ? String(productId).trim() : undefined;
            
            const amountNum = typeof amountValue === 'number' ? amountValue : parseFloat(String(amountValue).replace(/[^0-9.-]/g, ''));
            if (isNaN(amountNum)) continue;

            if (!driverData.has(idStr)) {
                driverData.set(idStr, []);
            }
            
            driverData.get(idStr)!.push({
                value: amountNum,
                period: periodStr
            });

            // Store full record with Product ID
            records.push({
                driverId: idStr,
                productId: productIdStr,
                period: periodStr,
                accountedAmount: amountNum
            });
        }

        // Convert to the expected format
        driverData.forEach((periods, id) => {
            if (periods.length > 0) {
                facts.set(id, periods);
            }
        });

        return { accountingFacts: facts, accountingFactRecords: records };
    }

    // Old format: multiple period columns
    const accountedAmountColumns: { index: number; period: string }[] = [];
    
    headerRow.forEach((header, index) => {
        const headerStr = String(header).toLowerCase().trim();
        if (headerStr.includes('accounted amount') || (headerStr.includes('accounted') && headerStr.includes('amount'))) {
            accountedAmountColumns.push({ index, period: String(header) });
        }
    });

    if (accountedAmountColumns.length === 0) {
        headerRow.forEach((header, index) => {
            const headerStr = String(header).toLowerCase();
            if (headerStr.includes('amount') || headerStr.includes('value') || headerStr.includes('$')) {
                accountedAmountColumns.push({ index, period: String(header) });
            }
        });
    }

    if (accountedAmountColumns.length === 0) {
        for (let i = 1; i < headerRow.length; i++) {
            accountedAmountColumns.push({ index: i, period: String(headerRow[i]) || `Period ${i}` });
        }
    }

    // Process data rows for old format
    for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i] as any[];
        if (!row || row.length === 0) continue;

        const id = row[idColumnIndex];
        const productId = productIdColumnIndex >= 0 ? row[productIdColumnIndex] : undefined;
        if (!id) continue;

        const idStr = String(id).trim();
        const productIdStr = productId ? String(productId).trim() : undefined;
        if (!idStr) continue;

        const periods: PeriodData[] = [];
        
        accountedAmountColumns.forEach(({ index, period }) => {
            const value = row[index];
            if (value !== undefined && value !== null && value !== '') {
                const valueNum = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.-]/g, ''));
                if (!isNaN(valueNum)) {
                    periods.push({ value: valueNum, period });
                    // Store full record with Product ID
                    records.push({
                        driverId: idStr,
                        productId: productIdStr,
                        period: period,
                        accountedAmount: valueNum
                    });
                }
            }
        });

        if (periods.length > 0) {
            facts.set(idStr, periods);
        }
    }

    return { accountingFacts: facts, accountingFactRecords: records };
}

/**
 * Parse Product DIM sheet - extracts Product ID and Product Segment mapping
 * Expected format: Product ID column + Product Segment column
 */
function parseProductDIMSheet(sheet: any, XLSX: any): Map<string, ProductDIMRecord> {
    const productDIM = new Map<string, ProductDIMRecord>();
    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    if (!jsonData || jsonData.length === 0) {
        return productDIM;
    }

    const headerRow = jsonData[0] as any[];
    let productIdColumnIndex = -1;
    let productSegmentColumnIndex = -1;

    // Find Product ID column
    headerRow.forEach((header, index) => {
        const headerStr = String(header).toLowerCase().trim();
        if (headerStr.includes('product') && headerStr.includes('id')) {
            if (productIdColumnIndex === -1) productIdColumnIndex = index;
        }
    });

    // Find Product Segment column
    headerRow.forEach((header, index) => {
        const headerStr = String(header).toLowerCase().trim();
        if (headerStr.includes('product') && headerStr.includes('segment')) {
            if (productSegmentColumnIndex === -1) productSegmentColumnIndex = index;
        }
    });

    // If Product Segment not found, try alternative names
    if (productSegmentColumnIndex === -1) {
        headerRow.forEach((header, index) => {
            const headerStr = String(header).toLowerCase().trim();
            if (headerStr.includes('segment') && !headerStr.includes('product')) {
                if (productSegmentColumnIndex === -1) productSegmentColumnIndex = index;
            }
        });
    }

    // Default to first column if Product ID not found, second column for Product Segment
    if (productIdColumnIndex === -1) productIdColumnIndex = 0;
    if (productSegmentColumnIndex === -1) productSegmentColumnIndex = 1;

    // Process data rows
    for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i] as any[];
        if (!row || row.length === 0) continue;

        const productId = row[productIdColumnIndex];
        const productSegment = row[productSegmentColumnIndex];

        if (!productId) continue;

        const productIdStr = String(productId).trim();
        const productSegmentStr = productSegment ? String(productSegment).trim() : '';

        if (productIdStr) {
            productDIM.set(productIdStr, {
                productId: productIdStr,
                productSegment: productSegmentStr
            });
        }
    }

    return productDIM;
}

/**
 * Parse Fee Rate Fact sheet - captures Fee Rate, Raw Amount, and calculates Accounted Amount
 * Expected format: identifier + Fee Rate + Raw Amount columns
 * Returns map with fee rate, raw amount, and calculated accounted amount
 */
function parseFeeRateFactSheet(sheet: any, XLSX: any): Map<string, { feeRate: PeriodData[]; rawAmount: PeriodData[]; accountedAmount: PeriodData[] }> {
    const facts = new Map<string, { feeRate: PeriodData[]; rawAmount: PeriodData[]; accountedAmount: PeriodData[] }>();
    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    if (!jsonData || jsonData.length === 0) {
        return facts;
    }

    const headerRow = jsonData[0] as any[];
    let idColumnIndex = -1;
    const feeRateColumns: { index: number; period: string }[] = [];
    const rawAmountColumns: { index: number; period: string }[] = [];

    // Find identifier column
    headerRow.forEach((header, index) => {
        const headerStr = String(header).toLowerCase().trim();
        if (headerStr.includes('id') || headerStr.includes('name') || headerStr.includes('driver') || headerStr.includes('node')) {
            if (idColumnIndex === -1) idColumnIndex = index;
        }
    });

    // Find Fee Rate columns
    headerRow.forEach((header, index) => {
        const headerStr = String(header).toLowerCase().trim();
        if (headerStr.includes('fee rate') || (headerStr.includes('rate') && !headerStr.includes('raw'))) {
            feeRateColumns.push({ index, period: String(header) });
        }
    });

    // Find Raw Amount columns
    headerRow.forEach((header, index) => {
        const headerStr = String(header).toLowerCase().trim();
        if (headerStr.includes('raw amount') || (headerStr.includes('raw') && headerStr.includes('amount'))) {
            rawAmountColumns.push({ index, period: String(header) });
        }
    });

    if (idColumnIndex === -1) idColumnIndex = 0;

    // Process data rows
    for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i] as any[];
        if (!row || row.length === 0) continue;

        const id = row[idColumnIndex];
        if (!id) continue;

        const idStr = String(id).trim();
        if (!idStr) continue;

        const feeRates: PeriodData[] = [];
        const rawAmounts: PeriodData[] = [];
        const accountedAmounts: PeriodData[] = [];

        // Extract Fee Rates
        feeRateColumns.forEach(({ index, period }) => {
            const value = row[index];
            if (value !== undefined && value !== null && value !== '') {
                const valueNum = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.-]/g, ''));
                if (!isNaN(valueNum)) {
                    feeRates.push({ value: valueNum, period });
                }
            }
        });

        // Extract Raw Amounts
        rawAmountColumns.forEach(({ index, period }) => {
            const value = row[index];
            if (value !== undefined && value !== null && value !== '') {
                const valueNum = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.-]/g, ''));
                if (!isNaN(valueNum)) {
                    rawAmounts.push({ value: valueNum, period });
                }
            }
        });

        // Calculate Accounted Amount = Fee Rate × Raw Amount for each period
        // Match periods between fee rate and raw amount
        feeRates.forEach((feeRate) => {
            const matchingRawAmount = rawAmounts.find(ra => ra.period === feeRate.period) || rawAmounts[0];
            if (matchingRawAmount) {
                const accountedValue = feeRate.value * matchingRawAmount.value;
                accountedAmounts.push({ 
                    value: accountedValue, 
                    period: feeRate.period 
                });
            }
        });

        if (feeRates.length > 0 || rawAmounts.length > 0) {
            facts.set(idStr, { feeRate: feeRates, rawAmount: rawAmounts, accountedAmount: accountedAmounts });
        }
    }

    return facts;
}

/**
 * Parse fact sheet (legacy - for Rate Fact if Fee Rate Fact not found)
 * Handles both formats:
 * 1. Multiple period columns (old format)
 * 2. Single Period column + value column (new format)
 */
function parseFactSheet(sheet: any, XLSX: any): Map<string, PeriodData[]> {
    const facts = new Map<string, PeriodData[]>();
    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    if (!jsonData || jsonData.length === 0) {
        return facts;
    }

    const headerRow = jsonData[0] as any[];
    let idColumnIndex = -1;
    let periodColumnIndex = -1;
    let valueColumnIndex = -1;

    // Find identifier column
    headerRow.forEach((header, index) => {
        const headerStr = String(header).toLowerCase().trim();
        if (headerStr.includes('id') || headerStr.includes('name') || headerStr.includes('driver') || headerStr.includes('node')) {
            if (idColumnIndex === -1) idColumnIndex = index;
        }
    });

    // Check for new format: single Period column + value column
    headerRow.forEach((header, index) => {
        const headerStr = String(header).toLowerCase().trim();
        if (headerStr === 'period' || (headerStr.includes('period') && !headerStr.includes('amount'))) {
            if (periodColumnIndex === -1) periodColumnIndex = index;
        }
        // Look for rate, amount, or value column (but not period)
        if (headerStr.includes('rate') || headerStr.includes('amount') || headerStr.includes('value')) {
            if (valueColumnIndex === -1 && !headerStr.includes('period')) valueColumnIndex = index;
        }
    });

    if (idColumnIndex === -1) idColumnIndex = 0;

    // New format: Period column + value column
    if (periodColumnIndex >= 0 && valueColumnIndex >= 0) {
        // Group by driver ID and collect period/value pairs
        const driverData = new Map<string, PeriodData[]>();
        
        for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i] as any[];
            if (!row || row.length === 0) continue;

            const id = row[idColumnIndex];
            const periodValue = row[periodColumnIndex];
            const value = row[valueColumnIndex];

            if (!id || !periodValue || value === undefined || value === null || value === '') continue;

            const idStr = String(id).trim();
            const periodStr = String(periodValue).trim();
            
            const valueNum = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.-]/g, ''));
            if (isNaN(valueNum)) continue;

            if (!driverData.has(idStr)) {
                driverData.set(idStr, []);
            }
            
            driverData.get(idStr)!.push({
                value: valueNum,
                period: periodStr
            });
        }

        // Convert to the expected format
        driverData.forEach((periods, id) => {
            if (periods.length > 0) {
                facts.set(id, periods);
            }
        });

        return facts;
    }

    // Old format: multiple period columns
    const periodColumns: { index: number; period: string }[] = [];

    headerRow.forEach((header, index) => {
        const headerStr = String(header).toLowerCase().trim();
        if (headerStr && !headerStr.includes('level') && !headerStr.includes('id') && !headerStr.includes('name') && !headerStr.includes('driver') && !headerStr.includes('node')) {
            periodColumns.push({ index, period: String(header) });
        }
    });

    if (periodColumns.length === 0) {
        headerRow.forEach((header, index) => {
            const headerStr = String(header).toLowerCase();
            if (headerStr.includes('amount') || headerStr.includes('value') || headerStr.includes('$') || headerStr.includes('total') || headerStr.includes('period')) {
                periodColumns.push({ index, period: String(header) });
            }
        });
    }

    if (periodColumns.length === 0 && idColumnIndex >= 0) {
        for (let i = idColumnIndex + 1; i < headerRow.length; i++) {
            periodColumns.push({ index: i, period: String(headerRow[i]) || `Period ${i - idColumnIndex}` });
        }
    }

    if (idColumnIndex === -1) idColumnIndex = 0;
    if (periodColumns.length === 0) {
        for (let i = 1; i < headerRow.length; i++) {
            periodColumns.push({ index: i, period: String(headerRow[i]) || `Period ${i}` });
        }
    }

    // Process data rows for old format
    for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i] as any[];
        if (!row || row.length === 0) continue;

        const id = row[idColumnIndex];
        if (!id) continue;

        const idStr = String(id).trim();
        if (!idStr) continue;

        const periods: PeriodData[] = [];
        
        periodColumns.forEach(({ index, period }) => {
            const value = row[index];
            if (value !== undefined && value !== null && value !== '') {
                const valueNum = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.-]/g, ''));
                if (!isNaN(valueNum)) {
                    periods.push({ value: valueNum, period });
                }
            }
        });

        if (periods.length > 0) {
            facts.set(idStr, periods);
        }
    }

    return facts;
}

/**
 * Map accounting and rate amounts to tree nodes
 * Matches by node name (exact or partial) and aggregates upward
 */
/**
 * Parse period string to date for sorting
 */
function parsePeriodDate(period: string | undefined): Date | null {
    if (!period) return null;
    
    const periodStr = String(period).trim();
    
    // Try quarterly formats first
    const quarterlyMatch1 = periodStr.match(/Q(\d)\s+(\d{4})/i); // Q1 2024
    if (quarterlyMatch1) {
        const quarter = parseInt(quarterlyMatch1[1]);
        const year = parseInt(quarterlyMatch1[2]);
        return new Date(year, (quarter - 1) * 3, 1);
    }
    
    const quarterlyMatch2 = periodStr.match(/(\d{4})-Q(\d)/i); // 2024-Q1
    if (quarterlyMatch2) {
        const year = parseInt(quarterlyMatch2[1]);
        const quarter = parseInt(quarterlyMatch2[2]);
        return new Date(year, (quarter - 1) * 3, 1);
    }
    
    // Try year-month formats
    const yearMonthMatch1 = periodStr.match(/(\d{4})M(\d{2})/); // 2024M01
    if (yearMonthMatch1) {
        const year = parseInt(yearMonthMatch1[1]);
        const month = parseInt(yearMonthMatch1[2]) - 1;
        return new Date(year, month, 1);
    }
    
    const yearMonthMatch2 = periodStr.match(/(\d{4})(\d{2})/); // 202401
    if (yearMonthMatch2 && yearMonthMatch2[0].length === 6) {
        const year = parseInt(yearMonthMatch2[1]);
        const month = parseInt(yearMonthMatch2[2]) - 1;
        if (month >= 0 && month <= 11) {
            return new Date(year, month, 1);
        }
    }
    
    // Try standard date formats - try parsing directly first
    const directDate = new Date(periodStr);
    if (!isNaN(directDate.getTime())) {
        return directDate;
    }
    
    // Try MM/DD/YYYY format explicitly
    const mmddyyyyMatch = periodStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (mmddyyyyMatch) {
        const month = parseInt(mmddyyyyMatch[1]) - 1;
        const day = parseInt(mmddyyyyMatch[2]);
        const year = parseInt(mmddyyyyMatch[3]);
        const date = new Date(year, month, day);
        if (!isNaN(date.getTime())) {
            return date;
        }
    }
    
    // Try YYYY-MM-DD format
    const yyyymmddMatch = periodStr.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (yyyymmddMatch) {
        const year = parseInt(yyyymmddMatch[1]);
        const month = parseInt(yyyymmddMatch[2]) - 1;
        const day = parseInt(yyyymmddMatch[3]);
        const date = new Date(year, month, day);
        if (!isNaN(date.getTime())) {
            return date;
        }
    }
    
    // Try direct date parsing as last resort
    const date = new Date(periodStr);
    if (!isNaN(date.getTime())) {
        return date;
    }
    
    return null;
}

/**
 * Calculate trend percentage from min period date to max period date
 */
function calculateTrend(periods: PeriodData[]): number | undefined {
    if (!periods || periods.length < 2) return undefined;
    
    // Sort periods by date (min to max)
    const periodsWithDates = periods.map(p => ({
        ...p,
        date: parsePeriodDate(p.period)
    }));
    
    // Filter out periods without valid dates
    const validPeriods = periodsWithDates.filter(p => p.date !== null);
    
    if (validPeriods.length < 2) {
        // If we can't parse dates, fall back to first/last
        const firstValue = periods[0].value;
        const lastValue = periods[periods.length - 1].value;
        
        if (Math.abs(firstValue) < 0.0001) {
            if (Math.abs(lastValue) < 0.0001) {
                return 0;
            }
            return undefined; // Can't calculate from zero
        }
        
        const trend = ((lastValue - firstValue) / Math.abs(firstValue)) * 100;
        if (isNaN(trend) || !isFinite(trend)) {
            return undefined;
        }
        return trend;
    }
    
    // Sort by date
    validPeriods.sort((a, b) => {
        if (!a.date || !b.date) return 0;
        return a.date.getTime() - b.date.getTime();
    });
    
    // Get min and max date periods
    const minPeriod = validPeriods[0];
    const maxPeriod = validPeriods[validPeriods.length - 1];
    
    const minValue = minPeriod.value;
    const maxValue = maxPeriod.value;
    
    // Handle zero values more carefully
    if (Math.abs(minValue) < 0.0001) {
        // If min value is essentially zero, return undefined
        if (Math.abs(maxValue) < 0.0001) {
            return 0; // Both are zero, no change
        }
        // Can't calculate meaningful percentage change from zero
        return undefined;
    }
    
    // Calculate percentage change: ((max date value - min date value) / |min date value|) * 100
    const trend = ((maxValue - minValue) / Math.abs(minValue)) * 100;
    
    // Return the trend, handling edge cases
    if (isNaN(trend) || !isFinite(trend)) {
        return undefined;
    }
    
    return trend;
}

function mapAmountsToTree(
    tree: DriverTreeNode[],
    accountingFacts: Map<string, PeriodData[]>,
    rateFacts: Map<string, PeriodData[]> | Map<string, { feeRate: PeriodData[]; rawAmount: PeriodData[]; accountedAmount: PeriodData[] }>
): void {
    // Check if rateFacts is the new Fee Rate Fact structure
    const rateFactsValues = Array.from(rateFacts.values() as any);
    const isFeeRateFactStructure = rateFacts.size > 0 && 
        rateFactsValues[0] && 
        typeof rateFactsValues[0] === 'object' && 
        'feeRate' in rateFactsValues[0];
    // Map amounts to all nodes (not just leaf nodes) to populate "Increase Rates" section
    const mapToNode = (node: DriverTreeNode) => {
        const isLeaf = !node.children || node.children.length === 0;
        
        // Check if this node is part of "Increase Rates" section
        const isIncreaseRateNode = node.name.toLowerCase().includes('increase rate') || 
                                  node.name.toLowerCase().includes('rate');
        
        // Map to all nodes, not just leaf nodes, especially for Increase Rates section
        const shouldMap = isLeaf || isIncreaseRateNode;
        
        if (shouldMap) {
            // Try to find matching fact by name (case-insensitive, exact or partial match)
            // Try exact match first
            let accountingMatched = false;
            let rateMatched = false;

            for (const [factKey, periods] of accountingFacts.entries()) {
                const factKeyLower = factKey.toLowerCase().trim();
                const nodeNameLower = node.name.toLowerCase().trim();
                
                // Exact match
                if (factKeyLower === nodeNameLower) {
                    node.accountingPeriods = periods;
                    node.accountingAmount = periods.length > 0 ? periods[periods.length - 1].value : 0;
                    node.accountingTrend = calculateTrend(periods);
                    accountingMatched = true;
                    break;
                }
            }

            // If no exact match, try partial match
            if (!accountingMatched) {
                for (const [factKey, periods] of accountingFacts.entries()) {
                    const factKeyLower = factKey.toLowerCase().trim();
                    const nodeNameLower = node.name.toLowerCase().trim();
                    
                    if (factKeyLower.includes(nodeNameLower) || nodeNameLower.includes(factKeyLower)) {
                        node.accountingPeriods = periods;
                        node.accountingAmount = periods.length > 0 ? periods[periods.length - 1].value : 0;
                        node.accountingTrend = calculateTrend(periods);
                        break;
                    }
                }
            }

            // Handle rate facts - check if it's Fee Rate Fact structure or legacy
            if (isFeeRateFactStructure) {
                // New Fee Rate Fact structure
                for (const [factKey, rateData] of (rateFacts as Map<string, { feeRate: PeriodData[]; rawAmount: PeriodData[]; accountedAmount: PeriodData[] }>).entries()) {
                    const factKeyLower = factKey.toLowerCase().trim();
                    const nodeNameLower = node.name.toLowerCase().trim();
                    
                    const isMatch = factKeyLower === nodeNameLower || 
                                   factKeyLower.includes(nodeNameLower) || 
                                   nodeNameLower.includes(factKeyLower);
                    
                    if (isMatch) {
                        node.isFeeRateDriver = true;
                        node.ratePeriods = rateData.feeRate;
                        node.rateAmount = rateData.feeRate.length > 0 ? rateData.feeRate[rateData.feeRate.length - 1].value : 0;
                        node.rawAmount = rateData.rawAmount.length > 0 ? rateData.rawAmount[rateData.rawAmount.length - 1].value : 0;
                        node.feeRate = node.rateAmount;
                        node.rateTrend = calculateTrend(rateData.feeRate);
                        
                        // For Increase Rates section, show Fee Rate as percentage
                        // Don't override accounting amount if it's already set from Accounting Fact
                        // Only set from Fee Rate Fact if this is a Fee Rate driver and no accounting amount exists
                        if (rateData.accountedAmount.length > 0 && !node.accountingAmount) {
                            node.accountingPeriods = rateData.accountedAmount;
                            node.accountingAmount = rateData.accountedAmount[rateData.accountedAmount.length - 1].value;
                            node.accountingTrend = calculateTrend(rateData.accountedAmount);
                        }
                        
                        rateMatched = true;
                        break;
                    }
                }
            } else {
                // Legacy Rate Fact structure (Rate Fact tab - not Fee Rate Fact)
                for (const [factKey, periods] of (rateFacts as Map<string, PeriodData[]>).entries()) {
                    const factKeyLower = factKey.toLowerCase().trim();
                    const nodeNameLower = node.name.toLowerCase().trim();
                    
                    // Try exact match first
                    if (factKeyLower === nodeNameLower) {
                        node.ratePeriods = periods;
                        node.rateAmount = periods.length > 0 ? periods[periods.length - 1].value : 0;
                        node.rateTrend = calculateTrend(periods);
                        rateMatched = true;
                        break;
                    }
                }

                // If no exact match, try partial match
                if (!rateMatched) {
                    for (const [factKey, periods] of (rateFacts as Map<string, PeriodData[]>).entries()) {
                        const factKeyLower = factKey.toLowerCase().trim();
                        const nodeNameLower = node.name.toLowerCase().trim();
                        
                        if (factKeyLower.includes(nodeNameLower) || nodeNameLower.includes(factKeyLower)) {
                            node.ratePeriods = periods;
                            node.rateAmount = periods.length > 0 ? periods[periods.length - 1].value : 0;
                            node.rateTrend = calculateTrend(periods);
                            rateMatched = true;
                            break;
                        }
                    }
                }
            }
        }

        // Recursively map children first
        if (node.children) {
            node.children.forEach(child => mapToNode(child));
        }
    };

    // Map amounts to all nodes
    tree.forEach(node => mapToNode(node));

    // Now aggregate amounts and trends upward from children to parents
    const aggregateUpward = (node: DriverTreeNode): { 
        accounting: number; 
        rate: number;
        accountingPeriods: PeriodData[];
        ratePeriods: PeriodData[];
    } => {
        let accountingTotal = node.accountingAmount || 0;
        let rateTotal = node.rateAmount || 0;
        let accountingPeriods: PeriodData[] = node.accountingPeriods ? [...node.accountingPeriods] : [];
        let ratePeriods: PeriodData[] = node.ratePeriods ? [...node.ratePeriods] : [];

        // Sum from children
        if (node.children && node.children.length > 0) {
            node.children.forEach(child => {
                const childTotals = aggregateUpward(child);
                accountingTotal += childTotals.accounting;
                rateTotal += childTotals.rate;
                
                // Aggregate periods by summing corresponding period values
                // Match periods by period name/date, not just index
                if (childTotals.accountingPeriods.length > 0) {
                    if (accountingPeriods.length === 0) {
                        accountingPeriods = childTotals.accountingPeriods.map(p => ({ ...p }));
                    } else {
                        // Match periods by period name/date
                        childTotals.accountingPeriods.forEach(childPeriod => {
                            const matchingPeriod = accountingPeriods.find(p => p.period === childPeriod.period);
                            if (matchingPeriod) {
                                matchingPeriod.value += childPeriod.value;
                            } else {
                                // If no match, add as new period
                                accountingPeriods.push({ ...childPeriod });
                            }
                        });
                    }
                }
                
                if (childTotals.ratePeriods.length > 0) {
                    if (ratePeriods.length === 0) {
                        ratePeriods = childTotals.ratePeriods.map(p => ({ ...p }));
                    } else {
                        // Match periods by period name/date
                        childTotals.ratePeriods.forEach(childPeriod => {
                            const matchingPeriod = ratePeriods.find(p => p.period === childPeriod.period);
                            if (matchingPeriod) {
                                matchingPeriod.value += childPeriod.value;
                            } else {
                                // If no match, add as new period
                                ratePeriods.push({ ...childPeriod });
                            }
                        });
                    }
                }
            });
        }

        // Update node with aggregated data
        if (accountingPeriods.length > 0) {
            node.accountingPeriods = accountingPeriods;
            node.accountingAmount = accountingTotal;
            node.accountingTrend = calculateTrend(accountingPeriods);
        }
        if (ratePeriods.length > 0) {
            node.ratePeriods = ratePeriods;
            node.rateAmount = rateTotal;
            node.rateTrend = calculateTrend(ratePeriods);
        }

        return { 
            accounting: accountingTotal, 
            rate: rateTotal,
            accountingPeriods,
            ratePeriods
        };
    };

    // Aggregate from root nodes
    tree.forEach(node => aggregateUpward(node));
}

/**
 * Flatten tree structure for easier rendering
 */
export function flattenTree(nodes: DriverTreeNode[]): DriverTreeNode[] {
    const result: DriverTreeNode[] = [];
    
    const traverse = (node: DriverTreeNode) => {
        result.push(node);
        if (node.children) {
            node.children.forEach(child => traverse(child));
        }
    };

    nodes.forEach(node => traverse(node));
    return result;
}

