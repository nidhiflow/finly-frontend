import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit3, CalendarDays, Target, Wallet, ArrowRight, PiggyBank, Zap, Tag, Building2 } from 'lucide-react';
import { savingsGoalsAPI, categoriesAPI, accountsAPI } from '../services/api';
import { useApp } from '../context/AppContext';
import { useIsMobile } from '../hooks/useIsMobile';

export default function SavingsGoals() {
    const [goals, setGoals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingGoal, setEditingGoal] = useState(null);
    const [form, setForm] = useState({ name: '', target_amount: '', month: '', category_id: '', account_id: '', current_amount: '' });
    const [recordGoalId, setRecordGoalId] = useState(null);
    const [recordAmount, setRecordAmount] = useState('');
    const [categories, setCategories] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const { addToast, formatCurrency } = useApp();

    useEffect(() => {
        loadGoals();
    }, []);

    useEffect(() => {
        if (showModal) {
            Promise.all([categoriesAPI.list(), accountsAPI.list()])
                .then(([cats, accs]) => {
                    setCategories(Array.isArray(cats) ? cats : []);
                    setAccounts(Array.isArray(accs) ? accs : []);
                })
                .catch(() => {});
        }
    }, [showModal]);

    const loadGoals = async () => {
        try {
            const data = await savingsGoalsAPI.list();
            setGoals(data);
        } catch (err) {
            addToast('Failed to load savings goals', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                name: form.name.trim(),
                target_amount: parseFloat(form.target_amount),
                month: form.month || undefined,
                category_id: form.category_id || undefined,
                account_id: form.account_id || undefined,
            };
            if (editingGoal) {
                if (form.current_amount !== '' && form.current_amount !== undefined) {
                    const parsed = parseFloat(form.current_amount);
                    if (Number.isFinite(parsed) && parsed >= 0) payload.current_amount = parsed;
                }
                await savingsGoalsAPI.update(editingGoal.id, payload);
                addToast('Goal updated');
            } else {
                await savingsGoalsAPI.create(payload);
                addToast('Goal added');
            }
            setShowModal(false);
            setEditingGoal(null);
            setForm({ name: '', target_amount: '', month: '', category_id: '', account_id: '', current_amount: '' });
            loadGoals();
        } catch (err) {
            addToast(err?.message || 'Failed to save goal', 'error');
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Delete this savings goal?')) return;
        try {
            await savingsGoalsAPI.delete(id);
            addToast('Goal deleted');
            loadGoals();
        } catch (err) {
            addToast(err?.message || 'Failed to delete goal', 'error');
        }
    };

    const handleRecordSavings = async () => {
        const parsed = parseFloat(recordAmount);
        if (!Number.isFinite(parsed) || parsed <= 0) {
            addToast('Enter a valid positive amount', 'error');
            return;
        }
        try {
            await savingsGoalsAPI.recordSavings(recordGoalId, parsed);
            addToast(`Added ${parsed} to savings`);
            setRecordGoalId(null);
            setRecordAmount('');
            loadGoals();
        } catch (err) {
            addToast(err?.message || 'Failed to record savings', 'error');
        }
    };

    const trackingModeLabel = (g) => {
        const mode = g.tracking_mode;
        if (mode === 'auto_account_category') return { icon: Zap, text: 'Auto: Account + Category' };
        if (mode === 'auto_account') return { icon: Building2, text: 'Auto: Account' };
        if (mode === 'auto_category') return { icon: Tag, text: 'Auto: Category' };
        return { icon: PiggyBank, text: 'Manual tracking' };
    };

    const openNew = () => {
        setEditingGoal(null);
        setForm({ name: '', target_amount: '', month: '', category_id: '', account_id: '', current_amount: '' });
        setShowModal(true);
    };

    const openEdit = (g) => {
        setEditingGoal(g);
        setForm({
            name: g.name,
            target_amount: String(g.target_amount),
            month: g.month || '',
            category_id: g.category_id || '',
            account_id: g.account_id || '',
            current_amount: g.current_amount != null && g.current_amount !== '' ? String(g.current_amount) : '',
        });
        setShowModal(true);
    };

    const categoryOptions = (() => {
        const out = [{ id: '', label: 'None' }];
        (categories || []).forEach((main) => {
            if (!main.parent_id) {
                out.push({ id: main.id, label: main.name });
                (main.subcategories || []).forEach((sub) => {
                    out.push({ id: sub.id, label: `${main.name} › ${sub.name}` });
                });
            }
        });
        return out;
    })();

    if (loading) return <div className="loading-spinner" />;

    const totalTarget = goals.reduce((sum, goal) => sum + Number(goal.target_amount || 0), 0);
    const totalSaved = goals.reduce((sum, goal) => sum + Number(goal.current_amount || 0), 0);
    const overallPct = totalTarget > 0 ? Math.min((totalSaved / totalTarget) * 100, 100) : 0;
    const topGoal = goals.reduce((best, goal) => {
        const pct = Number(goal.target_amount) > 0 ? (Number(goal.current_amount || 0) / Number(goal.target_amount || 0)) * 100 : 0;
        if (!best || pct > best.pct) return { ...goal, pct };
        return best;
    }, null);
    const remainingAcrossGoals = Math.max(0, totalTarget - totalSaved);
    const plannerCards = [
        {
            key: 'progress',
            icon: Target,
            label: 'Goal progress',
            value: `${overallPct.toFixed(0)}%`,
            note: totalTarget > 0 ? `${formatCurrency(totalSaved)} saved across all active goals.` : 'Create goals to start tracking savings momentum.',
            tone: overallPct >= 80 ? 'positive' : overallPct >= 50 ? 'warning' : 'neutral',
        },
        {
            key: 'remaining',
            icon: Wallet,
            label: 'Still to save',
            value: formatCurrency(remainingAcrossGoals),
            note: totalTarget > 0 ? 'The remaining amount needed to complete every active goal.' : 'No remaining amount yet because no goals are active.',
            tone: remainingAcrossGoals > 0 ? 'neutral' : 'positive',
        },
        {
            key: 'top-goal',
            icon: ArrowRight,
            label: 'Closest goal',
            value: topGoal ? topGoal.name : 'No goal yet',
            note: topGoal ? `${topGoal.pct.toFixed(0)}% complete and leading the pack.` : 'Add a goal to start seeing progress leaders.',
            tone: topGoal?.pct >= 80 ? 'positive' : 'neutral',
        },
    ];

    const isMobile = useIsMobile();

    return (
        <div className="fade-in page-stack goals-page">
            {!isMobile && (
            <div className="card page-toolbar-card">
                <div className="page-toolbar-header">
                    <div>
                        <div className="dashboard-section-kicker">Goals</div>
                        <div className="dashboard-section-title">Savings goals</div>
                        <div className="dashboard-section-note">Stay focused on what you are building toward, month by month.</div>
                    </div>
                    <button className="btn btn-primary btn-sm" onClick={openNew}>
                    <Plus size={16} /> Add Goal
                    </button>
                </div>
            </div>
            )}

            <div className="card goals-overview-hero">
                <div className="goals-overview-head">
                    <div>
                        <div className="dashboard-section-kicker">Goal planning</div>
                        <div className="budget-overview-value">
                            {formatCurrency(totalSaved)}
                            <span> / {formatCurrency(totalTarget)}</span>
                        </div>
                        <div className="budget-overview-note">
                            {goals.length > 0
                                ? `${overallPct.toFixed(0)}% of your total goal target is already funded.`
                                : 'Create a savings goal to start tracking progress.'}
                        </div>
                    </div>
                    <div className="budget-overview-score" style={{ color: overallPct >= 80 ? 'var(--income)' : overallPct >= 50 ? 'var(--warning)' : 'var(--accent-primary)' }}>
                        {overallPct.toFixed(0)}%
                    </div>
                </div>
                <div className="budget-progress-track budget-overview-track">
                    <div
                        className="budget-progress-bar"
                        style={{ width: `${overallPct}%`, background: overallPct >= 100 ? 'var(--income)' : overallPct >= 70 ? 'var(--warning)' : 'var(--accent-primary)', height: 12 }}
                    />
                </div>
            </div>

            {!isMobile && (
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
            )}

            {!isMobile && (
            <div className="accounts-section-heading">
                <div>
                    <div className="dashboard-section-kicker">Goals overview</div>
                    <div className="dashboard-section-title">Active savings plans</div>
                    <div className="dashboard-section-note">Watch progress, target months, and the remaining amount for each goal.</div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={openNew}>
                    Add goal <ArrowRight size={14} />
                </button>
            </div>
            )}

            {goals.length > 0 ? (
                <div className="goals-planning-grid">
                    {goals.map((g) => {
                        const pct = g.target_amount > 0
                            ? Math.min((g.current_amount / g.target_amount) * 100, 100)
                            : 0;
                        const color =
                            pct >= 100 ? 'var(--income)' :
                                pct >= 70 ? 'var(--warning)' :
                                    'var(--accent-primary)';

                        return (
                            <div key={g.id} className="card goals-planning-card">
                                <div className="goal-card-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: 14 }}>{g.name}</div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
                                            {g.month && (
                                                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>
                                                    <CalendarDays size={12} /> {g.month}
                                                </span>
                                            )}
                                            {(() => { const tm = trackingModeLabel(g); const TmIcon = tm.icon; return (
                                                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: g.tracking_mode === 'manual' ? 'var(--text-muted)' : 'var(--accent-primary)' }}>
                                                    <TmIcon size={12} /> {tm.text}
                                                </span>
                                            ); })()}
                                        </div>
                                    </div>
                                    <div className="goal-card-actions" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <span style={{ fontSize: 14, fontWeight: 700, color }}>{pct.toFixed(0)}%</span>
                                        <button className="btn btn-ghost btn-sm" title="Record savings" onClick={() => { setRecordGoalId(g.id); setRecordAmount(''); }}>
                                            <PiggyBank size={14} />
                                        </button>
                                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(g)}>
                                            <Edit3 size={14} />
                                        </button>
                                        <button
                                            className="btn btn-ghost btn-sm"
                                            onClick={() => handleDelete(g.id)}
                                            style={{ color: 'var(--danger)' }}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                                {recordGoalId === g.id && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, padding: '8px 10px', background: 'var(--bg-secondary)', borderRadius: 8 }}>
                                        <PiggyBank size={16} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            className="input"
                                            placeholder="Amount to add"
                                            value={recordAmount}
                                            onChange={(e) => setRecordAmount(e.target.value)}
                                            style={{ flex: 1, padding: '6px 10px', fontSize: 13 }}
                                            autoFocus
                                        />
                                        <button className="btn btn-primary btn-sm" onClick={handleRecordSavings}>Add</button>
                                        <button className="btn btn-ghost btn-sm" onClick={() => setRecordGoalId(null)}>✕</button>
                                    </div>
                                )}
                                <div className="budget-progress-track">
                                    <div
                                        className="budget-progress-bar"
                                        style={{ width: `${pct}%`, background: color }}
                                    />
                                </div>
                                <div className="goal-card-totals" style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 12 }}>
                                    <span>{formatCurrency(g.current_amount)} saved</span>
                                    <span>{formatCurrency(g.target_amount)} target</span>
                                </div>
                                <div className="budget-planning-note">
                                    {pct >= 100
                                        ? 'This goal is complete and ready for the next milestone.'
                                        : g.month
                                            ? `Targeting ${g.month} with ${formatCurrency(Math.max(0, g.target_amount - g.current_amount))} still to save.`
                                            : `${formatCurrency(Math.max(0, g.target_amount - g.current_amount))} left to reach this goal.`}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="empty-state">
                    <div className="empty-state-icon" style={{ fontSize: 36 }}>🎯</div>
                    <h3>No savings goals yet</h3>
                    <p>Create your first goal to start tracking savings.</p>
                </div>
            )}

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-title">{editingGoal ? 'Edit Goal' : 'Add Goal'}</div>
                            <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                <div className="input-group">
                                    <label className="input-label">Goal name</label>
                                    <input
                                        className="input"
                                        value={form.name}
                                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                        required
                                        placeholder="Ex: New iPhone, Emergency fund..."
                                    />
                                </div>
                                <div className="input-group">
                                    <label className="input-label">Target amount</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        className="input"
                                        value={form.target_amount}
                                        onChange={e => setForm(f => ({ ...f, target_amount: e.target.value }))}
                                        required
                                    />
                                </div>
                                <div className="input-group">
                                    <label className="input-label">Target month (optional)</label>
                                    <input
                                        type="month"
                                        className="input"
                                        value={form.month}
                                        onChange={e => setForm(f => ({ ...f, month: e.target.value }))}
                                    />
                                </div>
                                <div className="input-group">
                                    <label className="input-label">Assign to category (optional)</label>
                                    <select
                                        className="input"
                                        value={form.category_id}
                                        onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
                                    >
                                        {categoryOptions.map((opt) => (
                                            <option key={opt.id || 'none'} value={opt.id}>{opt.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="input-group">
                                    <label className="input-label">Assign to account (optional)</label>
                                    <select
                                        className="input"
                                        value={form.account_id}
                                        onChange={e => setForm(f => ({ ...f, account_id: e.target.value }))}
                                    >
                                        <option value="">None</option>
                                        {accounts.filter((a) => !a.parent_id).map((acc) => (
                                            <option key={acc.id} value={acc.id}>{acc.name}</option>
                                        ))}
                                    </select>
                                </div>
                                {editingGoal && (
                                    <div className="input-group">
                                        <label className="input-label">Amount saved (manual override, optional)</label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            className="input"
                                            placeholder={editingGoal.account_id ? "Auto from account when set" : "0"}
                                            value={form.current_amount}
                                            onChange={e => setForm(f => ({ ...f, current_amount: e.target.value }))}
                                        />
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">
                                    {editingGoal ? 'Save changes' : 'Add goal'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

