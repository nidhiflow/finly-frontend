import { useState, useEffect } from 'react';
import { Plus, Edit3, Trash2, ChevronLeft, ChevronRight, Sparkles, AlertTriangle, AlertOctagon, Wallet, Target, ArrowRight, TrendingDown } from 'lucide-react';
import { budgetsAPI, categoriesAPI, aiAPI } from '../services/api';
import { useApp } from '../context/AppContext';
import { getBudgetAlerts } from '../utils/budgetAlerts';

export default function Budget() {
    const [budgets, setBudgets] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingBudget, setEditingBudget] = useState(null);
    const [form, setForm] = useState({ category_id: '', amount: '', period: 'monthly' });
    const [suggestions, setSuggestions] = useState([]);
    const [suggestionsLoading, setSuggestionsLoading] = useState(false);
    const [suggestionsError, setSuggestionsError] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [budgetAlerts, setBudgetAlerts] = useState(null);
    const [showBudgetAlerts, setShowBudgetAlerts] = useState(() => {
        try {
            return sessionStorage.getItem('finly_hide_budget_alerts') !== '1';
        } catch {
            return true;
        }
    });
    const { addToast, formatCurrency } = useApp();

    // Month navigation
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const monthKey = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;
    const monthLabel = currentMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

    const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    const nextMonth = () => {
        // Allow navigating into future months so users can preview spending against the same budget plan.
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
    };

    useEffect(() => { loadData(); }, [monthKey]);

    const loadData = async () => {
        try {
            const [buds, cats] = await Promise.all([budgetsAPI.list({ month: monthKey }), categoriesAPI.list()]);
            setBudgets(buds);
            setBudgetAlerts(getBudgetAlerts(buds));
            setCategories(cats.filter(c => c.type === 'expense'));
        } catch { addToast('Failed to load budgets', 'error'); }
        finally { setLoading(false); }
    };


    const totalBudget = budgets.reduce((s, b) => s + parseFloat(b.amount || 0), 0);
    const totalSpent = budgets.reduce((s, b) => s + parseFloat(b.spent || 0), 0);
    const overallPct = totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100) : 0;
    const totalRemaining = Math.max(0, totalBudget - totalSpent);
    const leadBudget = budgets.reduce((best, budget) => {
        const pct = parseFloat(budget.amount) > 0 ? (parseFloat(budget.spent) / parseFloat(budget.amount)) * 100 : 0;
        if (!best || pct > best.pct) return { ...budget, pct };
        return best;
    }, null);
    const plannerCards = [
        {
            key: 'remaining',
            icon: Wallet,
            label: 'Budget left',
            value: formatCurrency(totalRemaining),
            note: totalBudget > 0 ? `${formatCurrency(totalSpent)} already spent from ${formatCurrency(totalBudget)} planned.` : 'Add budgets to start tracking your remaining plan.',
            tone: overallPct > 90 ? 'negative' : overallPct > 70 ? 'warning' : 'positive',
        },
        {
            key: 'pressure',
            icon: AlertTriangle,
            label: 'Pressure point',
            value: leadBudget ? `${leadBudget.category_icon} ${leadBudget.category_name}` : 'No budget pressure yet',
            note: leadBudget ? `${leadBudget.pct.toFixed(0)}% of this category budget is already used.` : 'Your categories are clear once budgets are added.',
            tone: leadBudget?.pct > 90 ? 'negative' : leadBudget?.pct > 70 ? 'warning' : 'neutral',
        },
        {
            key: 'planning',
            icon: Target,
            label: 'Planning mode',
            value: monthLabel,
            note: 'Move across months to plan ahead instead of only reacting to current spending.',
            tone: 'neutral',
        },
    ];

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const data = { ...form, amount: parseFloat(form.amount) };
            if (editingBudget) {
                await budgetsAPI.update(editingBudget.id, data);
                addToast('Budget updated');
            } else {
                await budgetsAPI.create(data);
                addToast('Budget created');
            }
            setShowModal(false);
            setEditingBudget(null);
            setForm({ category_id: '', amount: '', period: 'monthly' });
            loadData();
        } catch (err) { addToast(err.message, 'error'); }
    };

    const handleDelete = async (id) => {
        if (!confirm('Delete this budget?')) return;
        try {
            await budgetsAPI.delete(id);
            addToast('Budget deleted');
            loadData();
        } catch (err) { addToast(err.message, 'error'); }
    };

    const openEdit = (b) => {
        setEditingBudget(b);
        setForm({ category_id: b.category_id, amount: String(b.amount), period: b.period });
        setShowModal(true);
    };

    const applySuggestion = (suggestion) => {
        const existingBudget = budgets.find((budget) => budget.category_id === suggestion.categoryId && budget.period === 'monthly');
        if (existingBudget) {
            setEditingBudget(existingBudget);
            setForm({
                category_id: existingBudget.category_id,
                amount: String(suggestion.suggestedAmount ?? existingBudget.amount ?? ''),
                period: existingBudget.period,
            });
        } else {
            setEditingBudget(null);
            setForm({
                category_id: suggestion.categoryId || '',
                amount: String(suggestion.suggestedAmount ?? ''),
                period: 'monthly',
            });
        }
        setShowModal(true);
        setShowSuggestions(false);
    };

    if (loading) return <div className="loading-spinner" />;

    return (
        <div className="fade-in page-stack budget-page">
            <div className="card page-toolbar-card">
                <div className="page-toolbar-header">
                    <div>
                        <div className="dashboard-section-kicker">Budget</div>
                        <div className="dashboard-section-title">Budget planning</div>
                        <div className="dashboard-section-note">Track category limits, get planning help, and catch risky spending early.</div>
                    </div>
                    <div className="page-toolbar-actions">
                        <button className="btn btn-secondary btn-sm" onClick={() => setCurrentMonth(new Date())}>This month</button>
                    </div>
                </div>
                <div className="dashboard-date-nav" style={{ justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <button className="btn btn-ghost btn-icon" onClick={prevMonth}><ChevronLeft size={20} /></button>
                        <span className="month-nav-label" style={{ fontSize: 15, fontWeight: 600, minWidth: 140, textAlign: 'center' }}>{monthLabel}</span>
                        <button className="btn btn-ghost btn-icon" onClick={nextMonth}>
                            <ChevronRight size={20} />
                        </button>
                    </div>
                </div>
                <div className="dashboard-section-note" style={{ marginTop: 10 }}>
                    The selected month changes the spending review window. Saved budgets stay tied to the category and period you choose.
                </div>
            </div>

            {/* Budget Alerts */}
            {budgetAlerts?.hasAlerts && showBudgetAlerts && (
                <div className="card" style={{ marginBottom: 16, padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, gap: 8, justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <AlertTriangle size={18} style={{ color: 'var(--warning)' }} />
                            <div style={{ fontWeight: 600, fontSize: 14 }}>Smart budget alerts</div>
                        </div>
                        <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            style={{ padding: 4 }}
                            onClick={() => {
                                setShowBudgetAlerts(false);
                                try {
                                    sessionStorage.setItem('finly_hide_budget_alerts', '1');
                                } catch { }
                            }}
                            title="Hide budget alerts for now"
                        >
                            <AlertOctagon size={14} />
                        </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {budgetAlerts.criticalAlerts.map((a) => (
                            <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, padding: '6px 8px', borderRadius: 8, background: 'var(--danger-soft)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <AlertOctagon size={16} style={{ color: 'var(--danger)' }} />
                                    <span>{a.icon} {a.name}</span>
                                </div>
                                <span style={{ fontWeight: 600 }}>Over budget · {a.pct.toFixed(0)}%</span>
                            </div>
                        ))}
                        {budgetAlerts.warningAlerts.map((a) => (
                            <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, padding: '6px 8px', borderRadius: 8, background: 'var(--warning-soft)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <AlertTriangle size={16} style={{ color: 'var(--warning)' }} />
                                    <span>{a.icon} {a.name}</span>
                                </div>
                                <span style={{ fontWeight: 600 }}>Close to budget · {a.pct.toFixed(0)}%</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="card budget-overview-hero">
                <div className="budget-overview-head">
                    <div>
                        <div className="dashboard-section-kicker">Plan overview</div>
                        <div className="budget-overview-value">
                            {formatCurrency(totalSpent)}
                            <span> / {formatCurrency(totalBudget)}</span>
                        </div>
                        <div className="budget-overview-note">
                            {totalBudget > 0
                                ? `${overallPct.toFixed(0)}% of the total plan is already used in ${monthLabel}.`
                                : `No budgets are planned for ${monthLabel} yet.`}
                        </div>
                    </div>
                    <div className="budget-overview-score" style={{ color: overallPct > 90 ? 'var(--danger)' : overallPct > 70 ? 'var(--warning)' : 'var(--income)' }}>
                        {overallPct.toFixed(0)}%
                    </div>
                </div>
                <div className="budget-progress-track budget-overview-track">
                    <div className="budget-progress-bar" style={{
                        width: `${overallPct}%`,
                        background: overallPct > 90 ? 'var(--danger)' : overallPct > 70 ? 'var(--warning)' : 'var(--income)',
                        height: 12,
                    }} />
                </div>
                <div className="budget-overview-metrics">
                    <div className="mini-metric">
                        <span className="mini-metric-label">Budget left</span>
                        <strong>{formatCurrency(totalRemaining)}</strong>
                    </div>
                    <div className="mini-metric">
                        <span className="mini-metric-label">Active budgets</span>
                        <strong>{budgets.length}</strong>
                    </div>
                    <div className="mini-metric">
                        <span className="mini-metric-label">Alerts</span>
                        <strong>{(budgetAlerts?.criticalAlerts?.length || 0) + (budgetAlerts?.warningAlerts?.length || 0)}</strong>
                    </div>
                </div>
            </div>

            <div className="dashboard-planner-grid">
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

            <div className="card page-toolbar-card" style={{ padding: 16 }}>
                <div className="page-toolbar-header">
                <div>
                    <div className="page-toolbar-subtitle">Category budgets</div>
                    <div className="dashboard-section-note">Review category performance or update the recurring limits that guide this plan.</div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button className="btn btn-secondary btn-sm" disabled={suggestionsLoading} onClick={async () => {
                        setSuggestionsLoading(true);
                        setSuggestions([]);
                        setSuggestionsError('');
                        setShowSuggestions(true);
                        try {
                            const { suggestions: list } = await aiAPI.getBudgetSuggestions({ month: monthKey });
                            setSuggestions(Array.isArray(list) ? list : []);
                        } catch (err) {
                            const message = err?.message || 'Failed to get suggestions';
                            addToast(message, 'error');
                            setSuggestionsError(message);
                            setSuggestions([]);
                        } finally {
                            setSuggestionsLoading(false);
                        }
                    }}>
                        <Sparkles size={14} /> {suggestionsLoading ? 'Loading...' : 'Get AI plan'}
                    </button>
                    <button className="btn btn-primary btn-sm" onClick={() => { setEditingBudget(null); setForm({ category_id: '', amount: '', period: 'monthly' }); setShowModal(true); }}>
                        <Plus size={16} /> Add Budget
                    </button>
                </div>
                </div>
            </div>

            {showSuggestions && (
                <div className="card budget-suggestions-card">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--accent-primary)', display: 'inline-flex', alignItems: 'center', gap: 8 }}><Sparkles size={16} /> Finly AI budget guide</span>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setShowSuggestions(false); setSuggestions([]); setSuggestionsError(''); }}>Close</button>
                    </div>
                    {suggestionsLoading ? (
                        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Reviewing recent spending and preparing budget guidance...</p>
                    ) : suggestionsError ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', borderRadius: 10, background: 'var(--danger-soft)', color: 'var(--danger)' }}>
                                <AlertTriangle size={16} />
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: 13 }}>Budget guidance is unavailable right now</div>
                                    <div style={{ fontSize: 12 }}>{suggestionsError}</div>
                                </div>
                            </div>
                            <button type="button" className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }} onClick={async () => {
                                setSuggestionsLoading(true);
                                setSuggestions([]);
                                setSuggestionsError('');
                                try {
                                    const { suggestions: list } = await aiAPI.getBudgetSuggestions({ month: monthKey });
                                    setSuggestions(Array.isArray(list) ? list : []);
                                } catch (err) {
                                    const message = err?.message || 'Failed to get suggestions';
                                    addToast(message, 'error');
                                    setSuggestionsError(message);
                                } finally {
                                    setSuggestionsLoading(false);
                                }
                            }}>
                                Try again
                            </button>
                        </div>
                    ) : suggestions.length === 0 ? (
                        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No guidance yet. Add a bit more spending history so Finly can suggest realistic category limits.</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {suggestions.map((s, i) => (
                                <div key={s.categoryId || i} className="budget-guidance-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg-input)', borderRadius: 8 }}>
                                    <div className="budget-guidance-copy">
                                        <div style={{ fontWeight: 600, fontSize: 13 }}>{s.categoryName || 'Category'}</div>
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.reason || ''}</div>
                                    </div>
                                    <div className="budget-guidance-actions" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ fontWeight: 700 }}>{formatCurrency(s.suggestedAmount ?? 0)}</span>
                                        <button type="button" className="btn btn-primary btn-sm" onClick={() => applySuggestion(s)}>Apply</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {budgets.length > 0 ? (
                <div className="budget-planning-grid">
                    {budgets.map(b => {
                        const pct = parseFloat(b.amount) > 0 ? Math.min((parseFloat(b.spent) / parseFloat(b.amount)) * 100, 100) : 0;
                        const color = pct > 90 ? 'var(--danger)' : pct > 70 ? 'var(--warning)' : 'var(--income)';
                        return (
                            <div key={b.id} className="budget-item budget-planning-card">
                                <div className="budget-header">
                                    <div className="budget-info">
                                        <span style={{ fontSize: 24 }}>{b.category_icon}</span>
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: 14 }}>{b.category_name}</div>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{b.period}</div>
                                        </div>
                                    </div>
                                    <div className="budget-header-actions" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ fontSize: 14, fontWeight: 700, color }}>{pct.toFixed(0)}%</span>
                                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(b)}><Edit3 size={14} /></button>
                                        <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(b.id)} style={{ color: 'var(--danger)' }}>
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                                <div className="budget-progress-track">
                                    <div className="budget-progress-bar" style={{ width: `${pct}%`, background: color }} />
                                </div>
                                <div className="budget-amounts">
                                    <span>{formatCurrency(b.spent)} spent</span>
                                    <span>{formatCurrency(b.remaining)} remaining</span>
                                </div>
                                <div className="budget-planning-note">
                                    {pct > 90
                                        ? 'This category needs attention now to avoid overruns.'
                                        : pct > 70
                                            ? 'You are entering the watch zone for this category.'
                                            : 'This category is still tracking within the plan.'}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="empty-state">
                    <div className="empty-state-icon" style={{ fontSize: 36 }}>📊</div>
                    <h3>No budgets set</h3>
                    <p>Create budgets to track your spending limits</p>
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-title">{editingBudget ? 'Edit Budget' : 'Add Budget'}</div>
                            <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                <div className="input-group">
                                    <label className="input-label">Category</label>
                                    <select className="input" value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))} required>
                                        <option value="">Select category</option>
                                        {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                                    </select>
                                </div>
                                <div className="input-group">
                                    <label className="input-label">Budget Amount</label>
                                    <input type="number" className="input" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required placeholder="0" step="0.01" />
                                </div>
                                <div className="input-group">
                                    <label className="input-label">Period</label>
                                    <select className="input" value={form.period} onChange={e => setForm(f => ({ ...f, period: e.target.value }))}>
                                        <option value="weekly">Weekly</option>
                                        <option value="monthly">Monthly</option>
                                        <option value="yearly">Yearly</option>
                                    </select>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">{editingBudget ? 'Update' : 'Create'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
