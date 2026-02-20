'use client';

import DisclaimerModal from '@/components/DisclaimerModal';
import { AnimatePresence, motion } from 'framer-motion';
import {
    ArrowRight,
    BarChart3,
    Brain,
    Building,
    Calendar,
    Clock,
    DollarSign,
    Globe,
    LineChart,
    Package,
    Search,
    Target,
    TrendingDown,
    TrendingUp,
    Truck,
    Users,
    X
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useMemo } from 'react';
import { ExcelDriverTreeData, joinFactWithDimension, getDimensionTableNames } from '@/lib/excel-parser';
import { extractExecutiveSummaryMetrics } from '@/lib/excel-metrics';

const personalizedInsights = [
    {
        id: 1,
        title: 'Market Share Analysis',
        kpi: '18.2%',
        kpiLabel: 'Market Share Declining',
        insight: 'Lost 0.3% to new EV entrants',
        trend: 'down',
        value: '-0.3%',
        priority: 'critical',
        icon: Globe,
        bgColor: 'bg-purple-50',
        iconColor: 'text-purple-700',
        valueColor: 'text-red-600',
        action: 'View Details',
        category: 'Market',
        // Enhanced data fields
        confidenceScore: 92,
        dataSource: 'Fin360 Data Platform',
        lastUpdated: '2 hours ago',
        aiRecommendations: [
            'Launch aggressive pricing campaign in key EV segments',
            'Accelerate EV product roadmap by 6 months',
            'Partner with charging network providers'
        ],
        impactedMetrics: [
            { metric: 'Revenue Impact', value: '-$60M', trend: 'negative' },
            { metric: 'Unit Volume', value: '-1,250 units', trend: 'negative' },
            { metric: 'Customer Retention', value: '94%', trend: 'stable' }
        ],
        historicalContext: 'Market share has declined for 3 consecutive months',
        predictiveInsight: 'Expected to stabilize at -0.4% without intervention',
        dataQuality: 'High',
        modelAccuracy: '94%',
        consoleLink: '/business-consoles/market-demand',
        consoleAvailable: true
    },
    {
        id: 2,
        title: 'Competitive Intelligence',
        kpi: '42%',
        kpiLabel: 'EV Mix Below Target',
        insight: 'Premium EV adoption lagging',
        trend: 'down',
        value: '-5%',
        priority: 'high',
        icon: Target,
        bgColor: 'bg-purple-50',
        iconColor: 'text-purple-700',
        valueColor: 'text-red-600',
        action: 'View Details',
        category: 'Product Mix',
        // Enhanced data fields
        confidenceScore: 88,
        dataSource: 'SAP Analytics Cloud',
        lastUpdated: '4 hours ago',
        aiRecommendations: [
            'Increase EV marketing budget by 25%',
            'Introduce mid-range EV models',
            'Enhance dealer EV training programs'
        ],
        impactedMetrics: [
            { metric: 'EV Revenue Mix', value: '42% vs 47% target', trend: 'negative' },
            { metric: 'Average Transaction Price', value: '$52,400', trend: 'positive' },
            { metric: 'Inventory Turnover', value: '8.2x', trend: 'stable' }
        ],
        historicalContext: 'EV mix has been below target for 2 quarters',
        predictiveInsight: 'Without intervention, EV mix will reach only 44% by year-end',
        dataQuality: 'High',
        modelAccuracy: '91%',
        consoleLink: '/business-consoles/product-performance',
        consoleAvailable: false
    },
    {
        id: 3,
        title: 'Product Performance',
        kpi: '$55.2K',
        kpiLabel: 'Revenue/Unit Rising',
        insight: 'ATP up $1,500 via mix',
        trend: 'up',
        value: '+3.2%',
        priority: 'medium',
        icon: Package,
        bgColor: 'bg-blue-50',
        iconColor: 'text-blue-700',
        valueColor: 'text-green-600',
        action: 'View Details',
        category: 'Pricing',
        // Enhanced data fields
        confidenceScore: 95,
        dataSource: 'Fin360 Data Platform',
        lastUpdated: '1 hour ago',
        aiRecommendations: [
            'Maintain premium positioning strategy',
            'Bundle high-margin accessories',
            'Focus on personalization options'
        ],
        impactedMetrics: [
            { metric: 'Gross Margin', value: '21.3%', trend: 'positive' },
            { metric: 'Option Take Rate', value: '78%', trend: 'positive' },
            { metric: 'Financing Penetration', value: '65%', trend: 'stable' }
        ],
        historicalContext: 'ATP has increased for 5 consecutive months',
        predictiveInsight: 'ATP growth expected to moderate to +2.5% next quarter',
        dataQuality: 'Very High',
        modelAccuracy: '96%',
        consoleLink: '/business-consoles/product-performance',
        consoleAvailable: false
    },
    {
        id: 4,
        title: 'Regional Sales',
        kpi: '68%',
        kpiLabel: 'Digital Revenue Growth',
        insight: 'Connected services +45%',
        trend: 'up',
        value: '+15%',
        priority: 'high',
        icon: Building,
        bgColor: 'bg-indigo-50',
        iconColor: 'text-indigo-700',
        valueColor: 'text-green-600',
        action: 'View Details',
        category: 'Digital',
        // Enhanced data fields
        confidenceScore: 93,
        dataSource: 'Salesforce CRM + Fin360',
        lastUpdated: '30 minutes ago',
        aiRecommendations: [
            'Expand subscription service offerings',
            'Develop predictive maintenance packages',
            'Create tiered subscription models'
        ],
        impactedMetrics: [
            { metric: 'Recurring Revenue', value: '$124M ARR', trend: 'positive' },
            { metric: 'Service Attach Rate', value: '68%', trend: 'positive' },
            { metric: 'Customer Lifetime Value', value: '$4,250', trend: 'positive' }
        ],
        historicalContext: 'Digital services have grown 45% YoY',
        predictiveInsight: 'Digital revenue projected to reach 72% penetration by Q2',
        dataQuality: 'High',
        modelAccuracy: '92%',
        consoleLink: '/business-consoles/regional-sales',
        consoleAvailable: false
    },
    {
        id: 5,
        title: 'Manufacturing Efficiency',
        kpi: '2.8M',
        kpiLabel: 'Production Volume',
        insight: 'Q4 capacity at 88% utilization',
        trend: 'up',
        value: '+8.5%',
        priority: 'low',
        icon: Truck,
        bgColor: 'bg-teal-50',
        iconColor: 'text-teal-700',
        valueColor: 'text-green-600',
        action: 'View Details',
        category: 'Volume',
        // Enhanced data fields
        confidenceScore: 97,
        dataSource: 'SAP Manufacturing Execution',
        lastUpdated: '15 minutes ago',
        aiRecommendations: [
            'Optimize shift patterns for 92% utilization',
            'Implement predictive maintenance schedule',
            'Cross-train operators for flexibility'
        ],
        impactedMetrics: [
            { metric: 'OEE Score', value: '88%', trend: 'positive' },
            { metric: 'Cost per Unit', value: '$38,450', trend: 'stable' },
            { metric: 'Quality Rate', value: '99.2%', trend: 'positive' }
        ],
        historicalContext: 'Production volume has exceeded targets for 4 months',
        predictiveInsight: 'Capacity constraints expected in Q1 if demand continues',
        dataQuality: 'Very High',
        modelAccuracy: '98%'
    },
    {
        id: 6,
        title: 'Supply Chain Status',
        kpi: '92.3%',
        kpiLabel: 'Manufacturing Excellence',
        insight: 'Zero critical quality issues',
        trend: 'up',
        value: '+1.8%',
        priority: 'medium',
        icon: Package,
        bgColor: 'bg-emerald-50',
        iconColor: 'text-emerald-700',
        valueColor: 'text-green-600',
        action: 'View Details',
        category: 'Quality',
        // Enhanced data fields
        confidenceScore: 96,
        dataSource: 'Quality Management System',
        lastUpdated: '3 hours ago',
        aiRecommendations: [
            'Maintain current quality protocols',
            'Invest in automated inspection systems',
            'Expand supplier quality programs'
        ],
        impactedMetrics: [
            { metric: 'First Pass Yield', value: '92.3%', trend: 'positive' },
            { metric: 'Warranty Claims', value: '0.8%', trend: 'positive' },
            { metric: 'Customer Satisfaction', value: '4.6/5.0', trend: 'stable' }
        ],
        historicalContext: 'Quality metrics at 18-month high',
        predictiveInsight: 'Quality expected to remain stable with current processes',
        dataQuality: 'High',
        modelAccuracy: '95%'
    },
    {
        id: 7,
        title: 'Financial Performance',
        kpi: '12.5%',
        kpiLabel: 'EBIT Margin Pressure',
        insight: 'Commodity impact -120bps',
        trend: 'down',
        value: '+0.8%',
        priority: 'high',
        icon: DollarSign,
        bgColor: 'bg-amber-50',
        iconColor: 'text-amber-700',
        valueColor: 'text-green-600',
        action: 'View Details',
        category: 'Financial',
        // Enhanced data fields
        confidenceScore: 90,
        dataSource: 'SAP S/4HANA Finance',
        lastUpdated: '1 hour ago',
        aiRecommendations: [
            'Accelerate cost reduction initiatives',
            'Hedge commodity exposure',
            'Renegotiate supplier contracts'
        ],
        impactedMetrics: [
            { metric: 'EBIT Margin', value: '12.5%', trend: 'negative' },
            { metric: 'Material Costs', value: '+8.2% YoY', trend: 'negative' },
            { metric: 'Operating Leverage', value: '2.1x', trend: 'stable' }
        ],
        historicalContext: 'Margins compressed due to commodity inflation',
        predictiveInsight: 'Margin recovery expected in H2 with pricing actions',
        dataQuality: 'Very High',
        modelAccuracy: '93%'
    },
    {
        id: 8,
        title: 'Working Capital',
        kpi: '94%',
        kpiLabel: 'Supply Chain Crisis',
        insight: 'Chip shortage affecting 3 models',
        trend: 'down',
        value: '-2.1%',
        priority: 'critical',
        icon: Clock,
        bgColor: 'bg-red-50',
        iconColor: 'text-red-700',
        valueColor: 'text-red-600',
        action: 'View Details',
        category: 'Supply Chain',
        // Enhanced data fields
        confidenceScore: 85,
        dataSource: 'Supply Chain Control Tower',
        lastUpdated: '10 minutes ago',
        aiRecommendations: [
            'Secure alternative chip suppliers',
            'Redesign for chip flexibility',
            'Prioritize high-margin models'
        ],
        impactedMetrics: [
            { metric: 'Parts Availability', value: '94%', trend: 'negative' },
            { metric: 'Production Delays', value: '12,000 units', trend: 'negative' },
            { metric: 'Inventory Days', value: '45 days', trend: 'negative' }
        ],
        historicalContext: 'Chip shortage has impacted production for 3 weeks',
        predictiveInsight: 'Supply expected to normalize in 6-8 weeks',
        dataQuality: 'Medium',
        modelAccuracy: '87%'
    },
    {
        id: 9,
        title: 'Customer Metrics',
        kpi: '$3.2B',
        kpiLabel: 'Service Revenue Up',
        insight: 'Parts e-commerce +28%',
        trend: 'up',
        value: '+12%',
        priority: 'high',
        icon: Users,
        bgColor: 'bg-green-50',
        iconColor: 'text-green-700',
        valueColor: 'text-green-600',
        action: 'View Details',
        category: 'Aftermarket',
        consoleLink: '/business-consoles/customer',
        consoleAvailable: false
    },
    {
        id: 10,
        title: 'Inventory Management',
        kpi: '18.2%',
        kpiLabel: 'Capital Efficiency',
        insight: 'ROIC improving via optimization',
        trend: 'up',
        value: '+1.2%',
        priority: 'low',
        icon: Package,
        bgColor: 'bg-blue-50',
        iconColor: 'text-blue-700',
        valueColor: 'text-green-600',
        action: 'View Details',
        category: 'Capital',
        consoleLink: '/business-consoles/operations',
        consoleAvailable: false
    },
    {
        id: 11,
        title: 'Monthly Close Status',
        kpi: '$32.5K',
        kpiLabel: 'Cost Per Vehicle',
        insight: 'Material costs up $2,500',
        trend: 'down',
        value: '-8.3%',
        priority: 'critical',
        icon: Calendar,
        bgColor: 'bg-orange-50',
        iconColor: 'text-orange-700',
        valueColor: 'text-red-600',
        action: 'View Details',
        category: 'Financial Close',
        consoleLink: '/monthly-report',
        consoleAvailable: true
    },
    {
        id: 12,
        title: 'Revenue Impact',
        kpi: '$1.2B',
        kpiLabel: 'FX Impact on Revenue',
        insight: 'USD strength affecting exports',
        trend: 'down',
        value: '-2.8%',
        priority: 'medium',
        icon: DollarSign,
        bgColor: 'bg-purple-50',
        iconColor: 'text-purple-700',
        valueColor: 'text-red-600',
        action: 'View Details',
        category: 'Risk',
        consoleLink: '/business-consoles/financial-performance',
        consoleAvailable: false
    },
    {
        id: 13,
        title: 'Production Output',
        kpi: '912K',
        kpiLabel: 'Units Produced',
        insight: 'Q4 tracking +5% vs guidance',
        trend: 'up',
        value: '+5.2%',
        priority: 'low',
        icon: BarChart3,
        bgColor: 'bg-green-50',
        iconColor: 'text-green-700',
        valueColor: 'text-green-600',
        action: 'View Details',
        category: 'Manufacturing',
        consoleLink: '/business-consoles/operations',
        consoleAvailable: false
    },
    {
        id: 14,
        title: 'ESG Performance',
        kpi: '32%',
        kpiLabel: 'Carbon Reduction',
        insight: 'Ahead of 2025 targets',
        trend: 'up',
        value: '+8%',
        priority: 'low',
        icon: Building,
        bgColor: 'bg-emerald-50',
        iconColor: 'text-emerald-700',
        valueColor: 'text-green-600',
        action: 'View Details',
        category: 'Sustainability',
        consoleLink: '/business-consoles/sustainability',
        consoleAvailable: false
    }
];

