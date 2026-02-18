// Comprehensive scenario parser for automotive financial planning
// Intelligent parsing using semantic keyword groups and weighted scoring
// Handles diverse user inputs without requiring exact keyword matches

export interface ParsedScenario {
    levers: Record<string, number>;
    explanation: string;
}

// Semantic keyword groups - related terms grouped by concept
const SEMANTIC_GROUPS: Record<string, string[]> = {
    // Production/Volume concepts
    production: ['production', 'manufacturing', 'output', 'volume', 'units', 'shipments', 'sales volume', 
                 'unit sales', 'units sold', 'manufacturing volume', 'production volume', 'production output',
                 'ev production', 'electric vehicle production', 'ice production', 'vehicle production',
                 'suv production', 'truck production', 'car production', 'build', 'building', 'assembly'],
    
    // Market share concepts
    marketShare: ['market share', 'share', 'market position', 'competitive position', 'market standing',
                  'competitor', 'competitors', 'competition', 'new entrant', 'taking share', 'gaining share'],
    
    // Demand concepts
    demand: ['demand', 'sales demand', 'customer demand', 'industry demand', 'market demand', 'order', 'orders',
             'bookings', 'backlog', 'inquiry', 'inquiries', 'customer interest', 'purchasing'],
    
    // Price concepts
    price: ['price', 'pricing', 'price change', 'prices', 'atp', 'average transaction price', 'msrp', 
            'list price', 'cost to customer', 'selling price', 'retail price', 'wholesale price'],
    
    // Cost concepts
    cost: ['cost', 'costs', 'expense', 'expenses', 'spend', 'spending', 'outlay', 'outgoings', 'expenditure',
           'budget', 'expense', 'charges', 'fees'],
    
    // Material concepts
    material: ['material', 'materials', 'raw material', 'raw materials', 'steel', 'aluminum', 'aluminium',
               'plastic', 'plastics', 'components', 'parts', 'commodity', 'commodities', 'copper', 'lithium',
               'battery', 'batteries', 'chips', 'semiconductors', 'supplies'],
    
    // Supply chain concepts
    supplyChain: ['supply chain', 'supply-chain', 'logistics', 'shipping', 'freight', 'transportation',
                  'delivery', 'inventory', 'warehouse', 'warehousing', 'distribution', 'procurement'],
    
    // Labor concepts
    labor: ['labor', 'labour', 'wage', 'wages', 'salary', 'salaries', 'worker', 'workers', 'employee',
            'employees', 'workforce', 'staff', 'personnel', 'manpower', 'human resources'],
    
    // Quality/Warranty concepts
    quality: ['warranty', 'warranties', 'quality', 'defect', 'defects', 'recall', 'recalls', 'reliability',
              'durability', 'claim', 'claims', 'repair', 'repairs', 'service', 'service cost'],
    
    // Marketing concepts
    marketing: ['marketing', 'advertising', 'ad', 'ads', 'promotion', 'promotions', 'campaign', 'campaigns',
                'brand', 'branding', 'media', 'spend', 'spending', 'budget', 'advertising budget'],
    
    // Financial concepts
    interest: ['interest rate', 'interest rates', 'fed rate', 'federal rate', 'borrowing cost', 
               'borrowing costs', 'debt cost', 'financing cost', 'cost of capital'],
    
    // FX concepts
    currency: ['currency', 'exchange rate', 'fx rate', 'forex', 'yen', 'euro', 'yuan', 'rmb', 'peso',
               'won', 'dollar', 'usd', 'eur', 'jpy', 'cny', 'mxn', 'krw'],
    
    // Economic concepts
    economic: ['recession', 'economic downturn', 'economic slowdown', 'slowdown', 'downturn', 'crisis',
               'depression', 'stagnation', 'gdp decline', 'economic decline', 'economic growth',
               'expansion', 'boom', 'prosperity', 'gdp growth', 'economic recovery', 'recovery', 'upturn'],
    
    // Tariff concepts
    tariff: ['tariff', 'tariffs', 'trade war', 'trade dispute', 'import tax', 'duty', 'duties', 'trade barrier']
};

