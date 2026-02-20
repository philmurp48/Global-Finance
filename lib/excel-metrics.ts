import { ExcelDriverTreeData, DriverTreeNode, PeriodData } from './excel-parser';

/**
 * Extract metrics and KPIs from Excel data for Executive Summary tiles
 */
export function extractExecutiveSummaryMetrics(excelData: ExcelDriverTreeData | null) {
    if (!excelData || !excelData.tree || excelData.tree.length === 0) {
        return null;
    }

    // Calculate total revenue (sum of all accounting amounts at root level)
    const calculateTotalRevenue = (nodes: DriverTreeNode[]): number => {
        let total = 0;
        nodes.forEach(node => {
            if (node.accountingAmount) {
                total += node.accountingAmount;
            }
            if (node.children) {
                total += calculateTotalRevenue(node.children);
            }
        });
        return total;
    };

    // Find nodes by name pattern
    const findNodesByName = (nodes: DriverTreeNode[], pattern: string): DriverTreeNode[] => {
        const results: DriverTreeNode[] = [];
        nodes.forEach(node => {
            if (node.name.toLowerCase().includes(pattern.toLowerCase())) {
                results.push(node);
            }
            if (node.children) {
                results.push(...findNodesByName(node.children, pattern));
            }
        });
        return results;
    };

    // Get latest period value
    const getLatestValue = (periods: PeriodData[] | undefined): number => {
        if (!periods || periods.length === 0) return 0;
        return periods[periods.length - 1].value;
    };

    // Calculate trend (percentage change from first to last)
    const calculateTrend = (periods: PeriodData[] | undefined): number => {
        if (!periods || periods.length < 2) return 0;
        const first = periods[0].value;
        const last = periods[periods.length - 1].value;
        if (first === 0) return 0;
        return ((last - first) / Math.abs(first)) * 100;
    };

    const totalRevenue = calculateTotalRevenue(excelData.tree);
    
    // Extract key metrics from tree structure
    const revenueNodes = findNodesByName(excelData.tree, 'revenue');
    const costNodes = findNodesByName(excelData.tree, 'cost');
    const profitNodes = findNodesByName(excelData.tree, 'profit');
    const marginNodes = findNodesByName(excelData.tree, 'margin');
    const volumeNodes = findNodesByName(excelData.tree, 'volume');
    const priceNodes = findNodesByName(excelData.tree, 'price');
    const marketNodes = findNodesByName(excelData.tree, 'market');
    const salesNodes = findNodesByName(excelData.tree, 'sales');
    const operationalNodes = findNodesByName(excelData.tree, 'operational');
    const efficiencyNodes = findNodesByName(excelData.tree, 'efficiency');
    const qualityNodes = findNodesByName(excelData.tree, 'quality');
    const inventoryNodes = findNodesByName(excelData.tree, 'inventory');
    const supplyChainNodes = findNodesByName(excelData.tree, 'supply chain');

    // Calculate metrics
    const revenue = revenueNodes.reduce((sum, node) => sum + (node.accountingAmount || 0), 0) || totalRevenue;
    const costs = costNodes.reduce((sum, node) => sum + (node.accountingAmount || 0), 0);
    const profit = profitNodes.reduce((sum, node) => sum + (node.accountingAmount || 0), 0) || (revenue - costs);
    const volume = volumeNodes.reduce((sum, node) => sum + (node.accountingAmount || 0), 0);
    const sales = salesNodes.reduce((sum, node) => sum + (node.accountingAmount || 0), 0) || revenue;

    // Get trends from accounting facts
    const revenueTrend = excelData.accountingFacts && revenueNodes.length > 0 
        ? calculateTrend(excelData.accountingFacts.get(revenueNodes[0].id))
        : 0;
    
    const profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0;
    const costRatio = revenue > 0 ? (costs / revenue) * 100 : 0;

    // Find top level 1 nodes for categorization
    const level1Nodes = excelData.tree.filter(node => node.level === 1);
    
    // Extract operational metrics
    const operationalTotal = operationalNodes.reduce((sum, node) => sum + (node.accountingAmount || 0), 0);
    const efficiencyTotal = efficiencyNodes.reduce((sum, node) => sum + (node.accountingAmount || 0), 0);
    const qualityTotal = qualityNodes.reduce((sum, node) => sum + (node.accountingAmount || 0), 0);

    return {
        totalRevenue: revenue,
        totalCosts: costs,
        totalProfit: profit,
        profitMargin,
        costRatio,
        volume,
        sales,
        revenueTrend,
        operationalTotal,
        efficiencyTotal,
        qualityTotal,
        level1Nodes,
        allNodes: excelData.tree
    };
}

/**
 * Extract scenario levers from Excel data
 */
