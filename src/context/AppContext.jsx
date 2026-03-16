import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { settingsAPI } from '../services/api';

const AppContext = createContext(null);

export function AppProvider({ children }) {
    const { user } = useAuth();
    const [theme, setTheme] = useState(localStorage.getItem('finly_theme') || 'dark');
    const [toasts, setToasts] = useState([]);
    const [settings, setSettings] = useState({ currency: 'INR', currencySymbol: '₹' });
    const themeTransitionTimeoutRef = useRef(null);

    useEffect(() => {
        if (!user) return;
        settingsAPI.get().then(s => setSettings(prev => ({ ...prev, ...s }))).catch(() => {});
    }, [user]);

    const toggleTheme = useCallback(() => {
        const newTheme = theme === 'dark' ? 'light' : 'dark';
        if (typeof document !== 'undefined') {
            const root = document.documentElement;
            const body = document.body;
            root.classList.add('theme-transitioning');
            body.classList.add('theme-transitioning');
            if (themeTransitionTimeoutRef.current) {
                clearTimeout(themeTransitionTimeoutRef.current);
            }
            themeTransitionTimeoutRef.current = setTimeout(() => {
                root.classList.remove('theme-transitioning');
                body.classList.remove('theme-transitioning');
            }, 260);
        }
        setTheme(newTheme);
        localStorage.setItem('finly_theme', newTheme);
    }, [theme]);

    useEffect(() => () => {
        if (themeTransitionTimeoutRef.current) {
            clearTimeout(themeTransitionTimeoutRef.current);
        }
    }, []);

    const addToast = useCallback((message, type = 'success') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 3000);
    }, []);

    const formatCurrency = useCallback((v) => {
        const cur = settings.currency || 'INR';
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(v);
    }, [settings.currency]);

    return (
        <AppContext.Provider value={{ theme, toggleTheme, toasts, addToast, settings, setSettings, formatCurrency }}>
            {children}
        </AppContext.Provider>
    );
}

export function useApp() {
    const context = useContext(AppContext);
    if (!context) throw new Error('useApp must be used within AppProvider');
    return context;
}
