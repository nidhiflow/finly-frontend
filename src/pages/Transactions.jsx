import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, Trash2, Filter, Bookmark, Save, ChevronDown, X, Repeat, Clock3, TrendingUp, TrendingDown, ArrowRight, Sparkles, PiggyBank, ArrowLeftRight } from 'lucide-react';
import { transactionsAPI, categoriesAPI, accountsAPI, bookmarksAPI } from '../services/api';
import { useApp } from '../context/AppContext';
import { useIsMobile } from '../hooks/useIsMobile';

export default function Transactions() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [transactions, setTransactions] = useState([]);
    const [categories, setCategories] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const PRESETS_KEY = 'finly_filter_presets';
    const loadPresets = () => {
        try {
            const raw = localStorage.getItem(PRESETS_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch { return []; }
    };
    const [filterPresets, setFilterPresets] = useState(loadPresets);
    const [showPresetsDropdown, setShowPresetsDropdown] = useState(false);
    const presetsRef = useRef(null);
    useEffect(() => {
        const handler = (e) => { if (presetsRef.current && !presetsRef.current.contains(e.target)) setShowPresetsDropdown(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const [filters, setFilters] = useState({ type: '', categoryId: '', accountId: '', search: '', startDate: '', endDate: '' });
    const [showFilters, setShowFilters] = useState(false);
    const [mobilePanel, _setMobilePanel] = useState('');
    const [bookmarkedIds, setBookmarkedIds] = useState(new Set());
    const [bookmarkedTransactions, setBookmarkedTransactions] = useState([]);
    const [upcomingRecurring, setUpcomingRecurring] = useState([]);
    const [suggestions, setSuggestions] = useState([]);
    const { addToast, formatCurrency } = useApp();
    const navigate = useNavigate();
    const isMobile = useIsMobile();

    useEffect(() => {
        const type = searchParams.get('type') || '';
        const categoryId = searchParams.get('categoryId') || '';
        const accountId = searchParams.get('accountId') || '';
        const search = searchParams.get('search') || '';
        const startDate = searchParams.get('startDate') || '';
        const endDate = searchParams.get('endDate') || '';

        if (type || categoryId || accountId || search || startDate || endDate) {
            setFilters({ type, categoryId, accountId, search, startDate, endDate });
            setShowFilters(!!(type || categoryId || accountId || startDate || endDate));
        }
        // We only want to read initial params on first mount
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const syncFiltersToUrl = (newFilters) => {
        const params = {};
        if (newFilters.type) params.type = newFilters.type;
        if (newFilters.categoryId) params.categoryId = newFilters.categoryId;
        if (newFilters.accountId) params.accountId = newFilters.accountId;
        if (newFilters.search) params.search = newFilters.search;
        if (newFilters.startDate) params.startDate = newFilters.startDate;
        if (newFilters.endDate) params.endDate = newFilters.endDate;
        setSearchParams(params);
    };

    const hasActiveFilters = !!(filters.type || filters.categoryId || filters.accountId || filters.search || filters.startDate || filters.endDate);
    const saveCurrentAsPreset = () => {
        const name = window.prompt('Name this filter preset', '');
        if (!name?.trim()) return;
        const id = `p_${Date.now()}`;
        const preset = { id, name: name.trim(), filters: { ...filters } };
        const next = [preset, ...filterPresets].slice(0, 10);
        setFilterPresets(next);
        localStorage.setItem(PRESETS_KEY, JSON.stringify(next));
        addToast('Preset saved');
        setShowPresetsDropdown(false);
    };
    const applyPreset = (preset) => {
        setFilters(preset.filters);
        syncFiltersToUrl(preset.filters);
        setShowFilters(true);
        setShowPresetsDropdown(false);
    };
    const deletePreset = (e, id) => {
        e.stopPropagation();
        const next = filterPresets.filter(p => p.id !== id);
        setFilterPresets(next);
        localStorage.setItem(PRESETS_KEY, JSON.stringify(next));
        addToast('Preset removed');
    };

    const loadData = useCallback(async () => {
        try {
            await transactionsAPI.processRecurring().catch(() => {});
            const apiParams = {};
            if (filters.type) apiParams.type = filters.type;
            if (filters.categoryId) apiParams.categoryId = filters.categoryId;
            if (filters.accountId) apiParams.accountId = filters.accountId;
            if (filters.search) apiParams.search = filters.search;
            if (filters.startDate) apiParams.startDate = filters.startDate;
            if (filters.endDate) apiParams.endDate = filters.endDate;
            const [tx, cats, accs, bIds, bookmarkedList, recurring, smartSuggestions] = await Promise.all([
                transactionsAPI.list(apiParams),
                categoriesAPI.list(),
                accountsAPI.list(),
                bookmarksAPI.getIds(),
                bookmarksAPI.list().catch(() => []),
                transactionsAPI.getUpcomingRecurring().catch(() => []),
                transactionsAPI.getSuggestions().catch(() => []),
            ]);
            setTransactions(tx);
            setCategories(cats);
            setAccounts(accs);
            setBookmarkedIds(new Set(bIds));
            setBookmarkedTransactions(Array.isArray(bookmarkedList) ? bookmarkedList : []);
            setUpcomingRecurring(Array.isArray(recurring) ? recurring : []);
            setSuggestions(Array.isArray(smartSuggestions) ? smartSuggestions : []);
        } catch { addToast('Failed to load transactions', 'error'); }
        finally { setLoading(false); }
    }, [filters.type, filters.categoryId, filters.accountId, filters.search, filters.startDate, filters.endDate, addToast]);

    useEffect(() => { loadData(); }, [loadData]);

    const handleDelete = async (id, e) => {
        e.stopPropagation();
        if (!confirm('Delete this transaction?')) return;
        try {
            await transactionsAPI.delete(id);
            setTransactions(prev => prev.filter(t => t.id !== id));
            addToast('Transaction deleted');
        } catch { addToast('Failed to delete', 'error'); }
    };

    const toggleBookmark = async (id, e) => {
        e.stopPropagation();
        try {
            if (bookmarkedIds.has(id)) {
                await bookmarksAPI.remove(id);
                setBookmarkedIds(prev => { const s = new Set(prev); s.delete(id); return s; });
                setBookmarkedTransactions(prev => prev.filter(tx => tx.id !== id));
                addToast('Bookmark removed');
            } else {
                await bookmarksAPI.add(id);
                setBookmarkedIds(prev => new Set(prev).add(id));
                const selected = transactions.find(tx => tx.id === id);
                if (selected) {
                    setBookmarkedTransactions(prev => {
                        if (prev.some(tx => tx.id === id)) return prev;
                        return [{ ...selected }, ...prev];
                    });
                }
                addToast('Transaction bookmarked');
            }
        } catch { addToast('Failed to update bookmark', 'error'); }
    };

    const handleTurnOffRepeat = async (id, e) => {
        e.stopPropagation();
        try {
            await transactionsAPI.turnOffRepeat(id);
            await loadData();
            addToast('Repeat turned off');
        } catch { addToast('Failed to turn off repeat', 'error'); }
    };

    const removeBookmarkFromPanel = async (txId, e) => {
        e.stopPropagation();
        try {
            await bookmarksAPI.remove(txId);
            setBookmarkedIds(prev => {
                const next = new Set(prev);
                next.delete(txId);
                return next;
            });
            setBookmarkedTransactions(prev => prev.filter(tx => tx.id !== txId));
            addToast('Bookmark removed');
        } catch {
            addToast('Failed to update bookmark', 'error');
        }
    };

    // Group by date (transactions are already filtered by API when params provided)
    const grouped = {};
    transactions.forEach(tx => {
        const key = tx.date;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(tx);
    });


    const formatDate = (dateStr) => {
        const d = new Date(dateStr);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (d.toDateString() === today.toDateString()) return 'Today';
        if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
        return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    };

    if (loading) return <div className="loading-spinner" />;

    const hasTransactions = Object.keys(grouped).length > 0;
    const incomeTotal = transactions.reduce((sum, tx) => sum + (tx.type === 'income' ? Number(tx.amount) || 0 : 0), 0);
    const expenseTotal = transactions.reduce((sum, tx) => sum + (tx.type === 'expense' ? Number(tx.amount) || 0 : 0), 0);
    const transferTotal = transactions.reduce((sum, tx) => sum + (tx.type === 'transfer' ? Number(tx.amount) || 0 : 0), 0);
    const savingsTotal = incomeTotal - expenseTotal;
    const incomeCount = transactions.filter(tx => tx.type === 'income').length;
    const expenseCount = transactions.filter(tx => tx.type === 'expense').length;
    const transferCount = transactions.filter(tx => tx.type === 'transfer').length;
    const activeFilterCount = [filters.type, filters.categoryId, filters.accountId, filters.startDate, filters.endDate].filter(Boolean).length;
    const reviewCards = [
        {
            key: 'income',
            className: 'income',
            icon: TrendingUp,
            label: 'Income in view',
            value: formatCurrency(incomeTotal),
            helper: `${incomeCount} income transaction${incomeCount === 1 ? '' : 's'}`,
        },
        {
            key: 'expense',
            className: 'expense',
            icon: TrendingDown,
            label: 'Expenses in view',
            value: formatCurrency(expenseTotal),
            helper: `${expenseCount} expense transaction${expenseCount === 1 ? '' : 's'}`,
        },
        {
            key: 'savings',
            className: 'savings',
            icon: PiggyBank,
            label: 'Savings in view',
            value: formatCurrency(savingsTotal),
            helper: savingsTotal >= 0 ? 'Income still stays ahead of spending' : 'Spending is above income in this view',
        },
        {
            key: 'transfer',
            className: 'transfer',
            icon: ArrowLeftRight,
            label: 'Transfers in view',
            value: formatCurrency(transferTotal),
            helper: `${transferCount} transfer${transferCount === 1 ? '' : 's'} in this view`,
        },
    ];

    return (
        <div className={`fade-in page-stack transactions-page${isMobile ? ' transactions-page--mobile-ledger' : ''}`}>
            {isMobile ? (
                <>
                    {/* Mobile: Compact type tabs + search */}
                    <div className="mv2-tx-toolbar">
                        <div className="mv2-tx-type-tabs">
                            {[
                                { value: '', label: 'All' },
                                { value: 'income', label: 'Income' },
                                { value: 'expense', label: 'Expense' },
                                { value: 'transfer', label: 'Transfer' },
                            ].map((tab) => (
                                <button
                                    key={tab.value || 'all'}
                                    type="button"
                                    className={`mv2-tx-type-tab ${filters.type === tab.value ? 'active' : ''}`}
                                    onClick={() => {
                                        const next = { ...filters, type: tab.value };
                                        setFilters(next);
                                        syncFiltersToUrl(next);
                                    }}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                        <div className="mv2-tx-search-row">
                            <div className="mv2-tx-search">
                                <Search size={16} />
                                <input
                                    className="mv2-tx-search-input"
                                    placeholder="Search notes..."
                                    value={filters.search}
                                    onChange={(e) => {
                                        const next = { ...filters, search: e.target.value };
                                        setFilters(next);
                                        syncFiltersToUrl(next);
                                    }}
                                />
                                {filters.search && (
                                    <button className="mv2-tx-search-clear" onClick={() => { const next = { ...filters, search: '' }; setFilters(next); syncFiltersToUrl(next); }}>
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                            <button type="button" className={`mv2-tx-filter-btn ${showFilters ? 'active' : ''}`} onClick={() => setShowFilters(!showFilters)}>
                                <Filter size={16} />
                                {activeFilterCount > 0 && <span className="mv2-tx-filter-badge">{activeFilterCount}</span>}
                            </button>
                        </div>
                    </div>

                    {/* Mobile: Compact summary chips */}
                    <div className="mv2-tx-summary-scroll">
                        <div className="mv2-tx-summary-chip income"><TrendingUp size={12} /> {formatCurrency(incomeTotal)}</div>
                        <div className="mv2-tx-summary-chip expense"><TrendingDown size={12} /> {formatCurrency(expenseTotal)}</div>
                        <div className="mv2-tx-summary-chip savings"><PiggyBank size={12} /> {formatCurrency(savingsTotal)}</div>
                        <div className="mv2-tx-summary-chip">{transactions.length} items</div>
                    </div>
                </>
            ) : (
            <>
            <div className="card page-toolbar-card">
                <div className="page-toolbar-header">
                    <div>
                        <div className="dashboard-section-kicker">Transactions</div>
                        <div className="dashboard-section-title">Your money timeline</div>
                        <div className="dashboard-section-note">
                            {hasTransactions ? `${transactions.length} transaction${transactions.length !== 1 ? 's' : ''} in this view.` : 'Track, search, and manage every transaction in one place.'}
                        </div>
                    </div>
                    <div className="page-toolbar-actions">
                        <button className="btn btn-secondary btn-sm" onClick={() => setShowFilters(!showFilters)}>
                            <Filter size={16} /> Filters
                        </button>
                        <button className="btn btn-primary btn-sm" onClick={() => navigate('/add')}>
                            <Plus size={16} /> Add
                        </button>
                    </div>
                </div>
                <div className="filter-bar transactions-toolbar-row" style={{ marginBottom: 0 }}>
                    <div className="search-input-wrapper transactions-search-box">
                    <Search size={18} />
                    <input className="input" placeholder="Search notes..." value={filters.search}
                        onChange={e => { const next = { ...filters, search: e.target.value }; setFilters(next); syncFiltersToUrl(next); }} />
                </div>
                <div className="transactions-presets" ref={presetsRef}>
                    <button className="btn btn-secondary btn-sm transactions-presets-trigger" onClick={() => setShowPresetsDropdown(!showPresetsDropdown)} title="Saved filter presets">
                        <Save size={16} /> Saved <ChevronDown size={14} style={{ opacity: 0.8 }} />
                    </button>
                    {showPresetsDropdown && (
                        <div className="transactions-presets-dropdown">
                            {hasActiveFilters && (
                                <button type="button" className="btn btn-primary btn-sm transactions-presets-save" onClick={saveCurrentAsPreset}>
                                    <Save size={14} /> Save current filters
                                </button>
                            )}
                            {filterPresets.length === 0 ? (
                                <div className="transactions-presets-empty">No saved presets. Set filters and save.</div>
                            ) : (
                                filterPresets.map(p => (
                                    <div key={p.id} className="transactions-preset-item"
                                        onClick={() => applyPreset(p)} onKeyDown={e => e.key === 'Enter' && applyPreset(p)} role="button" tabIndex={0}>
                                        <span className="transactions-preset-name">{p.name}</span>
                                        <button type="button" className="btn btn-ghost btn-sm transactions-preset-delete" onClick={(e) => deletePreset(e, p.id)} title="Remove preset">
                                            <X size={14} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>
            </div>
            </>
            )}

            {showFilters && (
                <div className="card filter-panel-card slide-up">
                    <div className="page-toolbar-subtitle">Filter this list</div>
                    <div className="filter-bar" style={{ marginBottom: 0 }}>
                    <select className="input" value={filters.type} onChange={e => { const next = { ...filters, type: e.target.value }; setFilters(next); syncFiltersToUrl(next); }}>
                        <option value="">All Types</option>
                        <option value="income">Income</option>
                        <option value="expense">Expense</option>
                        <option value="transfer">Transfer</option>
                    </select>
                    <select className="input" value={filters.categoryId} onChange={e => { const next = { ...filters, categoryId: e.target.value }; setFilters(next); syncFiltersToUrl(next); }}>
                        <option value="">All Categories</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                    </select>
                    <select className="input" value={filters.accountId} onChange={e => { const next = { ...filters, accountId: e.target.value }; setFilters(next); syncFiltersToUrl(next); }}>
                        <option value="">All Accounts</option>
                        {accounts.map(a => <option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}
                    </select>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                        <span style={{ color: 'var(--text-muted)' }}>From</span>
                        <input type="date" className="input" style={{ width: 'auto', padding: '6px 10px', fontSize: 13 }}
                            value={filters.startDate} onChange={e => { const next = { ...filters, startDate: e.target.value }; setFilters(next); syncFiltersToUrl(next); }} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                        <span style={{ color: 'var(--text-muted)' }}>To</span>
                        <input type="date" className="input" style={{ width: 'auto', padding: '6px 10px', fontSize: 13 }}
                            value={filters.endDate} onChange={e => { const next = { ...filters, endDate: e.target.value }; setFilters(next); syncFiltersToUrl(next); }} />
                    </div>
                    <button className="btn btn-ghost btn-sm" onClick={() => { const next = { type: '', categoryId: '', accountId: '', search: '', startDate: '', endDate: '' }; setFilters(next); syncFiltersToUrl(next); }}>Clear</button>
                </div>
                </div>
            )}

            {!isMobile && (
            <div className="stats-grid transactions-review-stats">
                {reviewCards.map((card) => {
                    const Icon = card.icon;
                    return (
                        <div key={card.key} className={`stat-card ${card.className}`}>
                            <div className="stat-card-icon"><Icon size={22} /></div>
                            <div className="stat-card-label">{card.label}</div>
                            <div className="stat-card-value">{card.value}</div>
                            <div className="stat-card-helper">{card.helper}</div>
                        </div>
                    );
                })}
            </div>
            )}

            {!isMobile && (
            <div className="dashboard-planner-grid transactions-review-planner">
                <div className={`planner-card ${hasActiveFilters ? 'warning' : 'neutral'}`}>
                    <div className="planner-card-top">
                        <span className="planner-card-icon"><Filter size={18} /></span>
                        <span className="planner-card-label">Review filters</span>
                    </div>
                    <div className="planner-card-value">{activeFilterCount} active filters</div>
                    <div className="planner-card-note">
                        {hasActiveFilters ? 'This timeline is narrowed to a focused review window.' : 'You are seeing the full transaction timeline right now.'}
                    </div>
                </div>
                <div className={`planner-card ${bookmarkedTransactions.length > 0 ? 'positive' : 'neutral'}`}>
                    <div className="planner-card-top">
                        <span className="planner-card-icon"><Bookmark size={18} /></span>
                        <span className="planner-card-label">Saved for later</span>
                    </div>
                    <div className="planner-card-value">{bookmarkedTransactions.length} bookmarks</div>
                    <div className="planner-card-note">Pin repeat purchases or common entries so you can re-add them faster.</div>
                </div>
                <div className={`planner-card ${upcomingRecurring.length > 0 ? 'warning' : 'neutral'}`}>
                    <div className="planner-card-top">
                        <span className="planner-card-icon"><Clock3 size={18} /></span>
                        <span className="planner-card-label">Recurring review</span>
                    </div>
                    <div className="planner-card-value">{upcomingRecurring.length} upcoming</div>
                    <div className="planner-card-note">Review scheduled transactions before they affect your balance.</div>
                </div>
            </div>
            )}

            {isMobile && mobilePanel && (
                <div className="card transactions-mobile-panel">
                    {mobilePanel === 'bookmarks' && (
                        <>
                            <div className="card-header">
                                <div>
                                    <div className="card-title">Bookmarked transactions</div>
                                    <div className="card-subtitle">Re-add or review your saved entries quickly.</div>
                                </div>
                            </div>
                            {bookmarkedTransactions.length > 0 ? (
                                <div className="bookmarks-list" style={{ padding: 0 }}>
                                    {bookmarkedTransactions.slice(0, 4).map(tx => (
                                        <div key={tx.bookmark_id || tx.id} className="bookmarks-item" onClick={() => navigate(`/add?edit=${tx.id}`)}>
                                            <div className="bookmarks-item-icon" style={{ background: tx.category_color ? `${tx.category_color}20` : 'var(--bg-input)' }}>
                                                {tx.category_icon || '💸'}
                                            </div>
                                            <div className="bookmarks-item-info">
                                                <div className="bookmarks-item-name">{tx.category_name || tx.type}</div>
                                                <div className="bookmarks-item-note">{tx.note || tx.date}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="transactions-side-empty">No bookmarked transactions yet.</div>
                            )}
                        </>
                    )}
                    {mobilePanel === 'recurring' && (
                        <>
                            <div className="card-header">
                                <div>
                                    <div className="card-title">Upcoming recurring</div>
                                    <div className="card-subtitle">Check the scheduled items before they land.</div>
                                </div>
                            </div>
                            {upcomingRecurring.length > 0 ? (
                                <div className="transactions-mini-list">
                                    {upcomingRecurring.slice(0, 4).map(tx => (
                                        <button key={tx.id} type="button" className="transactions-mini-item" onClick={() => navigate(`/add?edit=${tx.id}`)}>
                                            <div className="transactions-mini-item-top">
                                                <span>{tx.category_icon || (tx.type === 'income' ? '💰' : '💸')} {tx.category_name || tx.type}</span>
                                                <strong className={`tx-amount ${tx.type}`}>{tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}</strong>
                                            </div>
                                            <div className="transactions-mini-item-note">{tx.note || tx.date}</div>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="transactions-side-empty">No recurring items scheduled right now.</div>
                            )}
                        </>
                    )}
                    {mobilePanel === 'suggestions' && (
                        <>
                            <div className="card-header">
                                <div>
                                    <div className="card-title">Smart quick add</div>
                                    <div className="card-subtitle">Use your recent patterns instead of filling everything again.</div>
                                </div>
                            </div>
                            {suggestions.length > 0 ? (
                                <div className="dashboard-chip-list">
                                    {suggestions.slice(0, 6).map((s, i) => (
                                        <button
                                            key={i}
                                            type="button"
                                            className="dashboard-data-chip"
                                            onClick={() => navigate(`/add?prefill=${encodeURIComponent(JSON.stringify({ type: s.type || 'expense', category_id: s.categoryId || '', account_id: s.accountId || '', amount: s.amount || '', note: '' }))}`)}
                                        >
                                            <span>{s.categoryIcon || '📦'} {formatCurrency(s.amount)}</span>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="transactions-side-empty">Add a few more transactions to unlock smarter quick-fill suggestions.</div>
                            )}
                        </>
                    )}
                </div>
            )}

            <div className="transactions-workspace">
                <div className="transactions-main-column">
                    {!isMobile && (
                    <div className="dashboard-section-heading">
                        <div>
                            <div className="dashboard-section-kicker">Timeline</div>
                            <div className="dashboard-section-title">Your transaction ledger</div>
                            <div className="dashboard-section-note">A date-grouped review of everything in the current view.</div>
                        </div>
                    </div>
                    )}

                    {hasTransactions ? (
                        Object.entries(grouped).map(([date, txs]) => (
                            <div key={date} className="tx-date-group">
                                <div className="tx-date-label">{formatDate(date)}</div>
                                <div className="tx-list">
                                    {txs.map(tx => (
                                        <div key={tx.id} className="tx-item" onClick={() => navigate(`/add?edit=${tx.id}`)}>
                                            <div className="tx-icon" style={{ background: tx.category_color ? `${tx.category_color}20` : 'var(--bg-input)' }}>
                                                {tx.category_icon || (tx.type === 'transfer' ? '🔄' : tx.type === 'income' ? '💰' : '💸')}
                                            </div>
                                            <div className="tx-info">
                                                <div className="tx-category">{tx.category_name || tx.type}</div>
                                                <div className="tx-note">
                                                    {tx.note || '—'}
                                                    {tx.repeat_group_id && (
                                                        <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--accent-primary)', fontWeight: 600 }}>Repeat</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="tx-item-actions">
                                                <div className="tx-item-amount-block">
                                                    <div className={`tx-amount ${tx.type}`}>
                                                        {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}{formatCurrency(tx.amount)}
                                                    </div>
                                                    <div className="tx-account">{tx.account_parent_name ? `${tx.account_parent_name}/${tx.account_name}` : tx.account_name}</div>
                                                </div>
                                                <button className={`btn btn-ghost btn-icon btn-sm bookmark-toggle ${bookmarkedIds.has(tx.id) ? 'active' : ''}`}
                                                    onClick={(e) => toggleBookmark(tx.id, e)}
                                                    title={bookmarkedIds.has(tx.id) ? 'Remove bookmark' : 'Bookmark'}
                                                    style={{ width: 32, height: 32 }}>
                                                    <Bookmark size={14} fill={bookmarkedIds.has(tx.id) ? 'var(--accent-primary)' : 'none'} />
                                                </button>
                                                {tx.repeat_group_id && (
                                                    <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); handleTurnOffRepeat(tx.id, e); }} title="Turn off repeat" style={{ fontSize: 11 }}>
                                                        Off
                                                    </button>
                                                )}
                                                <button className="btn btn-ghost btn-icon btn-sm" onClick={(e) => handleDelete(tx.id, e)}
                                                    style={{ color: 'var(--text-muted)', width: 32, height: 32 }}>
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="empty-state">
                            <div className="empty-state-icon" style={{ fontSize: 40 }}>🧾</div>
                            <h3>Nothing here yet</h3>
                            <p style={{ maxWidth: 360, margin: '4px auto 12px' }}>
                                Add your first transaction to see your daily timeline, smart filters, bookmarks, and more come alive.
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
                                <button className="btn btn-primary" onClick={() => navigate('/add')}>
                                    <Plus size={16} /> Add your first transaction
                                </button>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                    Tip: Use <strong>Ctrl+K</strong> to quickly search once you have data.
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {!isMobile && (
                <div className="transactions-side-column">
                    <div className="card transactions-side-card">
                        <div className="card-header">
                            <div>
                                <div className="card-title">Bookmarked transactions</div>
                                <div className="card-subtitle">Quick access to repeat entries and saved references.</div>
                            </div>
                            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/transactions')}>
                                Review <ArrowRight size={14} />
                            </button>
                        </div>
                        {bookmarkedTransactions.length > 0 ? (
                            <div className="bookmarks-list" style={{ padding: 0 }}>
                                {bookmarkedTransactions.slice(0, 5).map(tx => (
                                    <div key={tx.bookmark_id || tx.id} className="bookmarks-item" onClick={() => navigate(`/add?edit=${tx.id}`)}>
                                        <div className="bookmarks-item-icon" style={{ background: tx.category_color ? `${tx.category_color}20` : 'var(--bg-input)' }}>
                                            {tx.category_icon || '💸'}
                                        </div>
                                        <div className="bookmarks-item-info">
                                            <div className="bookmarks-item-name">{tx.category_name || tx.type}</div>
                                            <div className="bookmarks-item-note">{tx.note || tx.date} · {tx.account_parent_name ? `${tx.account_parent_name}/${tx.account_name}` : tx.account_name}</div>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                                            <div className={`bookmarks-item-amount ${tx.type}`}>
                                                {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                                            </div>
                                            <div style={{ display: 'flex', gap: 4 }}>
                                                <button className="bookmarks-readd" onClick={(e) => { e.stopPropagation(); navigate(`/add?prefill=${encodeURIComponent(JSON.stringify({ type: tx.type, category_id: tx.category_id, account_id: tx.account_id, amount: tx.amount, note: tx.note }))}`); }} title="Re-add this transaction">
                                                    <Plus size={12} />
                                                </button>
                                                <button className="bookmarks-remove" onClick={(e) => removeBookmarkFromPanel(tx.id, e)} title="Remove bookmark">
                                                    <X size={12} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="bookmarks-empty" style={{ paddingInline: 0 }}>
                                <Bookmark size={28} style={{ color: 'var(--text-muted)', marginBottom: 8 }} />
                                <p>No bookmarked transactions yet</p>
                            </div>
                        )}
                    </div>

                    <div className="card transactions-side-card">
                        <div className="card-header">
                            <div>
                                <div className="card-title">Upcoming recurring</div>
                                <div className="card-subtitle">Scheduled items to verify before they post.</div>
                            </div>
                            <Repeat size={18} style={{ color: 'var(--accent-primary)' }} />
                        </div>
                        {upcomingRecurring.length > 0 ? (
                            <div className="transactions-mini-list">
                                {upcomingRecurring.slice(0, 5).map(tx => (
                                    <button key={tx.id} type="button" className="transactions-mini-item" onClick={() => navigate(`/add?edit=${tx.id}`)}>
                                        <div className="transactions-mini-item-top">
                                            <span>{tx.category_icon || (tx.type === 'income' ? '💰' : '💸')} {tx.category_name || tx.type}</span>
                                            <strong className={`tx-amount ${tx.type}`}>{tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}</strong>
                                        </div>
                                        <div className="transactions-mini-item-note">{tx.note || tx.date}</div>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="transactions-side-empty">No recurring items scheduled right now.</div>
                        )}
                    </div>

                    <div className="card transactions-side-card">
                        <div className="card-header">
                            <div>
                                <div className="card-title">Smart quick add</div>
                                <div className="card-subtitle">Recent patterns you can reuse in one tap.</div>
                            </div>
                            <Sparkles size={18} style={{ color: 'var(--accent-primary)' }} />
                        </div>
                        {suggestions.length > 0 ? (
                            <div className="dashboard-chip-list">
                                {suggestions.slice(0, 6).map((s, i) => (
                                    <button
                                        key={i}
                                        type="button"
                                        className="dashboard-data-chip"
                                        onClick={() => navigate(`/add?prefill=${encodeURIComponent(JSON.stringify({ type: s.type || 'expense', category_id: s.categoryId || '', account_id: s.accountId || '', amount: s.amount || '', note: '' }))}`)}
                                    >
                                        <span>{s.categoryIcon || '📦'} {formatCurrency(s.amount)}</span>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="transactions-side-empty">Add a few more transactions to unlock smarter quick-fill suggestions.</div>
                        )}
                    </div>
                </div>
                )}
            </div>
        </div>
    );
}