export default function HomePage() {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [selectedInsight, setSelectedInsight] = useState<any>(null);
    const [showSearchResults, setShowSearchResults] = useState(false);
    const [searchResults, setSearchResults] = useState<any>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [excelData, setExcelData] = useState<ExcelDriverTreeData | null>(null);

    // Load Excel data on mount
    useEffect(() => {
        const loadData = async () => {
            try {
                const response = await fetch('/api/excel-data');
                if (response.ok) {
                    const result = await response.json();
                    if (result.data) {
                        const parsed = result.data;
                        const restoredData: ExcelDriverTreeData = {
                            tree: parsed.tree || [],
                            accountingFacts: new Map(parsed.accountingFacts || []),
                            factMarginRecords: parsed.factMarginRecords || [],
                            dimensionTables: new Map(Object.entries(parsed.dimensionTables || {}).map(([k, v]) => [k, new Map(Object.entries(v as any))])),
                            namingConventionRecords: parsed.namingConventionRecords || []
                        };
                        setExcelData(restoredData);
                    }
                }
            } catch (error) {
                console.error('Failed to load Excel data:', error);
            }
        };

        loadData();
    }, []);

    // Generate personalized insights from Excel data
    const excelMetrics = useMemo(() => extractExecutiveSummaryMetrics(excelData), [excelData]);
    
    // Helper to get Report naming from NamingConvention based on Fact_Margin field name
    const getReportNaming = (factMarginFieldName: string): string => {
        if (!excelData?.namingConventionRecords || excelData.namingConventionRecords.length === 0) {
            return factMarginFieldName; // Fallback to field name
        }
        
        // Find column names
        const findColumnName = (records: any[], possibleNames: string[]): string | null => {
            if (records.length === 0) return null;
            const firstRecord = records[0];
            const keys = Object.keys(firstRecord);
            for (const name of possibleNames) {
                const found = keys.find(k => k.toLowerCase() === name.toLowerCase());
                if (found) return found;
            }
            return null;
        };
        
        const factMarginNamingCol = findColumnName(excelData.namingConventionRecords, [
            'Fact_Margin Naming', 'Fact_Margin naming', 'Fact Margin Naming', 
            'Fact Margin naming', 'Naming', 'Field Name', 'Fact_Margin Field Name'
        ]);
        const reportNamingCol = findColumnName(excelData.namingConventionRecords, [
            'Report Naming', 'Report naming', 'Report Naming Column', 'Report Field Name'
        ]);
        
        if (!factMarginNamingCol || !reportNamingCol) {
            return factMarginFieldName;
        }
        
        // Find matching record
        const normalizeFieldName = (name: string) => {
            return name.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
        };
        
        const targetNormalized = normalizeFieldName(factMarginFieldName);
        for (const record of excelData.namingConventionRecords) {
            const factMarginNaming = String(record[factMarginNamingCol] || '').trim();
            const factMarginNormalized = normalizeFieldName(factMarginNaming);
            
            if (factMarginNormalized === targetNormalized || 
                factMarginNormalized.includes(targetNormalized) || 
                targetNormalized.includes(factMarginNormalized)) {
                const reportNaming = String(record[reportNamingCol] || '').trim();
                if (reportNaming) {
                    return reportNaming;
                }
            }
        }
        
        return factMarginFieldName; // Fallback
    };
    
    // Helper to get field value from Fact_Margin record (reuse from scenario-modeling)
    const getFieldValue = (record: any, fieldName: string): number | null => {
        if (!record || !fieldName) return null;
        
        const normalizeFieldName = (name: string) => {
            return name.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
        };
        
        const targetNormalized = normalizeFieldName(fieldName);
        
        // Try exact match first
        for (const [key, value] of Object.entries(record)) {
            const keyLower = key.toLowerCase();
            if (keyLower.includes('id') || keyLower.includes('period') || keyLower.includes('date') || keyLower.includes('quarter')) continue;
            
            const keyNormalized = normalizeFieldName(key);
            if (keyNormalized === targetNormalized) {
                const numValue = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.-]/g, ''));
                if (!isNaN(numValue)) {
                    return numValue;
                }
            }
        }
        
        // Try partial match
        for (const [key, value] of Object.entries(record)) {
            const keyLower = key.toLowerCase();
            if (keyLower.includes('id') || keyLower.includes('period') || keyLower.includes('date') || keyLower.includes('quarter')) continue;
            
            const keyNormalized = normalizeFieldName(key);
            if (keyNormalized.includes(targetNormalized) || targetNormalized.includes(keyNormalized)) {
                const numValue = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.-]/g, ''));
                if (!isNaN(numValue)) {
                    return numValue;
                }
            }
        }
        
        return null;
    };
    
    // Helper to get max quarter value and trend vs quarter-1 for a field
    const getKPIValueAndTrend = (fieldName: string): { value: number; trend: number; maxQuarter: string; prevQuarter: string | null } => {
        if (!excelData?.factMarginRecords || excelData.factMarginRecords.length === 0) {
            return { value: 0, trend: 0, maxQuarter: '', prevQuarter: null };
        }
        
        // Group records by quarter
        const quarterData: { [quarter: string]: number[] } = {};
        const quarters: string[] = [];
        
        excelData.factMarginRecords.forEach(record => {
            const quarterKey = Object.keys(record).find(key => key.toLowerCase() === 'quarter');
            if (!quarterKey || !record[quarterKey]) return;
            
            const quarter = String(record[quarterKey]).trim();
            if (!quarter) return;
            
            const fieldValue = getFieldValue(record, fieldName);
            if (fieldValue !== null && !isNaN(fieldValue)) {
                if (!quarterData[quarter]) {
                    quarterData[quarter] = [];
                    quarters.push(quarter);
                }
                quarterData[quarter].push(fieldValue);
            }
        });
        
        if (quarters.length === 0) {
            return { value: 0, trend: 0, maxQuarter: '', prevQuarter: null };
        }
        
        // Sort quarters and get max quarter
        const sortedQuarters = quarters.sort();
        const maxQuarter = sortedQuarters[sortedQuarters.length - 1];
        const maxQuarterIndex = sortedQuarters.indexOf(maxQuarter);
        const prevQuarter = maxQuarterIndex > 0 ? sortedQuarters[maxQuarterIndex - 1] : null;
        
        // Calculate max quarter value (sum all records for that quarter)
        const maxQuarterValue = quarterData[maxQuarter]?.reduce((sum, val) => sum + val, 0) || 0;
        const prevQuarterValue = prevQuarter ? (quarterData[prevQuarter]?.reduce((sum, val) => sum + val, 0) || 0) : 0;
        
        // Calculate trend percentage
        const trend = prevQuarterValue !== 0 ? ((maxQuarterValue - prevQuarterValue) / Math.abs(prevQuarterValue)) * 100 : 0;
        
        return {
            value: maxQuarterValue,
            trend: trend,
            maxQuarter: maxQuarter,
            prevQuarter: prevQuarter
        };
    };
    
    const dynamicInsights = useMemo(() => {
        if (!excelMetrics) {
            return personalizedInsights; // Fallback to default
        }

        const insights: any[] = [];
        let idCounter = 1;

        // Primary Financial Metrics (Top Row)
        // Total Revenue
        if (excelMetrics.totalRevenue && excelMetrics.totalRevenue > 0) {
            const trend = excelMetrics.revenueTrend || 0;
            insights.push({
                id: idCounter++,
                title: 'Total Revenue',
                kpi: `$${Math.round(excelMetrics.totalRevenue)}MM`,
                kpiLabel: 'Total Revenue',
                insight: `Aggregated from all revenue streams`,
                trend: trend >= 0 ? 'up' : 'down',
                value: `${trend >= 0 ? '+' : ''}${trend.toFixed(1)}%`,
                priority: 'high',
                icon: DollarSign,
                bgColor: 'bg-green-50',
                iconColor: 'text-green-700',
                valueColor: trend >= 0 ? 'text-green-600' : 'text-red-600',
                action: 'View Details',
                category: 'Financial',
                confidenceScore: 95,
                dataSource: 'Fact_Margin',
                lastUpdated: 'Just now'
            });
        }

        // Total Expense
        if (excelMetrics.totalExpense && excelMetrics.totalExpense > 0) {
            const trend = excelMetrics.expenseTrend || 0;
            insights.push({
                id: idCounter++,
                title: 'Total Expense',
                kpi: `$${Math.round(excelMetrics.totalExpense)}MM`,
                kpiLabel: 'Total Expense',
                insight: `Total operating expenses`,
                trend: trend >= 0 ? 'up' : 'down',
                value: `${trend >= 0 ? '+' : ''}${trend.toFixed(1)}%`,
                priority: 'high',
                icon: TrendingDown,
                bgColor: 'bg-red-50',
                iconColor: 'text-red-700',
                valueColor: trend >= 0 ? 'text-red-600' : 'text-green-600',
                action: 'View Details',
                category: 'Financial',
                confidenceScore: 95,
                dataSource: 'Fact_Margin',
                lastUpdated: 'Just now'
            });
        }

        // Margin
        if (excelMetrics.totalMargin !== undefined && excelMetrics.totalMargin !== 0) {
            const trend = excelMetrics.marginTrend || 0;
            insights.push({
                id: idCounter++,
                title: 'Margin',
                kpi: `$${Math.round(excelMetrics.totalMargin)}MM`,
                kpiLabel: 'Margin',
                insight: `Revenue minus expenses`,
                trend: trend >= 0 ? 'up' : 'down',
                value: `${trend >= 0 ? '+' : ''}${trend.toFixed(1)}%`,
                priority: excelMetrics.totalMargin < 0 ? 'critical' : 'high',
                icon: TrendingUp,
                bgColor: 'bg-blue-50',
                iconColor: 'text-blue-700',
                valueColor: trend >= 0 ? 'text-green-600' : 'text-red-600',
                action: 'View Details',
                category: 'Financial',
                confidenceScore: 96,
                dataSource: 'Fact_Margin',
                lastUpdated: 'Just now'
            });
        }

        // Margin Percentage
        if (excelMetrics.marginPct !== undefined && excelMetrics.marginPct !== 0) {
            const trend = excelMetrics.marginPctTrend || 0;
            insights.push({
                id: idCounter++,
                title: 'Margin %',
                kpi: `${Math.round(excelMetrics.marginPct)}%`,
                kpiLabel: 'Margin Percentage',
                insight: `Profitability ratio`,
                trend: trend >= 0 ? 'up' : 'down',
                value: `${trend >= 0 ? '+' : ''}${trend.toFixed(1)}%`,
                priority: excelMetrics.marginPct < 5 ? 'critical' : 'medium',
                icon: Target,
                bgColor: 'bg-purple-50',
                iconColor: 'text-purple-700',
                valueColor: trend >= 0 ? 'text-green-600' : 'text-red-600',
                action: 'View Details',
                category: 'Financial',
                confidenceScore: 94,
                dataSource: 'Fact_Margin',
                lastUpdated: 'Just now'
            });
        }

        // Key Operational Metrics (Second Row)
        // AUM - Show in Billions
        if (excelMetrics.totalAUM && excelMetrics.totalAUM > 0) {
            const trend = excelMetrics.aumTrend || 0;
            const aumInBillions = excelMetrics.totalAUM / 1000; // Convert MM to B
            insights.push({
                id: idCounter++,
                title: 'AUM',
                kpi: `$${aumInBillions.toFixed(1)}B`,
                kpiLabel: 'Assets Under Management',
                insight: `Total assets under management`,
                trend: trend >= 0 ? 'up' : 'down',
                value: `${trend >= 0 ? '+' : ''}${trend.toFixed(1)}%`,
                priority: 'high',
                icon: Building,
                bgColor: 'bg-indigo-50',
                iconColor: 'text-indigo-700',
                valueColor: trend >= 0 ? 'text-green-600' : 'text-red-600',
                action: 'View Details',
                category: 'Assets',
                confidenceScore: 97,
                dataSource: 'Fact_Margin',
                lastUpdated: 'Just now'
            });
        }

        // Trading Volume
        if (excelMetrics.totalTradingVolume && excelMetrics.totalTradingVolume > 0) {
            const trend = excelMetrics.tradingVolumeTrend || 0;
            insights.push({
                id: idCounter++,
                title: 'Trading Volume',
                kpi: `$${Math.round(excelMetrics.totalTradingVolume)}MM`,
                kpiLabel: 'Trading Volume',
                insight: `Total trading volume`,
                trend: trend >= 0 ? 'up' : 'down',
                value: `${trend >= 0 ? '+' : ''}${trend.toFixed(1)}%`,
                priority: 'medium',
                icon: BarChart3,
                bgColor: 'bg-teal-50',
                iconColor: 'text-teal-700',
                valueColor: trend >= 0 ? 'text-green-600' : 'text-red-600',
                action: 'View Details',
                category: 'Trading',
                confidenceScore: 96,
                dataSource: 'Fact_Margin',
                lastUpdated: 'Just now'
            });
        }

        // Headcount
        if (excelMetrics.totalHeadcount && excelMetrics.totalHeadcount > 0) {
            const trend = excelMetrics.headcountTrend || 0;
            insights.push({
                id: idCounter++,
                title: 'Headcount',
                kpi: `${Math.round(excelMetrics.totalHeadcount)}`,
                kpiLabel: 'Headcount FTE',
                insight: `Full-time equivalent employees`,
                trend: trend >= 0 ? 'up' : 'down',
                value: `${trend >= 0 ? '+' : ''}${trend.toFixed(1)}%`,
                priority: 'medium',
                icon: Users,
                bgColor: 'bg-amber-50',
                iconColor: 'text-amber-700',
                valueColor: trend >= 0 ? 'text-green-600' : 'text-red-600',
                action: 'View Details',
                category: 'Operations',
                confidenceScore: 98,
                dataSource: 'Fact_Margin',
                lastUpdated: 'Just now'
            });
        }

        // Revenue Components (Third Row)
        // Transaction Fees
        if (excelMetrics.totalTransactionFees && excelMetrics.totalTransactionFees > 0) {
            const trend = excelMetrics.transactionFeesTrend || 0;
            insights.push({
                id: idCounter++,
                title: 'Transaction Fees',
                kpi: `$${Math.round(excelMetrics.totalTransactionFees)}MM`,
                kpiLabel: 'Transaction Fees Revenue',
                insight: `Revenue from transaction fees`,
                trend: trend >= 0 ? 'up' : 'down',
                value: `${trend >= 0 ? '+' : ''}${trend.toFixed(1)}%`,
                priority: 'medium',
                icon: DollarSign,
                bgColor: 'bg-emerald-50',
                iconColor: 'text-emerald-700',
                valueColor: trend >= 0 ? 'text-green-600' : 'text-red-600',
                action: 'View Details',
                category: 'Revenue',
                confidenceScore: 95,
                dataSource: 'Fact_Margin',
                lastUpdated: 'Just now'
            });
        }

        // Custody Safekeeping
        if (excelMetrics.totalCustodySafekeeping && excelMetrics.totalCustodySafekeeping > 0) {
            const trend = excelMetrics.custodySafekeepingTrend || 0;
            insights.push({
                id: idCounter++,
                title: 'Custody Safekeeping',
                kpi: `$${Math.round(excelMetrics.totalCustodySafekeeping)}MM`,
                kpiLabel: 'Custody Safekeeping Revenue',
                insight: `Revenue from custody services`,
                trend: trend >= 0 ? 'up' : 'down',
                value: `${trend >= 0 ? '+' : ''}${trend.toFixed(1)}%`,
                priority: 'medium',
                icon: Package,
                bgColor: 'bg-cyan-50',
                iconColor: 'text-cyan-700',
                valueColor: trend >= 0 ? 'text-green-600' : 'text-red-600',
                action: 'View Details',
                category: 'Revenue',
                confidenceScore: 95,
                dataSource: 'Fact_Margin',
                lastUpdated: 'Just now'
            });
        }

        // Admin Fund Expense
        if (excelMetrics.totalAdminFundExpense && excelMetrics.totalAdminFundExpense > 0) {
            const trend = excelMetrics.adminFundExpenseTrend || 0;
            insights.push({
                id: idCounter++,
                title: 'Admin Fund Expense',
                kpi: `$${Math.round(excelMetrics.totalAdminFundExpense)}MM`,
                kpiLabel: 'Admin Fund Expense Revenue',
                insight: `Revenue from fund administration`,
                trend: trend >= 0 ? 'up' : 'down',
                value: `${trend >= 0 ? '+' : ''}${trend.toFixed(1)}%`,
                priority: 'medium',
                icon: Building,
                bgColor: 'bg-violet-50',
                iconColor: 'text-violet-700',
                valueColor: trend >= 0 ? 'text-green-600' : 'text-red-600',
                action: 'View Details',
                category: 'Revenue',
                confidenceScore: 95,
                dataSource: 'Fact_Margin',
                lastUpdated: 'Just now'
            });
        }

        // Performance Fees
        if (excelMetrics.totalPerformanceFees && excelMetrics.totalPerformanceFees > 0) {
            const trend = excelMetrics.performanceFeesTrend || 0;
            insights.push({
                id: idCounter++,
                title: 'Performance Fees',
                kpi: `$${Math.round(excelMetrics.totalPerformanceFees)}MM`,
                kpiLabel: 'Performance Fees Revenue',
                insight: `Revenue from performance-based fees`,
                trend: trend >= 0 ? 'up' : 'down',
                value: `${trend >= 0 ? '+' : ''}${trend.toFixed(1)}%`,
                priority: 'medium',
                icon: TrendingUp,
                bgColor: 'bg-pink-50',
                iconColor: 'text-pink-700',
                valueColor: trend >= 0 ? 'text-green-600' : 'text-red-600',
                action: 'View Details',
                category: 'Revenue',
                confidenceScore: 95,
                dataSource: 'Fact_Margin',
                lastUpdated: 'Just now'
            });
        }

        // Interest Rate Revenue
        if (excelMetrics.totalInterestRateRevenue && excelMetrics.totalInterestRateRevenue > 0) {
            const trend = excelMetrics.interestRateRevenueTrend || 0;
            insights.push({
                id: idCounter++,
                title: 'Interest Rate Revenue',
                kpi: `$${Math.round(excelMetrics.totalInterestRateRevenue)}MM`,
                kpiLabel: 'Interest Rate Revenue',
                insight: `Revenue from interest rates`,
                trend: trend >= 0 ? 'up' : 'down',
                value: `${trend >= 0 ? '+' : ''}${trend.toFixed(1)}%`,
                priority: 'medium',
                icon: LineChart,
                bgColor: 'bg-rose-50',
                iconColor: 'text-rose-700',
                valueColor: trend >= 0 ? 'text-green-600' : 'text-red-600',
                action: 'View Details',
                category: 'Revenue',
                confidenceScore: 95,
                dataSource: 'Fact_Margin',
                lastUpdated: 'Just now'
            });
        }

        // Expense Components (Fourth Row)
        // Comp Benefits
        if (excelMetrics.totalCompBenefits && excelMetrics.totalCompBenefits > 0) {
            const trend = excelMetrics.compBenefitsTrend || 0;
            insights.push({
                id: idCounter++,
                title: 'Compensation & Benefits',
                kpi: `$${Math.round(excelMetrics.totalCompBenefits)}MM`,
                kpiLabel: 'Compensation & Benefits',
                insight: `Employee compensation costs`,
                trend: trend >= 0 ? 'up' : 'down',
                value: `${trend >= 0 ? '+' : ''}${trend.toFixed(1)}%`,
                priority: 'high',
                icon: Users,
                bgColor: 'bg-orange-50',
                iconColor: 'text-orange-700',
                valueColor: trend >= 0 ? 'text-red-600' : 'text-green-600',
                action: 'View Details',
                category: 'Expense',
                confidenceScore: 96,
                dataSource: 'Fact_Margin',
                lastUpdated: 'Just now'
            });
        }

        // Tech and Data
        if (excelMetrics.totalTechData && excelMetrics.totalTechData > 0) {
            const trend = excelMetrics.techDataTrend || 0;
            insights.push({
                id: idCounter++,
                title: 'Tech & Data',
                kpi: `$${Math.round(excelMetrics.totalTechData)}MM`,
                kpiLabel: 'Technology & Data Expense',
                insight: `Technology and data infrastructure costs`,
                trend: trend >= 0 ? 'up' : 'down',
                value: `${trend >= 0 ? '+' : ''}${trend.toFixed(1)}%`,
                priority: 'medium',
                icon: Brain,
                bgColor: 'bg-slate-50',
                iconColor: 'text-slate-700',
                valueColor: trend >= 0 ? 'text-red-600' : 'text-green-600',
                action: 'View Details',
                category: 'Expense',
                confidenceScore: 95,
                dataSource: 'Fact_Margin',
                lastUpdated: 'Just now'
            });
        }

        // Sales & Marketing
        if (excelMetrics.totalSalesMktg && excelMetrics.totalSalesMktg > 0) {
            const trend = excelMetrics.salesMktgTrend || 0;
            insights.push({
                id: idCounter++,
                title: 'Sales & Marketing',
                kpi: `$${Math.round(excelMetrics.totalSalesMktg)}MM`,
                kpiLabel: 'Sales & Marketing Expense',
                insight: `Sales and marketing costs`,
                trend: trend >= 0 ? 'up' : 'down',
                value: `${trend >= 0 ? '+' : ''}${trend.toFixed(1)}%`,
                priority: 'medium',
                icon: Target,
                bgColor: 'bg-fuchsia-50',
                iconColor: 'text-fuchsia-700',
                valueColor: trend >= 0 ? 'text-red-600' : 'text-green-600',
                action: 'View Details',
                category: 'Expense',
                confidenceScore: 95,
                dataSource: 'Fact_Margin',
                lastUpdated: 'Just now'
            });
        }

        // Ops Prof Services
        if (excelMetrics.totalOpsProfSvcs && excelMetrics.totalOpsProfSvcs > 0) {
            const trend = excelMetrics.opsProfSvcsTrend || 0;
            insights.push({
                id: idCounter++,
                title: 'Ops & Prof Services',
                kpi: `$${Math.round(excelMetrics.totalOpsProfSvcs)}MM`,
                kpiLabel: 'Operations & Professional Services',
                insight: `Operations and professional services costs`,
                trend: trend >= 0 ? 'up' : 'down',
                value: `${trend >= 0 ? '+' : ''}${trend.toFixed(1)}%`,
                priority: 'medium',
                icon: Clock,
                bgColor: 'bg-stone-50',
                iconColor: 'text-stone-700',
                valueColor: trend >= 0 ? 'text-red-600' : 'text-green-600',
                action: 'View Details',
                category: 'Expense',
                confidenceScore: 95,
                dataSource: 'Fact_Margin',
                lastUpdated: 'Just now'
            });
        }

        return insights; // Return all tiles from Fact_Margin data
    }, [excelMetrics]);

    const handleInsightClick = (insight: any) => {
        // Navigate to Operational Performance page with field name as query parameter
        if (insight.id) {
            // The insight.id is the fieldName (e.g., 'AvgAUM_$mm', 'Headcount FTE')
            router.push(`/operational-performance?field=${encodeURIComponent(insight.id)}`);
        }
    };

    const handleViewConsole = () => {
        if (selectedInsight?.consoleAvailable && selectedInsight?.consoleLink) {
            setShowModal(false);
            router.push(selectedInsight.consoleLink);
        }
    };

    // AI Search functionality
    const handleAISearch = async () => {
        if (!searchQuery.trim()) return;

        // Clear previous results first
        setSearchResults(null);
        setIsSearching(true);
        setShowSearchResults(true);

        try {
            // Use local keyword-based analysis (no OpenAI API calls)
            const results = generateAIResponse(searchQuery, excelData, excelMetrics);
            setSearchResults(results);
        } catch (error) {
            console.error('Search Error:', error);
            // Show error message
            setSearchResults({
                summary: 'Unable to process search. Please try again.',
                keyFindings: [],
                recommendations: ['Please check your query and try again'],
                dataSource: 'Local Analysis',
                lastUpdated: 'Now'
            });
        } finally {
            setIsSearching(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleAISearch();
        }
    };

    // Intelligent Excel data analyzer - finds any metric/driver based on query intent
    const analyzeExcelData = (query: string, excelData: ExcelDriverTreeData | null, excelMetrics: any) => {
        if (!excelData || !excelMetrics) return null;

        const lowerQuery = query.toLowerCase();
        const results: any = {
            hasData: false,
            metrics: {},
            nodes: [],
            trends: {},
            comparisons: [],
            allNodes: []
        };

        // Recursively find all nodes in the tree
        const getAllNodes = (nodes: any[]): any[] => {
            const all: any[] = [];
            nodes.forEach(node => {
                all.push(node);
                if (node.children && node.children.length > 0) {
                    all.push(...getAllNodes(node.children));
                }
            });
            return all;
        };

        // Get all nodes from the tree
        if (excelData.tree && excelData.tree.length > 0) {
            results.allNodes = getAllNodes(excelData.tree);
        }

        // Intelligent keyword matching with synonyms
        const keywordMap: { [key: string]: string[] } = {
            revenue: ['revenue', 'sales', 'income', 'earnings', 'top line'],
            expense: ['expense', 'cost', 'spend', 'expenditure', 'outlay'],
            profit: ['profit', 'net income', 'earnings', 'bottom line'],
            margin: ['margin', 'profitability', 'ebit', 'ebitda'],
            aum: ['aum', 'assets under management', 'assets', 'funds'],
            volume: ['volume', 'quantity', 'units', 'production', 'output'],
            cost: ['cost', 'expense', 'spending', 'outlay'],
            cash: ['cash', 'liquidity', 'working capital'],
            investment: ['investment', 'capex', 'capital expenditure'],
            flows: ['flows', 'net flows', 'cash flows', 'fund flows', 'inflows', 'outflows'],
            returns: ['returns', 'market returns', 'return', 'performance', 'yield'],
            fees: ['fees', 'fee', 'charges', 'fee income'],
            expenses: ['expenses', 'expense', 'costs', 'spending']
        };

        // Find nodes matching query keywords (fuzzy matching)
        const findMatchingNodes = (queryText: string): any[] => {
            const found: any[] = [];
            const queryWords = queryText.toLowerCase().split(/\s+/).filter(w => w.length > 2);
            
            results.allNodes.forEach((node: any) => {
                const nodeName = node.name.toLowerCase();
                let matchScore = 0;
                
                // Direct keyword match
                queryWords.forEach(word => {
                    if (nodeName.includes(word)) {
                        matchScore += 10;
                    }
                });
                
                // Synonym matching
                Object.keys(keywordMap).forEach(key => {
                    if (keywordMap[key].some(syn => queryText.includes(syn))) {
                        keywordMap[key].forEach(syn => {
                            if (nodeName.includes(syn)) {
                                matchScore += 5;
                            }
                        });
                    }
                });
                
                if (matchScore > 0) {
                    found.push({ ...node, matchScore });
                }
            });
            
            // Sort by match score and return top matches
            return found.sort((a, b) => b.matchScore - a.matchScore);
        };

        // Extract metrics from excelMetrics
        if (excelMetrics) {
            if (excelMetrics.totalRevenue !== undefined) {
                results.metrics.revenue = excelMetrics.totalRevenue;
                results.hasData = true;
            }
            if (excelMetrics.totalCosts !== undefined) {
                results.metrics.costs = excelMetrics.totalCosts;
                results.hasData = true;
            }
            if (excelMetrics.totalProfit !== undefined) {
                results.metrics.profit = excelMetrics.totalProfit;
                results.hasData = true;
            }
            if (excelMetrics.profitMargin !== undefined) {
                results.metrics.profitMargin = excelMetrics.profitMargin;
                results.hasData = true;
            }
            if (excelMetrics.volume !== undefined) {
                results.metrics.volume = excelMetrics.volume;
                results.hasData = true;
            }
            if (excelMetrics.revenueTrend !== undefined) {
                results.metrics.revenueTrend = excelMetrics.revenueTrend;
            }
        }

        // Find matching nodes based on query
        results.nodes = findMatchingNodes(lowerQuery);

        // Check for comparison queries (e.g., "revenue vs expenses", "revenue vs AUM")
        const comparisonKeywords = ['vs', 'versus', 'compared to', 'compare', 'against', 'and'];
        const hasComparison = comparisonKeywords.some(kw => lowerQuery.includes(kw));
        
        if (hasComparison) {
            // Split query by comparison keyword
            const comparisonParts = lowerQuery.split(/\s+(vs|versus|compared to|compare|against|and)\s+/);
            if (comparisonParts.length >= 2) {
                const firstTerm = comparisonParts[0].trim();
                const secondTerm = comparisonParts[comparisonParts.length - 1].trim();
                
                const firstNodes = findMatchingNodes(firstTerm);
                const secondNodes = findMatchingNodes(secondTerm);
                
                results.comparisons = [
                    { term: firstTerm, nodes: firstNodes },
                    { term: secondTerm, nodes: secondNodes }
                ];
            }
        }

        // Extract period trends for all matching nodes
        if (results.nodes.length > 0 && excelData.accountingFacts) {
            results.nodes.forEach((node: any) => {
                const periods = excelData.accountingFacts.get(node.id);
                if (periods && periods.length > 0) {
                    const firstValue = periods[0].value;
                    const lastValue = periods[periods.length - 1].value;
                    const change = firstValue !== 0 ? ((lastValue - firstValue) / Math.abs(firstValue)) * 100 : 0;
                    
                    results.trends[node.id] = {
                        nodeName: node.name,
                        periods: periods.map((p: any, idx: number) => ({
                            period: p.period || `Period ${idx + 1}`,
                            value: p.value,
                            index: idx
                        })),
                        latest: lastValue,
                        first: firstValue,
                        change: change,
                        periodCount: periods.length
                    };
                }
            });
        }

        // Extract trends for comparison nodes
        if (results.comparisons.length > 0 && excelData.accountingFacts) {
            results.comparisons.forEach((comp: any) => {
                comp.nodes.forEach((node: any) => {
                    const periods = excelData.accountingFacts.get(node.id);
                    if (periods && periods.length > 0) {
                        if (!results.trends[node.id]) {
                            const firstValue = periods[0].value;
                            const lastValue = periods[periods.length - 1].value;
                            const change = firstValue !== 0 ? ((lastValue - firstValue) / Math.abs(firstValue)) * 100 : 0;
                            
                            results.trends[node.id] = {
                                nodeName: node.name,
                                periods: periods.map((p: any, idx: number) => ({
                                    period: p.period || `Period ${idx + 1}`,
                                    value: p.value,
                                    index: idx
                                })),
                                latest: lastValue,
                                first: firstValue,
                                change: change,
                                periodCount: periods.length
                            };
                        }
                    }
                });
            });
        }

        // Check for dimension-based queries (e.g., "by product segment", "product mix", "by segment")
        // Also detect patterns like "product mix of X", "X by product segment", "X by segment"
        const dimensionKeywords = ['by product segment', 'by segment', 'product mix', 'by product', 'segment breakdown', 'by dimension', 'segment'];
        const dimensionPatterns = [
            /product mix of (.+)/i,
            /(.+) by product segment/i,
            /(.+) by segment/i,
            /(.+) product mix/i,
            /segment.*of (.+)/i
        ];
        
        const hasExplicitDimension = dimensionKeywords.some(kw => lowerQuery.includes(kw));
        const matchesDimensionPattern = dimensionPatterns.some(pattern => pattern.test(lowerQuery));
        const needsDimensionAnalysis = hasExplicitDimension || matchesDimensionPattern;
        
        if (needsDimensionAnalysis && excelData.factMarginRecords && excelData.factMarginRecords.length > 0 && excelData.dimensionTables && excelData.dimensionTables.size > 0) {
            // Extract metric name from query
            let metricNameFromQuery = '';
            if (matchesDimensionPattern) {
                for (const pattern of dimensionPatterns) {
                    const match = lowerQuery.match(pattern);
                    if (match && match[1]) {
                        metricNameFromQuery = match[1].trim();
                        break;
                    }
                }
            }
            
            // If no metric extracted, try to get it from query words (remove dimension keywords)
            if (!metricNameFromQuery) {
                const words = lowerQuery.split(/\s+/);
                const filteredWords = words.filter(w => 
                    w.length > 2 && 
                    !dimensionKeywords.some(kw => kw.includes(w) || w.includes(kw.split(' ')[0]))
                );
                metricNameFromQuery = filteredWords.join(' ');
            }
            
            // Find the metric/driver node - search by name matching
            let metricNode = null;
            if (metricNameFromQuery) {
                // First try exact match from results.nodes
                metricNode = results.nodes.find((n: any) => 
                    n.name.toLowerCase().includes(metricNameFromQuery.toLowerCase()) ||
                    metricNameFromQuery.toLowerCase().includes(n.name.toLowerCase())
                );
                
                // If not found, search all nodes
                if (!metricNode && results.allNodes.length > 0) {
                    const metricNameLower = metricNameFromQuery.toLowerCase();
                    for (const node of results.allNodes) {
                        const nodeNameLower = node.name.toLowerCase();
                        // Check if metric name matches node name (either direction)
                        if (nodeNameLower.includes(metricNameLower) || metricNameLower.includes(nodeNameLower)) {
                            metricNode = node;
                            break;
                        }
                    }
                }
            }
            
            // Create a map of driverId to node name for matching
            const driverIdToNodeName = new Map<string, string>();
            results.allNodes.forEach((node: any) => {
                if (node.id) {
                    driverIdToNodeName.set(node.id, node.name.toLowerCase());
                }
            });
            
            // Join factMarginRecords with dimension tables using ID fields
            const dimensionData: { [segment: string]: { total: number; count: number; records: any[] } } = {};
            let matchedDriverIds = new Set<string>();
            
            // Get all dimension table names
            const dimTableNames = getDimensionTableNames(excelData.dimensionTables);
            
            // For each dimension table, try to join with factMarginRecords
            dimTableNames.forEach(dimTableName => {
                // Find the ID field name (e.g., "LegalEntityID" for "Dim_LegalEntity")
                const idFieldName = dimTableName.replace('Dim_', '').replace('DIM_', '') + 'ID';
                
                excelData.factMarginRecords.forEach((record: any) => {
                    if (!record[idFieldName]) return;
                    
                    const dimRecord = joinFactWithDimension(record, excelData.dimensionTables, idFieldName, dimTableName);
                    if (!dimRecord) return;
                
                // If we have a specific metric node, only include records for that driver
                let shouldInclude = false;
                if (metricNode) {
                    shouldInclude = record.driverId === metricNode.id;
                } else {
                    // If no specific node, try to match by name
                    const driverName = driverIdToNodeName.get(record.driverId);
                    if (driverName && metricNameFromQuery) {
                        shouldInclude = driverName.includes(metricNameFromQuery.toLowerCase()) ||
                                       metricNameFromQuery.toLowerCase().includes(driverName);
                    } else {
                        // If we can't match, include all records for dimension queries
                        shouldInclude = true;
                    }
                }
                
                if (shouldInclude) {
                    // Find segment field in dimension record (look for common field names)
                    const segmentField = Object.keys(dimRecord).find(key => 
                        key.toLowerCase().includes('segment') || 
                        key.toLowerCase().includes('category') ||
                        key.toLowerCase().includes('name') ||
                        key.toLowerCase().includes('type')
                    );
                    const segment = segmentField ? String(dimRecord[segmentField] || 'Unknown') : 'Unknown';
                    
                    // Calculate amount from record - sum all numeric fields that match Driver Level 4 names
                    let amount = 0;
                    if (metricNode) {
                        // If we have a specific metric node, try to find matching amount field
                        const amountField = Object.keys(record).find(key => 
                            key.toLowerCase().includes(metricNode.name.toLowerCase())
                        );
                        if (amountField) {
                            const value = record[amountField];
                            amount = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.-]/g, '')) || 0;
                        }
                    } else {
                        // Sum all numeric fields (excluding ID and period fields)
                        Object.keys(record).forEach(key => {
                            if (!key.toLowerCase().includes('id') && !key.toLowerCase().includes('period') && !key.toLowerCase().includes('date')) {
                                const value = record[key];
                                const numValue = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.-]/g, ''));
                                if (!isNaN(numValue)) {
                                    amount += numValue;
                                }
                            }
                        });
                    }
                    
                    if (!dimensionData[segment]) {
                        dimensionData[segment] = { total: 0, count: 0, records: [] };
                    }
                    dimensionData[segment].total += amount;
                    dimensionData[segment].count += 1;
                    dimensionData[segment].records.push(record);
                }
                });
            });
            
            // If we found data, create breakdown
            if (Object.keys(dimensionData).length > 0) {
                const total = Object.values(dimensionData).reduce((sum: number, d: any) => sum + d.total, 0);
                const finalMetricName = metricNode ? metricNode.name : 
                                      (metricNameFromQuery || results.nodes[0]?.name || 'Total');
                
                results.dimensionBreakdown = {
                    metricName: finalMetricName,
                    metricId: metricNode?.id || Array.from(matchedDriverIds)[0] || 'all',
                    breakdown: Object.keys(dimensionData).map(segment => ({
                        segment,
                        total: dimensionData[segment].total,
                        count: dimensionData[segment].count,
                        percentage: total > 0 ? (dimensionData[segment].total / total) * 100 : 0
                    })).sort((a, b) => b.total - a.total)
                };
                results.hasData = true;
            }
        }

        return results.hasData || results.nodes.length > 0 ? results : null;
    };

    // AI Response Generator - flexible, intelligent search using Excel data
    const generateAIResponse = (query: string, excelData: ExcelDriverTreeData | null, excelMetrics: any) => {
        const lowerQuery = query.toLowerCase();
        
        // Analyze Excel data intelligently
        const analysis = analyzeExcelData(query, excelData, excelMetrics);

        // If we have Excel data, generate intelligent response from it
        if (analysis && (analysis.hasData || analysis.nodes.length > 0)) {
            return generateIntelligentResponse(query, analysis, excelData, excelMetrics);
        }

        // Fallback to hardcoded responses only if no Excel data available
        return generateFallbackResponse(query, lowerQuery);
    };

    // Generate intelligent response from Excel data analysis
    const generateIntelligentResponse = (query: string, analysis: any, excelData: ExcelDriverTreeData | null, excelMetrics: any) => {
        const lowerQuery = query.toLowerCase();
        
        // Detect dimension-based queries (any dimension mentioned with "by" or "best/highest")
        const dimensionKeywords = {
            'costcenter': ['cost center', 'costcenter', 'cost centre'],
            'geography': ['geography', 'geographic', 'region', 'location'],
            'lineofbusiness': ['line of business', 'lineofbusiness', 'lob', 'business line'],
            'legalentity': ['legal entity', 'legalentity', 'entity'],
            'producttype': ['product type', 'producttype', 'product'],
            'quarter': ['quarter', 'q1', 'q2', 'q3', 'q4'],
            'scenario': ['scenario', 'scenarios']
        };

        // Check if query mentions dimensions
        const mentionedDimensions: string[] = [];
        Object.keys(dimensionKeywords).forEach(dim => {
            if (dimensionKeywords[dim as keyof typeof dimensionKeywords].some(keyword => lowerQuery.includes(keyword))) {
                mentionedDimensions.push(dim);
            }
        });

        // Check for "by" queries or "best/highest" queries with dimensions
        const hasByKeyword = lowerQuery.includes(' by ') || lowerQuery.includes('by ');
        const hasBestHighest = lowerQuery.includes('best') || lowerQuery.includes('highest') || 
                              lowerQuery.includes('top') || lowerQuery.includes('maximum') || 
                              lowerQuery.includes('max') || lowerQuery.includes('lowest') || 
                              lowerQuery.includes('minimum') || lowerQuery.includes('min');

        // If dimensions are mentioned and query has "by" or "best/highest", use dimension query handler
        if (mentionedDimensions.length > 0 && (hasByKeyword || hasBestHighest) && excelData) {
            console.log('Detected dimension-based query:', { dimensions: mentionedDimensions, query });
            return generateFlexibleDimensionResponse(query, mentionedDimensions, excelData, excelMetrics);
        }
        
        // Handle cost center margin queries (legacy support)
        const isCostCenterMarginQuery = (lowerQuery.includes('cost center') || lowerQuery.includes('costcenter') || lowerQuery.includes('costcentre')) && 
                                       (lowerQuery.includes('margin') || lowerQuery.includes('best') || lowerQuery.includes('highest') || 
                                        lowerQuery.includes('top') || lowerQuery.includes('maximum') || lowerQuery.includes('max'));
        
        if (isCostCenterMarginQuery && excelData) {
            console.log('Detected cost center margin query, calculating margins...');
            return generateCostCenterMarginResponse(query, excelData, excelMetrics);
        }
        
        // Handle dimension-based queries (e.g., "product mix", "by product segment")
        if (analysis.dimensionBreakdown) {
            return generateDimensionResponse(analysis, excelData);
        }

        // Handle dimension value comparison queries (e.g., "revenue higher in North America or Europe")
        const dimensionValueComparison = detectDimensionValueComparison(query, excelData);
        if (dimensionValueComparison) {
            console.log('Detected dimension value comparison:', dimensionValueComparison);
            return generateDimensionValueComparisonResponse(query, dimensionValueComparison, excelData, excelMetrics);
        }

        // Handle comparison queries (e.g., "revenue vs expenses", "revenue vs AUM")
        if (analysis.comparisons && analysis.comparisons.length >= 2) {
            return generateComparisonResponse(analysis, excelData);
        }

        // Handle trend queries (e.g., "trend in revenue", "how is revenue changing")
        const isTrendQuery = lowerQuery.includes('trend') || lowerQuery.includes('change') || 
                           lowerQuery.includes('over time') || lowerQuery.includes('period') ||
                           lowerQuery.includes('growing') || lowerQuery.includes('declining');
        
        if (isTrendQuery && Object.keys(analysis.trends).length > 0) {
            return generateTrendResponse(analysis, excelData);
        }

        // Handle specific metric queries
        return generateMetricResponse(query, analysis, excelData, excelMetrics);
    };

    // Generate response for cost center margin queries
    const generateCostCenterMarginResponse = (query: string, excelData: ExcelDriverTreeData | null, excelMetrics: any) => {
        if (!excelData) {
            return {
                summary: 'No Excel data available to analyze cost center margins.',
                keyFindings: [],
                recommendations: ['Please upload Excel data with cost center information'],
                dataSource: 'Excel Data Upload',
                lastUpdated: 'Real-time'
            };
        }

        // Calculate margins by cost center from fact margin records
        const marginByCostCenter: { [key: string]: { 
            id: string; 
            name: string; 
            revenue: number; 
            costs: number; 
            profit: number; 
            margin: number;
            recordCount: number;
        } } = {};

        console.log('Cost Center Margin Analysis:', {
            hasFactMarginRecords: !!excelData.factMarginRecords,
            factMarginRecordCount: excelData.factMarginRecords?.length || 0,
            hasDimensionTables: !!excelData.dimensionTables
        });

        if (excelData.factMarginRecords && excelData.factMarginRecords.length > 0) {
            excelData.factMarginRecords.forEach((record: any) => {
                // Find cost center ID - check multiple possible field names
                const costCenterId = record.CostCenterID || record.Cost_Center_ID || record.costCenterId || 
                                   record.CostCenter || record.costCenter || record.Cost_Center ||
                                   record.SegmentID || record.Segment_ID || record.segmentId ||
                                   record.Segment || record.segment ||
                                   record.DepartmentID || record.Department || record.department;
                
                if (!costCenterId) return;

                // Initialize cost center if not exists
                if (!marginByCostCenter[costCenterId]) {
                    // Try to get name from dimension tables
                    let costCenterName = costCenterId;
                    if (excelData.dimensionTables) {
                        const dimTables = excelData.dimensionTables instanceof Map 
                            ? excelData.dimensionTables 
                            : new Map(Object.entries(excelData.dimensionTables));
                        
                        // Look for cost center in dimension tables
                        for (const [dimName, dimTable] of dimTables.entries()) {
                            const table = dimTable instanceof Map ? dimTable : new Map(Object.entries(dimTable as Record<string, unknown>));
                            const dimRecord = table.get(costCenterId);
                            if (dimRecord) {
                                costCenterName = dimRecord.name || dimRecord.Name || dimRecord.CostCenter || costCenterId;
                                break;
                            }
                        }
                    }
                    
                    marginByCostCenter[costCenterId] = {
                        id: costCenterId,
                        name: costCenterName,
                        revenue: 0,
                        costs: 0,
                        profit: 0,
                        margin: 0,
                        recordCount: 0
                    };
                }

                marginByCostCenter[costCenterId].recordCount += 1;

                // Sum revenue and costs from numeric fields
                Object.keys(record).forEach(key => {
                    const value = record[key];
                    if (typeof value === 'number' && !isNaN(value)) {
                        const keyLower = key.toLowerCase();
                        // Revenue indicators
                        if (keyLower.includes('revenue') || keyLower.includes('sales') || 
                            keyLower.includes('income') || keyLower.includes('rev_') ||
                            (keyLower.includes('amount') && value > 0 && !keyLower.includes('cost') && !keyLower.includes('expense'))) {
                            marginByCostCenter[costCenterId].revenue += Math.abs(value);
                        } 
                        // Cost/expense indicators
                        else if (keyLower.includes('cost') || keyLower.includes('expense') || 
                                 keyLower.includes('spend') || keyLower.includes('exp_') ||
                                 (value < 0 && !keyLower.includes('revenue') && !keyLower.includes('sales'))) {
                            marginByCostCenter[costCenterId].costs += Math.abs(value);
                        }
                    }
                });
            });

            // Calculate margins for each cost center
            Object.keys(marginByCostCenter).forEach(ccId => {
                const cc = marginByCostCenter[ccId];
                cc.profit = cc.revenue - cc.costs;
                cc.margin = cc.revenue !== 0 ? (cc.profit / cc.revenue) * 100 : 0;
            });
        }

        // Sort by margin (highest first)
        const sortedCostCenters = Object.values(marginByCostCenter)
            .filter(cc => cc.revenue > 0 || cc.costs > 0) // Only include cost centers with data
            .sort((a, b) => b.margin - a.margin);

        console.log('Cost Center Margin Results:', {
            totalCostCenters: sortedCostCenters.length,
            topThree: sortedCostCenters.slice(0, 3).map(cc => ({ name: cc.name, margin: cc.margin.toFixed(2) + '%' }))
        });

        if (sortedCostCenters.length === 0) {
            return {
                summary: 'Unable to calculate cost center margins from available data. Cost center information may not be present in the Excel file.',
                keyFindings: [
                    {
                        title: 'Data Availability',
                        detail: 'No cost center margin data found in uploaded Excel file',
                        confidence: 100
                    }
                ],
                recommendations: [
                    'Ensure your Excel file contains cost center identifiers (CostCenterID, SegmentID, etc.)',
                    'Verify that Fact_Margin records include cost center information',
                    'Check that dimension tables include cost center names'
                ],
                dataSource: 'Excel Data Upload',
                lastUpdated: 'Real-time'
            };
        }

        // Get the cost center with highest margin
        const bestCostCenter = sortedCostCenters[0];
        const topThree = sortedCostCenters.slice(0, 3);

        // Format values
        const formatValue = (value: number) => {
            if (Math.abs(value) >= 1000000) {
                return `$${(value / 1000).toFixed(2)}M`;
            } else if (Math.abs(value) >= 1000) {
                return `$${(value / 1000).toFixed(2)}M`;
            } else {
                return `$${value.toFixed(2)}`;
            }
        };

        return {
            summary: `Cost Center "${bestCostCenter.name}" has the highest margin at ${bestCostCenter.margin.toFixed(2)}% with revenue of ${formatValue(bestCostCenter.revenue)} and costs of ${formatValue(bestCostCenter.costs)}.`,
            keyFindings: topThree.map((cc, idx) => ({
                title: `${cc.name} (${cc.id})`,
                detail: `Margin: ${cc.margin.toFixed(2)}% | Revenue: ${formatValue(cc.revenue)} | Costs: ${formatValue(cc.costs)} | Profit: ${formatValue(cc.profit)}`,
                confidence: 95 - (idx * 5)
            })),
            visualizations: {
                topCostCenters: {
                    type: 'bar',
                    title: 'Top Cost Centers by Margin %',
                    data: topThree.map(cc => ({
                        costCenter: cc.name,
                        margin: cc.margin,
                        revenue: cc.revenue / 1000,
                        costs: cc.costs / 1000
                    }))
                }
            },
            relatedDrivers: [
                {
                    category: 'Cost Centers',
                    drivers: sortedCostCenters.slice(0, 5).map(cc => cc.name),
                    impact: 'High'
                }
            ],
            recommendations: [
                `Focus on replicating ${bestCostCenter.name}'s success factors across other cost centers`,
                `Analyze the cost structure of top-performing cost centers`,
                `Identify opportunities to improve margins in lower-performing cost centers`,
                `Review detailed breakdown for ${bestCostCenter.name} in the driver tree`
            ],
            dataSource: 'Excel Data Upload (Fact_Margin + Dimension Tables)',
            lastUpdated: 'Real-time',
            dataQuality: {
                completeness: sortedCostCenters.length > 0 ? 90 : 0,
                accuracy: 95,
                timeliness: 100,
                methodology: `Calculated from ${excelData.factMarginRecords?.length || 0} fact margin records across ${sortedCostCenters.length} cost centers`
            }
        };
    };

    // Detect dimension value comparison queries (e.g., "revenue higher in North America or Europe")
    const detectDimensionValueComparison = (query: string, excelData: ExcelDriverTreeData | null) => {
        if (!excelData || !excelData.dimensionTables) return null;

        const lowerQuery = query.toLowerCase();
        
        // Check for comparison keywords
        const comparisonKeywords = [' vs ', ' versus ', ' or ', ' higher ', ' lower ', ' greater ', ' less ', ' compare ', ' comparison '];
        const hasComparison = comparisonKeywords.some(kw => lowerQuery.includes(kw));
        if (!hasComparison) return null;

        // Map dimension names to their tables and ID fields
        const dimensionMapping: { [key: string]: { idField: string; dimTable: string; nameField: string } } = {
            'geography': { idField: 'GeographyID', dimTable: 'Dim_Geography', nameField: 'Geography' },
            'costcenter': { idField: 'CostCenterID', dimTable: 'Dim_CostCenter', nameField: 'CostCenter' },
            'lineofbusiness': { idField: 'LOBID', dimTable: 'Dim_LineOfBusiness', nameField: 'LineOfBusiness' },
            'legalentity': { idField: 'LegalEntityID', dimTable: 'Dim_LegalEntity', nameField: 'LegalEntity' },
            'producttype': { idField: 'ProductTypeID', dimTable: 'Dim_ProductType', nameField: 'ProductType' }
        };

        const dimTables = excelData.dimensionTables instanceof Map 
            ? excelData.dimensionTables 
            : new Map(Object.entries(excelData.dimensionTables || {}));

        // Get all dimension values from dimension tables
        const allDimensionValues: { [dim: string]: string[] } = {};
        Object.keys(dimensionMapping).forEach(dim => {
            const mapping = dimensionMapping[dim];
            if (dimTables.has(mapping.dimTable)) {
                const dimTable = dimTables.get(mapping.dimTable);
                const values: string[] = [];
                
                if (dimTable instanceof Map) {
                    dimTable.forEach((record: any) => {
                        const value = record[mapping.nameField] || record.name || record.Name;
                        if (value) values.push(String(value).toLowerCase());
                    });
                } else if (dimTable && typeof dimTable === 'object') {
                    Object.values(dimTable).forEach((record: any) => {
                        const value = record?.[mapping.nameField] || record?.name || record?.Name;
                        if (value) values.push(String(value).toLowerCase());
                    });
                }
                allDimensionValues[dim] = values;
            }
        });

        // Find which dimension values are mentioned in the query
        let foundDimension: string | null = null;
        const foundValues: string[] = [];

        Object.keys(allDimensionValues).forEach(dim => {
            allDimensionValues[dim].forEach(value => {
                // Check if value is mentioned in query (case-insensitive, handle partial matches)
                const valueWords = value.split(/\s+/);
                const queryWords = lowerQuery.split(/\s+/);
                
                // Check for exact match or if all words of the value are in query
                if (lowerQuery.includes(value) || 
                    valueWords.every(word => word.length > 2 && queryWords.some(qw => qw.includes(word) || word.includes(qw)))) {
                    if (!foundDimension) {
                        foundDimension = dim;
                    }
                    if (foundDimension === dim && !foundValues.includes(value)) {
                        foundValues.push(value);
                    }
                }
            });
        });

        // Also check for common geography names that might not be in dimension table yet
        const commonGeographies = ['north america', 'europe', 'asia', 'apac', 'emea', 'latin america', 'latam', 'africa', 'middle east'];
        if (!foundDimension || foundDimension === 'geography') {
            commonGeographies.forEach(geo => {
                if (lowerQuery.includes(geo) && !foundValues.includes(geo)) {
                    foundDimension = 'geography';
                    foundValues.push(geo);
                }
            });
        }

        if (foundDimension && foundValues.length >= 2) {
            return {
                dimension: foundDimension,
                values: foundValues,
                mapping: dimensionMapping[foundDimension]
            };
        }

        return null;
    };

    // Generate response for dimension value comparison queries
    const generateDimensionValueComparisonResponse = (query: string, comparison: any, excelData: ExcelDriverTreeData | null, excelMetrics: any) => {
        if (!excelData || !excelData.factMarginRecords || excelData.factMarginRecords.length === 0) {
            return {
                summary: 'No Excel data available for comparison.',
                keyFindings: [],
                recommendations: ['Please upload Excel data with dimension information'],
                dataSource: 'Excel Data Upload',
                lastUpdated: 'Real-time'
            };
        }

        const lowerQuery = query.toLowerCase();
        const { dimension, values, mapping } = comparison;

        // Detect measure field from query
        const measureFields = [
            'TradingVolume_$mm', 'TxnFeeRate_bps', 'AUM_$mm', 'CashBalances_$mm', 'NIM_bps_annual',
            'MarketReturn_pct', 'Rev_TransactionalFees_$mm', 'Rev_CustodySafekeeping_$mm',
            'Rev_AdminFundExpense_$mm', 'Rev_PerformanceFees_$mm', 'Rev_InterestRateRevenue_$mm',
            'TotalRevenue_$mm', 'Headcount_FTE', 'Exp_CompBenefits_$mm', 'Exp_TechData_$mm',
            'Exp_SalesMktg_$mm', 'Exp_OpsProfSvcs_$mm', 'TotalExpense_$mm', 'Margin_$mm', 'MarginPct'
        ];

        const measureAliases: { [key: string]: string[] } = {
            'TotalRevenue_$mm': ['revenue', 'total revenue', 'sales', 'income'],
            'TotalExpense_$mm': ['expense', 'expenses', 'total expense', 'costs', 'spending'],
            'Margin_$mm': ['margin', 'profit'],
            'MarginPct': ['margin %', 'margin percent', 'margin percentage', 'margin pct', 'profitability'],
            'AUM_$mm': ['aum', 'assets under management', 'assets'],
            'Headcount_FTE': ['headcount', 'fte', 'employees', 'staff']
        };

        let targetMeasure: string | null = null;
        for (const [measure, aliases] of Object.entries(measureAliases)) {
            if (aliases.some(alias => lowerQuery.includes(alias))) {
                targetMeasure = measure;
                break;
            }
        }

        // Default to revenue if no measure specified
        if (!targetMeasure) {
            targetMeasure = 'TotalRevenue_$mm';
        }

        console.log('Dimension Value Comparison:', { dimension, values, targetMeasure });

        // Get dimension table
        const dimTables = excelData.dimensionTables instanceof Map 
            ? excelData.dimensionTables 
            : new Map(Object.entries(excelData.dimensionTables || {}));

        // Build map of dimension value names to IDs
        const valueToIdMap: { [value: string]: string[] } = {};
        
        if (dimTables.has(mapping.dimTable)) {
            const dimTable = dimTables.get(mapping.dimTable);
            
            if (dimTable instanceof Map) {
                dimTable.forEach((record: any, id: string) => {
                    const name = String(record[mapping.nameField] || record.name || record.Name || '').toLowerCase();
                    if (name) {
                        if (!valueToIdMap[name]) valueToIdMap[name] = [];
                        valueToIdMap[name].push(id);
                    }
                });
            } else if (dimTable && typeof dimTable === 'object') {
                Object.entries(dimTable).forEach(([id, record]: [string, any]) => {
                    const name = String(record?.[mapping.nameField] || record?.name || record?.Name || '').toLowerCase();
                    if (name) {
                        if (!valueToIdMap[name]) valueToIdMap[name] = [];
                        valueToIdMap[name].push(id);
                    }
                });
            }
        }

        // Also handle common geography variations
        if (dimension === 'geography') {
            const geoVariations: { [key: string]: string[] } = {
                'north america': ['north america', 'northamerica', 'na', 'usa', 'united states', 'us', 'america'],
                'europe': ['europe', 'emea', 'eu'],
                'asia': ['asia', 'apac', 'asia pacific'],
                'latin america': ['latin america', 'latam', 'south america'],
                'africa': ['africa'],
                'middle east': ['middle east', 'me']
            };

            Object.keys(geoVariations).forEach(standardName => {
                geoVariations[standardName].forEach(variant => {
                    if (values.some((v: string) => variant.includes(v) || v.includes(variant))) {
                        // Try to find matching IDs
                        Object.keys(valueToIdMap).forEach(dimName => {
                            if (geoVariations[standardName].some((v: string) => dimName.includes(v) || v.includes(dimName))) {
                                if (!valueToIdMap[standardName]) valueToIdMap[standardName] = [];
                                valueToIdMap[standardName].push(...valueToIdMap[dimName]);
                            }
                        });
                    }
                });
            });
        }

        // Aggregate measure values for each dimension value
        const valueResults: { [value: string]: { 
            value: string;
            measureValue: number;
            revenue: number;
            expense: number;
            margin: number;
            marginPct: number;
            recordCount: number;
        } } = {};

        values.forEach((value: string) => {
            valueResults[value] = {
                value,
                measureValue: 0,
                revenue: 0,
                expense: 0,
                margin: 0,
                marginPct: 0,
                recordCount: 0
            };
        });

        excelData.factMarginRecords.forEach((record: any) => {
            const recordId = String(record[mapping.idField] || '');
            if (!recordId) return;

            // Find which dimension value this record belongs to
            let matchedValue: string | null = null;
            Object.keys(valueToIdMap).forEach(dimValue => {
                if (valueToIdMap[dimValue].includes(recordId)) {
                    // Check if this dimension value matches any of our comparison values
                    const valueLower = dimValue.toLowerCase();
                    values.forEach((queryValue: string) => {
                        if (valueLower.includes(queryValue) || queryValue.includes(valueLower) || 
                            dimValue.toLowerCase() === queryValue.toLowerCase()) {
                            matchedValue = queryValue;
                        }
                    });
                }
            });

            // Also try direct name matching if ID matching didn't work
            if (!matchedValue && dimension === 'geography') {
                // Check if any geography name in record matches
                Object.keys(record).forEach(key => {
                    if (key.toLowerCase().includes('geography') || key.toLowerCase().includes('region')) {
                        const recordValue = String(record[key] || '').toLowerCase();
                        values.forEach((queryValue: string) => {
                            if (recordValue.includes(queryValue) || queryValue.includes(recordValue)) {
                                matchedValue = queryValue;
                            }
                        });
                    }
                });
            }

            if (!matchedValue) return;

            const result = valueResults[matchedValue];
            result.recordCount += 1;

            // Aggregate measure values - check all measure fields
            measureFields.forEach(measure => {
                // Try exact match first
                if (record[measure] !== undefined && record[measure] !== null) {
                    const val = typeof record[measure] === 'number' ? record[measure] : parseFloat(String(record[measure])) || 0;
                    if (!isNaN(val)) {
                        if (measure === targetMeasure) {
                            result.measureValue += val;
                        }
                        if (measure === 'TotalRevenue_$mm') {
                            result.revenue += val;
                        }
                        if (measure === 'TotalExpense_$mm') {
                            result.expense += val;
                        }
                    }
                }
            });

            // Also check for case-insensitive field matching
            Object.keys(record).forEach(key => {
                const keyLower = key.toLowerCase().replace(/\s+/g, '').replace(/_/g, '');
                if (typeof record[key] === 'number' && !isNaN(record[key]) && record[key] !== 0) {
                    // Check if this matches our target measure
                    const targetLower = targetMeasure.toLowerCase().replace(/\s+/g, '').replace(/_/g, '');
                    if (keyLower === targetLower || keyLower.includes(targetLower) || targetLower.includes(keyLower)) {
                        result.measureValue += record[key];
                    }
                    // Check for revenue
                    if (keyLower.includes('revenue') && !keyLower.includes('expense')) {
                        result.revenue += record[key];
                    }
                    // Check for expense
                    if (keyLower.includes('expense') || keyLower.includes('cost')) {
                        result.expense += record[key];
                    }
                }
            });
        });

        // Calculate margins
        Object.keys(valueResults).forEach(value => {
            const result = valueResults[value];
            result.margin = result.revenue - result.expense;
            result.marginPct = result.revenue !== 0 ? (result.margin / result.revenue) * 100 : 0;
        });

        // Format values
        const formatValue = (value: number, measure: string) => {
            if (measure.includes('Pct') || measure.includes('_pct') || measure.includes('_bps')) {
                return `${value.toFixed(2)}${measure.includes('bps') ? ' bps' : '%'}`;
            } else if (measure.includes('_$mm')) {
                return `$${(value / 1000).toFixed(2)}M`;
            } else if (measure.includes('_FTE')) {
                return `${value.toFixed(0)} FTE`;
            } else {
                return `$${value.toFixed(2)}`;
            }
        };

        const measureDisplayName = measureAliases[targetMeasure]?.[0] || targetMeasure || 'Measure';

        // Compare the values
        const results = Object.values(valueResults);
        results.sort((a, b) => {
            if (targetMeasure === 'MarginPct' || lowerQuery.includes('margin')) {
                return b.marginPct - a.marginPct;
            }
            return b.measureValue - a.measureValue;
        });

        const higher = results[0];
        const lower = results[1];

        const difference = higher.measureValue - lower.measureValue;
        const percentDiff = lower.measureValue !== 0 ? (difference / Math.abs(lower.measureValue)) * 100 : 0;

        return {
            summary: `${higher.value} has ${lowerQuery.includes('lower') || lowerQuery.includes('less') ? 'lower' : 'higher'} ${measureDisplayName} than ${lower.value}: ${formatValue(higher.measureValue, targetMeasure)} vs ${formatValue(lower.measureValue, targetMeasure)} (${percentDiff > 0 ? '+' : ''}${percentDiff.toFixed(1)}% difference).`,
            keyFindings: results.map((result, idx) => ({
                title: result.value,
                detail: `${measureDisplayName}: ${formatValue(result.measureValue, targetMeasure)}${result.marginPct !== 0 ? ` | Margin: ${result.marginPct.toFixed(2)}%` : ''} | Records: ${result.recordCount}`,
                confidence: 95 - (idx * 5)
            })),
            visualizations: {
                comparison: {
                    type: 'bar',
                    title: `${measureDisplayName} Comparison`,
                    data: results.map(r => ({
                        label: r.value,
                        value: r.measureValue,
                        margin: r.marginPct
                    }))
                }
            },
            relatedDrivers: [
                {
                    category: mapping.nameField,
                    drivers: results.map(r => r.value),
                    impact: 'High'
                }
            ],
            recommendations: [
                `Analyze factors contributing to ${higher.value}'s ${lowerQuery.includes('lower') ? 'lower' : 'higher'} performance`,
                `Review detailed breakdown for both ${results.map(r => r.value).join(' and ')}`,
                `Identify best practices from ${higher.value} to apply to ${lower.value}`
            ],
            dataSource: 'Excel Data Upload (Fact_Margin + Dimension Tables)',
            lastUpdated: 'Real-time',
            dataQuality: {
                completeness: 90,
                accuracy: 95,
                timeliness: 100,
                methodology: `Compared ${measureDisplayName} across ${results.length} ${mapping.nameField} values from ${excelData.factMarginRecords.length} fact margin records`
            }
        };
    };

    // Generate flexible response for any dimension-based queries
    const generateFlexibleDimensionResponse = (query: string, dimensions: string[], excelData: ExcelDriverTreeData | null, excelMetrics: any) => {
        if (!excelData || !excelData.factMarginRecords || excelData.factMarginRecords.length === 0) {
            return {
                summary: 'No Excel data available for dimension analysis.',
                keyFindings: [],
                recommendations: ['Please upload Excel data with dimension information'],
                dataSource: 'Excel Data Upload',
                lastUpdated: 'Real-time'
            };
        }

        const lowerQuery = query.toLowerCase();
        
        // Map dimension names to ID field names and dimension table names
        const dimensionMapping: { [key: string]: { idField: string; dimTable: string; nameField: string } } = {
            'costcenter': { idField: 'CostCenterID', dimTable: 'Dim_CostCenter', nameField: 'CostCenter' },
            'geography': { idField: 'GeographyID', dimTable: 'Dim_Geography', nameField: 'Geography' },
            'lineofbusiness': { idField: 'LOBID', dimTable: 'Dim_LineOfBusiness', nameField: 'LineOfBusiness' },
            'legalentity': { idField: 'LegalEntityID', dimTable: 'Dim_LegalEntity', nameField: 'LegalEntity' },
            'producttype': { idField: 'ProductTypeID', dimTable: 'Dim_ProductType', nameField: 'ProductType' },
            'quarter': { idField: 'Quarter', dimTable: null as any, nameField: 'Quarter' },
            'scenario': { idField: 'Scenario', dimTable: null as any, nameField: 'Scenario' }
        };

        // Detect measure field from query
        const measureFields = [
            'TradingVolume_$mm', 'TxnFeeRate_bps', 'AUM_$mm', 'CashBalances_$mm', 'NIM_bps_annual',
            'MarketReturn_pct', 'Rev_TransactionalFees_$mm', 'Rev_CustodySafekeeping_$mm',
            'Rev_AdminFundExpense_$mm', 'Rev_PerformanceFees_$mm', 'Rev_InterestRateRevenue_$mm',
            'TotalRevenue_$mm', 'Headcount_FTE', 'Exp_CompBenefits_$mm', 'Exp_TechData_$mm',
            'Exp_SalesMktg_$mm', 'Exp_OpsProfSvcs_$mm', 'TotalExpense_$mm', 'Margin_$mm', 'MarginPct'
        ];

        const measureAliases: { [key: string]: string[] } = {
            'TradingVolume_$mm': ['trading volume', 'volume', 'trading'],
            'TotalRevenue_$mm': ['revenue', 'total revenue', 'sales', 'income'],
            'TotalExpense_$mm': ['expense', 'expenses', 'total expense', 'costs', 'spending'],
            'Margin_$mm': ['margin', 'profit'],
            'MarginPct': ['margin %', 'margin percent', 'margin percentage', 'margin pct', 'profitability'],
            'AUM_$mm': ['aum', 'assets under management', 'assets'],
            'Rev_TransactionalFees_$mm': ['transactional fees', 'transaction fees', 'fees'],
            'Exp_CompBenefits_$mm': ['compensation', 'benefits', 'comp and benefits'],
            'Headcount_FTE': ['headcount', 'fte', 'employees', 'staff']
        };

        let targetMeasure: string | null = null;
        for (const [measure, aliases] of Object.entries(measureAliases)) {
            if (aliases.some(alias => lowerQuery.includes(alias))) {
                targetMeasure = measure;
                break;
            }
        }

        // If no specific measure found, default to MarginPct for "best/highest" queries, or TotalRevenue_$mm
        if (!targetMeasure) {
            if (lowerQuery.includes('margin')) {
                targetMeasure = lowerQuery.includes('%') || lowerQuery.includes('percent') || lowerQuery.includes('pct') 
                    ? 'MarginPct' : 'Margin_$mm';
            } else if (lowerQuery.includes('revenue') || lowerQuery.includes('sales')) {
                targetMeasure = 'TotalRevenue_$mm';
            } else if (lowerQuery.includes('expense') || lowerQuery.includes('cost')) {
                targetMeasure = 'TotalExpense_$mm';
            } else {
                targetMeasure = 'MarginPct'; // Default for "best" queries
            }
        }

        console.log('Dimension Query Analysis:', { dimensions, targetMeasure, query });

        // Aggregate data by dimensions
        const aggregatedData: { [key: string]: { 
            dimensionValues: { [dim: string]: string };
            measures: { [measure: string]: number };
            recordCount: number;
        } } = {};

        const dimTables = excelData.dimensionTables instanceof Map 
            ? excelData.dimensionTables 
            : new Map(Object.entries(excelData.dimensionTables || {}));

        // Log first record to see what fields are available
        if (excelData.factMarginRecords.length > 0) {
            console.log('Sample record fields:', Object.keys(excelData.factMarginRecords[0]));
            console.log('Sample record values:', excelData.factMarginRecords[0]);
        }

        excelData.factMarginRecords.forEach((record: any) => {
            // Build dimension key
            const dimensionValues: { [dim: string]: string } = {};
            let dimensionKey = '';

            dimensions.forEach(dim => {
                const mapping = dimensionMapping[dim];
                if (!mapping) return;

                let dimValue = record[mapping.idField];
                let dimName = String(dimValue || 'Unknown');

                // If dimension table exists, look up name
                if (mapping.dimTable && dimTables.has(mapping.dimTable)) {
                    const dimTable = dimTables.get(mapping.dimTable);
                    if (dimTable instanceof Map) {
                        const dimRecord = dimTable.get(String(dimValue));
                        if (dimRecord) {
                            dimName = dimRecord[mapping.nameField] || dimRecord.name || dimRecord.Name || String(dimValue);
                        }
                    } else if (dimTable && typeof dimTable === 'object') {
                        const dimRecord = (dimTable as any)[String(dimValue)];
                        if (dimRecord) {
                            dimName = dimRecord[mapping.nameField] || dimRecord.name || dimRecord.Name || String(dimValue);
                        }
                    }
                }

                dimensionValues[dim] = dimName;
                dimensionKey += `${dim}:${dimName}|`;
            });

            if (!dimensionKey) return;

            // Initialize if not exists
            if (!aggregatedData[dimensionKey]) {
                aggregatedData[dimensionKey] = {
                    dimensionValues,
                    measures: {},
                    recordCount: 0
                };
            }

            aggregatedData[dimensionKey].recordCount += 1;

            // Always aggregate ALL measure fields so we have revenue/expense for margin calculations
            // First, try exact field name matching
            measureFields.forEach(measure => {
                // Check for exact field name first
                if (record[measure] !== undefined && record[measure] !== null && record[measure] !== '') {
                    const value = typeof record[measure] === 'number' ? record[measure] : parseFloat(String(record[measure])) || 0;
                    if (!isNaN(value)) {
                        if (!aggregatedData[dimensionKey].measures[measure]) {
                            aggregatedData[dimensionKey].measures[measure] = 0;
                        }
                        aggregatedData[dimensionKey].measures[measure] += value;
                    }
                }
            });

            // Also check all record fields for case-insensitive matching and partial matches
            Object.keys(record).forEach(key => {
                const keyLower = key.toLowerCase().replace(/\s+/g, '').replace(/_/g, '');
                const value = record[key];
                
                if (typeof value === 'number' && !isNaN(value) && value !== 0) {
                    // Find matching measure field (case-insensitive, ignoring spaces and underscores)
                    const matchingMeasure = measureFields.find(m => {
                        const mLower = m.toLowerCase().replace(/\s+/g, '').replace(/_/g, '');
                        return mLower === keyLower || 
                               keyLower.includes(mLower) || 
                               mLower.includes(keyLower) ||
                               key.toLowerCase() === m.toLowerCase();
                    });
                    
                    if (matchingMeasure) {
                        if (!aggregatedData[dimensionKey].measures[matchingMeasure]) {
                            aggregatedData[dimensionKey].measures[matchingMeasure] = 0;
                        }
                        aggregatedData[dimensionKey].measures[matchingMeasure] += value;
                    }
                }
            });
        });

        // Convert to array and calculate margins if needed
        const results = Object.entries(aggregatedData).map(([key, data]) => {
            // Get revenue and expense for margin calculation
            const revenue = data.measures['TotalRevenue_$mm'] || 0;
            const expense = data.measures['TotalExpense_$mm'] || 0;
            
            // Calculate margin from revenue and expense
            const margin = revenue - expense;
            const marginPct = revenue !== 0 ? (margin / revenue) * 100 : 0;
            
            // Get target measure value
            let measureValue = 0;
            if (targetMeasure) {
                // For margin queries, use calculated margin
                if (targetMeasure === 'MarginPct' || (targetMeasure === 'Margin_$mm' && lowerQuery.includes('margin'))) {
                    measureValue = targetMeasure === 'MarginPct' ? marginPct : margin;
                } else {
                    measureValue = data.measures[targetMeasure] || 0;
                }
            } else {
                // Default to margin if query mentions margin
                if (lowerQuery.includes('margin')) {
                    measureValue = lowerQuery.includes('%') || lowerQuery.includes('percent') || lowerQuery.includes('pct') 
                        ? marginPct : margin;
                } else {
                    // Use first available measure or revenue
                    measureValue = revenue || Object.values(data.measures)[0] || 0;
                }
            }

            console.log('Result calculation:', {
                dimensionKey: key,
                revenue,
                expense,
                margin,
                marginPct,
                measureValue,
                targetMeasure,
                availableMeasures: Object.keys(data.measures)
            });

            return {
                key,
                dimensionValues: data.dimensionValues,
                measureValue,
                margin,
                marginPct,
                revenue,
                expense,
                recordCount: data.recordCount,
                allMeasures: data.measures
            };
        });

        // Sort based on query intent
        const hasBestHighest = lowerQuery.includes('best') || lowerQuery.includes('highest') || 
                              lowerQuery.includes('top') || lowerQuery.includes('maximum') || 
                              lowerQuery.includes('max') || lowerQuery.includes('lowest') || 
                              lowerQuery.includes('minimum') || lowerQuery.includes('min');

        if (hasBestHighest) {
            if (targetMeasure === 'MarginPct' || lowerQuery.includes('margin')) {
                results.sort((a, b) => b.marginPct - a.marginPct);
            } else {
                results.sort((a, b) => b.measureValue - a.measureValue);
            }
        } else {
            // Sort by measure value descending
            results.sort((a, b) => b.measureValue - a.measureValue);
        }

        if (results.length === 0) {
            return {
                summary: `No data found for the specified dimensions: ${dimensions.join(', ')}`,
                keyFindings: [],
                recommendations: [
                    'Verify that your Excel file contains the requested dimension fields',
                    'Check that Fact_Margin records include the dimension IDs',
                    'Ensure dimension tables (Dim_*) are present in your Excel file'
                ],
                dataSource: 'Excel Data Upload',
                lastUpdated: 'Real-time'
            };
        }

        // Format dimension label
        const formatDimensionLabel = (dimValues: { [dim: string]: string }) => {
            return Object.entries(dimValues).map(([dim, value]) => {
                const dimName = dimensionMapping[dim]?.nameField || dim;
                return `${dimName}: ${value}`;
            }).join(', ');
        };

        const topResults = results.slice(0, 5);
        const bestResult = results[0];

        // Format value
        const formatValue = (value: number, measure: string) => {
            if (measure.includes('Pct') || measure.includes('_pct') || measure.includes('_bps')) {
                return `${value.toFixed(2)}${measure.includes('bps') ? ' bps' : '%'}`;
            } else if (measure.includes('_$mm')) {
                return `$${(value / 1000).toFixed(2)}M`;
            } else if (measure.includes('_FTE')) {
                return `${value.toFixed(0)} FTE`;
            } else {
                return `$${value.toFixed(2)}`;
            }
        };

        const measureDisplayName = measureAliases[targetMeasure || '']?.[0] || targetMeasure || 'Measure';

        // Determine what value to show in summary
        let summaryValue = bestResult.measureValue;
        let summaryMeasure = targetMeasure || '';
        if (lowerQuery.includes('margin') || targetMeasure === 'MarginPct' || targetMeasure === 'Margin_$mm') {
            summaryValue = targetMeasure === 'MarginPct' ? bestResult.marginPct : bestResult.margin;
            summaryMeasure = targetMeasure || 'MarginPct';
        }

        return {
            summary: hasBestHighest 
                ? `${formatDimensionLabel(bestResult.dimensionValues)} has the ${lowerQuery.includes('lowest') || lowerQuery.includes('minimum') ? 'lowest' : 'highest'} ${measureDisplayName} at ${formatValue(summaryValue, summaryMeasure)}${bestResult.marginPct !== 0 ? ` (${bestResult.marginPct.toFixed(2)}% margin)` : ''}.`
                : `${measureDisplayName} breakdown by ${dimensions.map(d => dimensionMapping[d]?.nameField || d).join(' and ')}: ${results.length} combinations found.`,
            keyFindings: topResults.map((result, idx) => {
                // For margin queries, show margin value and percentage
                let detailText = '';
                if (lowerQuery.includes('margin') || targetMeasure === 'MarginPct' || targetMeasure === 'Margin_$mm') {
                    const marginValue = targetMeasure === 'MarginPct' ? result.marginPct : result.margin;
                    detailText = `Margin: ${formatValue(marginValue, targetMeasure || 'MarginPct')} (${result.marginPct.toFixed(2)}%)`;
                    if (result.revenue > 0 || result.expense > 0) {
                        detailText += ` | Revenue: ${formatValue(result.revenue, 'TotalRevenue_$mm')} | Expense: ${formatValue(result.expense, 'TotalExpense_$mm')}`;
                    }
                } else {
                    detailText = `${measureDisplayName}: ${formatValue(result.measureValue, targetMeasure || '')}`;
                    if (result.marginPct !== 0) {
                        detailText += ` | Margin: ${result.marginPct.toFixed(2)}%`;
                    }
                }
                detailText += ` | Records: ${result.recordCount}`;
                
                return {
                    title: formatDimensionLabel(result.dimensionValues),
                    detail: detailText,
                    confidence: 95 - (idx * 5)
                };
            }),
            visualizations: {
                dimensionBreakdown: {
                    type: 'bar',
                    title: `${measureDisplayName} by ${dimensions.map(d => dimensionMapping[d]?.nameField || d).join(' and ')}`,
                    data: topResults.map(r => ({
                        label: formatDimensionLabel(r.dimensionValues),
                        value: r.measureValue || r.marginPct,
                        margin: r.marginPct
                    }))
                }
            },
            relatedDrivers: [
                {
                    category: dimensions.map(d => dimensionMapping[d]?.nameField || d).join(' & '),
                    drivers: topResults.slice(0, 5).map(r => formatDimensionLabel(r.dimensionValues)),
                    impact: 'High'
                }
            ],
            recommendations: [
                `Analyze trends for top-performing ${dimensions.map(d => dimensionMapping[d]?.nameField || d).join(' and ')}`,
                `Review detailed breakdown in the driver tree`,
                `Compare performance across different ${dimensions.map(d => dimensionMapping[d]?.nameField || d).join(' and ')} combinations`
            ],
            dataSource: 'Excel Data Upload (Fact_Margin + Dimension Tables)',
            lastUpdated: 'Real-time',
            dataQuality: {
                completeness: results.length > 0 ? 90 : 0,
                accuracy: 95,
                timeliness: 100,
                methodology: `Aggregated from ${excelData.factMarginRecords.length} fact margin records across ${results.length} ${dimensions.map(d => dimensionMapping[d]?.nameField || d).join(' and ')} combinations`
            }
        };
    };

    // Generate response for dimension-based queries (e.g., "product mix", "by product segment")
    const generateDimensionResponse = (analysis: any, excelData: ExcelDriverTreeData | null) => {
        let breakdown = analysis.dimensionBreakdown;
        if (!breakdown || !breakdown.breakdown || breakdown.breakdown.length === 0) {
            // If no breakdown was created, try to create one on the fly
            if (excelData && excelData.factMarginRecords && excelData.dimensionTables && excelData.dimensionTables.size > 0) {
                const dimensionData: { [segment: string]: { total: number; count: number } } = {};
                const dimTableNames = getDimensionTableNames(excelData.dimensionTables);
                
                dimTableNames.forEach(dimTableName => {
                    const idFieldName = dimTableName.replace('Dim_', '').replace('DIM_', '') + 'ID';
                    
                    excelData.factMarginRecords.forEach((record: any) => {
                        if (!record[idFieldName]) return;
                        
                        const dimRecord = joinFactWithDimension(record, excelData.dimensionTables, idFieldName, dimTableName);
                        if (!dimRecord) return;
                        
                        const segmentField = Object.keys(dimRecord).find(key => 
                            key.toLowerCase().includes('segment') || 
                            key.toLowerCase().includes('category') ||
                            key.toLowerCase().includes('name')
                        );
                        const segment = segmentField ? String(dimRecord[segmentField] || 'Unknown') : 'Unknown';
                        
                        // Sum numeric fields from record
                        let amount = 0;
                        Object.keys(record).forEach(key => {
                            if (!key.toLowerCase().includes('id') && !key.toLowerCase().includes('period') && !key.toLowerCase().includes('date')) {
                                const value = record[key];
                                const numValue = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.-]/g, ''));
                                if (!isNaN(numValue)) {
                                    amount += numValue;
                                }
                            }
                        });
                        
                        if (!dimensionData[segment]) {
                            dimensionData[segment] = { total: 0, count: 0 };
                        }
                        dimensionData[segment].total += amount;
                        dimensionData[segment].count += 1;
                    });
                });
                
                if (Object.keys(dimensionData).length > 0) {
                    const total = Object.values(dimensionData).reduce((sum: number, d: any) => sum + d.total, 0);
                    breakdown = {
                        metricName: analysis.nodes[0]?.name || 'Total',
                        metricId: 'all',
                        breakdown: Object.keys(dimensionData).map(segment => ({
                            segment,
                            total: dimensionData[segment].total,
                            count: dimensionData[segment].count,
                            percentage: total > 0 ? (dimensionData[segment].total / total) * 100 : 0
                        })).sort((a, b) => b.total - a.total)
                    };
                }
            }
            
            if (!breakdown || !breakdown.breakdown || breakdown.breakdown.length === 0) {
                return generateMetricResponse("", analysis, excelData, null);
            }
        }

        const total = breakdown.breakdown.reduce((sum: number, item: any) => sum + item.total, 0);
        const keyFindings: any[] = breakdown.breakdown.map((item: any, idx: number) => ({
            title: `${item.segment}`,
            detail: `$${(item.total / 1000).toFixed(2)}M (${item.percentage.toFixed(1)}% of total)`,
            confidence: 95 - (idx * 2)
        }));

        // Add summary finding
        keyFindings.unshift({
            title: "Total",
            detail: `$${(total / 1000).toFixed(2)}M across ${breakdown.breakdown.length} product segments`,
            confidence: 98
        });

        return {
            summary: `${breakdown.metricName} breakdown by Product Segment: ${breakdown.breakdown.length} segments with total of $${(total / 1000).toFixed(2)}M`,
            keyFindings,
            visualizations: {
                segmentBreakdown: {
                    type: 'pie',
                    title: `${breakdown.metricName} by Product Segment`,
                    data: breakdown.breakdown.map((item: any) => ({
                        name: item.segment,
                        value: item.total / 1000,
                        percentage: item.percentage
                    }))
                },
                segmentBar: {
                    type: 'bar',
                    title: `${breakdown.metricName} by Product Segment`,
                    data: breakdown.breakdown.map((item: any) => ({
                        segment: item.segment,
                        value: item.total / 1000,
                        percentage: item.percentage
                    }))
                }
            },
            relatedDrivers: [
                {
                    category: "Product Segments",
                    drivers: breakdown.breakdown.map((item: any) => item.segment),
                    impact: "High"
                }
            ],
            recommendations: [
                "Review detailed breakdown by product segment in driver tree",
                "Analyze trends for each product segment",
                "Compare segment performance against targets",
                "Identify opportunities for segment optimization"
            ],
            dataSource: "Excel Upload Data (Joined Accounting Fact + Product DIM)",
            lastUpdated: "Real-time from uploaded Excel file",
            dataQuality: {
                completeness: 95,
                accuracy: 98,
                timeliness: 100,
                methodology: "Data joined from Accounting Fact and Product DIM tables using Product ID"
            }
        };
    };

    // Generate response for comparison queries
    const generateComparisonResponse = (analysis: any, excelData: ExcelDriverTreeData | null) => {
        const [firstComp, secondComp] = analysis.comparisons;
        const firstNodes = firstComp.nodes || [];
        const secondNodes = secondComp.nodes || [];
        
        // Get values for comparison
        const getNodeValue = (node: any) => {
            if (node.accountingAmount !== undefined) return node.accountingAmount;
            if (node.rateAmount !== undefined) return node.rateAmount;
            return 0;
        };

        const firstValue = firstNodes.length > 0 ? getNodeValue(firstNodes[0]) : 0;
        const secondValue = secondNodes.length > 0 ? getNodeValue(secondNodes[0]) : 0;
        
        const difference = firstValue - secondValue;
        const percentDiff = secondValue !== 0 ? (difference / Math.abs(secondValue)) * 100 : 0;

        // Get trends if available
        const firstTrend = firstNodes.length > 0 ? analysis.trends[firstNodes[0].id] : null;
        const secondTrend = secondNodes.length > 0 ? analysis.trends[secondNodes[0].id] : null;

        const keyFindings: any[] = [
            {
                title: firstComp.term.charAt(0).toUpperCase() + firstComp.term.slice(1),
                detail: firstNodes.length > 0 
                    ? `${firstNodes[0].name}: $${(firstValue / 1000).toFixed(2)}M`
                    : `Value: $${(firstValue / 1000).toFixed(2)}M`,
                confidence: 95
            },
            {
                title: secondComp.term.charAt(0).toUpperCase() + secondComp.term.slice(1),
                detail: secondNodes.length > 0
                    ? `${secondNodes[0].name}: $${(secondValue / 1000).toFixed(2)}M`
                    : `Value: $${(secondValue / 1000).toFixed(2)}M`,
                confidence: 95
            },
            {
                title: "Difference",
                detail: `$${(Math.abs(difference) / 1000).toFixed(2)}M ${difference > 0 ? 'higher' : 'lower'} (${Math.abs(percentDiff).toFixed(1)}%)`,
                confidence: 92
            }
        ];

        // Add trend insights if available
        if (firstTrend || secondTrend) {
            if (firstTrend) {
                keyFindings.push({
                    title: `${firstComp.term} Trend`,
                    detail: `${firstTrend.nodeName} ${firstTrend.change > 0 ? 'increased' : 'decreased'} by ${Math.abs(firstTrend.change).toFixed(1)}% over ${firstTrend.periodCount} periods`,
                    confidence: 90
                });
            }
            if (secondTrend) {
                keyFindings.push({
                    title: `${secondComp.term} Trend`,
                    detail: `${secondTrend.nodeName} ${secondTrend.change > 0 ? 'increased' : 'decreased'} by ${Math.abs(secondTrend.change).toFixed(1)}% over ${secondTrend.periodCount} periods`,
                    confidence: 90
                });
            }
        }

        return {
            summary: `Comparison: ${firstComp.term} is $${(Math.abs(difference) / 1000).toFixed(2)}M ${difference > 0 ? 'higher' : 'lower'} than ${secondComp.term} (${Math.abs(percentDiff).toFixed(1)}% difference)`,
            keyFindings,
            visualizations: (firstTrend || secondTrend) ? {
                comparisonChart: {
                    type: 'bar',
                    title: 'Comparison',
                    data: [
                        { name: firstComp.term, value: firstValue / 1000 },
                        { name: secondComp.term, value: secondValue / 1000 }
                    ]
                }
            } : undefined,
            relatedDrivers: [
                {
                    category: "Comparison Metrics",
                    drivers: [
                        ...firstNodes.slice(0, 3).map((n: any) => n.name),
                        ...secondNodes.slice(0, 3).map((n: any) => n.name)
                    ],
                    impact: "High"
                }
            ],
            recommendations: [
                "Review detailed breakdown in driver tree",
                "Analyze period trends for both metrics",
                "Identify drivers contributing to the difference"
            ],
            dataSource: "Excel Upload Data",
            lastUpdated: "Real-time from uploaded Excel file",
            dataQuality: {
                completeness: 95,
                accuracy: 98,
                timeliness: 100,
                methodology: "Data extracted from uploaded Excel file"
            }
        };
    };

    // Generate response for trend queries
    const generateTrendResponse = (analysis: any, excelData: ExcelDriverTreeData | null) => {
        const trends = Object.values(analysis.trends) as any[];
        if (trends.length === 0) return null;

        const topTrend = trends[0];
        const keyFindings: any[] = [
            {
                title: "Trend Analysis",
                detail: `${topTrend.nodeName} ${topTrend.change > 0 ? 'increased' : 'decreased'} by ${Math.abs(topTrend.change).toFixed(1)}% from $${(topTrend.first / 1000).toFixed(2)}M to $${(topTrend.latest / 1000).toFixed(2)}M`,
                confidence: 95
            }
        ];

        // Add period-by-period insights
        if (topTrend.periods.length > 1) {
            const periodChanges = [];
            for (let i = 1; i < topTrend.periods.length; i++) {
                const prev = topTrend.periods[i - 1].value;
                const curr = topTrend.periods[i].value;
                const change = prev !== 0 ? ((curr - prev) / Math.abs(prev)) * 100 : 0;
                periodChanges.push({
                    period: topTrend.periods[i].period,
                    change: change
                });
            }
            
            if (periodChanges.length > 0) {
                keyFindings.push({
                    title: "Period Changes",
                    detail: `Analyzed ${topTrend.periodCount} periods with average change of ${(periodChanges.reduce((sum, p) => sum + Math.abs(p.change), 0) / periodChanges.length).toFixed(1)}% per period`,
                    confidence: 90
                });
            }
        }

        return {
            summary: `Trend analysis for ${topTrend.nodeName}: ${topTrend.change > 0 ? 'increasing' : 'decreasing'} by ${Math.abs(topTrend.change).toFixed(1)}% over ${topTrend.periodCount} periods`,
            keyFindings,
            visualizations: {
                trendChart: {
                    type: 'line',
                    title: `${topTrend.nodeName} Trend`,
                    data: topTrend.periods
                }
            },
            relatedDrivers: analysis.nodes.length > 0 ? [
                {
                    category: "Related Metrics",
                    drivers: analysis.nodes.slice(0, 5).map((n: any) => n.name),
                    impact: "High"
                }
            ] : [],
            recommendations: [
                "Review detailed period breakdown",
                "Identify factors driving the trend",
                "Compare against targets and benchmarks"
            ],
            dataSource: "Excel Upload Data",
            lastUpdated: "Real-time from uploaded Excel file",
            dataQuality: {
                completeness: 95,
                accuracy: 98,
                timeliness: 100,
                methodology: "Data extracted from uploaded Excel file"
            }
        };
    };

    // Generate response for specific metric queries
    const generateMetricResponse = (query: string, analysis: any, excelData: ExcelDriverTreeData | null, excelMetrics: any) => {
        const lowerQuery = query.toLowerCase();
        
        // Find the most relevant node
        const topNode = analysis.nodes.length > 0 ? analysis.nodes[0] : null;
        const nodeValue = topNode ? (topNode.accountingAmount || topNode.rateAmount || 0) : 0;
        const nodeTrend = topNode ? analysis.trends[topNode.id] : null;

        // Build response based on what we found
        const keyFindings: any[] = [];

        if (topNode) {
            keyFindings.push({
                title: topNode.name,
                detail: topNode.rateAmount !== undefined 
                    ? `Rate: ${(topNode.rateAmount * 100).toFixed(1)}%`
                    : `Value: $${(nodeValue / 1000).toFixed(2)}M`,
                confidence: 95
            });
        }

        // Add trend if available
        if (nodeTrend) {
            keyFindings.push({
                title: "Trend Analysis",
                detail: `${nodeTrend.change > 0 ? 'Increased' : 'Decreased'} by ${Math.abs(nodeTrend.change).toFixed(1)}% over ${nodeTrend.periodCount} periods`,
                confidence: 92
            });
        }

        // Add metric insights
        if (analysis.metrics.revenue !== undefined && (lowerQuery.includes('revenue') || lowerQuery.includes('sales'))) {
            keyFindings.push({
                title: "Total Revenue",
                detail: `$${(analysis.metrics.revenue / 1000).toFixed(2)}M from your Excel data`,
                confidence: 98
            });
        }

        if (analysis.metrics.costs !== undefined && (lowerQuery.includes('cost') || lowerQuery.includes('expense'))) {
            keyFindings.push({
                title: "Total Costs",
                detail: `$${(analysis.metrics.costs / 1000).toFixed(2)}M from your Excel data`,
                confidence: 98
            });
        }

        if (analysis.metrics.profit !== undefined && (lowerQuery.includes('profit') || lowerQuery.includes('margin'))) {
            keyFindings.push({
                title: "Total Profit",
                detail: `$${(analysis.metrics.profit / 1000).toFixed(2)}M with ${analysis.metrics.profitMargin?.toFixed(1)}% margin`,
                confidence: 98
            });
        }

        // Generate summary
        let summary = "Based on your Excel data: ";
        if (topNode) {
            summary += `${topNode.name} is `;
            if (topNode.rateAmount !== undefined) {
                summary += `${(topNode.rateAmount * 100).toFixed(1)}%`;
            } else {
                summary += `$${(nodeValue / 1000).toFixed(2)}M`;
            }
            if (nodeTrend) {
                summary += `, ${nodeTrend.change > 0 ? 'trending up' : 'trending down'} by ${Math.abs(nodeTrend.change).toFixed(1)}%`;
            }
        } else if (analysis.metrics.revenue !== undefined) {
            summary += `Total revenue is $${(analysis.metrics.revenue / 1000).toFixed(2)}M`;
        } else {
            summary += "Found relevant data in your Excel file";
        }

        return {
            summary,
            keyFindings: keyFindings.length > 0 ? keyFindings : [
                {
                    title: "Data Found",
                    detail: `Found ${analysis.nodes.length} relevant metrics in your Excel data`,
                    confidence: 85
                }
            ],
            visualizations: nodeTrend ? {
                metricChart: {
                    type: 'line',
                    title: `${topNode.name} Over Time`,
                    data: nodeTrend.periods
                }
            } : undefined,
            relatedDrivers: analysis.nodes.length > 0 ? [
                {
                    category: "Related Metrics",
                    drivers: analysis.nodes.slice(0, 5).map((n: any) => n.name),
                    impact: "High"
                }
            ] : [],
            recommendations: [
                "Explore the driver tree for detailed breakdown",
                nodeTrend ? "Analyze period trends for deeper insights" : "Upload period data for trend analysis",
                "Compare against other metrics in your data"
            ],
            dataSource: "Excel Upload Data",
            lastUpdated: "Real-time from uploaded Excel file",
            dataQuality: {
                completeness: 95,
                accuracy: 98,
                timeliness: 100,
                methodology: "Data extracted from uploaded Excel file"
            }
        };
    };

    // Fallback response generator (only used when no Excel data)
    const generateFallbackResponse = (query: string, lowerQuery: string) => {
        // Market share related queries
        if (lowerQuery.includes('market share') || lowerQuery.includes('losing share')) {
            return {
                summary: "Market share has declined 0.3% to 18.2%, primarily due to new entrants capturing premium segments",
                keyFindings: [
                    {
                        title: "Primary Driver: EV Competition",
                        detail: "New EV manufacturers have captured 0.3% market share, particularly in premium segments ($75K+ vehicles)",
                        confidence: 94
                    },
                    {
                        title: "Regional Impact",
                        detail: "West Coast markets showing highest share loss (-0.5%), while Midwest remains stable",
                        confidence: 92
                    },
                    {
                        title: "Product Mix Challenge",
                        detail: "EV mix at 42% vs 47% target is limiting competitiveness in growth segments",
                        confidence: 88
                    }
                ],
                visualizations: {
                    marketShareTrend: {
                        type: 'line',
                        title: 'Market Share Trend (12 Months)',
                        data: [
                            { month: 'Jan', value: 18.8, benchmark: 19.0 },
                            { month: 'Feb', value: 18.7, benchmark: 19.0 },
                            { month: 'Mar', value: 18.6, benchmark: 19.1 },
                            { month: 'Apr', value: 18.5, benchmark: 19.1 },
                            { month: 'May', value: 18.5, benchmark: 19.2 },
                            { month: 'Jun', value: 18.4, benchmark: 19.2 },
                            { month: 'Jul', value: 18.4, benchmark: 19.3 },
                            { month: 'Aug', value: 18.3, benchmark: 19.3 },
                            { month: 'Sep', value: 18.3, benchmark: 19.4 },
                            { month: 'Oct', value: 18.2, benchmark: 19.4 },
                            { month: 'Nov', value: 18.2, benchmark: 19.5 },
                            { month: 'Dec', value: 18.2, benchmark: 19.5 }
                        ]
                    },
                    regionalBreakdown: {
                        type: 'bar',
                        title: 'Regional Market Share Changes',
                        data: [
                            { region: 'West Coast', change: -0.5, share: 16.8 },
                            { region: 'Northeast', change: -0.3, share: 17.5 },
                            { region: 'Southeast', change: -0.2, share: 18.9 },
                            { region: 'Midwest', change: 0.1, share: 19.2 },
                            { region: 'Southwest', change: -0.1, share: 18.4 }
                        ]
                    },
                    competitorAnalysis: {
                        type: 'pie',
                        title: 'Premium Segment Share Loss Attribution',
                        data: [
                            { name: 'Competitor A', value: 35, color: '#ef4444' },
                            { name: 'Competitor B', value: 25, color: '#f59e0b' },
                            { name: 'Competitor C', value: 20, color: '#eab308' },
                            { name: 'Other Entrants', value: 20, color: '#84cc16' }
                        ]
                    }
                },
                relatedDrivers: [
                    {
                        category: "Market & Demand",
                        drivers: ["EV Strategy", "Market Strategy", "Consumer Demand"],
                        impact: "High"
                    },
                    {
                        category: "Product Mix",
                        drivers: ["Portfolio Optimization", "Vehicle Technology"],
                        impact: "Medium"
                    }
                ],
                recommendations: [
                    "Accelerate EV product launches by 6 months to close competitive gap",
                    "Implement targeted pricing strategy in West Coast markets",
                    "Increase EV marketing spend by 25% in Q1",
                    "Partner with charging infrastructure providers for competitive advantage"
                ],
                dataSource: "Fin360 Data Platform + Market Intelligence",
                lastUpdated: "Real-time analysis",
                dataQuality: {
                    completeness: 98,
                    accuracy: 95,
                    timeliness: 100,
                    methodology: "Combines internal sales data with third-party market research"
                }
            };
        }

        // EV strategy queries
        else if (lowerQuery.includes('ev') || lowerQuery.includes('electric')) {
            return {
                summary: "EV penetration is at 42% versus 47% target, with strong growth in connected services but lagging in mid-range offerings",
                keyFindings: [
                    {
                        title: "EV Mix Performance",
                        detail: "Current EV mix at 42% is 5 points below target, impacting premium segment competitiveness",
                        confidence: 91
                    },
                    {
                        title: "Charging Infrastructure Gap",
                        detail: "Limited charging network partnerships compared to competitors affecting purchase decisions",
                        confidence: 87
                    },
                    {
                        title: "Price Point Analysis",
                        detail: "Missing mid-range EV options ($40-55K) where 35% of demand exists",
                        confidence: 93
                    }
                ],
                visualizations: {
                    evMixProgress: {
                        type: 'gauge',
                        title: 'EV Mix vs Target',
                        data: {
                            current: 42,
                            target: 47,
                            benchmark: 45
                        }
                    },
                    pricePointGaps: {
                        type: 'bar',
                        title: 'EV Portfolio Coverage by Price Segment',
                        data: [
                            { segment: 'Entry ($25-40K)', coverage: 15, demand: 20 },
                            { segment: 'Mid-Range ($40-55K)', coverage: 10, demand: 35 },
                            { segment: 'Premium ($55-75K)', coverage: 55, demand: 30 },
                            { segment: 'Luxury ($75K+)', coverage: 65, demand: 15 }
                        ]
                    },
                    chargingInfrastructure: {
                        type: 'comparison',
                        title: 'Charging Network Access vs Competitors',
                        data: [
                            { company: 'Company A', stations: 65000, growth: '+12%' },
                            { company: 'Company B', stations: 120000, growth: '+18%' },
                            { company: 'Company C', stations: 85000, growth: '+15%' },
                            { company: 'Industry Avg', stations: 75000, growth: '+14%' }
                        ]
                    }
                },
                relatedDrivers: [
                    {
                        category: "Market & Demand",
                        drivers: ["EV Strategy", "Consumer Demand", "Strategic Partnerships"],
                        impact: "Critical"
                    },
                    {
                        category: "Supply & Manufacturing",
                        drivers: ["Battery Supply Chain", "Manufacturing Capacity"],
                        impact: "High"
                    }
                ],
                recommendations: [
                    "Launch 2 mid-range EV models within 12 months",
                    "Form strategic partnerships with top 3 charging networks",
                    "Increase battery production capacity by 40%",
                    "Implement EV-specific dealer training program"
                ],
                dataSource: "SAP Analytics + EV Market Intelligence",
                lastUpdated: "Updated 2 hours ago",
                dataQuality: {
                    completeness: 96,
                    accuracy: 93,
                    timeliness: 95,
                    methodology: "Real-time sales data with weekly market surveys"
                }
            };
        }

        // Supply chain queries
        else if (lowerQuery.includes('supply') || lowerQuery.includes('chip') || lowerQuery.includes('shortage')) {
            return {
                summary: "Chip shortage is impacting production of 3 key models with 12,000 units delayed, but recovery expected within 6-8 weeks",
                keyFindings: [
                    {
                        title: "Production Impact",
                        detail: "12,000 units delayed across 3 high-margin models, affecting Q4 revenue by $480M",
                        confidence: 95
                    },
                    {
                        title: "Supplier Status",
                        detail: "Primary chip supplier at 60% capacity, secondary suppliers being onboarded",
                        confidence: 89
                    },
                    {
                        title: "Recovery Timeline",
                        detail: "Supply normalization expected in 6-8 weeks based on supplier commitments",
                        confidence: 85
                    }
                ],
                visualizations: {
                    productionImpact: {
                        type: 'waterfall',
                        title: 'Production Impact by Model',
                        data: [
                            { model: 'Silverado EV', planned: 8000, actual: 3000, gap: -5000 },
                            { model: 'Sierra Denali', planned: 6000, actual: 2500, gap: -3500 },
                            { model: 'Escalade', planned: 5000, actual: 1500, gap: -3500 }
                        ]
                    },
                    supplyRecovery: {
                        type: 'timeline',
                        title: 'Supply Chain Recovery Timeline',
                        data: [
                            { week: 'W1', supply: 60, demand: 100, status: 'Critical' },
                            { week: 'W2', supply: 65, demand: 100, status: 'Critical' },
                            { week: 'W3', supply: 70, demand: 100, status: 'Warning' },
                            { week: 'W4', supply: 75, demand: 100, status: 'Warning' },
                            { week: 'W5', supply: 82, demand: 100, status: 'Improving' },
                            { week: 'W6', supply: 90, demand: 100, status: 'Improving' },
                            { week: 'W7', supply: 95, demand: 100, status: 'Normal' },
                            { week: 'W8', supply: 100, demand: 100, status: 'Normal' }
                        ]
                    },
                    financialImpact: {
                        type: 'stacked',
                        title: 'Revenue Impact Breakdown ($M)',
                        data: [
                            { category: 'Lost Sales', q3: 120, q4: 480, q1: 80 },
                            { category: 'Rush Shipping', q3: 15, q4: 25, q1: 5 },
                            { category: 'Customer Incentives', q3: 20, q4: 35, q1: 10 }
                        ]
                    }
                },
                relatedDrivers: [
                    {
                        category: "Supply & Manufacturing",
                        drivers: ["Semiconductor Supply", "Alternative Suppliers", "Inventory Management"],
                        impact: "Critical"
                    },
                    {
                        category: "Financial Performance",
                        drivers: ["Working Capital", "Production Efficiency"],
                        impact: "High"
                    }
                ],
                recommendations: [
                    "Prioritize chip allocation to highest-margin models",
                    "Accelerate dual-source chip design implementation",
                    "Negotiate long-term supply agreements with 2 additional suppliers",
                    "Implement chip inventory buffer strategy"
                ],
                dataSource: "Supply Chain Control Tower",
                lastUpdated: "Real-time monitoring",
                dataQuality: {
                    completeness: 94,
                    accuracy: 92,
                    timeliness: 100,
                    methodology: "Direct EDI feeds from suppliers with hourly updates"
                }
            };
        }

        // Financial Performance queries
        else if (lowerQuery.includes('ebit') || lowerQuery.includes('margin') || lowerQuery.includes('profitability')) {
            // Fallback to default response
            return {
                summary: "EBIT margin is at 12.5%, down 120bps due to commodity inflation, but recovery expected in H2 with pricing actions",
                keyFindings: [
                    {
                        title: "Current Performance",
                        detail: "EBIT margin at 12.5% vs 13.7% prior year, driven by material cost inflation",
                        confidence: 96
                    },
                    {
                        title: "Cost Pressures",
                        detail: "Commodity inflation adding $147M in costs, partially offset by $89M in productivity",
                        confidence: 94
                    },
                    {
                        title: "Recovery Path",
                        detail: "Pricing actions and cost reduction expected to restore 80bps by Q4",
                        confidence: 87
                    }
                ],
                visualizations: {
                    marginWaterfall: {
                        type: 'waterfall',
                        title: 'EBIT Margin Bridge YoY',
                        data: [
                            { category: 'Prior Year', value: 13.7 },
                            { category: 'Volume/Mix', value: 0.3 },
                            { category: 'Pricing', value: 0.5 },
                            { category: 'Commodities', value: -1.2 },
                            { category: 'Productivity', value: 0.4 },
                            { category: 'Other', value: -0.2 },
                            { category: 'Current Year', value: 12.5 }
                        ]
                    }
                },
                relatedDrivers: [
                    {
                        category: "Financial Performance",
                        drivers: ["Cost Management", "Pricing Strategy", "Operational Efficiency"],
                        impact: "High"
                    }
                ],
                recommendations: [
                    "Accelerate $200M cost reduction program",
                    "Implement dynamic pricing based on commodity indices",
                    "Lock in 70% of H2 commodity exposure",
                    "Drive manufacturing productivity initiatives"
                ],
                dataSource: "SAP S/4HANA Finance",
                lastUpdated: "Real-time",
                dataQuality: {
                    completeness: 99,
                    accuracy: 97,
                    timeliness: 100,
                    methodology: "Automated financial consolidation with daily updates"
                }
            };
        }


        // Cash Flow queries
        else if (lowerQuery.includes('cash') || lowerQuery.includes('liquidity') || lowerQuery.includes('working capital')) {
            return {
                summary: "Free cash flow at $2.8B YTD, on track for $4.5B full year despite working capital headwinds",
                keyFindings: [
                    {
                        title: "Cash Generation",
                        detail: "Operating cash flow of $3.9B YTD, up 8% despite higher inventory",
                        confidence: 95
                    },
                    {
                        title: "Working Capital Impact",
                        detail: "Inventory build of $600M for new launches impacting cash conversion",
                        confidence: 92
                    },
                    {
                        title: "Capital Discipline",
                        detail: "Capex at 5.2% of revenue, within guidance of 5-6%",
                        confidence: 98
                    }
                ],
                visualizations: {
                    cashFlowTrend: {
                        type: 'bar',
                        title: 'Quarterly Free Cash Flow',
                        data: [
                            { quarter: 'Q1', operating: 1200, capex: -400, free: 800 },
                            { quarter: 'Q2', operating: 1400, capex: -450, free: 950 },
                            { quarter: 'Q3', operating: 1300, capex: -425, free: 875 },
                            { quarter: 'Q4E', operating: 1500, capex: -475, free: 1025 }
                        ]
                    }
                },
                relatedDrivers: [
                    {
                        category: "Cash Management",
                        drivers: ["Working Capital", "Capital Allocation", "Collections"],
                        impact: "Critical"
                    }
                ],
                recommendations: [
                    "Optimize inventory levels post-launch phase",
                    "Accelerate collections in international markets",
                    "Defer non-critical capex to 2025",
                    "Negotiate extended payment terms with suppliers"
                ],
                dataSource: "Treasury Management System",
                lastUpdated: "Daily close",
                dataQuality: {
                    completeness: 98,
                    accuracy: 99,
                    timeliness: 100,
                    methodology: "Real-time cash positioning with daily bank reconciliation"
                }
            };
        }

        // Operational Excellence queries
        else if (lowerQuery.includes('quality') || lowerQuery.includes('manufacturing') || lowerQuery.includes('efficiency')) {
            return {
                summary: "Manufacturing excellence at 92.3% OEE with zero critical quality issues, best-in-class performance",
                keyFindings: [
                    {
                        title: "Quality Leadership",
                        detail: "Zero critical defects for 127 days, warranty claims down 23% YoY",
                        confidence: 97
                    },
                    {
                        title: "Efficiency Gains",
                        detail: "OEE improved 340bps through AI-driven predictive maintenance",
                        confidence: 94
                    },
                    {
                        title: "Cost Reduction",
                        detail: "Manufacturing cost per unit down 4.2% despite inflation",
                        confidence: 91
                    }
                ],
                visualizations: {
                    oeeBreakdown: {
                        type: 'stacked',
                        title: 'OEE Components Trend',
                        data: [
                            { month: 'Jan', availability: 94, performance: 91, quality: 99 },
                            { month: 'Feb', availability: 95, performance: 92, quality: 99 },
                            { month: 'Mar', availability: 96, performance: 93, quality: 99.5 },
                            { month: 'Current', availability: 97, performance: 94, quality: 99.8 }
                        ]
                    }
                },
                relatedDrivers: [
                    {
                        category: "Manufacturing Excellence",
                        drivers: ["Quality Systems", "Automation", "Workforce Training"],
                        impact: "High"
                    }
                ],
                recommendations: [
                    "Scale AI quality inspection to all plants",
                    "Implement digital twin for predictive maintenance",
                    "Expand automation in high-value processes",
                    "Launch zero-defect supplier program"
                ],
                dataSource: "MES + Quality Management System",
                lastUpdated: "Real-time",
                dataQuality: {
                    completeness: 97,
                    accuracy: 98,
                    timeliness: 100,
                    methodology: "IoT sensors with real-time production monitoring"
                }
            };
        }

        // Risk & Compliance queries
        else if (lowerQuery.includes('risk') || lowerQuery.includes('compliance') || lowerQuery.includes('audit')) {
            return {
                summary: "Enterprise risk profile stable with 14 high-priority risks actively managed, compliance score at 98.5%",
                keyFindings: [
                    {
                        title: "Top Risk: Supply Chain",
                        detail: "Semiconductor shortage remains #1 risk with $480M potential impact",
                        confidence: 90
                    },
                    {
                        title: "Compliance Excellence",
                        detail: "98.5% compliance score across all regulatory frameworks",
                        confidence: 96
                    },
                    {
                        title: "Cyber Security",
                        detail: "Zero material breaches, threat detection improved 45%",
                        confidence: 93
                    }
                ],
                visualizations: {
                    riskHeatmap: {
                        type: 'heatmap',
                        title: 'Enterprise Risk Matrix',
                        data: [
                            { risk: 'Supply Chain', impact: 5, likelihood: 4, trend: 'stable' },
                            { risk: 'Cyber Security', impact: 5, likelihood: 2, trend: 'improving' },
                            { risk: 'Regulatory', impact: 4, likelihood: 2, trend: 'stable' },
                            { risk: 'Market', impact: 3, likelihood: 3, trend: 'worsening' },
                            { risk: 'Operational', impact: 3, likelihood: 2, trend: 'improving' }
                        ]
                    }
                },
                relatedDrivers: [
                    {
                        category: "Risk Management",
                        drivers: ["Enterprise Risk Management", "Business Continuity", "Compliance"],
                        impact: "Critical"
                    }
                ],
                recommendations: [
                    "Diversify semiconductor supplier base",
                    "Enhance cyber security AI capabilities",
                    "Conduct regulatory scenario planning",
                    "Update business continuity plans quarterly"
                ],
                dataSource: "GRC Platform + Risk Analytics",
                lastUpdated: "Weekly risk review",
                dataQuality: {
                    completeness: 95,
                    accuracy: 94,
                    timeliness: 92,
                    methodology: "Integrated risk assessment with predictive analytics"
                }
            };
        }

        // Product Portfolio Mix queries
        else if (lowerQuery.includes('product mix') || lowerQuery.includes('portfolio') || lowerQuery.includes('model mix')) {
            return {
                summary: "Product mix optimization showing 42% EV/ICE balance with opportunity to increase EV to 47% for margin improvement",
                keyFindings: [
                    {
                        title: "Current Portfolio Performance",
                        detail: "42% EV mix generating 48% of profit contribution due to higher margins",
                        confidence: 93
                    },
                    {
                        title: "Launch Pipeline",
                        detail: "7 new EV models launching in next 18 months, 87% launch success rate",
                        confidence: 91
                    },
                    {
                        title: "Mix Optimization",
                        detail: "Shifting 5% more volume to EV would add $180M in annual profit",
                        confidence: 89
                    }
                ],
                visualizations: {
                    portfolioMix: {
                        type: 'donut',
                        title: 'Revenue Contribution by Segment',
                        data: [
                            { segment: 'Premium EV', value: 28, revenue: '$8.7B' },
                            { segment: 'Mass EV', value: 14, revenue: '$4.3B' },
                            { segment: 'Trucks/SUV', value: 35, revenue: '$10.9B' },
                            { segment: 'Sedans', value: 15, revenue: '$4.7B' },
                            { segment: 'Commercial', value: 8, revenue: '$2.5B' }
                        ]
                    }
                },
                relatedDrivers: [
                    {
                        category: "Product Mix",
                        drivers: ["Product Portfolio Strategy", "EV/ICE Balance", "Launch Planning"],
                        impact: "High"
                    },
                    {
                        category: "Market & Demand",
                        drivers: ["Consumer Preferences", "Market Segmentation"],
                        impact: "Medium"
                    }
                ],
                recommendations: [
                    "Accelerate transition of top 3 ICE models to EV platforms",
                    "Optimize dealer inventory mix based on regional EV demand",
                    "Phase out bottom 20% performers in sedan category",
                    "Increase marketing spend on high-margin EV models"
                ],
                dataSource: "Product Planning System + Sales Analytics",
                lastUpdated: "Weekly refresh",
                dataQuality: {
                    completeness: 97,
                    accuracy: 95,
                    timeliness: 96,
                    methodology: "Integrated product lifecycle and sales data"
                }
            };
        }

        // Volume & Production queries
        else if (lowerQuery.includes('volume') || lowerQuery.includes('production') || lowerQuery.includes('capacity')) {
            return {
                summary: "Production volume at 2.8M units YTD, 88% capacity utilization with flexibility to scale for demand surge",
                keyFindings: [
                    {
                        title: "Volume Performance",
                        detail: "2.8M units produced YTD, on track for 3.8M full year (+8.5% YoY)",
                        confidence: 96
                    },
                    {
                        title: "Capacity Utilization",
                        detail: "Running at 88% capacity with ability to flex to 95% in 30 days",
                        confidence: 94
                    },
                    {
                        title: "Production Mix",
                        detail: "High-margin trucks/SUVs at 65% of volume vs 60% plan",
                        confidence: 92
                    }
                ],
                visualizations: {
                    volumeTrend: {
                        type: 'area',
                        title: 'Monthly Production Volume Trend',
                        data: [
                            { month: 'Jan', actual: 285, plan: 280, capacity: 320 },
                            { month: 'Feb', actual: 290, plan: 285, capacity: 320 },
                            { month: 'Mar', actual: 310, plan: 300, capacity: 340 },
                            { month: 'Apr', actual: 315, plan: 310, capacity: 340 },
                            { month: 'May', actual: 325, plan: 315, capacity: 350 },
                            { month: 'Jun', actual: 330, plan: 320, capacity: 350 }
                        ]
                    }
                },
                relatedDrivers: [
                    {
                        category: "Supply & Manufacturing",
                        drivers: ["Production Planning", "Capacity Management", "Supply Chain"],
                        impact: "Critical"
                    },
                    {
                        category: "Market & Demand",
                        drivers: ["Demand Forecasting", "Seasonality"],
                        impact: "High"
                    }
                ],
                recommendations: [
                    "Increase third shift at truck plants to capture demand",
                    "Reallocate sedan capacity to SUV production",
                    "Lock in semiconductor supply for Q4 volume surge",
                    "Implement flexible manufacturing for EV/ICE platforms"
                ],
                dataSource: "Manufacturing Execution System",
                lastUpdated: "Real-time",
                dataQuality: {
                    completeness: 99,
                    accuracy: 98,
                    timeliness: 100,
                    methodology: "Direct feed from production systems"
                }
            };
        }

        // Pricing & ATP queries
        else if (lowerQuery.includes('pricing') || lowerQuery.includes('atp') || lowerQuery.includes('transaction price')) {
            return {
                summary: "Average transaction price at $55.2K, up 3.2% YoY with strong pricing power in trucks/SUVs offsetting sedan pressure",
                keyFindings: [
                    {
                        title: "ATP Performance",
                        detail: "ATP increased $1,700 YoY to $55.2K, driven by mix and content",
                        confidence: 95
                    },
                    {
                        title: "Pricing Power",
                        detail: "Maintained 95% of MSRP realization despite competitive pressure",
                        confidence: 93
                    },
                    {
                        title: "Segment Dynamics",
                        detail: "Truck ATP at $68K (+4.5%), offsetting sedan ATP pressure at $32K (-2.1%)",
                        confidence: 91
                    }
                ],
                visualizations: {
                    atpBySegment: {
                        type: 'bar',
                        title: 'ATP by Vehicle Segment',
                        data: [
                            { segment: 'Full-Size Trucks', atp: 68000, change: 4.5 },
                            { segment: 'Large SUVs', atp: 72000, change: 3.8 },
                            { segment: 'Mid-Size SUVs', atp: 48000, change: 2.9 },
                            { segment: 'EVs', atp: 65000, change: 1.2 },
                            { segment: 'Sedans', atp: 32000, change: -2.1 }
                        ]
                    }
                },
                relatedDrivers: [
                    {
                        category: "Pricing Strategy",
                        drivers: ["Dynamic Pricing", "Incentive Management", "Mix Optimization"],
                        impact: "High"
                    },
                    {
                        category: "Market & Demand",
                        drivers: ["Competitive Positioning", "Consumer Willingness to Pay"],
                        impact: "Medium"
                    }
                ],
                recommendations: [
                    "Implement AI-driven dynamic pricing by region",
                    "Reduce incentives on high-demand truck models",
                    "Bundle high-margin options to increase ATP",
                    "Strategic price increases on 2024 model refresh"
                ],
                dataSource: "Dealer Management System + Pricing Analytics",
                lastUpdated: "Daily",
                dataQuality: {
                    completeness: 98,
                    accuracy: 97,
                    timeliness: 99,
                    methodology: "Real-time dealer transaction data"
                }
            };
        }

        // Inventory Management queries
        else if (lowerQuery.includes('inventory') || lowerQuery.includes('dealer') || lowerQuery.includes('days supply')) {
            return {
                summary: "Inventory at 58 days supply, optimally balanced with high-demand models tight and slow-movers being addressed",
                keyFindings: [
                    {
                        title: "Overall Inventory Health",
                        detail: "58 days supply vs 60-day target, valued at $12.8B",
                        confidence: 97
                    },
                    {
                        title: "Mix Optimization",
                        detail: "Trucks at 42 days (tight), sedans at 95 days (excess)",
                        confidence: 94
                    },
                    {
                        title: "Dealer Performance",
                        detail: "Top quartile dealers turning inventory 15% faster",
                        confidence: 92
                    }
                ],
                visualizations: {
                    inventoryDays: {
                        type: 'heatmap',
                        title: 'Days Supply by Model',
                        data: [
                            { model: 'Silverado', days: 35, status: 'tight' },
                            { model: 'Tahoe/Suburban', days: 42, status: 'optimal' },
                            { model: 'Equinox', days: 55, status: 'optimal' },
                            { model: 'Malibu', days: 95, status: 'excess' },
                            { model: 'Bolt EV', days: 48, status: 'optimal' }
                        ]
                    }
                },
                relatedDrivers: [
                    {
                        category: "Inventory Management",
                        drivers: ["Production Planning", "Dealer Allocation", "Demand Matching"],
                        impact: "High"
                    },
                    {
                        category: "Financial Performance",
                        drivers: ["Working Capital", "Carrying Costs"],
                        impact: "Medium"
                    }
                ],
                recommendations: [
                    "Increase truck/SUV production allocation by 10%",
                    "Implement aggressive incentives on 95+ day inventory",
                    "Optimize dealer allocation based on turn rates",
                    "Reduce sedan production for 2024 model year"
                ],
                dataSource: "Dealer Inventory System",
                lastUpdated: "Real-time",
                dataQuality: {
                    completeness: 99,
                    accuracy: 99,
                    timeliness: 100,
                    methodology: "Live dealer inventory feeds"
                }
            };
        }

        // Capital Allocation queries
        else if (lowerQuery.includes('capital') || lowerQuery.includes('capex') || lowerQuery.includes('investment')) {
            return {
                summary: "$9.5B capital program focused 65% on EV/AV future, with strong ROI on current investments",
                keyFindings: [
                    {
                        title: "Capital Deployment",
                        detail: "$9.5B annual capex, 65% allocated to EV/AV initiatives",
                        confidence: 96
                    },
                    {
                        title: "ROI Performance",
                        detail: "Average project ROI at 18.5%, exceeding 15% hurdle rate",
                        confidence: 93
                    },
                    {
                        title: "Strategic Focus",
                        detail: "$3.2B in battery manufacturing delivering 35% cost reduction",
                        confidence: 91
                    }
                ],
                visualizations: {
                    capitalAllocation: {
                        type: 'sankey',
                        title: 'Capital Allocation Flow',
                        data: [
                            { from: 'Total Capital', to: 'EV/AV', value: 6.2 },
                            { from: 'Total Capital', to: 'Traditional', value: 2.3 },
                            { from: 'Total Capital', to: 'Digital/IT', value: 1.0 },
                            { from: 'EV/AV', to: 'Battery Plants', value: 3.2 },
                            { from: 'EV/AV', to: 'EV Platforms', value: 2.0 },
                            { from: 'EV/AV', to: 'Charging Infra', value: 1.0 }
                        ]
                    }
                },
                relatedDrivers: [
                    {
                        category: "Capital Management",
                        drivers: ["Investment Strategy", "Portfolio Optimization", "ROI Management"],
                        impact: "Critical"
                    },
                    {
                        category: "Strategic Planning",
                        drivers: ["EV Transition", "Technology Investment"],
                        impact: "High"
                    }
                ],
                recommendations: [
                    "Accelerate battery plant construction for cost advantage",
                    "Increase software/digital allocation to 15%",
                    "Defer non-critical ICE investments",
                    "Partner on charging infrastructure vs full ownership"
                ],
                dataSource: "Capital Planning System",
                lastUpdated: "Monthly",
                dataQuality: {
                    completeness: 98,
                    accuracy: 96,
                    timeliness: 95,
                    methodology: "Integrated capital planning and tracking"
                }
            };
        }

        // Competitive Intelligence queries
        else if (lowerQuery.includes('competitor') || lowerQuery.includes('competitive') || lowerQuery.includes('market position')) {
            return {
                summary: "Maintaining #2 position in North America with share pressure from new entrants in key segments",
                keyFindings: [
                    {
                        title: "Competitive Position",
                        detail: "#2 in North America at 16.8% share, gap to #1 widening by 0.3pts",
                        confidence: 94
                    },
                    {
                        title: "EV Competition",
                        detail: "Market leader commands 62% of segment, our share at 9% but growing",
                        confidence: 92
                    },
                    {
                        title: "Segment Strength",
                        detail: "Leading in full-size trucks (35% share) and large SUVs (29% share)",
                        confidence: 96
                    }
                ],
                visualizations: {
                    competitiveShare: {
                        type: 'radar',
                        title: 'Competitive Position by Segment',
                        data: [
                            { segment: 'Segment A', companyA: 35, companyB: 28, companyC: 20, companyD: 12 },
                            { segment: 'Segment B', companyA: 22, companyB: 18, companyC: 15, companyD: 12 },
                            { segment: 'Segment C', companyA: 62, companyB: 9, companyC: 7, companyD: 5 },
                            { segment: 'Segment D', companyA: 24, companyB: 20, companyC: 12, companyD: 10 }
                        ]
                    }
                },
                relatedDrivers: [
                    {
                        category: "Competitive Strategy",
                        drivers: ["Market Positioning", "Competitive Response", "Differentiation"],
                        impact: "High"
                    },
                    {
                        category: "Market & Demand",
                        drivers: ["Share Strategy", "Segment Focus"],
                        impact: "Critical"
                    }
                ],
                recommendations: [
                    "Defend truck/SUV fortress with aggressive innovation",
                    "Accelerate product launches to close competitive gap",
                    "Strategic withdrawal from commodity sedan segments",
                    "Leverage dealer advantage vs direct sales competitors"
                ],
                dataSource: "Market Intelligence + IHS Data",
                lastUpdated: "Weekly",
                dataQuality: {
                    completeness: 95,
                    accuracy: 93,
                    timeliness: 98,
                    methodology: "Third-party data with internal validation"
                }
            };
        }

        // Government & Regulatory queries
        else if (lowerQuery.includes('regulation') || lowerQuery.includes('government') || lowerQuery.includes('incentive')) {
            return {
                summary: "Capturing $1.2B in government incentives while managing $340M in regulatory compliance costs",
                keyFindings: [
                    {
                        title: "Incentive Capture",
                        detail: "$1.2B in EV incentives secured, $7,500 per vehicle pass-through",
                        confidence: 96
                    },
                    {
                        title: "Regulatory Compliance",
                        detail: "Meeting all emissions standards with $340M annual compliance cost",
                        confidence: 94
                    },
                    {
                        title: "Future Requirements",
                        detail: "2027 CAFE standards require 40mpg fleet average, currently at 32mpg",
                        confidence: 90
                    }
                ],
                visualizations: {
                    regulatoryImpact: {
                        type: 'waterfall',
                        title: 'Regulatory Financial Impact',
                        data: [
                            { category: 'EV Tax Credits', value: 800 },
                            { category: 'Manufacturing Incentives', value: 400 },
                            { category: 'R&D Credits', value: 150 },
                            { category: 'Emissions Compliance', value: -340 },
                            { category: 'Safety Standards', value: -120 },
                            { category: 'Net Benefit', value: 890 }
                        ]
                    }
                },
                relatedDrivers: [
                    {
                        category: "Government Relations",
                        drivers: ["Incentive Management", "Compliance Strategy", "Policy Influence"],
                        impact: "High"
                    },
                    {
                        category: "Product Planning",
                        drivers: ["Emissions Strategy", "Safety Standards"],
                        impact: "Critical"
                    }
                ],
                recommendations: [
                    "Maximize IRA incentive capture through strategic sourcing",
                    "Accelerate EV mix to meet 2027 CAFE standards",
                    "Engage in policy development for autonomous vehicle regulations",
                    "Optimize production footprint for state-level incentives"
                ],
                dataSource: "Regulatory Affairs + Finance",
                lastUpdated: "Monthly",
                dataQuality: {
                    completeness: 97,
                    accuracy: 98,
                    timeliness: 95,
                    methodology: "Regulatory tracking with financial integration"
                }
            };
        }

        // Partnership & Alliances queries
        else if (lowerQuery.includes('partnership') || lowerQuery.includes('alliance') || lowerQuery.includes('joint venture')) {
            return {
                summary: "Strategic partnerships generating $2.8B in value through technology access, cost sharing, and market expansion",
                keyFindings: [
                    {
                        title: "Partnership Value",
                        detail: "$2.8B in cumulative value from top 5 partnerships",
                        confidence: 92
                    },
                    {
                        title: "Technology Access",
                        detail: "LG Energy battery JV reducing cell costs by 40%",
                        confidence: 94
                    },
                    {
                        title: "Market Expansion",
                        detail: "Strategic partnership opening $1.5B commercial opportunity",
                        confidence: 89
                    }
                ],
                visualizations: {
                    partnershipValue: {
                        type: 'bubble',
                        title: 'Partnership Portfolio Value',
                        data: [
                            { partner: 'LG Energy', value: 1200, type: 'JV', status: 'active' },
                            { partner: 'Strategic Partner A', value: 800, type: 'Alliance', status: 'active' },
                            { partner: 'Microsoft', value: 400, type: 'Technology', status: 'active' },
                            { partner: 'EVgo', value: 300, type: 'Infrastructure', status: 'active' },
                            { partner: 'Nikola', value: 100, type: 'Investment', status: 'exit' }
                        ]
                    }
                },
                relatedDrivers: [
                    {
                        category: "Strategic Partnerships",
                        drivers: ["Partner Selection", "Value Creation", "Integration"],
                        impact: "High"
                    },
                    {
                        category: "Innovation",
                        drivers: ["Technology Access", "Cost Sharing"],
                        impact: "Medium"
                    }
                ],
                recommendations: [
                    "Expand battery partnerships to secure supply",
                    "Explore autonomous driving technology partnerships",
                    "Monetize legacy partnership investments",
                    "Develop ecosystem partnerships for connected services"
                ],
                dataSource: "Strategic Planning + Finance",
                lastUpdated: "Quarterly",
                dataQuality: {
                    completeness: 93,
                    accuracy: 91,
                    timeliness: 90,
                    methodology: "Partnership performance tracking"
                }
            };
        }

        // Customer Experience queries
        else if (lowerQuery.includes('customer') || lowerQuery.includes('satisfaction') || lowerQuery.includes('nps')) {
            return {
                summary: "Customer satisfaction at 82% with NPS of 45, driven by product quality improvements and dealer experience",
                keyFindings: [
                    {
                        title: "Satisfaction Metrics",
                        detail: "82% customer satisfaction, up 5pts YoY, NPS at 45 (+8pts)",
                        confidence: 95
                    },
                    {
                        title: "Quality Impact",
                        detail: "Initial quality improved 23%, driving repurchase intent to 72%",
                        confidence: 93
                    },
                    {
                        title: "Digital Experience",
                        detail: "Mobile app users show 15pt higher satisfaction",
                        confidence: 91
                    }
                ],
                visualizations: {
                    customerJourney: {
                        type: 'funnel',
                        title: 'Customer Journey Satisfaction',
                        data: [
                            { stage: 'Research', satisfaction: 78, volume: 100 },
                            { stage: 'Purchase', satisfaction: 85, volume: 45 },
                            { stage: 'Delivery', satisfaction: 88, volume: 42 },
                            { stage: 'Ownership', satisfaction: 82, volume: 40 },
                            { stage: 'Service', satisfaction: 79, volume: 38 }
                        ]
                    }
                },
                relatedDrivers: [
                    {
                        category: "Customer Experience",
                        drivers: ["Quality", "Dealer Network", "Digital Services"],
                        impact: "High"
                    },
                    {
                        category: "Brand Value",
                        drivers: ["Reputation", "Loyalty", "Advocacy"],
                        impact: "Critical"
                    }
                ],
                recommendations: [
                    "Invest in dealer training for EV customer education",
                    "Expand mobile app features for service scheduling",
                    "Implement proactive quality communication",
                    "Launch customer advisory board for product input"
                ],
                dataSource: "Customer Analytics + JD Power",
                lastUpdated: "Monthly",
                dataQuality: {
                    completeness: 96,
                    accuracy: 94,
                    timeliness: 97,
                    methodology: "Integrated customer data with third-party validation"
                }
            };
        }

        // Warranty & Quality queries
        else if (lowerQuery.includes('warranty') || lowerQuery.includes('recall') || lowerQuery.includes('defect')) {
            return {
                summary: "Warranty costs at 2.1% of revenue, down from 2.8%, with zero critical recalls in past 6 months",
                keyFindings: [
                    {
                        title: "Warranty Performance",
                        detail: "Warranty costs at $515M (2.1% of revenue) vs 2.8% prior year",
                        confidence: 97
                    },
                    {
                        title: "Quality Improvement",
                        detail: "Zero critical recalls, minor recalls down 45% YoY",
                        confidence: 95
                    },
                    {
                        title: "Cost Avoidance",
                        detail: "Prevented $280M in warranty costs through early detection",
                        confidence: 92
                    }
                ],
                visualizations: {
                    warrantyTrend: {
                        type: 'combo',
                        title: 'Warranty Cost and Incident Trend',
                        data: [
                            { month: 'Jan', cost: 48, incidents: 1250 },
                            { month: 'Feb', cost: 45, incidents: 1180 },
                            { month: 'Mar', cost: 43, incidents: 1100 },
                            { month: 'Apr', cost: 42, incidents: 1050 },
                            { month: 'May', cost: 41, incidents: 980 },
                            { month: 'Jun', cost: 40, incidents: 920 }
                        ]
                    }
                },
                relatedDrivers: [
                    {
                        category: "Quality Management",
                        drivers: ["Design Quality", "Manufacturing Quality", "Supplier Quality"],
                        impact: "Critical"
                    },
                    {
                        category: "Cost Management",
                        drivers: ["Warranty Reserves", "Cost Avoidance"],
                        impact: "High"
                    }
                ],
                recommendations: [
                    "Expand predictive quality analytics to suppliers",
                    "Implement blockchain for parts traceability",
                    "Increase pre-delivery quality inspections",
                    "Launch proactive recall prevention program"
                ],
                dataSource: "Quality Management System",
                lastUpdated: "Daily",
                dataQuality: {
                    completeness: 99,
                    accuracy: 98,
                    timeliness: 100,
                    methodology: "Real-time warranty claim processing"
                }
            };
        }

        // Digital & Connected Services queries
        else if (lowerQuery.includes('digital') || lowerQuery.includes('connected') || lowerQuery.includes('subscription')) {
            return {
                summary: "Digital services revenue at $1.8B annually with 68% penetration, growing 45% YoY with strong margins",
                keyFindings: [
                    {
                        title: "Revenue Growth",
                        detail: "$1.8B in digital revenue, 45% YoY growth, 68% penetration",
                        confidence: 94
                    },
                    {
                        title: "Subscription Performance",
                        detail: "2.8M active subscriptions at $22/month average",
                        confidence: 92
                    },
                    {
                        title: "Margin Excellence",
                        detail: "82% gross margin on digital services vs 20% on vehicles",
                        confidence: 96
                    }
                ],
                visualizations: {
                    digitalGrowth: {
                        type: 'growth',
                        title: 'Connected Services Adoption',
                        data: [
                            { quarter: 'Q1-22', subscribers: 1.8, revenue: 280 },
                            { quarter: 'Q2-22', subscribers: 2.0, revenue: 340 },
                            { quarter: 'Q3-22', subscribers: 2.2, revenue: 380 },
                            { quarter: 'Q4-22', subscribers: 2.5, revenue: 420 },
                            { quarter: 'Q1-23', subscribers: 2.8, revenue: 480 }
                        ]
                    }
                },
                relatedDrivers: [
                    {
                        category: "Digital Transformation",
                        drivers: ["Connected Vehicle Platform", "Service Innovation", "Data Monetization"],
                        impact: "High"
                    },
                    {
                        category: "Customer Value",
                        drivers: ["Lifetime Value", "Engagement", "Retention"],
                        impact: "Critical"
                    }
                ],
                recommendations: [
                    "Launch premium tier at $45/month for power users",
                    "Bundle insurance and financing with subscriptions",
                    "Develop third-party app ecosystem",
                    "Expand international connected services"
                ],
                dataSource: "Connected Services Platform",
                lastUpdated: "Real-time",
                dataQuality: {
                    completeness: 98,
                    accuracy: 97,
                    timeliness: 100,
                    methodology: "Real-time telemetry and billing data"
                }
            };
        }

        // Sustainability & ESG queries
        else if (lowerQuery.includes('sustainability') || lowerQuery.includes('esg') || lowerQuery.includes('carbon')) {
            return {
                summary: "On track for carbon neutrality by 2040 with 35% reduction achieved, ESG score improved to 78/100",
                keyFindings: [
                    {
                        title: "Carbon Reduction",
                        detail: "35% reduction in carbon intensity vs 2018 baseline",
                        confidence: 96
                    },
                    {
                        title: "ESG Performance",
                        detail: "ESG score at 78/100, top quartile in automotive",
                        confidence: 94
                    },
                    {
                        title: "Renewable Energy",
                        detail: "62% of manufacturing powered by renewable energy",
                        confidence: 93
                    }
                ],
                visualizations: {
                    carbonPath: {
                        type: 'pathway',
                        title: 'Carbon Neutrality Pathway',
                        data: [
                            { year: 2018, emissions: 100, target: 100 },
                            { year: 2020, emissions: 85, target: 82 },
                            { year: 2023, emissions: 65, target: 68 },
                            { year: 2025, emissions: 50, target: 55 },
                            { year: 2030, emissions: 30, target: 35 },
                            { year: 2040, emissions: 0, target: 0 }
                        ]
                    }
                },
                relatedDrivers: [
                    {
                        category: "ESG Strategy",
                        drivers: ["Carbon Management", "Renewable Energy", "Circular Economy"],
                        impact: "High"
                    },
                    {
                        category: "Stakeholder Value",
                        drivers: ["Investor Relations", "Regulatory Compliance", "Brand Value"],
                        impact: "Critical"
                    }
                ],
                recommendations: [
                    "Accelerate renewable energy procurement",
                    "Launch circular economy program for batteries",
                    "Expand supply chain sustainability requirements",
                    "Issue green bonds for EV infrastructure"
                ],
                dataSource: "ESG Reporting Platform",
                lastUpdated: "Quarterly",
                dataQuality: {
                    completeness: 95,
                    accuracy: 96,
                    timeliness: 92,
                    methodology: "Third-party verified ESG metrics"
                }
            };
        }

        // Default intelligent response
        else {
            // Fallback to default response
            return {
                summary: "I've analyzed your query across our business intelligence systems. Here are the most relevant insights:",
                keyFindings: [
                    {
                        title: "Market Performance",
                        detail: "Overall market share at 18.2% with pressure from new entrants",
                        confidence: 92
                    },
                    {
                        title: "Financial Health",
                        detail: "EBIT margin at 12.5% with commodity headwinds of 120bps",
                        confidence: 90
                    },
                    {
                        title: "Operational Excellence",
                        detail: "Manufacturing at 88% capacity utilization with 99.2% quality rate",
                        confidence: 97
                    }
                ],
                relatedDrivers: [
                    {
                        category: "Multiple Business Consoles",
                        drivers: ["See specific console for detailed analysis"],
                        impact: "Varies"
                    }
                ],
                recommendations: [
                    "Review specific Business Console for detailed insights",
                    "Set up alerts for critical KPIs",
                    "Schedule deep-dive analysis session"
                ],
                dataSource: excelData ? "Excel Upload Data (upload data for specific insights)" : "Integrated Business Intelligence Platform",
                lastUpdated: "Real-time"
            };
        }
    };

    // Build KPI tile for a field
    const buildKPITile = (fieldName: string, icon: any, bgColor: string, iconColor: string) => {
        const kpiData = getKPIValueAndTrend(fieldName);
        const reportNaming = getReportNaming(fieldName);
        const trend = kpiData.trend;
        const trendDirection = trend >= 0 ? 'up' : 'down';
        const valueColor = trend >= 0 ? 'text-green-600' : 'text-red-600';
        
        // Format value based on field type
        let formattedValue = '';
        if (fieldName.includes('_pct') || fieldName.includes('_bps')) {
            formattedValue = `${kpiData.value.toFixed(2)}${fieldName.includes('bps') ? ' bps' : '%'}`;
        } else if (fieldName.includes('_$mm')) {
            formattedValue = `$${(kpiData.value / 1000).toFixed(2)}M`;
        } else if (fieldName.includes('FTE') || fieldName.includes('Fte')) {
            formattedValue = `${kpiData.value.toFixed(0)} FTE`;
        } else {
            formattedValue = `$${kpiData.value.toFixed(2)}`;
        }
        
        const Icon = icon;
        
        return {
            id: fieldName,
            title: reportNaming,
            kpi: formattedValue,
            kpiLabel: reportNaming,
            insight: `${kpiData.maxQuarter} vs ${kpiData.prevQuarter || 'N/A'}`,
            trend: trendDirection,
            value: `${trend >= 0 ? '+' : ''}${trend.toFixed(1)}%`,
            priority: Math.abs(trend) > 10 ? 'high' : Math.abs(trend) > 5 ? 'medium' : 'low',
            icon: Icon,
            bgColor: bgColor,
            iconColor: iconColor,
            valueColor: valueColor,
            action: 'View Details',
            category: 'KPI',
            confidenceScore: 95,
            dataSource: 'Fact_Margin',
            lastUpdated: 'Just now'
        };
    };
    
    // Build KPI clusters
    const kpiClusters = useMemo(() => {
        if (!excelData?.factMarginRecords || excelData.factMarginRecords.length === 0) {
            return {
                increaseVolumes: [],
                workforceManagement: [],
                minimizeExpenses: [],
                optimizeRates: []
            };
        }
        
        // Helper functions need to be inside useMemo to access excelData
        const getReportNaming = (factMarginFieldName: string): string => {
            if (!excelData?.namingConventionRecords || excelData.namingConventionRecords.length === 0) {
                return factMarginFieldName;
            }
            
            const findColumnName = (records: any[], possibleNames: string[]): string | null => {
                if (records.length === 0) return null;
                const firstRecord = records[0];
                const keys = Object.keys(firstRecord);
                for (const name of possibleNames) {
                    const found = keys.find(k => k.toLowerCase() === name.toLowerCase());
                    if (found) return found;
                }
                return null;
            };
            
            const factMarginNamingCol = findColumnName(excelData.namingConventionRecords, [
                'Fact_Margin Naming', 'Fact_Margin naming', 'Fact Margin Naming', 
                'Fact Margin naming', 'Naming', 'Field Name', 'Fact_Margin Field Name'
            ]);
            const reportNamingCol = findColumnName(excelData.namingConventionRecords, [
                'Report Naming', 'Report naming', 'Report Naming Column', 'Report Field Name'
            ]);
            
            if (!factMarginNamingCol || !reportNamingCol) {
                return factMarginFieldName;
            }
            
            const normalizeFieldName = (name: string) => {
                return name.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
            };
            
            const targetNormalized = normalizeFieldName(factMarginFieldName);
            for (const record of excelData.namingConventionRecords) {
                const factMarginNaming = String(record[factMarginNamingCol] || '').trim();
                const factMarginNormalized = normalizeFieldName(factMarginNaming);
                
                if (factMarginNormalized === targetNormalized || 
                    factMarginNormalized.includes(targetNormalized) || 
                    targetNormalized.includes(factMarginNormalized)) {
                    const reportNaming = String(record[reportNamingCol] || '').trim();
                    if (reportNaming) {
                        return reportNaming;
                    }
                }
            }
            
            return factMarginFieldName;
        };
        
        const getFieldValue = (record: any, fieldName: string): number | null => {
            if (!record || !fieldName) return null;
            
            const normalizeFieldName = (name: string) => {
                return name.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
            };
            
            const targetNormalized = normalizeFieldName(fieldName);
            
            for (const [key, value] of Object.entries(record)) {
                const keyLower = key.toLowerCase();
                if (keyLower.includes('id') || keyLower.includes('period') || keyLower.includes('date') || keyLower.includes('quarter')) continue;
                
                const keyNormalized = normalizeFieldName(key);
                if (keyNormalized === targetNormalized) {
                    const numValue = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.-]/g, ''));
                    if (!isNaN(numValue)) {
                        return numValue;
                    }
                }
            }
            
            for (const [key, value] of Object.entries(record)) {
                const keyLower = key.toLowerCase();
                if (keyLower.includes('id') || keyLower.includes('period') || keyLower.includes('date') || keyLower.includes('quarter')) continue;
                
                const keyNormalized = normalizeFieldName(key);
                if (keyNormalized.includes(targetNormalized) || targetNormalized.includes(keyNormalized)) {
                    const numValue = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.-]/g, ''));
                    if (!isNaN(numValue)) {
                        return numValue;
                    }
                }
            }
            
            return null;
        };
        
        const getKPIValueAndTrend = (fieldName: string): { value: number; trend: number; maxQuarter: string; prevQuarter: string | null } => {
            if (!excelData?.factMarginRecords || excelData.factMarginRecords.length === 0) {
                return { value: 0, trend: 0, maxQuarter: '', prevQuarter: null };
            }
            
            const quarterData: { [quarter: string]: number[] } = {};
            const quarters: string[] = [];
            
            excelData.factMarginRecords.forEach(record => {
                const quarterKey = Object.keys(record).find(key => key.toLowerCase() === 'quarter');
                if (!quarterKey || !record[quarterKey]) return;
                
                const quarter = String(record[quarterKey]).trim();
                if (!quarter) return;
                
                const fieldValue = getFieldValue(record, fieldName);
                if (fieldValue !== null && !isNaN(fieldValue)) {
                    if (!quarterData[quarter]) {
                        quarterData[quarter] = [];
                        quarters.push(quarter);
                    }
                    quarterData[quarter].push(fieldValue);
                }
            });
            
            if (quarters.length === 0) {
                return { value: 0, trend: 0, maxQuarter: '', prevQuarter: null };
            }
            
            const sortedQuarters = quarters.sort();
            const maxQuarter = sortedQuarters[sortedQuarters.length - 1];
            const maxQuarterIndex = sortedQuarters.indexOf(maxQuarter);
            const prevQuarter = maxQuarterIndex > 0 ? sortedQuarters[maxQuarterIndex - 1] : null;
            
            const maxQuarterValue = quarterData[maxQuarter]?.reduce((sum, val) => sum + val, 0) || 0;
            const prevQuarterValue = prevQuarter ? (quarterData[prevQuarter]?.reduce((sum, val) => sum + val, 0) || 0) : 0;
            
            const trend = prevQuarterValue !== 0 ? ((maxQuarterValue - prevQuarterValue) / Math.abs(prevQuarterValue)) * 100 : 0;
            
            return {
                value: maxQuarterValue,
                trend: trend,
                maxQuarter: maxQuarter,
                prevQuarter: prevQuarter
            };
        };
        
        const buildKPITile = (fieldName: string, icon: any, bgColor: string, iconColor: string) => {
            const kpiData = getKPIValueAndTrend(fieldName);
            const reportNaming = getReportNaming(fieldName);
            const trend = kpiData.trend;
            const trendDirection = trend >= 0 ? 'up' : 'down';
            const valueColor = trend >= 0 ? 'text-green-600' : 'text-red-600';
            
            let formattedValue = '';
            if (fieldName.includes('_pct') || fieldName.includes('_bps')) {
                formattedValue = `${kpiData.value.toFixed(2)}${fieldName.includes('bps') ? ' bps' : '%'}`;
            } else if (fieldName.includes('_$mm')) {
                // For TransactionRevenue and AcquisitionCostPerClient, use more appropriate units
                if (fieldName.toLowerCase().includes('transactionrevenue') || fieldName.toLowerCase().includes('acquisitioncostperclient')) {
                    // If value is less than 1 million (1000 in thousands), show in thousands
                    // Otherwise show in millions with more precision
                    if (kpiData.value < 1000) {
                        formattedValue = `$${kpiData.value.toFixed(1)}K`;
                    } else if (kpiData.value < 1000000) {
                        // Show in thousands for values between 1K and 1M
                        formattedValue = `$${(kpiData.value / 1000).toFixed(1)}K`;
                    } else {
                        formattedValue = `$${(kpiData.value / 1000).toFixed(2)}M`;
                    }
                } else {
                    formattedValue = `$${(kpiData.value / 1000).toFixed(2)}M`;
                }
            } else if (fieldName.includes('FTE') || fieldName.includes('Fte')) {
                formattedValue = `${kpiData.value.toFixed(0)} FTE`;
            } else {
                formattedValue = `$${kpiData.value.toFixed(2)}`;
            }
            
            return {
                id: fieldName,
                title: reportNaming,
                kpi: formattedValue,
                kpiLabel: reportNaming,
                insight: `${kpiData.maxQuarter} vs ${kpiData.prevQuarter || 'N/A'}`,
                trend: trendDirection,
                trendPercent: Math.abs(trend), // Store the absolute trend percentage for visualizations
                value: `${trend >= 0 ? '+' : ''}${trend.toFixed(1)}%`,
                priority: Math.abs(trend) > 10 ? 'high' : Math.abs(trend) > 5 ? 'medium' : 'low',
                icon: icon,
                bgColor: bgColor,
                iconColor: iconColor,
                valueColor: valueColor,
                action: 'View Details',
                category: 'KPI',
                confidenceScore: 95,
                dataSource: 'Fact_Margin',
                lastUpdated: 'Just now'
            };
        };
        
        return {
            increaseVolumes: [
                buildKPITile('AvgAUM_$mm', BarChart3, 'bg-blue-50', 'text-blue-700'),
                buildKPITile('NetFlows_$mm', TrendingUp, 'bg-green-50', 'text-green-700'),
                buildKPITile('MarketReturn_pct', LineChart, 'bg-purple-50', 'text-purple-700'),
                buildKPITile('TradingVolume_$mm', BarChart3, 'bg-indigo-50', 'text-indigo-700')
            ],
            workforceManagement: [
                buildKPITile('Headcount FTE', Users, 'bg-orange-50', 'text-orange-700'),
                buildKPITile('TotalCompensation_$mm', DollarSign, 'bg-pink-50', 'text-pink-700')
            ],
            minimizeExpenses: [
                buildKPITile('AcquisitionCostPerClient_$mm', Target, 'bg-red-50', 'text-red-700'),
                buildKPITile('ApplicationSpend_$mm', Package, 'bg-amber-50', 'text-amber-700')
            ],
            optimizeRates: [
                buildKPITile('AdvisoryFeeRate_pct', DollarSign, 'bg-teal-50', 'text-teal-700'),
                buildKPITile('AdvisoryRevenue_$mm', TrendingUp, 'bg-cyan-50', 'text-cyan-700'),
                buildKPITile('AvgFeePerTrade_pct', BarChart3, 'bg-emerald-50', 'text-emerald-700'),
                buildKPITile('TransactionRevenue_$mm', DollarSign, 'bg-sky-50', 'text-sky-700')
            ]
        };
    }, [excelData]);
    
    return (
        <div className="flex-1">
            {/* Hero Section - Redesigned with smaller logo and search bar higher */}
            <div className="bg-white px-8 py-6">
                <div className="max-w-7xl mx-auto">
                    <div className="flex items-center justify-between mb-6">
                        {/* User Profile with smaller logo */}
                        <div className="flex items-center space-x-4">
                            <div className="relative w-16 h-16">
                                {/* Global Finance Logo - Reduced size */}
                                <div className="w-full h-full rounded-full overflow-hidden shadow-lg border-2 border-white bg-white p-2">
                                    <img
                                        src="/logo.svg"
                                        alt="Global Finance Logo"
                                        className="w-full h-full object-contain"
                                    />
                                </div>
                                {/* Online indicator */}
                                <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-navy-900">Hi Sarah,</h2>
                                <p className="text-sm text-gray-600">Here's your executive overview for today</p>
                            </div>
                        </div>
                        
                        {/* AI Search Bar - Moved higher and smaller */}
                        <div className="relative max-w-xl flex-1 ml-8">
                            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyPress={handleKeyPress}
                                onFocus={() => setIsSearchFocused(true)}
                                onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                                placeholder="Ask me anything about your business..."
                                className="w-full pl-11 pr-20 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            />
                            <button
                                onClick={handleAISearch}
                                disabled={isSearching || !searchQuery.trim()}
                                className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-gradient-to-r from-green-500 to-green-600 text-white px-4 py-1.5 rounded-full hover:shadow-lg hover:shadow-green-500/50 transition-all border border-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                            >
                                {isSearching ? (
                                    <div className="flex items-center space-x-1">
                                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        <span>Analyzing...</span>
                                    </div>
                                ) : (
                                    'Search'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* KPI Clusters Grid */}
            <div className="px-8 pb-12 bg-gray-50">
                <div className="max-w-7xl mx-auto">
                    {/* Top Row - Clusters 1 and 2 */}
                    <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-8">
                        {/* Cluster 1: Increase Volumes - Top Left */}
                        <div className="bg-gray-100/50 rounded-xl p-6 border border-gray-200">
                            <h3 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Increase Volumes</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {kpiClusters.increaseVolumes.map((insight) => {
                                    const Icon = insight.icon;
                                    return (
                                        <motion.div
                                            key={insight.id}
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            onClick={() => handleInsightClick(insight)}
                                            className="bg-white rounded-xl shadow-sm hover:shadow-lg hover:shadow-purple-100 transition-all cursor-pointer border border-gray-100 hover:border-purple-200 relative overflow-hidden min-h-[200px] flex flex-col"
                                        >
                                            {/* Status indicator bar at top */}
                                            <div className={`absolute top-0 left-0 right-0 h-1 ${insight.priority === 'critical' ? 'bg-red-500' :
                                                insight.priority === 'high' ? 'bg-green-500' :
                                                    'bg-gray-300'
                                                }`} />

                                            <div className="p-4 flex flex-col flex-1">
                                                {/* Header with icon and trend */}
                                                <div className="flex items-start justify-between mb-3">
                                                    <div className={`p-2 rounded-lg ${insight.bgColor} flex-shrink-0`}>
                                                        <Icon className={`w-4 h-4 ${insight.iconColor}`} />
                                                    </div>
                                                    <div className="flex items-center space-x-1 flex-shrink-0">
                                                        {insight.trend === 'up' && <TrendingUp className="w-3 h-3 text-green-500" />}
                                                        {insight.trend === 'down' && <TrendingDown className="w-3 h-3 text-red-500" />}
                                                        <span className={`text-xs font-bold ${insight.valueColor}`}>
                                                            {insight.value}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Large KPI Display */}
                                                <div className="mb-3">
                                                    <h4 className="text-xl font-bold text-navy-900 leading-tight">{insight.kpi}</h4>
                                                    <p className="text-xs font-medium text-gray-700 mt-0.5 line-clamp-1">{insight.kpiLabel}</p>
                                                </div>

                                                {/* Mini visualization - Different styles based on KPI type */}
                                                <div className="h-12 mb-3 flex items-center">
                                                    {insight.kpiLabel.toLowerCase().includes('headcount') || insight.kpiLabel.toLowerCase().includes('fte') ? (
                                                        // Bar chart for Headcount
                                                        <div className="w-full h-full flex items-end justify-between gap-1 px-2">
                                                            {[60, 70, 80, 85, 90].map((height, idx) => (
                                                                <div 
                                                                    key={idx} 
                                                                    className={`flex-1 rounded-t ${insight.trend === 'up' ? 'bg-green-400' : 'bg-red-400'}`}
                                                                    style={{ height: `${height}%` }}
                                                                />
                                                            ))}
                                                        </div>
                                                        ) : insight.kpiLabel.toLowerCase().includes('rate') || insight.kpiLabel.toLowerCase().includes('pct') || insight.kpiLabel.toLowerCase().includes('%') ? (
                                                        // Circular progress for rates/percentages
                                                        <div className="w-12 h-12 mx-auto">
                                                            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                                                                <circle
                                                                    cx="18"
                                                                    cy="18"
                                                                    r="16"
                                                                    fill="none"
                                                                    stroke="#e5e7eb"
                                                                    strokeWidth="2"
                                                                />
                                                                <circle
                                                                    cx="18"
                                                                    cy="18"
                                                                    r="16"
                                                                    fill="none"
                                                                    stroke={insight.trend === 'up' ? "#10b981" : "#ef4444"}
                                                                    strokeWidth="2"
                                                                    strokeDasharray={`${Math.min((insight as any).trendPercent || 0, 100)}, 100`}
                                                                    strokeLinecap="round"
                                                                />
                                                            </svg>
                                                        </div>
                                                    ) : (
                                                        // Line chart for other metrics
                                                        <svg className="w-full h-full" viewBox="0 0 60 24" preserveAspectRatio="none">
                                                            <polyline
                                                                points={insight.trend === 'up' ? "2,20 10,18 18,16 26,14 34,10 42,8 50,6 58,4" : "2,4 10,6 18,8 26,10 34,14 42,16 50,18 58,20"}
                                                                fill="none"
                                                                stroke={insight.trend === 'up' ? "#10b981" : "#ef4444"}
                                                                strokeWidth="2"
                                                            />
                                                        </svg>
                                                    )}
                                                </div>

                                                {/* Insight text */}
                                                <p className="text-xs text-gray-600 mt-auto">{insight.insight}</p>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        </div>
                        
                        {/* Cluster 2: Workforce Management - Top Right */}
                        <div className="bg-gray-100/50 rounded-xl p-6 border border-gray-200">
                            <h3 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Workforce Management</h3>
                            <div className="grid grid-cols-1 gap-4">
                                {kpiClusters.workforceManagement.map((insight) => {
                                    const Icon = insight.icon;
                                    return (
                                        <motion.div
                                            key={insight.id}
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            onClick={() => handleInsightClick(insight)}
                                            className="bg-white rounded-xl shadow-sm hover:shadow-lg hover:shadow-purple-100 transition-all cursor-pointer border border-gray-100 hover:border-purple-200 relative overflow-hidden min-h-[200px] flex flex-col"
                                        >
                                            {/* Status indicator bar at top */}
                                            <div className={`absolute top-0 left-0 right-0 h-1 ${insight.priority === 'critical' ? 'bg-red-500' :
                                                insight.priority === 'high' ? 'bg-green-500' :
                                                    'bg-gray-300'
                                                }`} />

                                            <div className="p-4 flex flex-col flex-1">
                                                {/* Header with icon and trend */}
                                                <div className="flex items-start justify-between mb-3">
                                                    <div className={`p-2 rounded-lg ${insight.bgColor} flex-shrink-0`}>
                                                        <Icon className={`w-4 h-4 ${insight.iconColor}`} />
                                                    </div>
                                                    <div className="flex items-center space-x-1 flex-shrink-0">
                                                        {insight.trend === 'up' && <TrendingUp className="w-3 h-3 text-green-500" />}
                                                        {insight.trend === 'down' && <TrendingDown className="w-3 h-3 text-red-500" />}
                                                        <span className={`text-xs font-bold ${insight.valueColor}`}>
                                                            {insight.value}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Large KPI Display */}
                                                <div className="mb-3">
                                                    <h4 className="text-xl font-bold text-navy-900 leading-tight">{insight.kpi}</h4>
                                                    <p className="text-xs font-medium text-gray-700 mt-0.5 line-clamp-1">{insight.kpiLabel}</p>
                                                </div>

                                                {/* Mini visualization - Different styles based on KPI type */}
                                                <div className="h-12 mb-3 flex items-center">
                                                    {insight.kpiLabel.toLowerCase().includes('headcount') || insight.kpiLabel.toLowerCase().includes('fte') ? (
                                                        // Bar chart for Headcount
                                                        <div className="w-full h-full flex items-end justify-between gap-1 px-2">
                                                            {[60, 70, 80, 85, 90].map((height, idx) => (
                                                                <div 
                                                                    key={idx} 
                                                                    className={`flex-1 rounded-t ${insight.trend === 'up' ? 'bg-green-400' : 'bg-red-400'}`}
                                                                    style={{ height: `${height}%` }}
                                                                />
                                                            ))}
                                                        </div>
                                                        ) : insight.kpiLabel.toLowerCase().includes('rate') || insight.kpiLabel.toLowerCase().includes('pct') || insight.kpiLabel.toLowerCase().includes('%') ? (
                                                        // Circular progress for rates/percentages
                                                        <div className="w-12 h-12 mx-auto">
                                                            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                                                                <circle
                                                                    cx="18"
                                                                    cy="18"
                                                                    r="16"
                                                                    fill="none"
                                                                    stroke="#e5e7eb"
                                                                    strokeWidth="2"
                                                                />
                                                                <circle
                                                                    cx="18"
                                                                    cy="18"
                                                                    r="16"
                                                                    fill="none"
                                                                    stroke={insight.trend === 'up' ? "#10b981" : "#ef4444"}
                                                                    strokeWidth="2"
                                                                    strokeDasharray={`${Math.min((insight as any).trendPercent || 0, 100)}, 100`}
                                                                    strokeLinecap="round"
                                                                />
                                                            </svg>
                                                        </div>
                                                    ) : (
                                                        // Line chart for other metrics
                                                        <svg className="w-full h-full" viewBox="0 0 60 24" preserveAspectRatio="none">
                                                            <polyline
                                                                points={insight.trend === 'up' ? "2,20 10,18 18,16 26,14 34,10 42,8 50,6 58,4" : "2,4 10,6 18,8 26,10 34,14 42,16 50,18 58,20"}
                                                                fill="none"
                                                                stroke={insight.trend === 'up' ? "#10b981" : "#ef4444"}
                                                                strokeWidth="2"
                                                            />
                                                        </svg>
                                                    )}
                                                </div>

                                                {/* Insight text */}
                                                <p className="text-xs text-gray-600 mt-auto">{insight.insight}</p>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                    
                    {/* Bottom Row - Clusters 3 and 4 */}
                    <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-8 mt-8">
                        {/* Cluster 3: Optimize Rates - Bottom Left (swapped) */}
                        <div className="bg-gray-100/50 rounded-xl p-6 border border-gray-200">
                            <h3 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Optimize Rates</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {kpiClusters.optimizeRates.map((insight) => {
                                    const Icon = insight.icon;
                                    return (
                                        <motion.div
                                            key={insight.id}
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            onClick={() => handleInsightClick(insight)}
                                            className="bg-white rounded-xl shadow-sm hover:shadow-lg hover:shadow-purple-100 transition-all cursor-pointer border border-gray-100 hover:border-purple-200 relative overflow-hidden min-h-[200px] flex flex-col"
                                        >
                                            {/* Status indicator bar at top */}
                                            <div className={`absolute top-0 left-0 right-0 h-1 ${insight.priority === 'critical' ? 'bg-red-500' :
                                                insight.priority === 'high' ? 'bg-green-500' :
                                                    'bg-gray-300'
                                                }`} />

                                            <div className="p-4 flex flex-col flex-1">
                                                {/* Header with icon and trend */}
                                                <div className="flex items-start justify-between mb-3">
                                                    <div className={`p-2 rounded-lg ${insight.bgColor} flex-shrink-0`}>
                                                        <Icon className={`w-4 h-4 ${insight.iconColor}`} />
                                                    </div>
                                                    <div className="flex items-center space-x-1 flex-shrink-0">
                                                        {insight.trend === 'up' && <TrendingUp className="w-3 h-3 text-green-500" />}
                                                        {insight.trend === 'down' && <TrendingDown className="w-3 h-3 text-red-500" />}
                                                        <span className={`text-xs font-bold ${insight.valueColor}`}>
                                                            {insight.value}
                                                        </span>
                                                    </div>
                                                </div>

                                                    {/* Large KPI Display */}
                                                    <div className="mb-3">
                                                        <h4 className="text-xl font-bold text-navy-900 leading-tight">{insight.kpi}</h4>
                                                        <p className="text-xs font-medium text-gray-700 mt-0.5 line-clamp-1">{insight.kpiLabel}</p>
                                                    </div>

                                                    {/* Mini visualization - Different styles based on KPI type */}
                                                    <div className="h-12 mb-3 flex items-center">
                                                        {insight.kpiLabel.toLowerCase().includes('headcount') || insight.kpiLabel.toLowerCase().includes('fte') ? (
                                                            // Bar chart for Headcount
                                                            <div className="w-full h-full flex items-end justify-between gap-1 px-2">
                                                                {[60, 70, 80, 85, 90].map((height, idx) => (
                                                                    <div 
                                                                        key={idx} 
                                                                        className={`flex-1 rounded-t ${insight.trend === 'up' ? 'bg-green-400' : 'bg-red-400'}`}
                                                                        style={{ height: `${height}%` }}
                                                                    />
                                                                ))}
                                                            </div>
                                                        ) : insight.kpiLabel.toLowerCase().includes('rate') || insight.kpiLabel.toLowerCase().includes('pct') || insight.kpiLabel.toLowerCase().includes('%') ? (
                                                        // Circular progress for rates/percentages
                                                        <div className="w-12 h-12 mx-auto">
                                                            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                                                                <circle
                                                                    cx="18"
                                                                    cy="18"
                                                                    r="16"
                                                                    fill="none"
                                                                    stroke="#e5e7eb"
                                                                    strokeWidth="2"
                                                                />
                                                                <circle
                                                                    cx="18"
                                                                    cy="18"
                                                                    r="16"
                                                                    fill="none"
                                                                    stroke={insight.trend === 'up' ? "#10b981" : "#ef4444"}
                                                                    strokeWidth="2"
                                                                    strokeDasharray={`${Math.min((insight as any).trendPercent || 0, 100)}, 100`}
                                                                    strokeLinecap="round"
                                                                />
                                                            </svg>
                                                        </div>
                                                        ) : (
                                                            // Line chart for other metrics
                                                            <svg className="w-full h-full" viewBox="0 0 60 24" preserveAspectRatio="none">
                                                                <polyline
                                                                    points={insight.trend === 'up' ? "2,20 10,18 18,16 26,14 34,10 42,8 50,6 58,4" : "2,4 10,6 18,8 26,10 34,14 42,16 50,18 58,20"}
                                                                    fill="none"
                                                                    stroke={insight.trend === 'up' ? "#10b981" : "#ef4444"}
                                                                    strokeWidth="2"
                                                                />
                                                            </svg>
                                                        )}
                                                    </div>

                                                    {/* Insight text */}
                                                    <p className="text-xs text-gray-600 mt-auto">{insight.insight}</p>
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                        </div>
                        
                        {/* Cluster 4: Minimize Expenses - Bottom Right (swapped) */}
                        <div className="bg-gray-100/50 rounded-xl p-6 border border-gray-200">
                            <h3 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Minimize Expenses</h3>
                            <div className="grid grid-cols-1 gap-4">
                                    {kpiClusters.minimizeExpenses.map((insight) => {
                                        const Icon = insight.icon;
                                        return (
                                            <motion.div
                                                key={insight.id}
                                                whileHover={{ scale: 1.02 }}
                                                whileTap={{ scale: 0.98 }}
                                                onClick={() => handleInsightClick(insight)}
                                                className="bg-white rounded-xl shadow-sm hover:shadow-lg hover:shadow-purple-100 transition-all cursor-pointer border border-gray-100 hover:border-purple-200 relative overflow-hidden min-h-[200px] flex flex-col"
                                            >
                                                {/* Status indicator bar at top */}
                                                <div className={`absolute top-0 left-0 right-0 h-1 ${insight.priority === 'critical' ? 'bg-red-500' :
                                                    insight.priority === 'high' ? 'bg-green-500' :
                                                        'bg-gray-300'
                                                    }`} />

                                                <div className="p-4 flex flex-col flex-1">
                                                    {/* Header with icon and trend */}
                                                    <div className="flex items-start justify-between mb-3">
                                                        <div className={`p-2 rounded-lg ${insight.bgColor} flex-shrink-0`}>
                                                            <Icon className={`w-4 h-4 ${insight.iconColor}`} />
                                                        </div>
                                                        <div className="flex items-center space-x-1 flex-shrink-0">
                                                            {insight.trend === 'up' && <TrendingUp className="w-3 h-3 text-green-500" />}
                                                            {insight.trend === 'down' && <TrendingDown className="w-3 h-3 text-red-500" />}
                                                            <span className={`text-xs font-bold ${insight.valueColor}`}>
                                                                {insight.value}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Large KPI Display */}
                                                    <div className="mb-3">
                                                        <h4 className="text-xl font-bold text-navy-900 leading-tight">{insight.kpi}</h4>
                                                        <p className="text-xs font-medium text-gray-700 mt-0.5 line-clamp-1">{insight.kpiLabel}</p>
                                                    </div>

                                                    {/* Mini visualization - Different styles based on KPI type */}
                                                    <div className="h-12 mb-3 flex items-center">
                                                        {insight.kpiLabel.toLowerCase().includes('headcount') || insight.kpiLabel.toLowerCase().includes('fte') ? (
                                                            // Bar chart for Headcount
                                                            <div className="w-full h-full flex items-end justify-between gap-1 px-2">
                                                                {[60, 70, 80, 85, 90].map((height, idx) => (
                                                                    <div 
                                                                        key={idx} 
                                                                        className={`flex-1 rounded-t ${insight.trend === 'up' ? 'bg-green-400' : 'bg-red-400'}`}
                                                                        style={{ height: `${height}%` }}
                                                                    />
                                                                ))}
                                                            </div>
                                                        ) : insight.kpiLabel.toLowerCase().includes('rate') || insight.kpiLabel.toLowerCase().includes('pct') || insight.kpiLabel.toLowerCase().includes('%') ? (
                                                        // Circular progress for rates/percentages
                                                        <div className="w-12 h-12 mx-auto">
                                                            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                                                                <circle
                                                                    cx="18"
                                                                    cy="18"
                                                                    r="16"
                                                                    fill="none"
                                                                    stroke="#e5e7eb"
                                                                    strokeWidth="2"
                                                                />
                                                                <circle
                                                                    cx="18"
                                                                    cy="18"
                                                                    r="16"
                                                                    fill="none"
                                                                    stroke={insight.trend === 'up' ? "#10b981" : "#ef4444"}
                                                                    strokeWidth="2"
                                                                    strokeDasharray={`${Math.min((insight as any).trendPercent || 0, 100)}, 100`}
                                                                    strokeLinecap="round"
                                                                />
                                                            </svg>
                                                        </div>
                                                        ) : (
                                                            // Line chart for other metrics
                                                            <svg className="w-full h-full" viewBox="0 0 60 24" preserveAspectRatio="none">
                                                                <polyline
                                                                    points={insight.trend === 'up' ? "2,20 10,18 18,16 26,14 34,10 42,8 50,6 58,4" : "2,4 10,6 18,8 26,10 34,14 42,16 50,18 58,20"}
                                                                    fill="none"
                                                                    stroke={insight.trend === 'up' ? "#10b981" : "#ef4444"}
                                                                    strokeWidth="2"
                                                                />
                                                            </svg>
                                                        )}
                                                    </div>

                                                    {/* Insight text */}
                                                    <p className="text-xs text-gray-600 mt-auto">{insight.insight}</p>
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Enhanced Modal for Insight Details */}
            {showModal && selectedInsight && (
                <AnimatePresence>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowModal(false)}
                        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
                        >
                            {/* Modal Header with colored bar */}
                            <div className={`h-2 ${selectedInsight.priority === 'critical' ? 'bg-red-500' :
                                selectedInsight.priority === 'high' ? 'bg-yellow-500' :
                                    'bg-gray-300'
                                }`} />

                            <div className="p-6 overflow-y-auto max-h-[calc(90vh-8px)]">
                                {/* Header Section */}
                                <div className="flex items-start justify-between mb-6">
                                    <div className="flex items-start space-x-4">
                                        <div className={`p-3 rounded-lg ${selectedInsight.bgColor}`}>
                                            {(() => {
                                                const Icon = selectedInsight.icon;
                                                return <Icon className={`w-7 h-7 ${selectedInsight.iconColor}`} />;
                                            })()}
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-semibold text-navy-900">{selectedInsight.title}</h3>
                                            <p className="text-sm text-gray-500 mt-1">AI-driven insight</p>
                                            <div className="flex items-center space-x-4 mt-2">
                                                <span className="text-xs text-gray-500">
                                                    <span className="font-medium">Source:</span> {selectedInsight.dataSource}
                                                </span>
                                                <span className="text-xs text-gray-500">
                                                    <span className="font-medium">Updated:</span> {selectedInsight.lastUpdated}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setShowModal(false)}
                                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                    >
                                        <X className="w-5 h-5 text-gray-400" />
                                    </button>
                                </div>

                                {/* Main Content Grid */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {/* Left Column */}
                                    <div className="space-y-6">
                                        {/* Key Metrics */}
                                        <div className="bg-gray-50 rounded-xl p-5">
                                            <div className="flex items-center justify-between mb-4">
                                                <h4 className="text-sm font-semibold text-gray-900">Key Metrics</h4>
                                                <div className="flex items-center space-x-2">
                                                    <span className="text-xs text-gray-500">AI Confidence</span>
                                                    <div className="flex items-center space-x-1">
                                                        <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full bg-gradient-to-r from-purple-500 to-purple-600 rounded-full"
                                                                style={{ width: `${selectedInsight.confidenceScore}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-xs font-bold text-gray-700">{selectedInsight.confidenceScore}%</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between py-3 border-b border-gray-200">
                                                    <div>
                                                        <p className="text-xs text-gray-500 uppercase tracking-wider">Current Value</p>
                                                        <p className={`text-2xl font-bold ${selectedInsight.valueColor} mt-1`}>
                                                            {selectedInsight.value}
                                                        </p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-xs text-gray-500 uppercase tracking-wider">Trend</p>
                                                        <p className="text-sm font-medium text-gray-900 mt-1">
                                                            {selectedInsight.trend === 'up' ? 'Improving' :
                                                                selectedInsight.trend === 'down' ? 'Declining' :
                                                                    'Stable'}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="pt-2">
                                                    <p className="text-sm text-gray-700 leading-relaxed">{selectedInsight.insight}</p>
                                                    <p className="text-xs text-gray-500 mt-2">{selectedInsight.historicalContext}</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Impacted Metrics */}
                                        <div className="bg-white border border-gray-200 rounded-xl p-5">
                                            <h4 className="text-sm font-semibold text-gray-900 mb-4">Impacted Metrics</h4>
                                            <div className="space-y-3">
                                                {selectedInsight.impactedMetrics.map((metric: any, idx: number) => (
                                                    <div key={idx} className="flex items-center justify-between">
                                                        <span className="text-sm text-gray-600">{metric.metric}</span>
                                                        <span className={`text-sm font-medium ${metric.trend === 'positive' ? 'text-green-600' :
                                                            metric.trend === 'negative' ? 'text-red-600' :
                                                                'text-gray-600'
                                                            }`}>
                                                            {metric.value}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Data Quality Indicators */}
                                        <div className="bg-white border border-gray-200 rounded-xl p-5">
                                            <h4 className="text-sm font-semibold text-gray-900 mb-4">Data Quality & Model Info</h4>
                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm text-gray-600">Data Quality</span>
                                                    <span className={`text-sm font-medium ${selectedInsight.dataQuality === 'Very High' ? 'text-green-600' :
                                                        selectedInsight.dataQuality === 'High' ? 'text-blue-600' :
                                                            selectedInsight.dataQuality === 'Medium' ? 'text-yellow-600' :
                                                                'text-gray-600'
                                                        }`}>
                                                        {selectedInsight.dataQuality}
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm text-gray-600">Model Accuracy</span>
                                                    <span className="text-sm font-medium text-gray-900">{selectedInsight.modelAccuracy}</span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm text-gray-600">Category</span>
                                                    <span className="text-sm font-medium text-gray-900">{selectedInsight.category}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right Column */}
                                    <div className="space-y-6">
                                        {/* AI Recommendations */}
                                        <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl p-5 border border-purple-200">
                                            <div className="flex items-center space-x-2 mb-4">
                                                <Brain className="w-5 h-5 text-purple-600" />
                                                <h4 className="text-sm font-semibold text-gray-900">Recommendations</h4>
                                            </div>
                                            <div className="space-y-3">
                                                {selectedInsight.aiRecommendations.map((rec: string, idx: number) => (
                                                    <div key={idx} className="flex items-start space-x-2">
                                                        <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                            <span className="text-xs font-bold text-purple-700">{idx + 1}</span>
                                                        </div>
                                                        <p className="text-sm text-gray-700">{rec}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Predictive Insight */}
                                        <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-5 border border-purple-200">
                                            <div className="flex items-center space-x-2 mb-3">
                                                <TrendingUp className="w-5 h-5 text-purple-600" />
                                                <h4 className="text-sm font-semibold text-gray-900">Predictive Forecast</h4>
                                            </div>
                                            <p className="text-sm text-gray-700">{selectedInsight.predictiveInsight}</p>
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="flex gap-3">
                                            <button
                                                onClick={handleViewConsole}
                                                disabled={!selectedInsight?.consoleAvailable}
                                                className={`flex-1 px-4 py-3 text-sm font-medium rounded-lg transition-all shadow-lg ${selectedInsight?.consoleAvailable
                                                    ? 'text-white bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 hover:shadow-xl'
                                                    : 'text-gray-400 bg-gray-100 cursor-not-allowed'
                                                    }`}
                                            >
                                                {selectedInsight?.consoleAvailable ? 'View Insights Console' : 'View Insights Console (Coming Soon)'}
                                            </button>
                                            <button className="px-4 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                                                Export
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                </AnimatePresence>
            )}

            {/* AI Search Results Modal */}
            {showSearchResults && (
                <AnimatePresence>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowSearchResults(false)}
                        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
                        >
                            {/* Header */}
                            <div className="bg-gradient-to-r from-purple-500 to-purple-600 p-6 text-white">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <div className="flex items-center space-x-3 mb-2">
                                            <Brain className="w-8 h-8" />
                                            <h2 className="text-2xl font-bold">Analysis Results</h2>
                                        </div>
                                        <p className="text-purple-100">Query: "{searchQuery}"</p>
                                    </div>
                                    <button
                                        onClick={() => setShowSearchResults(false)}
                                        className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                                {isSearching ? (
                                    <div className="flex flex-col items-center justify-center py-20">
                                        <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                                        <p className="text-gray-600">Analyzing business data and generating insights...</p>
                                    </div>
                                ) : searchResults ? (
                                    <div className="space-y-6">
                                        {/* Summary */}
                                        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-5 border border-blue-200">
                                            <h3 className="font-semibold text-gray-900 mb-2">Executive Summary</h3>
                                            <p className="text-gray-700">{searchResults.summary}</p>
                                        </div>

                                        {/* Key Findings */}
                                        <div>
                                            <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                                                <Target className="w-5 h-5 mr-2 text-purple-600" />
                                                Key Findings
                                            </h3>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                {searchResults.keyFindings.map((finding: any, idx: number) => (
                                                    <div key={idx} className="bg-white border border-gray-200 rounded-lg p-4">
                                                        <div className="flex items-start justify-between mb-2">
                                                            <h4 className="font-medium text-gray-900 text-sm">{finding.title}</h4>
                                                            <div className="flex items-center space-x-1">
                                                                <span className="text-xs text-gray-500">Confidence</span>
                                                                <span className="text-xs font-bold text-purple-600">{finding.confidence}%</span>
                                                            </div>
                                                        </div>
                                                        <p className="text-sm text-gray-600">{finding.detail}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Data Visualizations */}
                                        {searchResults.visualizations && (
                                            <div>
                                                <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                                                    <BarChart3 className="w-5 h-5 mr-2 text-cyan-600" />
                                                    Data Visualizations
                                                </h3>
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                    {Object.entries(searchResults.visualizations).map(([key, viz]: [string, any]) => (
                                                        <div key={key} className="bg-white border border-gray-200 rounded-lg p-4">
                                                            <h4 className="text-sm font-medium text-gray-900 mb-3">{viz.title}</h4>

                                                            {/* Line Chart */}
                                                            {viz.type === 'line' && (
                                                                <div className="h-32 relative">
                                                                    <svg className="w-full h-full" viewBox="0 0 300 120">
                                                                        {/* Grid lines */}
                                                                        <line x1="0" y1="100" x2="300" y2="100" stroke="#e5e7eb" strokeWidth="1" />
                                                                        <line x1="0" y1="60" x2="300" y2="60" stroke="#e5e7eb" strokeWidth="1" />
                                                                        <line x1="0" y1="20" x2="300" y2="20" stroke="#e5e7eb" strokeWidth="1" />

                                                                        {/* Actual line */}
                                                                        <polyline
                                                                            points={viz.data.map((d: any, i: number) =>
                                                                                `${i * 25},${100 - (d.value - 17) * 20}`
                                                                            ).join(' ')}
                                                                            fill="none"
                                                                            stroke="#06b6d4"
                                                                            strokeWidth="2"
                                                                        />

                                                                        {/* Benchmark line */}
                                                                        <polyline
                                                                            points={viz.data.map((d: any, i: number) =>
                                                                                `${i * 25},${100 - (d.benchmark - 17) * 20}`
                                                                            ).join(' ')}
                                                                            fill="none"
                                                                            stroke="#94a3b8"
                                                                            strokeWidth="2"
                                                                            strokeDasharray="5,5"
                                                                        />

                                                                        {/* Data points */}
                                                                        {viz.data.map((d: any, i: number) => (
                                                                            <circle
                                                                                key={i}
                                                                                cx={i * 25}
                                                                                cy={100 - (d.value - 17) * 20}
                                                                                r="3"
                                                                                fill="#06b6d4"
                                                                            />
                                                                        ))}
                                                                    </svg>
                                                                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                                                                        <span>{viz.data[0].month}</span>
                                                                        <span>{viz.data[Math.floor(viz.data.length / 2)].month}</span>
                                                                        <span>{viz.data[viz.data.length - 1].month}</span>
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {/* Bar Chart */}
                                                            {viz.type === 'bar' && (
                                                                <div className="space-y-2">
                                                                    {viz.data.map((d: any, i: number) => {
                                                                        // Handle different data structures
                                                                        const label = d.region || d.segment || d.quarter || d.segment;
                                                                        const value = d.free || d.share || Math.abs(d.change) || d.atp || 0;
                                                                        const displayValue = d.free ? `$${d.free}M` :
                                                                            d.atp ? `$${(d.atp / 1000).toFixed(0)}K` :
                                                                                d.change !== undefined ? `${d.change > 0 ? '+' : ''}${d.change}%` :
                                                                                    `${d.share}%`;
                                                                        const maxValue = Math.max(...viz.data.map((item: any) =>
                                                                            item.free || item.share || Math.abs(item.change) || item.atp / 1000 || 0
                                                                        ));
                                                                        const percentage = (value / maxValue) * 100;

                                                                        return (
                                                                            <div key={i}>
                                                                                <div className="flex justify-between text-xs mb-1">
                                                                                    <span className="text-gray-600">{label}</span>
                                                                                    <span className={`font-medium ${d.change !== undefined && d.change < 0 ? 'text-red-600' : 'text-green-600'
                                                                                        }`}>
                                                                                        {displayValue}
                                                                                    </span>
                                                                                </div>
                                                                                <div className="w-full bg-gray-200 rounded-full h-2">
                                                                                    <div
                                                                                        className={`h-2 rounded-full ${d.change !== undefined && d.change < 0 ? 'bg-red-400' : 'bg-cyan-500'
                                                                                            }`}
                                                                                        style={{ width: `${percentage}%` }}
                                                                                    />
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}

                                                            {/* Pie Chart */}
                                                            {viz.type === 'pie' && (
                                                                <div className="flex items-center justify-center">
                                                                    <div className="relative w-32 h-32">
                                                                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                                                                            {(() => {
                                                                                let cumulativePercent = 0;
                                                                                return viz.data.map((d: any, i: number) => {
                                                                                    const startAngle = cumulativePercent * 3.6;
                                                                                    cumulativePercent += d.value;
                                                                                    const endAngle = cumulativePercent * 3.6;
                                                                                    const largeArc = d.value > 50 ? 1 : 0;
                                                                                    const x1 = 50 + 40 * Math.cos(startAngle * Math.PI / 180);
                                                                                    const y1 = 50 + 40 * Math.sin(startAngle * Math.PI / 180);
                                                                                    const x2 = 50 + 40 * Math.cos(endAngle * Math.PI / 180);
                                                                                    const y2 = 50 + 40 * Math.sin(endAngle * Math.PI / 180);

                                                                                    return (
                                                                                        <path
                                                                                            key={i}
                                                                                            d={`M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`}
                                                                                            fill={d.color}
                                                                                            stroke="white"
                                                                                            strokeWidth="2"
                                                                                        />
                                                                                    );
                                                                                });
                                                                            })()}
                                                                        </svg>
                                                                        <div className="absolute inset-0 flex items-center justify-center">
                                                                            <div className="text-center">
                                                                                <p className="text-xs text-gray-500">Total</p>
                                                                                <p className="text-sm font-bold">100%</p>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    <div className="ml-4 space-y-1">
                                                                        {viz.data.map((d: any, i: number) => (
                                                                            <div key={i} className="flex items-center space-x-2">
                                                                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                                                                                <span className="text-xs text-gray-600">{d.name}: {d.value}%</span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {/* Gauge Chart */}
                                                            {viz.type === 'gauge' && (
                                                                <div className="flex items-center justify-center">
                                                                    <div className="relative w-40 h-20">
                                                                        <svg className="w-full h-full" viewBox="0 0 100 50">
                                                                            {/* Background arc */}
                                                                            <path
                                                                                d="M 10 45 A 35 35 0 0 1 90 45"
                                                                                fill="none"
                                                                                stroke="#e5e7eb"
                                                                                strokeWidth="8"
                                                                                strokeLinecap="round"
                                                                            />
                                                                            {/* Progress arc */}
                                                                            <path
                                                                                d="M 10 45 A 35 35 0 0 1 90 45"
                                                                                fill="none"
                                                                                stroke="#06b6d4"
                                                                                strokeWidth="8"
                                                                                strokeLinecap="round"
                                                                                strokeDasharray={`${viz.data.current * 1.8} 180`}
                                                                            />
                                                                            {/* Target marker */}
                                                                            <line
                                                                                x1="50"
                                                                                y1="10"
                                                                                x2="50"
                                                                                y2="15"
                                                                                stroke="#ef4444"
                                                                                strokeWidth="2"
                                                                                transform={`rotate(${(viz.data.target / 100) * 180 - 90} 50 45)`}
                                                                            />
                                                                        </svg>
                                                                        <div className="absolute inset-0 flex items-end justify-center pb-1">
                                                                            <div className="text-center">
                                                                                <p className="text-lg font-bold text-gray-900">{viz.data.current}%</p>
                                                                                <p className="text-xs text-gray-500">Target: {viz.data.target}%</p>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {/* Waterfall Chart */}
                                                            {viz.type === 'waterfall' && (
                                                                <div className="h-48">
                                                                    <svg className="w-full h-full" viewBox="0 0 400 180">
                                                                        {(() => {
                                                                            let cumulative = 0;
                                                                            const maxValue = Math.max(...viz.data.map((d: any) => Math.abs(d.value)));
                                                                            const scale = 120 / maxValue;

                                                                            return viz.data.map((d: any, i: number) => {
                                                                                const barHeight = Math.abs(d.value) * scale;
                                                                                const barY = d.value > 0 ? 150 - cumulative * scale - barHeight : 150 - cumulative * scale;
                                                                                const previousCumulative = cumulative;
                                                                                if (d.category !== 'Current Year' && d.category !== 'Prior Year') {
                                                                                    cumulative += d.value;
                                                                                }

                                                                                return (
                                                                                    <g key={i}>
                                                                                        <rect
                                                                                            x={i * 55 + 10}
                                                                                            y={barY}
                                                                                            width={45}
                                                                                            height={barHeight}
                                                                                            fill={d.value > 0 ? '#10b981' : '#ef4444'}
                                                                                            opacity="0.8"
                                                                                        />
                                                                                        {i < viz.data.length - 1 && i > 0 && (
                                                                                            <line
                                                                                                x1={i * 55 + 55}
                                                                                                y1={150 - cumulative * scale}
                                                                                                x2={(i + 1) * 55 + 10}
                                                                                                y2={150 - cumulative * scale}
                                                                                                stroke="#94a3b8"
                                                                                                strokeWidth="1"
                                                                                                strokeDasharray="2,2"
                                                                                            />
                                                                                        )}
                                                                                        <text
                                                                                            x={i * 55 + 32}
                                                                                            y={barY - 5}
                                                                                            textAnchor="middle"
                                                                                            className="text-xs font-medium fill-gray-700"
                                                                                        >
                                                                                            {d.value > 0 ? '+' : ''}{d.value.toFixed(1)}
                                                                                        </text>
                                                                                    </g>
                                                                                );
                                                                            });
                                                                        })()}
                                                                        {/* X-axis labels */}
                                                                        {viz.data.map((d: any, i: number) => (
                                                                            <text
                                                                                key={`label-${i}`}
                                                                                x={i * 55 + 32}
                                                                                y={170}
                                                                                textAnchor="middle"
                                                                                className="text-xs fill-gray-600"
                                                                                fontSize="10"
                                                                            >
                                                                                {d.category.length > 10 ? d.category.substring(0, 8) + '...' : d.category}
                                                                            </text>
                                                                        ))}
                                                                    </svg>
                                                                </div>
                                                            )}

                                                            {/* Area Chart */}
                                                            {viz.type === 'area' && (
                                                                <div className="h-32 relative">
                                                                    <svg className="w-full h-full" viewBox="0 0 300 120">
                                                                        {/* Grid lines */}
                                                                        <line x1="0" y1="100" x2="300" y2="100" stroke="#e5e7eb" strokeWidth="1" />
                                                                        <line x1="0" y1="60" x2="300" y2="60" stroke="#e5e7eb" strokeWidth="1" />
                                                                        <line x1="0" y1="20" x2="300" y2="20" stroke="#e5e7eb" strokeWidth="1" />

                                                                        {/* Area fill */}
                                                                        <path
                                                                            d={`M 0,100 ${viz.data.map((d: any, i: number) =>
                                                                                `L ${i * 50},${100 - (d.value / Math.max(...viz.data.map((x: any) => x.value))) * 80}`
                                                                            ).join(' ')} L ${(viz.data.length - 1) * 50},100 Z`}
                                                                            fill="#06b6d4"
                                                                            opacity="0.2"
                                                                        />

                                                                        {/* Line */}
                                                                        <polyline
                                                                            points={viz.data.map((d: any, i: number) =>
                                                                                `${i * 50},${100 - (d.value / Math.max(...viz.data.map((x: any) => x.value))) * 80}`
                                                                            ).join(' ')}
                                                                            fill="none"
                                                                            stroke="#06b6d4"
                                                                            strokeWidth="2"
                                                                        />
                                                                    </svg>
                                                                </div>
                                                            )}

                                                            {/* Combo Chart */}
                                                            {viz.type === 'combo' && (
                                                                <div className="h-32 relative">
                                                                    <svg className="w-full h-full" viewBox="0 0 300 120">
                                                                        {/* Bars */}
                                                                        {viz.data.map((d: any, i: number) => (
                                                                            <rect
                                                                                key={`bar-${i}`}
                                                                                x={i * 50 + 10}
                                                                                y={100 - (d.cost / Math.max(...viz.data.map((x: any) => x.cost))) * 80}
                                                                                width={30}
                                                                                height={(d.cost / Math.max(...viz.data.map((x: any) => x.cost))) * 80}
                                                                                fill="#94a3b8"
                                                                                opacity="0.6"
                                                                            />
                                                                        ))}

                                                                        {/* Line for incidents */}
                                                                        <polyline
                                                                            points={viz.data.map((d: any, i: number) =>
                                                                                `${i * 50 + 25},${100 - (d.incidents / Math.max(...viz.data.map((x: any) => x.incidents))) * 80}`
                                                                            ).join(' ')}
                                                                            fill="none"
                                                                            stroke="#ef4444"
                                                                            strokeWidth="2"
                                                                        />

                                                                        {/* Data points */}
                                                                        {viz.data.map((d: any, i: number) => (
                                                                            <circle
                                                                                key={`point-${i}`}
                                                                                cx={i * 50 + 25}
                                                                                cy={100 - (d.incidents / Math.max(...viz.data.map((x: any) => x.incidents))) * 80}
                                                                                r="3"
                                                                                fill="#ef4444"
                                                                            />
                                                                        ))}
                                                                    </svg>
                                                                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                                                                        <span>{viz.data[0].month}</span>
                                                                        <span>{viz.data[viz.data.length - 1].month}</span>
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {/* Heatmap Chart */}
                                                            {viz.type === 'heatmap' && (
                                                                <div className="h-48">
                                                                    <svg className="w-full h-full" viewBox="0 0 500 200">
                                                                        {/* Risk heatmap grid */}
                                                                        {viz.data.map((d: any, i: number) => {
                                                                            const x = (d.likelihood - 1) * 100 + 50;
                                                                            const y = 150 - (d.impact - 1) * 30;
                                                                            const color = d.impact * d.likelihood > 12 ? '#ef4444' :
                                                                                d.impact * d.likelihood > 6 ? '#f59e0b' :
                                                                                    '#10b981';

                                                                            return (
                                                                                <g key={i}>
                                                                                    <rect
                                                                                        x={x - 40}
                                                                                        y={y - 25}
                                                                                        width={80}
                                                                                        height={50}
                                                                                        fill={color}
                                                                                        opacity="0.7"
                                                                                        stroke="#fff"
                                                                                        strokeWidth="2"
                                                                                    />
                                                                                    <text
                                                                                        x={x}
                                                                                        y={y}
                                                                                        textAnchor="middle"
                                                                                        dominantBaseline="middle"
                                                                                        className="text-xs font-medium fill-white"
                                                                                    >
                                                                                        {d.risk.substring(0, 10)}
                                                                                    </text>
                                                                                </g>
                                                                            );
                                                                        })}

                                                                        {/* Axes */}
                                                                        <text x="250" y={190} textAnchor="middle" className="text-xs fill-gray-600 font-medium">
                                                                            Likelihood →
                                                                        </text>
                                                                        <text x="20" y={75} textAnchor="middle" className="text-xs fill-gray-600 font-medium" transform="rotate(-90 20 75)">
                                                                            Impact →
                                                                        </text>
                                                                    </svg>
                                                                </div>
                                                            )}

                                                            {/* Stacked Chart */}
                                                            {viz.type === 'stacked' && (
                                                                <div className="h-32 relative">
                                                                    <svg className="w-full h-full" viewBox="0 0 300 120">
                                                                        {/* Stacked bars for OEE components */}
                                                                        {viz.data.map((d: any, i: number) => {
                                                                            const availabilityHeight = (d.availability / 100) * 100;
                                                                            const performanceHeight = (d.performance / 100) * 100;
                                                                            const qualityHeight = (d.quality / 100) * 100;
                                                                            const totalHeight = (d.availability * d.performance * d.quality) / 10000 * 100;

                                                                            return (
                                                                                <g key={i}>
                                                                                    <rect
                                                                                        x={i * 75 + 20}
                                                                                        y={120 - totalHeight}
                                                                                        width={50}
                                                                                        height={totalHeight}
                                                                                        fill="#06b6d4"
                                                                                        opacity="0.8"
                                                                                    />
                                                                                    <text
                                                                                        x={i * 75 + 45}
                                                                                        y={115 - totalHeight}
                                                                                        textAnchor="middle"
                                                                                        className="text-xs font-medium fill-gray-700"
                                                                                    >
                                                                                        {((d.availability * d.performance * d.quality) / 10000).toFixed(0)}%
                                                                                    </text>
                                                                                    <text
                                                                                        x={i * 75 + 45}
                                                                                        y={135}
                                                                                        textAnchor="middle"
                                                                                        className="text-xs fill-gray-600"
                                                                                    >
                                                                                        {d.month}
                                                                                    </text>
                                                                                </g>
                                                                            );
                                                                        })}
                                                                    </svg>
                                                                </div>
                                                            )}

                                                            {/* Other chart types as placeholders */}
                                                            {['donut', 'sankey', 'bubble', 'radar', 'funnel', 'growth', 'pathway'].includes(viz.type) && (
                                                                <div className="flex items-center justify-center h-32 bg-gray-50 rounded-lg">
                                                                    <div className="text-center">
                                                                        <BarChart3 className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                                                                        <p className="text-xs text-gray-500">{viz.title}</p>
                                                                        <p className="text-xs text-gray-400 mt-1">Chart visualization</p>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Related Business Drivers */}
                                        <div>
                                            <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                                                <Building className="w-5 h-5 mr-2 text-cyan-600" />
                                                Related Business Drivers
                                            </h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {searchResults.relatedDrivers.map((driver: any, idx: number) => (
                                                    <div key={idx} className="bg-gray-50 rounded-lg p-4">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <h4 className="font-medium text-gray-900">{driver.category}</h4>
                                                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${driver.impact === 'Critical' ? 'bg-red-100 text-red-700' :
                                                                driver.impact === 'High' ? 'bg-yellow-100 text-yellow-700' :
                                                                    'bg-gray-100 text-gray-700'
                                                                }`}>
                                                                {driver.impact} Impact
                                                            </span>
                                                        </div>
                                                        <div className="flex flex-wrap gap-2">
                                                            {driver.drivers.map((d: string, i: number) => (
                                                                <span key={i} className="text-xs bg-white px-2 py-1 rounded border border-gray-200">
                                                                    {d}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* AI Recommendations */}
                                        <div>
                                                <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                                                    <Brain className="w-5 h-5 mr-2 text-cyan-600" />
                                                    Recommendations
                                                </h3>
                                            <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-xl p-5 border border-cyan-200">
                                                <div className="space-y-3">
                                                    {searchResults.recommendations.map((rec: string, idx: number) => (
                                                        <div key={idx} className="flex items-start space-x-3">
                                                            <div className="w-7 h-7 rounded-full bg-cyan-500 text-white flex items-center justify-center flex-shrink-0 text-sm font-bold">
                                                                {idx + 1}
                                                            </div>
                                                            <p className="text-sm text-gray-700">{rec}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Data Quality & Transparency */}
                                        {searchResults.dataQuality && (
                                            <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                                                <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                                                    <LineChart className="w-5 h-5 mr-2 text-cyan-600" />
                                                    Data Quality & Transparency
                                                </h3>
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                                    <div>
                                                        <p className="text-xs text-gray-500 mb-1">Completeness</p>
                                                        <div className="flex items-center space-x-2">
                                                            <div className="flex-1 bg-gray-200 rounded-full h-2">
                                                                <div
                                                                    className="bg-green-500 h-2 rounded-full"
                                                                    style={{ width: `${searchResults.dataQuality.completeness}%` }}
                                                                />
                                                            </div>
                                                            <span className="text-xs font-bold text-gray-700">{searchResults.dataQuality.completeness}%</span>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500 mb-1">Accuracy</p>
                                                        <div className="flex items-center space-x-2">
                                                            <div className="flex-1 bg-gray-200 rounded-full h-2">
                                                                <div
                                                                    className="bg-blue-500 h-2 rounded-full"
                                                                    style={{ width: `${searchResults.dataQuality.accuracy}%` }}
                                                                />
                                                            </div>
                                                            <span className="text-xs font-bold text-gray-700">{searchResults.dataQuality.accuracy}%</span>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500 mb-1">Timeliness</p>
                                                        <div className="flex items-center space-x-2">
                                                            <div className="flex-1 bg-gray-200 rounded-full h-2">
                                                                <div
                                                                    className="bg-purple-500 h-2 rounded-full"
                                                                    style={{ width: `${searchResults.dataQuality.timeliness}%` }}
                                                                />
                                                            </div>
                                                            <span className="text-xs font-bold text-gray-700">{searchResults.dataQuality.timeliness}%</span>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500 mb-1">Overall Score</p>
                                                        <div className="flex items-center space-x-2">
                                                            <div className="flex-1 bg-gray-200 rounded-full h-2">
                                                                <div
                                                                    className="bg-cyan-500 h-2 rounded-full"
                                                                    style={{ width: `${Math.round((searchResults.dataQuality.completeness + searchResults.dataQuality.accuracy + searchResults.dataQuality.timeliness) / 3)}%` }}
                                                                />
                                                            </div>
                                                            <span className="text-xs font-bold text-gray-700">
                                                                {Math.round((searchResults.dataQuality.completeness + searchResults.dataQuality.accuracy + searchResults.dataQuality.timeliness) / 3)}%
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-xs text-gray-600">
                                                    <p><strong>Methodology:</strong> {searchResults.dataQuality.methodology}</p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Footer info */}
                                        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                                            <div className="flex items-center space-x-4 text-xs text-gray-500">
                                                <span><strong>Data Source:</strong> {searchResults.dataSource}</span>
                                                <span><strong>Last Updated:</strong> {searchResults.lastUpdated}</span>
                                            </div>
                                            <button
                                                onClick={() => setShowSearchResults(false)}
                                                className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors text-sm font-medium"
                                            >
                                                Close
                                            </button>
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        </motion.div>
                    </motion.div>
                </AnimatePresence>
            )}

            {/* Disclaimer Modal */}
            <DisclaimerModal />
        </div>
    );
}