export function extractScenarioLevers(excelData: ExcelDriverTreeData | null) {
    if (!excelData || !excelData.tree || excelData.tree.length === 0) {
        return [];
    }

    try {
        // Find Level 4 nodes (leaf nodes in new structure) that can be adjusted
        const findLevel4Nodes = (nodes: DriverTreeNode[]): DriverTreeNode[] => {
            const results: DriverTreeNode[] = [];
            if (!nodes || !Array.isArray(nodes)) {
                return results;
            }
            nodes.forEach(node => {
                if (!node) return;
                // In new structure, Driver Level 4 is the leaf level that matches Fact_Margin amount types
                if (node.level === 4 || (!node.children || node.children.length === 0)) {
                    if (node.accountingAmount !== undefined || node.rateAmount !== undefined) {
                        results.push(node);
                    }
                }
                if (node.children && Array.isArray(node.children)) {
                    results.push(...findLevel4Nodes(node.children));
                }
            });
            return results;
        };

        const level4Nodes = findLevel4Nodes(excelData.tree);

        // Convert to lever format
        return level4Nodes.map(node => {
            const currentValue = node.accountingAmount || node.rateAmount || 0;
            const absValue = Math.abs(currentValue);
            return {
                id: node.id || `lever-${Math.random()}`,
                name: node.name || 'Unnamed Lever',
                category: getCategoryFromPath(node, excelData.tree),
                currentValue: currentValue,
                minValue: currentValue * 0.5, // Allow 50% reduction
                maxValue: currentValue * 2, // Allow 100% increase
                unit: node.rateAmount !== undefined ? '%' : '$',
                impact: absValue > 1000 ? 'high' : absValue > 100 ? 'medium' : 'low',
                node: node
            };
        });
    } catch (error) {
        console.error('Error extracting scenario levers:', error);
        return [];
    }
}

/**
 * Get category from node path in tree
 */
function getCategoryFromPath(node: DriverTreeNode, tree: DriverTreeNode[]): string {
    try {
        if (!node || !node.id || !tree || !Array.isArray(tree)) {
            return 'Other';
        }
        
        const findPath = (nodes: DriverTreeNode[], targetId: string, path: string[] = []): string[] | null => {
            if (!nodes || !Array.isArray(nodes)) {
                return null;
            }
            for (const n of nodes) {
                if (!n || !n.id) continue;
                if (n.id === targetId) {
                    return [...path, n.name || 'Unnamed'];
                }
                if (n.children && Array.isArray(n.children)) {
                    const result = findPath(n.children, targetId, [...path, n.name || 'Unnamed']);
                    if (result) return result;
                }
            }
            return null;
        };

        const path = findPath(tree, node.id);
        if (path && path.length > 1) {
            return path[0]; // Use first level as category
        }
        return 'Other';
    } catch (error) {
        console.error('Error getting category from path:', error);
        return 'Other';
    }
}

/**
 * Extract operational performance metrics from Excel data
 */
export function extractOperationalMetrics(excelData: ExcelDriverTreeData | null) {
    if (!excelData || !excelData.tree || excelData.tree.length === 0) {
        return null;
    }

    // Find nodes by operational keywords
    const findNodesByKeywords = (nodes: DriverTreeNode[], keywords: string[]): DriverTreeNode[] => {
        const results: DriverTreeNode[] = [];
        nodes.forEach(node => {
            const nameLower = node.name.toLowerCase();
            if (keywords.some(keyword => nameLower.includes(keyword))) {
                results.push(node);
            }
            if (node.children) {
                results.push(...findNodesByKeywords(node.children, keywords));
            }
        });
        return results;
    };

    // Manufacturing metrics
    const oeeNodes = findNodesByKeywords(excelData.tree, ['oee', 'overall equipment effectiveness', 'efficiency']);
    const productionNodes = findNodesByKeywords(excelData.tree, ['production', 'volume', 'output', 'units']);
    const qualityNodes = findNodesByKeywords(excelData.tree, ['quality', 'defect', 'yield', 'first pass']);
    const deliveryNodes = findNodesByKeywords(excelData.tree, ['delivery', 'on-time', 'on time', 'schedule']);

    // Supply chain metrics
    const inventoryNodes = findNodesByKeywords(excelData.tree, ['inventory', 'stock', 'turn', 'days']);
    const supplyChainNodes = findNodesByKeywords(excelData.tree, ['supply chain', 'logistics', 'procurement']);

    // Digital metrics
    const digitalNodes = findNodesByKeywords(excelData.tree, ['digital', 'connected', 'subscription', 'service']);

    // Calculate values
    const oee = oeeNodes.length > 0 ? oeeNodes[0].rateAmount || oeeNodes[0].accountingAmount || 0 : 0;
    const productionVolume = productionNodes.reduce((sum, node) => sum + (node.accountingAmount || 0), 0);
    const qualityRate = qualityNodes.length > 0 ? qualityNodes[0].rateAmount || 0 : 0;
    const onTimeDelivery = deliveryNodes.length > 0 ? deliveryNodes[0].rateAmount || 0 : 0;
    const inventoryTurns = inventoryNodes.find(n => n.name.toLowerCase().includes('turn'))?.rateAmount || 0;
    const digitalRevenue = digitalNodes.reduce((sum, node) => sum + (node.accountingAmount || 0), 0);

    return {
        oee: oee > 1 ? oee : oee * 100, // Convert to percentage if needed
        productionVolume,
        qualityRate: qualityRate > 1 ? qualityRate : qualityRate * 100,
        onTimeDelivery: onTimeDelivery > 1 ? onTimeDelivery : onTimeDelivery * 100,
        inventoryTurns,
        digitalRevenue,
        oeeNodes,
        productionNodes,
        qualityNodes,
        deliveryNodes,
        inventoryNodes,
        digitalNodes
    };
}

