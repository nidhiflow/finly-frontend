import { useState, useEffect } from 'react';
import { Plus, Edit3, Trash2, ChevronDown, ChevronRight, Wallet, TrendingUp, TrendingDown, ArrowRight, Landmark, PiggyBank, Search } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { accountsAPI, statsAPI } from '../services/api';
import { useApp } from '../context/AppContext';
import { useIsMobile } from '../hooks/useIsMobile';
import { getBankById, getAllBanks, saveCustomBank } from '../data/bankLogos';
import { BankLogo } from '../components/BankLogo';

function AccountIcon({ icon, size = 44 }) {
    const bank = getBankById(icon);
    if (bank) return <BankLogo key={icon} bank={bank} size={size} />;
    return <div className="account-card-icon">{icon}</div>;
}

const DEFAULT_ACCOUNT_TYPES = [
    { value: 'bank_account', label: 'Bank account', icon: '🏦' },
    { value: 'savings', label: 'Savings', icon: '🏧' },
    { value: 'cash', label: 'Cash', icon: '💵' },
    { value: 'loan', label: 'Loan', icon: '📋' },
    { value: 'credit_card', label: 'Credit card', icon: '💳' },
];

const DEFAULT_SUBCATEGORY_TYPES = [
    { value: 'upi', label: 'UPI', icon: '📲' },
    { value: 'debit_card', label: 'Debit Card', icon: '💳' },
    { value: 'net_banking', label: 'Net banking', icon: '🌐' },
];

const SUBCATEGORY_STORAGE_KEY = 'finly_custom_account_subcategories';

