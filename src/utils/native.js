import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { App as CapacitorApp } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';

export const MOBILE_APP_SCHEME = 'finly';

/** Production API base used by the native app when build-time env is missing. */
export const NATIVE_APP_API_BASE = 'https://www.nidhiflow.in/api';

export function isNativeApp() {
    return Capacitor.isNativePlatform();
}

export function getAppScheme() {
    return MOBILE_APP_SCHEME;
}

export function getApiBaseUrl() {
    const envBase = import.meta.env.VITE_API_BASE_URL?.trim();
    if (envBase) {
        return envBase.replace(/\/+$/, '');
    }

    if (isNativeApp()) {
        return NATIVE_APP_API_BASE;
    }

    return '/api';
}

export async function openExternalUrl(url) {
    if (!url) {
        return;
    }

    if (isNativeApp()) {
        await Browser.open({ url, presentationStyle: 'fullscreen' });
        return;
    }

    window.location.href = url;
}

export async function closeExternalBrowser() {
    if (!isNativeApp()) {
        return;
    }

    try {
        await Browser.close();
    } catch {
        // Browser.close can fail if no in-app browser is active.
    }
}

export async function applyNativeWindowStyling(theme) {
    if (!isNativeApp()) {
        return;
    }

    try {
        await StatusBar.setStyle({
            style: theme === 'light' ? Style.Light : Style.Dark,
        });
        await StatusBar.setBackgroundColor({
            color: theme === 'light' ? '#f8fafc' : '#0f172a',
        });
    } catch {
        // Ignore unsupported platform APIs.
    }
}

export async function hideNativeSplash() {
    if (!isNativeApp()) {
        return;
    }

    try {
        await SplashScreen.hide();
    } catch {
        // Ignore if splash screen is already gone.
    }
}

export async function getNativeLaunchUrl() {
    if (!isNativeApp()) {
        return '';
    }

    try {
        const result = await CapacitorApp.getLaunchUrl();
        return result?.url || '';
    } catch {
        return '';
    }
}

export function addNativeAppUrlListener(callback) {
    if (!isNativeApp()) {
        return () => {};
    }

    let listener;
    CapacitorApp.addListener('appUrlOpen', async (event) => {
        await closeExternalBrowser();
        callback(event.url);
    }).then((result) => {
        listener = result;
    });

    return () => {
        listener?.remove();
    };
}