// Helper to find semantic matches - checks if text contains any term from a semantic group
const findSemanticMatch = (text: string, groupKey: string): boolean => {
    const group = SEMANTIC_GROUPS[groupKey];
    if (!group) return false;
    return group.some(term => text.toLowerCase().includes(term.toLowerCase()));
};

// Helper to calculate match score - how well text matches a concept
const calculateMatchScore = (text: string, groupKey: string): number => {
    const group = SEMANTIC_GROUPS[groupKey];
    if (!group) return 0;
    
    const lowerText = text.toLowerCase();
    let score = 0;
    
    // Longer/more specific terms get higher weight
    group.forEach(term => {
        if (lowerText.includes(term.toLowerCase())) {
            score += term.split(' ').length; // Multi-word terms score higher
        }
    });
    
    return score;
};

// Helper to extract percentage values from text
const extractPercentage = (text: string): number | null => {
    // Try to extract any percentage number in the text (most flexible)
    const anyPercentageMatch = text.match(/(\d+)\s*%/i);
    if (anyPercentageMatch) {
        const value = parseFloat(anyPercentageMatch[1]);
        if (!isNaN(value)) return value;
    }
    return null;
};

// Helper to check if text contains any of the keywords
const containsAny = (text: string, keywords: string[]): boolean => {
    const lowerText = text.toLowerCase();
    return keywords.some(keyword => lowerText.includes(keyword.toLowerCase()));
};

// Helper to check if text indicates increase/decrease
const isIncrease = (text: string): boolean => {
    return containsAny(text, ['increase', 'increases', 'increased', 'rise', 'rises', 'rose', 'up', 'higher', 
                              'grow', 'grows', 'growing', 'grew', 'improve', 'improves', 'improved', 
                              'gain', 'gains', 'gained', 'expand', 'expands', 'expanded', 'boost', 'boosted',
                              'expand', 'expansion', 'growth', 'improvement']);
};

const isDecrease = (text: string): boolean => {
    return containsAny(text, ['decrease', 'decreases', 'decreased', 'decline', 'declines', 'declined', 
                              'down', 'lower', 'fall', 'falls', 'fell', 'drop', 'drops', 'dropped',
                              'reduce', 'reduces', 'reduced', 'loss', 'lose', 'loses', 'lost', 
                              'shrink', 'shrinks', 'shrank', 'contract', 'contracts', 'contracted',
                              'reduction', 'cut', 'cuts', 'cutting']);
};

