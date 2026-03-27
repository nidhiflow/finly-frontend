/** Clearbit Logo API (linked at runtime, not bundled). Set VITE_DISABLE_CLEARBIT_LOGOS=true to skip. */
const CLEARBIT_BASE = "https://logo.clearbit.com";

export function getBankLogoSources(bank) {
    if (!bank || bank.isEmoji) return [];
    const disableClearbit =
        typeof import.meta !== "undefined" &&
        import.meta.env?.VITE_DISABLE_CLEARBIT_LOGOS === "true";
    const list = [];
    if (bank.logoDomain && !disableClearbit) {
        list.push(`${CLEARBIT_BASE}/${bank.logoDomain}`);
    }
    if (bank.id) {
        list.push(`/bank-logos/color/${bank.id}.png`);
    }
    if (bank.logoSrc) list.push(bank.logoSrc);
    const hex = (bank.color || "#6366f1").replace(/^#/, "");
    if (bank.simpleIconSlug) {
        list.push(`https://cdn.simpleicons.org/${bank.simpleIconSlug}/${hex}`);
    }
    return list;
}

const BANK_LOGOS = [
    /* ── Public Sector Banks ── */
    { id: "sbi", name: "State Bank of India", abbr: "SBI", color: "#22409A", textColor: "#fff", logoDomain: "sbi.co.in" },
    { id: "pnb", name: "Punjab National Bank", abbr: "PNB", color: "#D71920", textColor: "#fff", logoDomain: "pnbindia.in" },
    { id: "bob", name: "Bank of Baroda", abbr: "BOB", color: "#F47920", textColor: "#fff", logoDomain: "bankofbaroda.in" },
    { id: "canara", name: "Canara Bank", abbr: "CB", color: "#FFD700", textColor: "#1a1a2e", logoDomain: "canarabank.com" },
    { id: "union", name: "Union Bank of India", abbr: "UBI", color: "#D42426", textColor: "#fff", logoDomain: "unionbankofindia.co.in" },
    { id: "boi", name: "Bank of India", abbr: "BOI", color: "#F37021", textColor: "#fff", logoDomain: "bankofindia.co.in" },
    { id: "indian", name: "Indian Bank", abbr: "IB", color: "#004990", textColor: "#fff", logoDomain: "indianbank.in" },
    { id: "iob", name: "Indian Overseas Bank", abbr: "IOB", color: "#1B3A6B", textColor: "#fff", logoDomain: "iob.in" },
    { id: "central", name: "Central Bank of India", abbr: "CBI", color: "#872432", textColor: "#fff", logoDomain: "centralbankofindia.co.in" },
    { id: "uco", name: "UCO Bank", abbr: "UCO", color: "#6B2A7B", textColor: "#fff", logoDomain: "ucobank.com" },
    { id: "psb", name: "Punjab & Sind Bank", abbr: "PSB", color: "#8B0000", textColor: "#fff", logoDomain: "psbindia.co.in" },
    { id: "maha", name: "Bank of Maharashtra", abbr: "BOM", color: "#006838", textColor: "#fff", logoDomain: "bankofmaharashtra.in" },

    /* ── Private Sector Banks ── */
    { id: "hdfc", name: "HDFC Bank", abbr: "HDFC", color: "#004B87", textColor: "#fff", logoDomain: "hdfcbank.com", logoSrc: "/bank-logos/hdfc.svg" },
    { id: "icici", name: "ICICI Bank", abbr: "ICICI", color: "#F37A21", textColor: "#fff", logoDomain: "icicibank.com", logoSrc: "/bank-logos/icici.svg" },
    { id: "axis", name: "Axis Bank", abbr: "AXIS", color: "#800020", textColor: "#fff", logoDomain: "axisbank.com", logoSrc: "/bank-logos/axis.svg" },
    { id: "kotak", name: "Kotak Mahindra Bank", abbr: "KMB", color: "#ED1C24", textColor: "#fff", logoDomain: "kotak.com" },
    { id: "yes", name: "Yes Bank", abbr: "YES", color: "#003B70", textColor: "#fff", logoDomain: "yesbank.in" },
    { id: "indusind", name: "IndusInd Bank", abbr: "IIB", color: "#8B1A1A", textColor: "#fff", logoDomain: "indusind.com" },
    { id: "federal", name: "Federal Bank", abbr: "FED", color: "#003D6B", textColor: "#fff", logoDomain: "federalbank.co.in" },
    { id: "idbi", name: "IDBI Bank", abbr: "IDBI", color: "#00A651", textColor: "#fff", logoDomain: "idbibank.in" },
    { id: "bandhan", name: "Bandhan Bank", abbr: "BB", color: "#EE3A23", textColor: "#fff", logoDomain: "bandhanbank.com" },
    { id: "idfc", name: "IDFC First Bank", abbr: "IDFC", color: "#9E1B32", textColor: "#fff", logoDomain: "idfcfirstbank.com" },
    { id: "rbl", name: "RBL Bank", abbr: "RBL", color: "#0054A4", textColor: "#fff", logoDomain: "rblbank.com" },
    { id: "sib", name: "South Indian Bank", abbr: "SIB", color: "#1C2B56", textColor: "#fff", logoDomain: "sib.co.in" },
    { id: "kvb", name: "Karur Vysya Bank", abbr: "KVB", color: "#A42F2D", textColor: "#fff", logoDomain: "kvb.co.in" },
    { id: "csb", name: "CSB Bank", abbr: "CSB", color: "#005B30", textColor: "#fff", logoDomain: "csb.co.in" },
    { id: "dcb", name: "DCB Bank", abbr: "DCB", color: "#003366", textColor: "#fff", logoDomain: "dcbbank.com" },
    { id: "tmb", name: "Tamilnad Mercantile Bank", abbr: "TMB", color: "#BD2129", textColor: "#fff", logoDomain: "tmb.in" },
    { id: "cityunion", name: "City Union Bank", abbr: "CUB", color: "#004B8D", textColor: "#fff", logoDomain: "cityunionbank.com" },
    { id: "dhanlaxmi", name: "Dhanlaxmi Bank", abbr: "DLB", color: "#006747", textColor: "#fff", logoDomain: "dhanbank.com" },
    { id: "nainital", name: "Nainital Bank", abbr: "NB", color: "#0066B3", textColor: "#fff", logoDomain: "nainitalbank.co.in" },
    { id: "karnataka", name: "Karnataka Bank", abbr: "KB", color: "#0072BB", textColor: "#fff", logoDomain: "ktkbank.com" },
    { id: "jk", name: "J&K Bank", abbr: "JKB", color: "#003366", textColor: "#fff", logoDomain: "jkbank.com" },
    { id: "saraswat", name: "Saraswat Bank", abbr: "SB", color: "#E31837", textColor: "#fff", logoDomain: "saraswatbank.com" },

    /* ── Small Finance & Payments Banks ── */
    { id: "au", name: "AU Small Finance Bank", abbr: "AU", color: "#E31E24", textColor: "#fff", logoDomain: "aubank.in" },
    { id: "ujjivan", name: "Ujjivan Small Finance Bank", abbr: "USF", color: "#F58220", textColor: "#fff", logoDomain: "ujjivansfb.in" },
    { id: "equitas", name: "Equitas Small Finance Bank", abbr: "EQ", color: "#F26522", textColor: "#fff", logoDomain: "equitasbank.com" },
    { id: "jana", name: "Jana Small Finance Bank", abbr: "JN", color: "#E21F2F", textColor: "#fff", logoDomain: "janabank.com" },
    { id: "esaf", name: "ESAF Small Finance Bank", abbr: "ESAF", color: "#005C99", textColor: "#fff", logoDomain: "esafbank.com" },
    { id: "suryoday", name: "Suryoday Small Finance Bank", abbr: "SUR", color: "#F7941D", textColor: "#fff", logoDomain: "suryodaybank.com" },
    { id: "utkarsh", name: "Utkarsh Small Finance Bank", abbr: "UTK", color: "#0071BC", textColor: "#fff", logoDomain: "utkarsh.bank" },
    { id: "northeast", name: "North East Small Finance Bank", abbr: "NE", color: "#00A859", textColor: "#fff", logoDomain: "nesfb.com" },
    { id: "paytm", name: "Paytm Payments Bank", abbr: "PTM", color: "#00BAF2", textColor: "#fff", logoDomain: "paytmbank.com", logoSrc: "/bank-logos/paytm.svg" },
    { id: "airtel", name: "Airtel Payments Bank", abbr: "APB", color: "#ED1C24", textColor: "#fff", logoDomain: "airtel.in", logoSrc: "/bank-logos/airtel.svg" },
    { id: "fino", name: "Fino Payments Bank", abbr: "FINO", color: "#E31937", textColor: "#fff", logoDomain: "finobank.com" },
    { id: "indiapost", name: "India Post Payments Bank", abbr: "IPPB", color: "#E31E24", textColor: "#fff", logoDomain: "ippbonline.com" },
    { id: "jio", name: "Jio Payments Bank", abbr: "JIO", color: "#0A3B7E", textColor: "#fff", logoDomain: "jio.com", logoSrc: "/bank-logos/jio.svg" },

    /* ── Neo / Digital Banks ── */
    { id: "fi", name: "Fi Money", abbr: "Fi", color: "#6C3FEE", textColor: "#fff", logoDomain: "fi.money", logoSrc: "/bank-logos/fi.svg" },
    { id: "jupiter", name: "Jupiter", abbr: "JUP", color: "#5539CC", textColor: "#fff", logoDomain: "jupiter.money" },
    { id: "niyo", name: "Niyo", abbr: "NIYO", color: "#FF5722", textColor: "#fff", logoDomain: "goniyo.com" },

    /* ── Foreign Banks ── */
    { id: "citi", name: "Citibank", abbr: "CITI", color: "#003B70", textColor: "#fff", logoDomain: "citigroup.com" },
    { id: "hsbc", name: "HSBC", abbr: "HSBC", color: "#DB0011", textColor: "#fff", logoDomain: "hsbc.co.in", logoSrc: "/bank-logos/hsbc.svg" },
    { id: "sc", name: "Standard Chartered", abbr: "SC", color: "#0072AA", textColor: "#fff", logoDomain: "sc.com" },
    { id: "deutsche", name: "Deutsche Bank", abbr: "DB", color: "#0018A8", textColor: "#fff", logoDomain: "db.com", logoSrc: "/bank-logos/deutsche.svg" },
    { id: "barclays", name: "Barclays", abbr: "BRC", color: "#00AEEF", textColor: "#fff", logoDomain: "barclays.com", logoSrc: "/bank-logos/barclays.svg" },
    { id: "dbs", name: "DBS Bank", abbr: "DBS", color: "#E21A22", textColor: "#fff", logoDomain: "dbs.com" },
    { id: "jpmorgan", name: "JP Morgan Chase", abbr: "JPM", color: "#117ACA", textColor: "#fff", logoDomain: "jpmorganchase.com", logoSrc: "/bank-logos/jpmorgan.svg" },
    { id: "boa", name: "Bank of America", abbr: "BOA", color: "#012169", textColor: "#fff", logoDomain: "bankofamerica.com", logoSrc: "/bank-logos/boa.svg" },
    { id: "wells", name: "Wells Fargo", abbr: "WF", color: "#D71E28", textColor: "#fff", logoDomain: "wellsfargo.com", logoSrc: "/bank-logos/wells.svg" },
    { id: "goldman", name: "Goldman Sachs", abbr: "GS", color: "#7399C6", textColor: "#fff", logoDomain: "goldmansachs.com" },
    { id: "morgan_stanley", name: "Morgan Stanley", abbr: "MS", color: "#002D62", textColor: "#fff", logoDomain: "morganstanley.com" },
    { id: "ubs", name: "UBS", abbr: "UBS", color: "#E60000", textColor: "#fff", logoDomain: "ubs.com" },
    { id: "santander", name: "Santander", abbr: "SAN", color: "#EC0000", textColor: "#fff", logoDomain: "santander.com" },
    { id: "ing", name: "ING", abbr: "ING", color: "#FF6200", textColor: "#fff", logoDomain: "ing.com" },
    { id: "anz", name: "ANZ", abbr: "ANZ", color: "#007DC3", textColor: "#fff", logoDomain: "anz.com.au" },
    { id: "rbc", name: "Royal Bank of Canada", abbr: "RBC", color: "#005DAA", textColor: "#fff", logoDomain: "rbc.com" },
    { id: "mufg", name: "MUFG Bank", abbr: "MUFG", color: "#DA291C", textColor: "#fff", logoDomain: "mufg.jp" },
    { id: "socgen", name: "Societe Generale", abbr: "SG", color: "#E61E25", textColor: "#fff", logoDomain: "societegenerale.com" },
    { id: "bnp", name: "BNP Paribas", abbr: "BNP", color: "#00915A", textColor: "#fff", logoDomain: "bnpparibas.com" },

    /* ── Generic / Non-bank ── */
    { id: "generic_bank", name: "Bank Account", abbr: "🏦", color: "#6366f1", textColor: "#fff", isEmoji: true },
    { id: "generic_savings", name: "Savings", abbr: "🏧", color: "#10b981", textColor: "#fff", isEmoji: true },
    { id: "generic_cash", name: "Cash", abbr: "💵", color: "#22c55e", textColor: "#fff", isEmoji: true },
    { id: "generic_credit", name: "Credit Card", abbr: "💳", color: "#f59e0b", textColor: "#fff", isEmoji: true },
    { id: "generic_loan", name: "Loan", abbr: "📋", color: "#ef4444", textColor: "#fff", isEmoji: true },
    { id: "generic_wallet", name: "Wallet", abbr: "👛", color: "#8b5cf6", textColor: "#fff", isEmoji: true },
    { id: "generic_investment", name: "Investment", abbr: "📈", color: "#0ea5e9", textColor: "#fff", isEmoji: true },
];

export function getBankById(id) {
    if (!id) return null;
    const found = BANK_LOGOS.find((b) => b.id === id);
    if (found) return found;
    /* Check user-added custom banks in localStorage */
    const custom = getCustomBanks().find((b) => b.id === id);
    return custom || null;
}

/* ── Custom bank helpers (persisted in localStorage) ── */

const CUSTOM_BANKS_KEY = "finly_custom_banks";

const BRAND_COLORS = [
    "#6366f1", "#ec4899", "#14b8a6", "#f59e0b", "#8b5cf6",
    "#06b6d4", "#f97316", "#10b981", "#e11d48", "#3b82f6",
];

export function getCustomBanks() {
    try {
        return JSON.parse(localStorage.getItem(CUSTOM_BANKS_KEY) || "[]");
    } catch {
        return [];
    }
}

export function saveCustomBank(name) {
    const trimmed = (name || "").trim();
    if (!trimmed) return null;
    const id = "custom_" + trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/_+$/, "");
    const existing = getCustomBanks();
    if (existing.some((b) => b.id === id)) return existing.find((b) => b.id === id);
    const abbr = trimmed
        .split(/\s+/)
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 4);
    const color = BRAND_COLORS[existing.length % BRAND_COLORS.length];
    const bank = { id, name: trimmed, abbr, color, textColor: "#fff", isCustom: true };
    const updated = [...existing, bank];
    localStorage.setItem(CUSTOM_BANKS_KEY, JSON.stringify(updated));
    return bank;
}

/** All banks: built-in + user-created, deduped by id */
export function getAllBanks() {
    const map = new Map();
    for (const b of BANK_LOGOS) map.set(b.id, b);
    for (const b of getCustomBanks()) {
        if (!map.has(b.id)) map.set(b.id, b);
    }
    return Array.from(map.values());
}

export default BANK_LOGOS;