export default function Accounts() {
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingAcc, setEditingAcc] = useState(null);
    const [form, setForm] = useState({ name: '', type: 'cash', balance: 0, icon: '💵', color: '#3498DB' });
    const [balanceInput, setBalanceInput] = useState('');
    const [customTypes, setCustomTypes] = useState(() => {
        try { return JSON.parse(localStorage.getItem('finly_custom_account_types') || '[]'); } catch { return []; }
    });
    const [customSubcategories, setCustomSubcategories] = useState(() => {
        try { return JSON.parse(localStorage.getItem(SUBCATEGORY_STORAGE_KEY) || '[]'); } catch { return []; }
    });
    const [showAddType, setShowAddType] = useState(false);
    const [newTypeName, setNewTypeName] = useState('');
    const [expandedBankId, setExpandedBankId] = useState(null);
    const [showSubModal, setShowSubModal] = useState(false);
    const [subParentId, setSubParentId] = useState(null);
    const [editingSub, setEditingSub] = useState(null);
    const [subForm, setSubForm] = useState({ name: '', type: 'upi' });
    const [bankSearch, setBankSearch] = useState('');
    const [showBankPicker, setShowBankPicker] = useState(false);
    const [newBankName, setNewBankName] = useState('');
    const [showAddBankInput, setShowAddBankInput] = useState(false);
    const [, setCustomBankTick] = useState(0);
    const [trendData, setTrendData] = useState([]);
    const { addToast, formatCurrency } = useApp();
    const isMobile = useIsMobile();

    const accountTypes = [...DEFAULT_ACCOUNT_TYPES, ...customTypes];
    const subcategoryTypes = [...DEFAULT_SUBCATEGORY_TYPES, ...customSubcategories];

    useEffect(() => { loadAccounts(); }, []);

    const loadAccounts = async () => {
        try {
            const accs = await accountsAPI.list();
            setAccounts(accs);
            const now = new Date();
            const start = new Date(now.getFullYear(), now.getMonth(), 1);
            const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            const trend = await statsAPI.trend({
                startDate: start.toISOString().split('T')[0],
                endDate: end.toISOString().split('T')[0],
                groupBy: 'day',
            }).catch(() => []);
            setTrendData((trend || []).slice(-7).map(d => ({ ...d, net: (d.income || 0) - (d.expense || 0) })));
        } catch {
            addToast('Failed to load accounts', 'error');
        } finally {
            setLoading(false);
        }
    };

    const mainAccounts = accounts.filter(a => !a.parent_id);
    const totalNetWorth = mainAccounts.reduce((sum, a) => sum + parseFloat(a.balance || 0), 0);
    const totalAssets = mainAccounts.reduce((sum, a) => {
        const value = parseFloat(a.balance || 0);
        return value > 0 ? sum + value : sum;
    }, 0);
    const totalLiabilities = Math.abs(mainAccounts.reduce((sum, a) => {
        const value = parseFloat(a.balance || 0);
        return value < 0 ? sum + value : sum;
    }, 0));
    const savingsAccounts = mainAccounts.filter(a => a.type === 'savings');
    const largestAccount = mainAccounts.reduce((best, account) => {
        const balance = parseFloat(account.balance || 0);
        if (!best) return { ...account, balanceValue: balance };
        return Math.abs(balance) > Math.abs(best.balanceValue) ? { ...account, balanceValue: balance } : best;
    }, null);
    const plannerCards = [
        {
            key: 'largest',
            icon: Landmark,
            label: 'Largest account',
            value: largestAccount ? largestAccount.name : 'No account yet',
            note: largestAccount ? formatCurrency(largestAccount.balanceValue) : 'Add an account to start tracking balances.',
            tone: largestAccount?.balanceValue >= 0 ? 'positive' : 'negative',
        },
        {
            key: 'savings',
            icon: PiggyBank,
            label: 'Savings system',
            value: `${savingsAccounts.length} savings account${savingsAccounts.length === 1 ? '' : 's'}`,
            note: savingsAccounts.length > 0
                ? `${formatCurrency(savingsAccounts.reduce((sum, acc) => sum + (parseFloat(acc.balance || 0) || 0), 0))} parked in savings.`
                : 'No dedicated savings account yet.',
            tone: savingsAccounts.length > 0 ? 'positive' : 'neutral',
        },
        {
            key: 'liabilities',
            icon: totalLiabilities > 0 ? TrendingDown : TrendingUp,
            label: 'Liabilities',
            value: totalLiabilities > 0 ? formatCurrency(totalLiabilities) : formatCurrency(0),
            note: totalLiabilities > 0 ? 'Loans and cards are pulling net worth down.' : 'No liabilities are reducing net worth right now.',
            tone: totalLiabilities > 0 ? 'warning' : 'positive',
        },
    ];

    const getChildren = (parentId) => accounts.filter(a => a.parent_id === parentId);

    const handleAddType = () => {
        const trimmed = newTypeName.trim();
        if (!trimmed) return;
        const value = trimmed.toLowerCase().replace(/\s+/g, '_');
        if (accountTypes.some(t => t.value === value)) {
            addToast('This type already exists', 'error');
            return;
        }
        const newType = { value, label: trimmed, icon: '🏷️' };
        const updated = [...customTypes, newType];
        setCustomTypes(updated);
        localStorage.setItem('finly_custom_account_types', JSON.stringify(updated));
        setForm(f => ({ ...f, type: value, icon: newType.icon }));
        setNewTypeName('');
        setShowAddType(false);
        addToast(`Type "${trimmed}" added`);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingAcc) {
                await accountsAPI.update(editingAcc.id, form);
                addToast('Account updated');
            } else {
                const submitForm = { ...form, balance: parseFloat(balanceInput) || 0 };
                await accountsAPI.create(submitForm);
                addToast('Account created');
            }
            setShowModal(false);
            setEditingAcc(null);
            setForm({ name: '', type: 'cash', balance: 0, icon: 'generic_cash', color: '#22c55e' });
            setBalanceInput('');
            setBankSearch('');
            setShowBankPicker(false);
            loadAccounts();
        } catch (err) { addToast(err.message, 'error'); }
    };

    const handleDelete = async (id) => {
        if (!confirm('Delete this account?')) return;
        try {
            await accountsAPI.delete(id);
            addToast('Account deleted');
            loadAccounts();
        } catch (err) { addToast(err.message, 'error'); }
    };

    const openAdd = () => {
        setEditingAcc(null);
        setForm({ name: '', type: 'cash', balance: 0, icon: 'generic_cash', color: '#22c55e' });
        setBalanceInput('');
        setBankSearch('');
        setShowBankPicker(false);
        setShowModal(true);
    };

    const openEdit = (acc) => {
        setEditingAcc(acc);
        setForm({ name: acc.name, type: acc.type, balance: acc.balance, icon: acc.icon, color: acc.color });
        setBalanceInput(acc.balance != null && acc.balance !== '' ? String(acc.balance) : '');
        setBankSearch('');
        setShowBankPicker(false);
        setShowModal(true);
    };

    const openAddSub = (parentId) => {
        setSubParentId(parentId);
        setEditingSub(null);
        setSubForm({ name: '', type: 'upi' });
        setShowSubModal(true);
    };

    const openEditSub = (sub) => {
        setSubParentId(sub.parent_id);
        setEditingSub(sub);
        setSubForm({ name: sub.name, type: sub.type });
        setShowSubModal(true);
    };

    const handleSubSubmit = async (e) => {
        e.preventDefault();
        const parent = accounts.find(a => a.id === subParentId);
        if (!parent) return;
        const typeInfo = subcategoryTypes.find(t => t.value === subForm.type) || { label: subForm.name || subForm.type, icon: '🏷️' };
        const name = subForm.name.trim() || typeInfo.label;
        try {
            if (editingSub) {
                await accountsAPI.update(editingSub.id, { name, type: subForm.type, icon: typeInfo.icon, color: parent.color, balance: 0 });
                addToast('Subcategory updated');
            } else {
                await accountsAPI.create({ name, type: subForm.type, icon: typeInfo.icon, color: parent.color, parent_id: subParentId, balance: 0 });
                addToast('Subcategory added');
            }
            setShowSubModal(false);
            setSubParentId(null);
            setEditingSub(null);
            loadAccounts();
        } catch (err) { addToast(err.message, 'error'); }
    };

    const addCustomSubcategoryType = () => {
        const label = prompt('New subcategory type (e.g. Wallet)');
        if (!label?.trim()) return;
        const value = label.toLowerCase().replace(/\s+/g, '_');
        if (subcategoryTypes.some(t => t.value === value)) {
            addToast('This subcategory type already exists', 'error');
            return;
        }
        const newType = { value, label, icon: '🏷️' };
        const updated = [...customSubcategories, newType];
        setCustomSubcategories(updated);
        localStorage.setItem(SUBCATEGORY_STORAGE_KEY, JSON.stringify(updated));
        setSubForm(f => ({ ...f, type: value }));
        addToast(`"${label}" added`);
    };

    if (loading) return <div className="loading-spinner" />;

    const heroChartColor = totalNetWorth >= 0 ? '#10b981' : '#ef4444';

    return (
        <div className="fade-in page-stack accounts-page">
            {isMobile ? (
                <div className="mobile-accounts-home">
                    <div className="mobile-accounts-header">
                        <div>
                            <div className="dashboard-section-kicker" style={{ color: 'var(--accent-secondary)' }}>Accounts</div>
                            <div className="dashboard-section-title">Where your money lives</div>
                            <div className="dashboard-section-note">Track bank accounts, savings, cash, cards, and grouped sub-accounts in one place.</div>
                        </div>
                        <button className="btn btn-primary btn-sm" onClick={openAdd}>
                            <Plus size={16} /> Add Account
                        </button>
                    </div>

                    <div className="mobile-hero-card">
                        <div className="mobile-hero-top">
                            <div className="mobile-hero-left">
                                <div className="mobile-hero-label">NET WORTH</div>
                                <div className="mobile-hero-balance">{formatCurrency(totalNetWorth)}</div>
                                <div className="mobile-hero-message" style={{ marginBottom: 0 }}>
                                    {mainAccounts.length} primary account{mainAccounts.length !== 1 ? 's' : ''} across assets, savings, cash, cards, and liabilities.
                                </div>
                            </div>
                            {trendData.length > 1 && (
                                <div className="mobile-hero-chart-area">
                                    <ResponsiveContainer width="100%" height={80}>
                                        <AreaChart data={trendData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                                            <defs>
                                                <linearGradient id="accHeroGrad" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor={heroChartColor} stopOpacity={0.4} />
                                                    <stop offset="100%" stopColor={heroChartColor} stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <Area type="monotone" dataKey="net" stroke={heroChartColor} strokeWidth={2}
                                                fill="url(#accHeroGrad)" dot={false} isAnimationActive animationDuration={800} animationEasing="ease-out" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </div>
                        <button className="mobile-hero-chart-link" onClick={() => {}}>
                            Last 7 days <ChevronRight size={12} />
                        </button>
                    </div>

                    <div className="mobile-tx-flow">
                        <span className="flow-item income"><Landmark size={13} /> ASSETS {formatCurrency(totalAssets)}</span>
                        <span className="flow-arrow">→</span>
                        <span className="flow-item expense">{formatCurrency(totalLiabilities)}</span>
                        <span className="flow-arrow">→</span>
                        <span className="flow-item balance">{formatCurrency(totalNetWorth)}</span>
                    </div>

                    <div className="mobile-accounts-list">
                        {mainAccounts.length === 0 ? (
                            <div className="card" style={{ padding: 32, textAlign: 'center' }}>
                                <div style={{ fontSize: 48, marginBottom: 12 }}>🏦</div>
                                <h3>No accounts yet</h3>
                                <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Add your first account to start tracking.</p>
                                <button className="btn btn-primary btn-sm" onClick={openAdd} style={{ marginTop: 16 }}>
                                    <Plus size={16} /> Add Account
                                </button>
                            </div>
                        ) : mainAccounts.map(acc => {
                            const balanceValue = parseFloat(acc.balance || 0) || 0;
                            const typeLabel = accountTypes.find(t => t.value === acc.type)?.label || acc.type.replace('_', ' ');
                            return (
                                <button key={acc.id} type="button" className="mobile-account-row" onClick={() => openEdit(acc)}>
                                    <AccountIcon icon={acc.icon} size={44} />
                                    <div className="mobile-account-info">
                                        <div className="mobile-account-name">{acc.name}</div>
                                        <div className="mobile-account-type">{typeLabel}</div>
                                    </div>
                                    <div className="mobile-account-right">
                                        <div className={`mobile-account-balance ${balanceValue >= 0 ? 'positive' : 'negative'}`}>
                                            {formatCurrency(acc.balance)}
                                        </div>
                                        <div className="mobile-account-tag">{typeLabel}</div>
                                    </div>
                                    <ChevronRight size={18} className="mobile-account-chevron" />
                                </button>
                            );
                        })}
                    </div>
                </div>
            ) : (
            <>
            <div className="card page-toolbar-card">
                <div className="page-toolbar-header">
                    <div>
                        <div className="dashboard-section-kicker">Accounts</div>
                        <div className="dashboard-section-title">Where your money lives</div>
                        <div className="dashboard-section-note">Track bank accounts, savings, cash, cards, and grouped sub-accounts in one place.</div>
                    </div>
                    <button className="btn btn-primary btn-sm" onClick={openAdd}>
                        <Plus size={16} /> Add Account
                    </button>
                </div>
            </div>

            <div className="card accounts-networth-hero">
                <div className="accounts-networth-head">
                    <div>
                        <div className="dashboard-section-kicker accounts-hero-kicker">Net worth</div>
                        <div className="accounts-networth-value">{formatCurrency(totalNetWorth)}</div>
                        <div className="accounts-networth-note">
                            {mainAccounts.length} primary account{mainAccounts.length !== 1 ? 's' : ''} across assets, savings, cash, cards, and liabilities.
                        </div>
                    </div>
                    <div className="accounts-networth-icon">
                        <Wallet size={24} />
                    </div>
                </div>
                <div className="accounts-networth-metrics">
                    <div className="mini-metric">
                        <span className="mini-metric-label">Assets</span>
                        <strong>{formatCurrency(totalAssets)}</strong>
                    </div>
                    <div className="mini-metric">
                        <span className="mini-metric-label">Liabilities</span>
                        <strong>{formatCurrency(totalLiabilities)}</strong>
                    </div>
                    <div className="mini-metric">
                        <span className="mini-metric-label">Savings accounts</span>
                        <strong>{savingsAccounts.length}</strong>
                    </div>
                </div>
            </div>

            <div className="accounts-planner-grid">
                {plannerCards.map((card) => {
                    const Icon = card.icon;
                    return (
                        <div key={card.key} className={`planner-card ${card.tone || 'neutral'}`}>
                            <div className="planner-card-top">
                                <span className="planner-card-icon"><Icon size={18} /></span>
                                <span className="planner-card-label">{card.label}</span>
                            </div>
                            <div className="planner-card-value">{card.value}</div>
                            <div className="planner-card-note">{card.note}</div>
                        </div>
                    );
                })}
            </div>

            <div className="accounts-section-heading">
                <div>
                    <div className="dashboard-section-kicker">Accounts overview</div>
                    <div className="dashboard-section-title">Your accounts and sub-accounts</div>
                    <div className="dashboard-section-note">Review balances, expand bank account channels, and manage each money bucket from one place.</div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={openAdd}>
                    Add another account <ArrowRight size={14} />
                </button>
            </div>

            <div className="accounts-grid">
                {mainAccounts.length === 0 ? (
                    <div className="empty-state" style={{ gridColumn: '1 / -1', padding: 32 }}>
                        <div className="empty-state-icon" style={{ fontSize: 48, marginBottom: 12 }}>🏦</div>
                        <h3>No accounts yet</h3>
                        <p>Add your first account to start tracking.</p>
                        <button className="btn btn-primary" onClick={openAdd} style={{ marginTop: 16 }}>
                            <Plus size={18} /> Add Account
                        </button>
                    </div>
                ) : mainAccounts.map(acc => {
                    const children = getChildren(acc.id);
                    const isExpanded = expandedBankId === acc.id;
                    const balanceValue = parseFloat(acc.balance || 0) || 0;
                    const typeLabel = accountTypes.find(t => t.value === acc.type)?.label || acc.type.replace('_', ' ');
                    const shareOfNetWorth = totalAssets > 0 && balanceValue > 0 ? Math.round((balanceValue / totalAssets) * 100) : 0;
                    return (
                        <div key={acc.id} className="account-card">
                            <div className="account-card-header">
                                <div className="account-card-icon-wrap">
                                    <AccountIcon icon={acc.icon} size={44} />
                                    <div>
                                        <div className="account-card-name">{acc.name}</div>
                                        <div className="account-card-type">{typeLabel}</div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 4 }}>
                                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(acc)}><Edit3 size={14} /></button>
                                    <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(acc.id)} style={{ color: 'var(--danger)' }}>
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                            <div className={`account-card-balance ${(acc.balance || 0) >= 0 ? 'positive' : 'negative'}`}>
                                {formatCurrency(acc.balance)}
                            </div>
                            <div className="account-card-meta">
                                <span>{children.length} subcategories</span>
                                <span>{balanceValue >= 0 ? `${shareOfNetWorth}% of assets` : 'A liability account'}</span>
                            </div>
                            {(
                                <div className="account-card-subsection">
                                    <button
                                        type="button"
                                        className="btn btn-ghost btn-sm"
                                        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 0', fontSize: 12 }}
                                        onClick={() => setExpandedBankId(isExpanded ? null : acc.id)}
                                    >
                                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                        Subcategories ({children.length})
                                    </button>
                                    {isExpanded && (
                                        <div className="account-subcategory-list">
                                            {children.map(sub => (
                                                <div key={sub.id} className="account-subcategory-row">
                                                    <span>{sub.icon} {sub.name}</span>
                                                    <span style={{ display: 'flex', gap: 2 }}>
                                                        <button type="button" className="btn btn-ghost btn-sm" style={{ padding: 2 }} onClick={() => openEditSub(sub)}><Edit3 size={12} /></button>
                                                        <button type="button" className="btn btn-ghost btn-sm" style={{ padding: 2, color: 'var(--danger)' }} onClick={() => handleDelete(sub.id)}><Trash2 size={12} /></button>
                                                    </span>
                                                </div>
                                            ))}
                                            <button type="button" className="btn btn-ghost btn-sm account-subcategory-add" onClick={() => openAddSub(acc.id)}>
                                                <Plus size={12} /> Add subcategory
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
            </>
            )}

            {/* Add/Edit Account Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-title">{editingAcc ? 'Edit Account' : 'Add Account'}</div>
                            <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                <div className="input-group">
                                    <label className="input-label">Name</label>
                                    <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="e.g. HDFC or My Wallet" />
                                </div>
                                <div className="input-group">
                                    <label className="input-label">Bank / Logo</label>
                                    <button type="button" className="bank-logo-trigger" onClick={() => setShowBankPicker(!showBankPicker)}>
                                        <AccountIcon key={form.icon} icon={form.icon} size={32} />
                                        <span>{getBankById(form.icon)?.name || 'Select a bank or icon'}</span>
                                        <ChevronDown size={16} className={showBankPicker ? 'rotated' : ''} />
                                    </button>
                                    {showBankPicker && (() => {
                                        const q = bankSearch.toLowerCase();
                                        const filtered = getAllBanks().filter(b => b.name.toLowerCase().includes(q) || b.abbr.toLowerCase().includes(q));
                                        return (
                                        <div className="bank-logo-picker">
                                            <div className="bank-logo-search">
                                                <Search size={15} />
                                                <input
                                                    className="input"
                                                    placeholder="Search banks..."
                                                    value={bankSearch}
                                                    onChange={e => { setBankSearch(e.target.value); setShowAddBankInput(false); }}
                                                    autoFocus
                                                />
                                            </div>
                                            <div className="bank-logo-grid">
                                                {filtered.map((b, idx) => (
                                                    <button
                                                        key={b.id}
                                                        type="button"
                                                        className={`bank-logo-option ${form.icon === b.id ? 'selected' : ''}`}
                                                        style={{ animationDelay: `${idx * 30}ms` }}
                                                        onClick={() => {
                                                            setForm(f => ({ ...f, icon: b.id, color: b.color }));
                                                            setShowBankPicker(false);
                                                            setBankSearch('');
                                                        }}
                                                    >
                                                        <BankLogo key={b.id} bank={b} size={38} />
                                                        <span className="bank-logo-option-name">{b.name}</span>
                                                    </button>
                                                ))}
                                            </div>
                                            {filtered.length === 0 && bankSearch.trim() && !showAddBankInput && (
                                                <div className="bank-logo-empty">
                                                    <span>No banks match "{bankSearch}"</span>
                                                    <button type="button" className="bank-logo-add-btn" onClick={() => { setNewBankName(bankSearch.trim()); setShowAddBankInput(true); }}>
                                                        <Plus size={14} /> Add "{bankSearch.trim()}"
                                                    </button>
                                                </div>
                                            )}
                                            {showAddBankInput && (
                                                <div className="bank-logo-add-form">
                                                    <input
                                                        className="input"
                                                        placeholder="Bank name"
                                                        value={newBankName}
                                                        onChange={e => setNewBankName(e.target.value)}
                                                        autoFocus
                                                    />
                                                    <button type="button" className="btn btn-primary btn-sm" onClick={() => {
                                                        const bank = saveCustomBank(newBankName);
                                                        if (bank) {
                                                            setForm(f => ({ ...f, icon: bank.id, color: bank.color }));
                                                            setCustomBankTick(t => t + 1);
                                                            setShowBankPicker(false);
                                                            setShowAddBankInput(false);
                                                            setBankSearch('');
                                                            setNewBankName('');
                                                            addToast(`"${bank.name}" added`);
                                                        }
                                                    }}>Save</button>
                                                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setShowAddBankInput(false); setNewBankName(''); }}>Cancel</button>
                                                </div>
                                            )}
                                        </div>
                                        );
                                    })()}
                                </div>
                                <div className="input-group">
                                    <label className="input-label">Type</label>
                                    <select className="input" value={form.type} onChange={e => {
                                        if (e.target.value === '__add_type__') {
                                            setShowAddType(true);
                                            return;
                                        }
                                        setForm(f => ({ ...f, type: e.target.value }));
                                    }}>
                                        {accountTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                        <option value="__add_type__">+ Add Type</option>
                                    </select>
                                    {showAddType && (
                                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                            <input className="input" placeholder="New type name" value={newTypeName}
                                                onChange={e => setNewTypeName(e.target.value)}
                                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddType(); } }}
                                                autoFocus style={{ flex: 1 }} />
                                            <button type="button" className="btn btn-primary btn-sm" onClick={handleAddType}>Add</button>
                                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setShowAddType(false); setNewTypeName(''); }}>Cancel</button>
                                        </div>
                                    )}
                                </div>
                                {!editingAcc && (
                                    <div className="input-group">
                                        <label className="input-label">Initial Balance</label>
                                        <input type="text" inputMode="decimal" className="input" value={balanceInput} onChange={e => setBalanceInput(e.target.value.replace(/[^0-9.-]/g, ''))} placeholder="0" step="0.01" />
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">{editingAcc ? 'Update' : 'Create'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Add/Edit Subcategory Modal */}
            {showSubModal && subParentId && (
                <div className="modal-overlay" onClick={() => setShowSubModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-title">{editingSub ? 'Edit Subcategory' : 'Add Subcategory'}</div>
                            <button className="btn btn-ghost btn-sm" onClick={() => setShowSubModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleSubSubmit}>
                            <div className="modal-body">
                                <div className="input-group">
                                    <label className="input-label">Name</label>
                                    <input className="input" value={subForm.name} onChange={e => setSubForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. UPI (optional, uses type label if empty)" />
                                </div>
                                <div className="input-group">
                                    <label className="input-label">Type</label>
                                    <select className="input" value={subForm.type} onChange={e => setSubForm(f => ({ ...f, type: e.target.value }))}>
                                        {subcategoryTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                    </select>
                                    <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 6 }} onClick={addCustomSubcategoryType}>+ Add subcategory type</button>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowSubModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">{editingSub ? 'Update' : 'Add'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