// Intelligent scenario parser with semantic matching and weighted scoring
export const parseScenarioFromText = (text: string): ParsedScenario => {
    const lowerText = text.toLowerCase();
    const levers: Record<string, number> = {};
    const explanations: string[] = [];
    
    // Extract percentage value once (used across all scenarios)
    const extractedPercentage = extractPercentage(lowerText);
    
    // Calculate semantic match scores for all concepts
    const matchScores: Record<string, number> = {};
    Object.keys(SEMANTIC_GROUPS).forEach(groupKey => {
        matchScores[groupKey] = calculateMatchScore(lowerText, groupKey);
    });
    
    // Determine direction (increase/decrease)
    const hasIncrease = isIncrease(lowerText);
    const hasDecrease = isDecrease(lowerText);
    
    // Use extracted percentage or reasonable defaults
    const getValue = (defaultValue: number): number => {
        return extractedPercentage !== null ? extractedPercentage : defaultValue;
    };
    
    // Apply value with direction
    const applyValue = (leverId: string, value: number, isNegative: boolean = false): number => {
        const finalValue = isNegative ? -value : value;
        levers[leverId] = finalValue;
        return finalValue;
    };
    
    // Priority-based scenario matching with semantic scoring
    
    // 1. TARIFF SCENARIOS (high priority - specific)
    if (matchScores.tariff > 0 || findSemanticMatch(lowerText, 'tariff')) {
        const tariffValue = getValue(25);
        levers['tariffs'] = Math.min(Math.max(tariffValue, 0), 50);
        levers['market-share'] = -Math.min(tariffValue / 10, 2);
        levers['price-change'] = Math.min(tariffValue / 8, 3);
        levers['material-inflation'] = Math.min(tariffValue * 0.08, 5);
        explanations.push(`Applied ${tariffValue}% tariff impact`);
    }
    
    // 2. MARKET SHARE SCENARIOS
    else if (matchScores.marketShare > 0 || findSemanticMatch(lowerText, 'marketShare')) {
        const shareValue = getValue(2);
        const isLoss = hasDecrease || containsAny(lowerText, ['take', 'takes', 'taking', 'competitor', 'competitors', 'lose', 'loss']);
        const finalValue = isLoss ? -shareValue : shareValue;
        levers['market-share'] = Math.max(Math.min(finalValue, 10), -10);
        explanations.push(`Applied ${Math.abs(shareValue)}% market share ${isLoss ? 'loss' : 'gain'}`);
    }
    
    // 3. MARKET DEMAND SCENARIOS
    else if (matchScores.demand > 0 || findSemanticMatch(lowerText, 'demand')) {
        const demandValue = getValue(10);
        if (hasDecrease) {
            levers['volume-growth'] = Math.max(Math.min(-demandValue, 0), -20);
            levers['price-change'] = Math.max(Math.min(-demandValue * 0.2, 0), -5);
            explanations.push(`Applied ${demandValue}% market demand decrease`);
        } else if (hasIncrease) {
            levers['volume-growth'] = Math.min(Math.max(demandValue, 0), 20);
            explanations.push(`Applied ${demandValue}% market demand increase`);
        }
    }
    
    // 4. PRODUCTION/VOLUME SCENARIOS (very broad catch)
    else if (matchScores.production > 0 || findSemanticMatch(lowerText, 'production')) {
        const volumeValue = getValue(8);
        if (hasDecrease) {
            levers['volume-growth'] = Math.max(Math.min(-volumeValue, 0), -20);
            explanations.push(`Applied ${volumeValue}% volume decrease`);
        } else if (hasIncrease) {
            levers['volume-growth'] = Math.min(Math.max(volumeValue, 0), 20);
            explanations.push(`Applied ${volumeValue}% volume growth`);
        } else {
            // If no direction specified but percentage present, infer from context
            const volumeValueInferred = extractedPercentage !== null ? extractedPercentage : 8;
            levers['volume-growth'] = Math.min(Math.max(volumeValueInferred, 0), 20);
            explanations.push(`Applied ${volumeValueInferred}% volume change`);
        }
    }
    
    // 5. PRICING SCENARIOS
    else if (matchScores.price > 0 || findSemanticMatch(lowerText, 'price')) {
        const priceValue = getValue(3);
        if (hasIncrease) {
            levers['price-change'] = Math.min(Math.max(priceValue, 0), 10);
            explanations.push(`Applied ${priceValue}% price increase`);
        } else if (hasDecrease) {
            levers['price-change'] = Math.max(Math.min(-priceValue, 0), -10);
            explanations.push(`Applied ${priceValue}% price decrease`);
        }
    }
    
    // 6. MATERIAL COST SCENARIOS
    else if (matchScores.material > 0 || findSemanticMatch(lowerText, 'material')) {
        const materialValue = getValue(5);
        if (hasIncrease) {
            levers['material-inflation'] = Math.min(Math.max(materialValue, 0), 15);
            explanations.push(`Applied ${materialValue}% material cost increase`);
        } else if (hasDecrease) {
            levers['material-inflation'] = Math.max(Math.min(-materialValue, 0), -5);
            explanations.push(`Applied ${materialValue}% material cost decrease`);
        }
    }
    
    // 7. SUPPLY CHAIN SCENARIOS
    else if (matchScores.supplyChain > 0 || findSemanticMatch(lowerText, 'supplyChain')) {
        const scValue = getValue(10);
        if (containsAny(lowerText, ['cost', 'costs', 'price', 'expense']) && hasIncrease) {
            levers['supply-chain'] = Math.max(Math.min(-scValue, 0), -15);
            levers['material-inflation'] = Math.min(Math.max(scValue * 0.6, 0), 15);
            explanations.push(`Applied ${scValue}% supply chain cost increase`);
        } else if (containsAny(lowerText, ['disruption', 'disruptions', 'shortage', 'problem'])) {
            levers['supply-chain'] = Math.max(Math.min(-scValue, 0), -15);
            levers['material-inflation'] = Math.min(scValue * 0.5, 5);
            explanations.push(`Applied supply chain disruption impact`);
        } else if (hasIncrease || containsAny(lowerText, ['improve', 'better', 'efficiency', 'optimize'])) {
            levers['supply-chain'] = Math.min(Math.max(scValue, 0), 15);
            explanations.push(`Applied ${scValue}% supply chain efficiency improvement`);
        } else if (hasDecrease) {
            levers['supply-chain'] = Math.max(Math.min(-scValue, 0), -15);
            explanations.push(`Applied ${scValue}% supply chain cost increase`);
        }
    }
    
    // 8. LABOR SCENARIOS
    else if (matchScores.labor > 0 || findSemanticMatch(lowerText, 'labor')) {
        const laborValue = getValue(5);
        if (containsAny(lowerText, ['wage', 'wages', 'salary', 'cost', 'costs']) && hasIncrease) {
            levers['labor-productivity'] = Math.max(Math.min(-laborValue * 0.5, 0), -10);
            explanations.push(`Applied ${laborValue}% labor cost increase`);
        } else if (containsAny(lowerText, ['productivity', 'efficiency', 'automation']) && hasIncrease) {
            levers['labor-productivity'] = Math.min(Math.max(laborValue, 0), 10);
            explanations.push(`Applied ${laborValue}% labor productivity improvement`);
        } else if (containsAny(lowerText, ['strike', 'shortage', 'problem'])) {
            levers['labor-productivity'] = Math.max(Math.min(-laborValue, 0), -10);
            explanations.push(`Applied labor disruption impact`);
        }
    }
    
    // 9. WARRANTY & QUALITY SCENARIOS
    else if (matchScores.quality > 0 || findSemanticMatch(lowerText, 'quality')) {
        const warrantyValue = getValue(10);
        if (hasIncrease || containsAny(lowerText, ['higher', 'more', 'worse', 'problem'])) {
            levers['warranty-costs'] = Math.min(Math.max(warrantyValue, 0), 20);
            explanations.push(`Applied ${warrantyValue}% warranty cost increase`);
        } else if (hasDecrease || containsAny(lowerText, ['improve', 'better', 'reduce', 'lower'])) {
            levers['warranty-costs'] = Math.max(Math.min(-warrantyValue, 0), -20);
            explanations.push(`Applied ${warrantyValue}% warranty cost reduction`);
        }
    }
    
    // 10. MARKETING SCENARIOS
    else if (matchScores.marketing > 0 || findSemanticMatch(lowerText, 'marketing')) {
        const marketingValue = getValue(15);
        if (hasIncrease) {
            levers['marketing-spend'] = Math.min(Math.max(marketingValue, 0), 30);
            levers['market-share'] = Math.min(marketingValue / 15, 2);
            explanations.push(`Applied ${marketingValue}% marketing spend increase`);
        } else if (hasDecrease) {
            levers['marketing-spend'] = Math.max(Math.min(-marketingValue, 0), -30);
            explanations.push(`Applied ${marketingValue}% marketing spend reduction`);
        }
    }
    
    // 11. INTEREST RATE SCENARIOS
    else if (matchScores.interest > 0 || findSemanticMatch(lowerText, 'interest')) {
        const rateValue = getValue(2);
        if (hasIncrease) {
            levers['interest-rates'] = Math.min(Math.max(rateValue, 0), 5);
            explanations.push(`Applied ${rateValue}% interest rate increase`);
        } else if (hasDecrease) {
            levers['interest-rates'] = Math.max(Math.min(-rateValue, 0), -5);
            explanations.push(`Applied ${rateValue}% interest rate decrease`);
        }
    }
    
    // 12. FX/CURRENCY SCENARIOS
    else if (matchScores.currency > 0 || findSemanticMatch(lowerText, 'currency')) {
        const fxValue = getValue(5);
        if (containsAny(lowerText, ['weaker', 'weaken', 'depreciation', 'depreciate', 'fall', 'down', 'lower'])) {
            levers['fx-rate'] = Math.max(Math.min(-fxValue, 0), -10);
            explanations.push(`Applied ${fxValue}% currency depreciation`);
        } else if (containsAny(lowerText, ['stronger', 'strengthen', 'appreciation', 'appreciate', 'rise', 'up', 'higher'])) {
            levers['fx-rate'] = Math.min(Math.max(fxValue, 0), 10);
            explanations.push(`Applied ${fxValue}% currency appreciation`);
        }
    }
    
    // 13. RECESSION/ECONOMIC SCENARIOS
    else if (matchScores.economic > 0 || findSemanticMatch(lowerText, 'economic')) {
        if (containsAny(lowerText, ['recession', 'downturn', 'slowdown', 'crisis', 'decline'])) {
            levers['volume-growth'] = -15;
            levers['market-share'] = -3;
            levers['price-change'] = -5;
            levers['labor-productivity'] = -2;
            levers['marketing-spend'] = -10;
            explanations.push('Modeled recession scenario with reduced demand');
        } else if (containsAny(lowerText, ['growth', 'expansion', 'boom', 'recovery', 'upturn'])) {
            const growthValue = getValue(8);
            levers['volume-growth'] = Math.min(Math.max(growthValue, 0), 20);
            levers['market-share'] = Math.min(growthValue / 4, 2);
            levers['price-change'] = Math.min(growthValue / 4, 3);
            explanations.push(`Applied ${growthValue}% economic growth scenario`);
        }
    }
    
    // 14. INTELLIGENT FALLBACK - If no specific scenario matched, use semantic inference
    else if (Object.keys(levers).length === 0) {
        // Find the highest scoring semantic match
        const sortedScores = Object.entries(matchScores)
            .filter(([_, score]) => score > 0)
            .sort(([_, a], [__, b]) => b - a);
        
        if (sortedScores.length > 0) {
            const [topConcept, topScore] = sortedScores[0];
            const inferredValue = getValue(5);
            
            // Map semantic concepts to levers
            const conceptToLever: Record<string, string> = {
                production: 'volume-growth',
                demand: 'volume-growth',
                price: 'price-change',
                material: 'material-inflation',
                cost: 'material-inflation',
                supplyChain: 'supply-chain',
                labor: 'labor-productivity',
                quality: 'warranty-costs',
                marketing: 'marketing-spend',
                interest: 'interest-rates',
                currency: 'fx-rate'
            };
            
            const leverId = conceptToLever[topConcept];
            if (leverId) {
                const direction = hasDecrease ? -1 : (hasIncrease ? 1 : 1);
                const finalValue = direction * inferredValue;
                
                // Apply appropriate bounds based on lever
                const bounds: Record<string, [number, number]> = {
                    'volume-growth': [-20, 20],
                    'price-change': [-10, 10],
                    'material-inflation': [-5, 15],
                    'supply-chain': [-15, 15],
                    'labor-productivity': [-10, 10],
                    'warranty-costs': [-20, 20],
                    'marketing-spend': [-30, 30],
                    'interest-rates': [-5, 5],
                    'fx-rate': [-10, 10]
                };
                
                const [min, max] = bounds[leverId] || [-20, 20];
                levers[leverId] = Math.max(Math.min(finalValue, max), min);
                
                const conceptNames: Record<string, string> = {
                    production: 'production',
                    demand: 'demand',
                    price: 'pricing',
                    material: 'material costs',
                    cost: 'costs',
                    supplyChain: 'supply chain',
                    labor: 'labor',
                    quality: 'warranty',
                    marketing: 'marketing',
                    interest: 'interest rates',
                    currency: 'currency'
                };
                
                explanations.push(`Inferred ${Math.abs(inferredValue)}% ${hasDecrease ? 'decrease' : 'change'} in ${conceptNames[topConcept] || topConcept}`);
            }
        } else if (extractedPercentage !== null) {
            // Last resort: if we have a percentage but no clear concept, apply to volume
            if (hasDecrease) {
                levers['volume-growth'] = Math.max(Math.min(-extractedPercentage, 0), -20);
                explanations.push(`Applied ${extractedPercentage}% decrease`);
            } else if (hasIncrease) {
                levers['volume-growth'] = Math.min(Math.max(extractedPercentage, 0), 20);
                explanations.push(`Applied ${extractedPercentage}% increase`);
            } else {
                levers['volume-growth'] = Math.min(Math.max(extractedPercentage, 0), 20);
                explanations.push(`Applied ${extractedPercentage}% change`);
            }
        }
    }
    
    const explanation = explanations.length > 0 
        ? explanations.join('. ') 
        : 'Analyzed scenario and adjusted relevant levers based on key factors identified.';
    
    return { levers, explanation };
};
