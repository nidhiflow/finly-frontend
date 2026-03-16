import { useEffect, useState } from 'react';

export function useIsMobile(maxWidth = 768) {
    const getValue = () => {
        if (typeof window === 'undefined') {
            return false;
        }

        return window.innerWidth <= maxWidth;
    };

    const [isMobile, setIsMobile] = useState(getValue);

    useEffect(() => {
        const handleResize = () => setIsMobile(getValue());
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [maxWidth]);

    return isMobile;
}
