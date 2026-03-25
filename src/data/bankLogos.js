const BANK_LOGOS = [
    // Indian Public Sector Banks (add /public/bank-logos/{id}.svg for full-color marks)
    { id: 'sbi', name: 'State Bank of India', abbr: 'SBI', color: '#22409A', textColor: '#fff' },
    { id: 'pnb', name: 'Punjab National Bank', abbr: 'PNB', color: '#D71920', textColor: '#fff' },
    { id: 'bob', name: 'Bank of Baroda', abbr: 'BOB', color: '#F47920', textColor: '#fff' },
    { id: 'canara', name: 'Canara Bank', abbr: 'CB', color: '#FFD700', textColor: '#1a1a2e' },
    { id: 'union', name: 'Union Bank of India', abbr: 'UBI', color: '#D42426', textColor: '#fff' },
    { id: 'boi', name: 'Bank of India', abbr: 'BOI', color: '#F37021', textColor: '#fff' },
    { id: 'indian', name: 'Indian Bank', abbr: 'IB', color: '#004990', textColor: '#fff' },
    { id: 'iob', name: 'Indian Overseas Bank', abbr: 'IOB', color: '#1B3A6B', textColor: '#fff' },
    { id: 'central', name: 'Central Bank of India', abbr: 'CBI', color: '#872432', textColor: '#fff' },
    { id: 'uco', name: 'UCO Bank', abbr: 'UCO', color: '#6B2A7B', textColor: '#fff' },
    { id: 'psb', name: 'Punjab & Sind Bank', abbr: 'PSB', color: '#8B0000', textColor: '#fff' },
    { id: 'maha', name: 'Bank of Maharashtra', abbr: 'BOM', color: '#006838', textColor: '#fff' },

    // Indian Private Banks — SVGs from simple-icons (CC0), hosted under /bank-logos/
    { id: 'hdfc', name: 'HDFC Bank', abbr: 'HDFC', color: '#004B87', textColor: '#fff', logoSrc: '/bank-logos/hdfc.svg' },
    { id: 'icici', name: 'ICICI Bank', abbr: 'ICICI', color: '#F37A21', textColor: '#fff', logoSrc: '/bank-logos/icici.svg' },
    { id: 'axis', name: 'Axis Bank', abbr: 'AXIS', color: '#800020', textColor: '#fff', logoSrc: '/bank-logos/axis.svg' },
    { id: 'kotak', name: 'Kotak Mahindra Bank', abbr: 'KMB', color: '#ED1C24', textColor: '#fff' },
    { id: 'yes', name: 'Yes Bank', abbr: 'YES', color: '#003B70', textColor: '#fff' },
    { id: 'indusind', name: 'IndusInd Bank', abbr: 'IIB', color: '#8B1A1A', textColor: '#fff' },
    { id: 'federal', name: 'Federal Bank', abbr: 'FED', color: '#003D6B', textColor: '#fff' },
    { id: 'idbi', name: 'IDBI Bank', abbr: 'IDBI', color: '#00A651', textColor: '#fff' },
    { id: 'bandhan', name: 'Bandhan Bank', abbr: 'BB', color: '#EE3A23', textColor: '#fff' },
    { id: 'idfc', name: 'IDFC First Bank', abbr: 'IDFC', color: '#9E1B32', textColor: '#fff' },
    { id: 'rbl', name: 'RBL Bank', abbr: 'RBL', color: '#0054A4', textColor: '#fff' },
    { id: 'sib', name: 'South Indian Bank', abbr: 'SIB', color: '#1C2B56', textColor: '#fff' },
    { id: 'kvb', name: 'Karur Vysya Bank', abbr: 'KVB', color: '#A42F2D', textColor: '#fff' },
    { id: 'csb', name: 'CSB Bank', abbr: 'CSB', color: '#005B30', textColor: '#fff' },
    { id: 'dcb', name: 'DCB Bank', abbr: 'DCB', color: '#003366', textColor: '#fff' },
    { id: 'tmb', name: 'Tamilnad Mercantile Bank', abbr: 'TMB', color: '#BD2129', textColor: '#fff' },
    { id: 'cityunion', name: 'City Union Bank', abbr: 'CUB', color: '#004B8D', textColor: '#fff' },
    { id: 'dhanlaxmi', name: 'Dhanlaxmi Bank', abbr: 'DLB', color: '#006747', textColor: '#fff' },
    { id: 'nainital', name: 'Nainital Bank', abbr: 'NB', color: '#0066B3', textColor: '#fff' },

    // Payment Banks & Neo Banks
    { id: 'paytm', name: 'Paytm Payments Bank', abbr: 'PTM', color: '#00BAF2', textColor: '#fff', logoSrc: '/bank-logos/paytm.svg' },
    { id: 'airtel', name: 'Airtel Payments Bank', abbr: 'APB', color: '#ED1C24', textColor: '#fff', logoSrc: '/bank-logos/airtel.svg' },
    { id: 'fino', name: 'Fino Payments Bank', abbr: 'FINO', color: '#E31937', textColor: '#fff' },
    { id: 'jio', name: 'Jio Payments Bank', abbr: 'JIO', color: '#0A3B7E', textColor: '#fff', logoSrc: '/bank-logos/jio.svg' },
    { id: 'fi', name: 'Fi Money', abbr: 'Fi', color: '#6C3FEE', textColor: '#fff', logoSrc: '/bank-logos/fi.svg' },
    { id: 'jupiter', name: 'Jupiter', abbr: 'JUP', color: '#5539CC', textColor: '#fff' },
    { id: 'niyo', name: 'Niyo', abbr: 'NIYO', color: '#FF5722', textColor: '#fff' },

    // Foreign Banks in India
    { id: 'citi', name: 'Citibank', abbr: 'CITI', color: '#003B70', textColor: '#fff' },
    { id: 'hsbc', name: 'HSBC', abbr: 'HSBC', color: '#DB0011', textColor: '#fff', logoSrc: '/bank-logos/hsbc.svg' },
    { id: 'sc', name: 'Standard Chartered', abbr: 'SC', color: '#0072AA', textColor: '#fff' },
    { id: 'deutsche', name: 'Deutsche Bank', abbr: 'DB', color: '#0018A8', textColor: '#fff', logoSrc: '/bank-logos/deutsche.svg' },
    { id: 'barclays', name: 'Barclays', abbr: 'BRC', color: '#00AEEF', textColor: '#fff', logoSrc: '/bank-logos/barclays.svg' },
    { id: 'dbs', name: 'DBS Bank', abbr: 'DBS', color: '#E21A22', textColor: '#fff' },
    { id: 'jpmorgan', name: 'JP Morgan Chase', abbr: 'JPM', color: '#117ACA', textColor: '#fff', logoSrc: '/bank-logos/jpmorgan.svg' },
    { id: 'boa', name: 'Bank of America', abbr: 'BOA', color: '#012169', textColor: '#fff', logoSrc: '/bank-logos/boa.svg' },
    { id: 'wells', name: 'Wells Fargo', abbr: 'WF', color: '#D71E28', textColor: '#fff', logoSrc: '/bank-logos/wells.svg' },

    // Generic Account Types
    { id: 'generic_bank', name: 'Bank Account', abbr: '🏦', color: '#6366f1', textColor: '#fff', isEmoji: true },
    { id: 'generic_savings', name: 'Savings', abbr: '🏧', color: '#10b981', textColor: '#fff', isEmoji: true },
    { id: 'generic_cash', name: 'Cash', abbr: '💵', color: '#22c55e', textColor: '#fff', isEmoji: true },
    { id: 'generic_credit', name: 'Credit Card', abbr: '💳', color: '#f59e0b', textColor: '#fff', isEmoji: true },
    { id: 'generic_loan', name: 'Loan', abbr: '📋', color: '#ef4444', textColor: '#fff', isEmoji: true },
    { id: 'generic_wallet', name: 'Wallet', abbr: '👛', color: '#8b5cf6', textColor: '#fff', isEmoji: true },
    { id: 'generic_investment', name: 'Investment', abbr: '📈', color: '#0ea5e9', textColor: '#fff', isEmoji: true },
];

export function getBankById(id) {
    return BANK_LOGOS.find(b => b.id === id) || null;
}

export default BANK_LOGOS;
