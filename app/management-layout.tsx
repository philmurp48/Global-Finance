'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
    BarChart3,
    Brain,
    FileText,
    Grid,
    Home,
    LayoutDashboard,
    LogOut,
    Menu,
    Repeat,
    Search,
    Target,
    TrendingUp,
    Upload,
    X
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function ManagementReportingLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [shouldPulse, setShouldPulse] = useState(false);
    const [headerSearchQuery, setHeaderSearchQuery] = useState('');
    const [headerSearchResults, setHeaderSearchResults] = useState<any>(null);
    const [isHeaderSearching, setIsHeaderSearching] = useState(false);
    const [showHeaderSearchResults, setShowHeaderSearchResults] = useState(false);
    const pathname = usePathname();
    const router = useRouter();

    // Check if we're on the home page to set initial menu state
    useEffect(() => {
        const isHomePage = pathname === '/';
        if (isHomePage) {
            setIsMenuOpen(false);
            setShouldPulse(true);
            // Stop pulsing after 3 seconds
            const timer = setTimeout(() => setShouldPulse(false), 3000);
            return () => clearTimeout(timer);
        }
    }, [pathname]);

    // Header AI Search functionality
    const handleHeaderAISearch = async () => {
        if (!headerSearchQuery.trim()) return;

        setHeaderSearchResults(null);
        setIsHeaderSearching(true);
        setShowHeaderSearchResults(true);

        try {
            // Get uploadId from localStorage
            const uploadId = localStorage.getItem('currentUploadId');
            
            // Call the /api/ask endpoint
            const response = await fetch('/api/ask', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    question: headerSearchQuery,
                    uploadId: uploadId,
                    pageContext: 'header-search'
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                
                // Handle rate limit or quota errors
                if (response.status === 429 || (response.status === 503 && !errorData.fallback)) {
                    setHeaderSearchResults({
                        summary: errorData.error || 'AI temporarily unavailable, try later.',
                        keyFindings: [],
                        recommendations: [
                            'Please wait a moment and try again',
                            'The service may be experiencing high demand'
                        ],
                        relatedDrivers: [],
                        visualizations: {},
                        dataSource: 'System',
                        lastUpdated: 'Now'
                    });
                    return;
                }

                // If API is not configured (fallback case), show helpful message
                if (response.status === 503 && errorData.fallback) {
                    setHeaderSearchResults({
                        summary: errorData.error || 'AI service is not configured. Please set GEMINI_API_KEY environment variable.',
                        keyFindings: [],
                        recommendations: [
                            'Add GEMINI_API_KEY to your .env.local file',
                            'Get your API key from https://makersuite.google.com/app/apikey',
                            'Restart the development server after adding the key'
                        ],
                        relatedDrivers: [],
                        visualizations: {},
                        dataSource: 'System',
                        lastUpdated: 'Now'
                    });
                    return;
                }

                // Handle 500 errors with detailed message
                if (response.status === 500) {
                    setHeaderSearchResults({
                        summary: errorData.error || 'An error occurred while processing your request.',
                        keyFindings: errorData.details ? [
                            {
                                title: 'Error Details',
                                detail: typeof errorData.details === 'string' ? errorData.details : errorData.details.message || 'Check server logs',
                                confidence: 0
                            }
                        ] : [],
                        recommendations: [
                            'Check that GEMINI_API_KEY is set correctly in .env.local',
                            'Verify your API key is valid at https://makersuite.google.com/app/apikey',
                            'Restart the development server after adding the key',
                            'Check the server console for detailed error messages'
                        ],
                        relatedDrivers: [],
                        visualizations: {},
                        dataSource: 'System',
                        lastUpdated: 'Now'
                    });
                    return;
                }

                throw new Error(errorData.error || 'Failed to process search');
            }

            const data = await response.json();
            // Ensure keyFindings, recommendations, and relatedDrivers are always arrays
            setHeaderSearchResults({
                ...data,
                keyFindings: Array.isArray(data.keyFindings) ? data.keyFindings : [],
                recommendations: Array.isArray(data.recommendations) ? data.recommendations : [],
                relatedDrivers: Array.isArray(data.relatedDrivers) ? data.relatedDrivers : [],
                visualizations: data.visualizations || {}
            });
        } catch (error: any) {
            console.error('Header Search Error:', error);
            setHeaderSearchResults({
                summary: error.message || 'Unable to process search. Please try again.',
                keyFindings: [],
                recommendations: [
                    'Check your internet connection',
                    'Try rephrasing your question',
                    'Ensure the GEMINI_API_KEY is configured'
                ],
                relatedDrivers: [],
                visualizations: {},
                dataSource: 'System',
                lastUpdated: 'Now'
            });
        } finally {
            setIsHeaderSearching(false);
        }
    };

    const handleHeaderKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleHeaderAISearch();
        }
    };

    const navigationItems = [
        {
            title: 'Executive Summary',
            href: '/',
            icon: Home,
            subItems: []
        },
        {
            title: 'Scenario Modeling',
            href: '/scenario-modeling',
            icon: TrendingUp,
            subItems: []
        },
        {
            title: 'Operational Performance',
            href: '/operational-performance',
            icon: BarChart3,
            subItems: []
        },
        {
            title: 'Data Upload',
            href: '/data-upload',
            icon: Upload,
            subItems: []
        }
    ];

    // Check if we're on the home page
    const isHomePage = pathname === '/';

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Header */}
            <div className="bg-navy-gradient border-b border-gray-700">
                <div className="flex items-center justify-between h-16 px-4">
                    {/* Left side - Menu toggle, Logo, and Platform Title */}
                    <div className="flex items-center space-x-4 flex-1">
                        {/* Menu Toggle Button */}
                        <button
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            className={`p-2 rounded-lg hover:bg-white/10 transition-all ${shouldPulse && !isMenuOpen ? 'animate-safari-pulse bg-purple-500/20' : ''
                                }`}
                            aria-label="Toggle menu"
                        >
                            {isMenuOpen ? (
                                <X className="w-5 h-5 text-white" />
                            ) : (
                                <Menu className="w-5 h-5 text-white" />
                            )}
                        </button>

                        {/* Global Finance Logo */}
                        <div className="relative h-10 w-10 flex-shrink-0">
                            <Image
                                src="/logo.svg"
                                alt="Global Finance Logo"
                                fill
                                className="object-contain"
                                priority
                            />
                        </div>

                        {/* Platform Title and Subtitle */}
                        <div className="flex flex-col">
                            <h1 className="text-lg font-bold text-white leading-tight">
                                Global Finance
                            </h1>
                            <p className="text-xs text-purple-400 font-medium leading-tight">
                                AI-Powered Management Reporting
                            </p>
                        </div>
                    </div>

                    {/* Center - Search Bar (hidden on home page) */}
                    {!isHomePage && (
                        <div className="flex-1 max-w-2xl mx-4">
                            <div className="flex items-center">
                                <div className="relative flex-1">
                                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type="text"
                                        value={headerSearchQuery}
                                        onChange={(e) => setHeaderSearchQuery(e.target.value)}
                                        onKeyDown={handleHeaderKeyPress}
                                        placeholder="Ask me anything about your business..."
                                        className="w-full pl-12 pr-4 py-2.5 bg-white/10 border border-white/20 rounded-l-full text-sm text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                        style={{ WebkitBackdropFilter: 'none', backdropFilter: 'none' }}
                                    />
                                </div>
                                <button 
                                    onClick={handleHeaderAISearch}
                                    disabled={isHeaderSearching || !headerSearchQuery.trim()}
                                    className="px-8 py-2.5 bg-purple-gradient text-white font-medium rounded-r-full hover:shadow-lg hover:shadow-purple-500/50 transition-all text-sm whitespace-nowrap border border-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isHeaderSearching ? 'Analyzing...' : 'Search'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Right side - User info and more (hidden on home page) */}
                    {!isHomePage && (
                        <div className="flex items-center space-x-4 flex-1 justify-end">
                            <div className="flex items-center space-x-3">
                                <div className="text-right">
                                    <p className="text-sm font-medium text-white">Sarah Johnson</p>
                                    <p className="text-xs text-gray-300">Finance Executive</p>
                                </div>
                                <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-purple-500/50 bg-white p-1.5">
                                    <img
                                        src="/logo.svg"
                                        alt="Global Finance Logo"
                                        className="w-full h-full object-contain"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Slide-out Menu */}
            <AnimatePresence>
                {isMenuOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsMenuOpen(false)}
                            className="fixed inset-0 bg-black bg-opacity-50 z-40"
                            style={{ 
                                WebkitTransform: 'translateZ(0)',
                                transform: 'translateZ(0)',
                                willChange: 'opacity'
                            }}
                        />

                        {/* Menu Panel */}
                        <motion.div
                            initial={{ x: -320 }}
                            animate={{ x: 0 }}
                            exit={{ x: -320 }}
                            transition={{ type: "tween", duration: 0.3, ease: "easeOut" }}
                            className="fixed left-0 top-0 bottom-0 w-80 bg-navy-gradient shadow-2xl z-50 flex flex-col border-r border-gray-700"
                            style={{ 
                                WebkitTransform: 'translateZ(0)',
                                transform: 'translateZ(0)',
                                willChange: 'transform'
                            }}
                        >
                            {/* Menu Header */}
                            <div className="p-6 border-b border-gray-700">
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center space-x-3">
                                        {/* Global Finance Logo */}
                                        <div className="relative h-8 w-8 flex-shrink-0">
                                            <Image
                                                src="/logo.svg"
                                                alt="Global Finance Logo"
                                                fill
                                                className="object-contain"
                                            />
                                        </div>
                                        <h2 className="text-xl font-bold text-white">Global Finance</h2>
                                    </div>
                                    <button
                                        onClick={() => setIsMenuOpen(false)}
                                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                    >
                                        <X className="w-5 h-5 text-white" />
                                    </button>
                                </div>
                            </div>

                            {/* Navigation Links */}
                            <nav className="flex-1 overflow-y-auto p-4">
                                <div className="space-y-1">
                                    {navigationItems.map((item) => {
                                        const Icon = item.icon;
                                        const isActive = pathname === item.href;
                                        return (
                                            <Link
                                                key={item.title}
                                                href={item.href}
                                                onClick={() => setIsMenuOpen(false)}
                                                className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-all ${isActive
                                                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30 shadow-lg shadow-purple-500/20'
                                                    : 'text-gray-300 hover:bg-white/10 hover:text-white'
                                                    }`}
                                            >
                                                <Icon className={`w-5 h-5 ${isActive ? 'text-purple-400' : ''}`} />
                                                <span className="font-medium">{item.title}</span>
                                                {isActive && (
                                                    <motion.div
                                                        layoutId="activeIndicator"
                                                        className="absolute left-0 w-1 h-8 bg-purple-400 rounded-r-full"
                                                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                                    />
                                                )}
                                            </Link>
                                        );
                                    })}
                                </div>
                            </nav>

                            {/* User Section - Simplified */}
                            <div className="mb-6 p-4 bg-black/20 rounded-lg mx-4">
                                <div className="flex items-center space-x-3 mb-2">
                                    <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-purple-500/50">
                                        <img
                                            src="/images/Sarah-Johnson-Finance-Executive-headshot.png"
                                            alt="Sarah Johnson"
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-white">Sarah Johnson</p>
                                        <p className="text-xs text-gray-400">Finance Executive</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        document.cookie = 'isAuthenticated=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
                                        localStorage.removeItem('disclaimerAcknowledged');
                                        window.location.href = '/login';
                                    }}
                                    className="w-full mt-2 px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors text-left flex items-center space-x-2"
                                >
                                    <LogOut className="w-4 h-4" />
                                    <span>Logout</span>
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Main Content Area */}
            <div className="flex-1 overflow-auto bg-gray-50">
                {children}
            </div>

            {/* Header AI Search Results Modal */}
            {showHeaderSearchResults && (
                <AnimatePresence>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowHeaderSearchResults(false)}
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
                                        <p className="text-purple-100">Query: "{headerSearchQuery}"</p>
                                    </div>
                                    <button
                                        onClick={() => setShowHeaderSearchResults(false)}
                                        className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                                {isHeaderSearching ? (
                                    <div className="flex flex-col items-center justify-center py-20">
                                        <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                                        <p className="text-gray-600">Analyzing business data and generating insights...</p>
                                    </div>
                                ) : headerSearchResults ? (
                                    <div className="space-y-6">
                                        {/* Summary */}
                                        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-5 border border-blue-200">
                                            <h3 className="font-semibold text-gray-900 mb-2">Executive Summary</h3>
                                            <p className="text-gray-700">{headerSearchResults.summary}</p>
                                        </div>

                                        {/* Key Findings */}
                                        {headerSearchResults.keyFindings && headerSearchResults.keyFindings.length > 0 && (
                                            <div>
                                                <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                                                    <Target className="w-5 h-5 mr-2 text-purple-600" />
                                                    Key Findings
                                                </h3>
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                    {headerSearchResults.keyFindings.map((finding: any, idx: number) => (
                                                        <div key={idx} className="bg-white border border-gray-200 rounded-lg p-4">
                                                            <div className="flex items-start justify-between mb-2">
                                                                <h4 className="font-medium text-gray-900 text-sm">{finding.title}</h4>
                                                                {finding.confidence && (
                                                                    <div className="flex items-center space-x-1">
                                                                        <span className="text-xs text-gray-500">Confidence</span>
                                                                        <span className="text-xs font-bold text-purple-600">{finding.confidence}%</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <p className="text-sm text-gray-600">{finding.detail}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Recommendations */}
                                        {headerSearchResults.recommendations && headerSearchResults.recommendations.length > 0 && (
                                            <div>
                                                <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                                                    <Brain className="w-5 h-5 mr-2 text-cyan-600" />
                                                    Recommendations
                                                </h3>
                                                <div className="space-y-3">
                                                    {headerSearchResults.recommendations.map((rec: string, idx: number) => (
                                                        <div key={idx} className="flex items-start space-x-3">
                                                            <div className="w-7 h-7 rounded-full bg-cyan-500 text-white flex items-center justify-center flex-shrink-0 text-sm font-bold">
                                                                {idx + 1}
                                                            </div>
                                                            <p className="text-sm text-gray-700">{rec}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Footer info */}
                                        <div className="pt-4 border-t border-gray-200 text-xs text-gray-500 space-y-1">
                                            <div className="flex justify-between">
                                                <span><strong>Data Source:</strong> {headerSearchResults.dataSource || 'Excel Data Upload'}</span>
                                                <span><strong>Last Updated:</strong> {headerSearchResults.lastUpdated || 'Real-time'}</span>
                                            </div>
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        </motion.div>
                    </motion.div>
                </AnimatePresence>
            )}
        </div>
    );
}

