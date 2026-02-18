'use client';

import { usePathname } from 'next/navigation';
import ManagementReportingLayout from './management-layout';

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isLoginPage = pathname === '/login';

    if (isLoginPage) {
        return <>{children}</>;
    }

    return (
        <ManagementReportingLayout>
            {children}
        </ManagementReportingLayout>
    );
}

