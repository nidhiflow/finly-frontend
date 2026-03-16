/**
 * Date range presets and utilities for Charts and Dashboard.
 * Does not change page frame sizes.
 */

/**
 * Get start and end dates for a preset.
 * @param {'7d'|'30d'|'90d'|'ytd'} preset
 * @returns {{ startDate: string, endDate: string }}
 */
function toLocalDateValue(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function getPresetRange(preset) {
    const today = new Date();
    const endDate = toLocalDateValue(today);
    let startDate;

    switch (preset) {
        case '7d': {
            const d7 = new Date(today);
            d7.setDate(d7.getDate() - 6);
            startDate = toLocalDateValue(d7);
            break;
        }
        case '30d': {
            const d30 = new Date(today);
            d30.setDate(d30.getDate() - 29);
            startDate = toLocalDateValue(d30);
            break;
        }
        case '90d': {
            const d90 = new Date(today);
            d90.setDate(d90.getDate() - 89);
            startDate = toLocalDateValue(d90);
            break;
        }
        case 'ytd': {
            startDate = `${today.getFullYear()}-01-01`;
            break;
        }
        default:
            startDate = endDate;
    }

    return { startDate, endDate };
}

/**
 * Get appropriate groupBy for a date range (day, week, or month).
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 * @returns {'day'|'week'|'month'}
 */
export function getGroupByForRange(startDate, endDate) {
    if (!startDate || !endDate) return 'day';
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.round((end - start) / (24 * 60 * 60 * 1000)) + 1;
    if (days <= 31) return 'day';
    if (days <= 90) return 'week';
    return 'month';
}
