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
    TrendingUp,
    Upload,
    X
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function ManagementReportingLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [shouldPulse, setShouldPulse] = useState(false);
    const pathname = usePathname();

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

                        {/* Accenture Logo */}
                        <div className="relative h-10 w-10 flex-shrink-0">
                            <Image
                                src="/logo.png"
                                alt="Accenture Logo"
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
                                        placeholder="Ask me anything about your business..."
                                        className="w-full pl-12 pr-4 py-2.5 bg-white/10 border border-white/20 rounded-l-full text-sm text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                        style={{ WebkitBackdropFilter: 'none', backdropFilter: 'none' }}
                                    />
                                </div>
                                <button className="px-8 py-2.5 bg-purple-gradient text-white font-medium rounded-r-full hover:shadow-lg hover:shadow-purple-500/50 transition-all text-sm whitespace-nowrap border border-purple-500">
                                    AI Search
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
                                <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-purple-500/50">
                                    <img
                                        src="/images/Sarah-Johnson-Finance-Executive-headshot.png"
                                        alt="Sarah Johnson"
                                        className="w-full h-full object-cover"
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
                                        {/* Accenture Logo */}
                                        <div className="relative h-8 w-8 flex-shrink-0">
                                            <Image
                                                src="/logo.png"
                                                alt="Accenture Logo"
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
        </div>
    );
}

