import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';

export const AUTH_TOKEN_KEY = 'finly_token';
export const AUTH_USER_KEY = 'finly_user';

export function isNativeApp() {
    return Capacitor.isNativePlatform();
}

export async function getStoredValue(key) {
    if (!isNativeApp()) {
        return localStorage.getItem(key);
    }

    const { value } = await Preferences.get({ key });
    return value;
}

export async function setStoredValue(key, value) {
    if (!isNativeApp()) {
        localStorage.setItem(key, value);
        return;
    }

    await Preferences.set({ key, value });
}

export async function removeStoredValue(key) {
    if (!isNativeApp()) {
        localStorage.removeItem(key);
        return;
    }

    await Preferences.remove({ key });
}

export async function getStoredJson(key, fallback = null) {
    const value = await getStoredValue(key);
    if (!value) {
        return fallback;
    }

    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
}

export async function setStoredJson(key, value) {
    await setStoredValue(key, JSON.stringify(value));
}

export async function clearAuthStorage() {
    await Promise.all([
        removeStoredValue(AUTH_TOKEN_KEY),
        removeStoredValue(AUTH_USER_KEY),
    ]);
}
