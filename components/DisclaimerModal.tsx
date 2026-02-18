'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function DisclaimerModal() {
    const [showDisclaimer, setShowDisclaimer] = useState(false);

    useEffect(() => {
        // Check if user just logged in (flag is set) and hasn't acknowledged the disclaimer yet
        const justLoggedIn = sessionStorage.getItem('justLoggedIn');
        const acknowledged = localStorage.getItem('disclaimerAcknowledged');

        if (justLoggedIn === 'true' && acknowledged !== 'true') {
            setShowDisclaimer(true);
            // Remove the flag so it doesn't show again during this session
            sessionStorage.removeItem('justLoggedIn');
        }
    }, []);

    const handleAcknowledge = () => {
        // Store acknowledgment in localStorage (persists across sessions)
        localStorage.setItem('disclaimerAcknowledged', 'true');
        setShowDisclaimer(false);
    };

    return (
        <AnimatePresence>
            {showDisclaimer && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center"
                        onClick={handleAcknowledge}
                    >
                        {/* Modal */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.2 }}
                            className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl mx-4"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div className="bg-gradient-to-r from-purple-600 to-purple-700 p-4 rounded-t-xl">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2">
                                        <AlertTriangle className="w-6 h-6 text-white" />
                                        <h2 className="text-lg font-bold text-white">Important Notice</h2>
                                    </div>
                                    <button
                                        onClick={handleAcknowledge}
                                        className="text-white/80 hover:text-white transition-colors p-1 hover:bg-white/20 rounded-lg"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="p-6">
                                <p className="text-gray-900 font-medium mb-4">
                                    This platform is a demonstration prototype created by Accenture for management reporting and analytics.
                                </p>

                                <div className="space-y-3 mb-5">
                                    <div className="flex items-start space-x-2">
                                        <div className="w-1.5 h-1.5 bg-purple-500 rounded-full mt-1.5 flex-shrink-0" />
                                        <div className="text-sm">
                                            <span className="font-semibold text-gray-900">Prototype Environment:</span>
                                            <span className="text-gray-700 ml-1">
                                                Conceptual demonstration, not production-ready
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-start space-x-2">
                                        <div className="w-1.5 h-1.5 bg-purple-500 rounded-full mt-1.5 flex-shrink-0" />
                                        <div className="text-sm">
                                            <span className="font-semibold text-gray-900">Limited Functionality:</span>
                                            <span className="text-gray-700 ml-1">
                                                Features demonstrated have been built for other clients but are not fully operational here
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-start space-x-2">
                                        <div className="w-1.5 h-1.5 bg-purple-500 rounded-full mt-1.5 flex-shrink-0" />
                                        <div className="text-sm">
                                            <span className="font-semibold text-gray-900">Synthetic Data:</span>
                                            <span className="text-gray-700 ml-1">
                                                All data is synthetic and for demonstration purposes only
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-5">
                                    <p className="text-xs text-purple-800">
                                        By accessing this prototype, you acknowledge and accept these limitations.
                                    </p>
                                </div>

                                {/* Action Button */}
                                <button
                                    onClick={handleAcknowledge}
                                    className="w-full px-4 py-2.5 bg-gradient-to-r from-purple-600 to-purple-700 text-white font-medium rounded-lg hover:shadow-lg hover:shadow-purple-500/30 transition-all"
                                >
                                    I Understand & Accept
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

