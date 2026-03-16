import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { authAPI } from '../services/api';
import {
    AUTH_TOKEN_KEY,
    AUTH_USER_KEY,
    clearAuthStorage,
    getStoredJson,
    getStoredValue,
    setStoredJson,
    setStoredValue,
} from '../utils/appStorage';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const persistSession = useCallback(async (sessionUser, token) => {
        await Promise.all([
            setStoredValue(AUTH_TOKEN_KEY, token),
            setStoredJson(AUTH_USER_KEY, sessionUser),
        ]);
        setUser(sessionUser);
    }, []);

    const logout = useCallback(async () => {
        await clearAuthStorage();
        setUser(null);
    }, []);

    const updateUser = useCallback(async (userData) => {
        setUser(userData);
        await setStoredJson(AUTH_USER_KEY, userData);
    }, []);

    useEffect(() => {
        let cancelled = false;
        let bootFallbackId;

        const restoreSession = async () => {
            try {
                const [token, savedUser] = await Promise.all([
                    getStoredValue(AUTH_TOKEN_KEY),
                    getStoredJson(AUTH_USER_KEY),
                ]);

                if (!token || !savedUser) {
                    if (!cancelled) {
                        setLoading(false);
                    }
                    return;
                }

                if (!cancelled) {
                    setUser(savedUser);
                }

                const currentUser = await authAPI.me();
                if (!cancelled) {
                    setUser(currentUser);
                }
                await setStoredJson(AUTH_USER_KEY, currentUser);
            } catch {
                await logout();
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        // Never let native startup wait forever on auth bootstrap.
        bootFallbackId = window.setTimeout(() => {
            if (!cancelled) {
                setLoading(false);
            }
        }, 9000);

        restoreSession();

        return () => {
            cancelled = true;
            window.clearTimeout(bootFallbackId);
        };
    }, [logout]);

    const login = async (email, password) => {
        const data = await authAPI.login({ email, password });
        if (data.requireOTP) {
            return data; // Caller (Login.jsx) handles OTP flow
        }
        await persistSession(data.user, data.token);
        return data;
    };

    const verifyLoginOtp = async (email, code) => {
        const data = await authAPI.verifyLoginOtp({ email, code });
        await persistSession(data.user, data.token);
        return data;
    };

    const signup = async (name, email, password) => {
        // Signup now just sends OTP, doesn't create a user yet
        const data = await authAPI.signup({ name, email, password });
        return data;
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, verifyLoginOtp, signup, logout, updateUser }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within AuthProvider');
    return context;
}
