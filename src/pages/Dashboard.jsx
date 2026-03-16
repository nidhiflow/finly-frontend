import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, TrendingDown, Wallet, Plus, ChevronLeft, ChevronRight, Calendar, Repeat, Sparkles, AlertTriangle, X, Target, Tag, ArrowRight, Clock3, Landmark } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { statsAPI, transactionsAPI, accountsAPI, budgetsAPI, savingsGoalsAPI } from '../services/api';
import { useApp } from '../context/AppContext';
import { getBudgetAlerts } from '../utils/budgetAlerts';
import { useIsMobile } from '../hooks/useIsMobile';

const CATEGORY_COLORS = [
    '#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6',
    '#8b5cf6', '#ef4444', '#14b8a6', '#f97316', '#06b6d4',
    '#84cc16', '#e11d48', '#0ea5e9', '#a855f7', '#22c55e',
];

export default function Dashboard() {
    const [summary, setSummary] = useState({ income: 0, expense: 0, balance: 0 });
    const [recentTx, setRecentTx] = useState([]);
    const [categoryData, setCategoryData] = useState([]);
    const [trendData, setTrendData] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [budgets, setBudgets] = useState([]);
    const [upcomingRecurring, setUpcomingRecurring] = useState([]);
    const [insights, setInsights] = useState(null);
    const [budgetAlerts, setBudgetAlerts] = useState(null);
    const [finlyScore, setFinlyScore] = useState(null);
    const [goalSummary, setGoalSummary] = useState(null);
    const [weeklySummary, setWeeklySummary] = useState([]);
    const [topGoal, setTopGoal] = useState(null);
    const [totalSavings, setTotalSavings] = useState(0);
    const [showBudgetAlerts, setShowBudgetAlerts] = useState(() => {
        try {
            return sessionStorage.getItem('finly_hide_budget_alerts') !== '1';
        } catch {
            return true;
        }
    });
    const [hiddenWeeklyWeek, setHiddenWeeklyWeek] = useState(() => {
        try {
            return localStorage.getItem('finly_hide_weekly_report_week') || null;
        } catch {
            return null;
        }
    });
    const [loading, setLoading] = useState(true);
    const { addToast, formatCurrency } = useApp();
    const navigate = useNavigate();

    // Month navigation state
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [filterMode, setFilterMode] = useState('month'); // 'month' or 'custom'
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const isMobile = useIsMobile();

    useEffect(() => {
        loadDashboard();
    }, [currentMonth, filterMode, fromDate, toDate]);

    const getDateRange = () => {
        if (filterMode === 'custom' && fromDate && toDate) {
            return { startDate: fromDate, endDate: toDate };
        }
        const start = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
        const end = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
        return {
            startDate: start.toISOString().split('T')[0],
            endDate: end.toISOString().split('T')[0],
        };
    };

    const loadDashboard = async () => {
        try {
            await transactionsAPI.processRecurring().catch(() => {});
            const { startDate, endDate } = getDateRange();
            const monthKey = filterMode === 'custom' && fromDate
                ? fromDate.slice(0, 7)
                : `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;
            const [sum, tx, cats, trend, accs, buds, upcoming, ins, score, goals, weeks] = await Promise.all([
                statsAPI.summary({ startDate, endDate }),
                transactionsAPI.list({ limit: 5, startDate, endDate }),
                statsAPI.byCategory({ startDate, endDate }),
                statsAPI.trend({ startDate, endDate, groupBy: 'day' }),
                accountsAPI.list(),
                budgetsAPI.list({ month: monthKey }),
                transactionsAPI.getUpcomingRecurring().catch(() => []),
                statsAPI.insights().catch(() => null),
                statsAPI.finlyScore().catch(() => null),
                savingsGoalsAPI.list({ month: monthKey }).catch(() => []),
                statsAPI.weeklySummary().catch(() => []),
            ]);
            setSummary(sum);
            setRecentTx(tx);
            setUpcomingRecurring(Array.isArray(upcoming) ? upcoming : []);
            setInsights(ins || null);
            // Assign distinct colors
            setCategoryData(cats.slice(0, 6).map((c, i) => ({ ...c, color: c.color || CATEGORY_COLORS[i % CATEGORY_COLORS.length] })));
            setTrendData(trend.slice(-7));
            setAccounts(accs);
            setBudgets(buds.slice(0, 3));
            setBudgetAlerts(getBudgetAlerts(buds));
            setFinlyScore(score);
            setWeeklySummary(Array.isArray(weeks) ? weeks : []);
            // compute total savings from savings accounts and their children
            try {
                const byId = {};
                accs.forEach(a => { byId[a.id] = a; });
                const isSavings = (a) => {
                    if (!a) return false;
                    if (a.type === 'savings') return true;
                    if (a.parent_id && byId[a.parent_id]) {
                        return byId[a.parent_id].type === 'savings';
                    }
                    return false;
                };
                let savingsTotal = 0;
                accs.forEach(a => {
                    if (isSavings(a)) {
                        const bal = parseFloat(a.balance || 0);
                        if (!Number.isNaN(bal)) savingsTotal += bal;
                    }
                });
                setTotalSavings(savingsTotal);
            } catch {
                setTotalSavings(0);
            }
            if (Array.isArray(goals) && goals.length > 0) {
                const totalTarget = goals.reduce((s, g) => s + (g.target_amount || 0), 0);
                const totalSaved = goals.reduce((s, g) => s + (g.current_amount || 0), 0);
                const pct = totalTarget > 0 ? Math.min((totalSaved / totalTarget) * 100, 100) : 0;
                setGoalSummary({ totalTarget, totalSaved, pct });
                let best = null;
                goals.forEach(g => {
                    const t = g.target_amount || 0;
                    const c = g.current_amount || 0;
                    if (t <= 0) return;
                    const ratio = c / t;
                    if (!best || ratio > best.ratio) {
                        best = { ...g, ratio };
                    }
                });
                setTopGoal(best);
            } else {
                setGoalSummary(null);
                setTopGoal(null);
            }
        } catch (err) {
            addToast('Failed to load dashboard', 'error');
        } finally {
            setLoading(false);
        }
    };

    const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
    const goToToday = () => setCurrentMonth(new Date());

    const formatMonth = (d) => d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

    const latestWeek = weeklySummary && weeklySummary.length > 0 ? weeklySummary[weeklySummary.length - 1].week : null;
    const shouldShowWeeklyReport = weeklySummary && weeklySummary.length > 0 && (!latestWeek || hiddenWeeklyWeek !== latestWeek);

    // Average daily spend for current summary window
    let avgDailyExpense = 0;
    if (summary.startDate && summary.endDate) {
        const start = new Date(summary.startDate);
        const end = new Date(summary.endDate);
        const diffMs = end.getTime() - start.getTime();
        const days = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1);
        avgDailyExpense = summary.expense > 0 ? summary.expense / days : 0;
    }

    // Finly score colors
    const scoreValue = finlyScore?.score ?? 0;
    const clampedScore = Math.max(0, Math.min(100, scoreValue));
    let scoreColor = 'var(--expense)';
    let scoreLabel = 'Needs attention';
    if (clampedScore >= 80) {
        scoreColor = 'var(--income)';
        scoreLabel = 'On track';
    } else if (clampedScore >= 50) {
        scoreColor = 'var(--warning)';
        scoreLabel = 'Can improve';
    }

    const isCurrentMonthView = filterMode === 'month'
        && currentMonth.getMonth() === new Date().getMonth()
        && currentMonth.getFullYear() === new Date().getFullYear();
    const currentPeriodLabel = filterMode === 'custom'
        ? `${fromDate || 'Start date'} - ${toDate || 'End date'}`
        : formatMonth(currentMonth);
    const goalProgressPct = goalSummary?.pct || 0;
    const budgetAlertCount = (budgetAlerts?.criticalAlerts?.length || 0) + (budgetAlerts?.warningAlerts?.length || 0);
    const expenseTrend = (() => {
        if (insights?.expenseChange === undefined) {
            return null;
        }
        const safePct = Math.max(-100, Math.min(300, insights.expenseChange));
        if (safePct > 80) {
            return {
                title: 'Spending is much higher than last month',
                value: `+${safePct}%`,
                tone: 'negative',
                note: 'A quick budget review could help you correct this early.',
            };
        }
        if (safePct > 0) {
            return {
                title: 'Spending is above last month',
                value: `+${safePct}%`,
                tone: 'negative',
                note: 'Keep an eye on the categories climbing fastest.',
            };
        }
        if (safePct < -40) {
            return {
                title: 'Spending is much lower than last month',
                value: `${safePct}%`,
                tone: 'positive',
                note: 'Nice job keeping your costs lighter this month.',
            };
        }
        if (safePct < 0) {
            return {
                title: 'Spending is lower than last month',
                value: `${safePct}%`,
                tone: 'positive',
                note: 'You are trending in a healthier direction.',
            };
        }
        return {
            title: 'Spending is similar to last month',
            value: '0%',
            tone: 'neutral',
            note: 'Your current pace is very close to the previous month.',
        };
    })();

    const statCards = [
        {
            key: 'income',
            className: 'income',
            icon: TrendingUp,
            label: 'Total Income',
            value: formatCurrency(summary.income),
            helper: 'Money added this period',
        },
        {
            key: 'expense',
            className: 'expense',
            icon: TrendingDown,
            label: 'Total Expenses',
            value: formatCurrency(summary.expense),
            helper: 'Money spent this period',
        },
        {
            key: 'balance',
            className: 'balance',
            icon: Wallet,
            label: 'Net Balance',
            value: formatCurrency(summary.balance),
            helper: summary.balance >= 0 ? 'You are above water' : 'Expenses are ahead right now',
        },
        {
            key: 'savings',
            className: 'savings',
            icon: Target,
            label: 'Total Savings',
            value: formatCurrency(totalSavings),
            helper: 'Saved across savings accounts',
        },
    ];

    const insightCards = [];
    if (expenseTrend) {
        insightCards.push({
            key: 'expenseTrend',
            icon: TrendingUp,
            label: 'Vs last month',
            value: expenseTrend.title,
            meta: expenseTrend.value,
            note: expenseTrend.note,
            tone: expenseTrend.tone,
        });
    }
    if (insights?.topCategory) {
        insightCards.push({
            key: 'topCategory',
            icon: Tag,
            label: 'Top category',
            value: `${insights.topCategory.icon} ${insights.topCategory.name}`,
            meta: `${insights.topCategory.pct}% of all spending`,
            note: 'This category is taking the largest share of your expenses.',
            tone: 'neutral',
        });
    }
    if (insights?.highestSpendDay?.amount > 0) {
        insightCards.push({
            key: 'highestSpendDay',
            icon: Calendar,
            label: 'Highest spend day',
            value: new Date(insights.highestSpendDay.date).toLocaleDateString('en', { day: 'numeric', month: 'short' }),
            meta: formatCurrency(insights.highestSpendDay.amount),
            note: 'Useful for spotting one-off spikes or lifestyle patterns.',
            tone: 'neutral',
        });
    }
    if (avgDailyExpense > 0) {
        insightCards.push({
            key: 'avgDailyExpense',
            icon: TrendingDown,
            label: 'Average daily spend',
            value: formatCurrency(avgDailyExpense),
            meta: 'Per day',
            note: 'Based on the selected date range so far.',
            tone: 'neutral',
        });
    }
    if (goalSummary) {
        insightCards.push({
            key: 'goals',
            icon: Target,
            label: 'Goals snapshot',
            value: `${formatCurrency(goalSummary.totalSaved)} of ${formatCurrency(goalSummary.totalTarget)}`,
            meta: `${Math.round(goalProgressPct)}% complete`,
            note: topGoal ? `${topGoal.name} is your most advanced goal right now.` : 'Track your progress and keep momentum going.',
            tone: goalProgressPct >= 80 ? 'positive' : goalProgressPct >= 50 ? 'warning' : 'neutral',
            action: () => navigate('/goals'),
            actionLabel: 'View goals',
        });
    }

    const visibleAccounts = accounts.filter(acc => !acc.parent_id).slice(0, 4);
    const totalNetWorth = accounts
        .filter(acc => !acc.parent_id)
        .reduce((sum, acc) => sum + (parseFloat(acc.balance || 0) || 0), 0);
    const upcomingExpenseTotal = upcomingRecurring
        .filter(tx => tx.type === 'expense')
        .reduce((sum, tx) => sum + (parseFloat(tx.amount || 0) || 0), 0);
    const upcomingIncomeTotal = upcomingRecurring
        .filter(tx => tx.type === 'income')
        .reduce((sum, tx) => sum + (parseFloat(tx.amount || 0) || 0), 0);
    const leadBudgetAlert = budgetAlerts?.criticalAlerts?.[0] || budgetAlerts?.warningAlerts?.[0] || null;
    const plannerCards = [
        {
            key: 'cash-position',
            icon: Wallet,
            label: 'Cash position',
            value: formatCurrency(summary.balance),
            note: summary.balance >= 0 ? 'Income is ahead for this period.' : 'Expenses are ahead for this period.',
            tone: summary.balance >= 0 ? 'positive' : 'negative',
            actionLabel: 'Open reports',
            action: () => navigate('/charts'),
        },
        {
            key: 'upcoming',
            icon: Clock3,
            label: 'Upcoming recurring',
            value: `${upcomingRecurring.length} scheduled`,
            note: upcomingRecurring.length > 0
                ? `${formatCurrency(upcomingExpenseTotal)} outgoing and ${formatCurrency(upcomingIncomeTotal)} incoming are coming up next.`
                : 'No recurring items are scheduled yet.',
            tone: upcomingRecurring.length > 0 ? 'warning' : 'neutral',
            actionLabel: 'Review recurring',
            action: () => navigate('/transactions'),
        },
        {
            key: 'money-plan',
            icon: leadBudgetAlert ? AlertTriangle : Target,
            label: leadBudgetAlert ? 'Budget pressure' : 'Goal momentum',
            value: leadBudgetAlert
                ? `${leadBudgetAlert.icon} ${leadBudgetAlert.name}`
                : topGoal
                    ? `${Math.round((topGoal.ratio || 0) * 100)}% on ${topGoal.name}`
                    : 'No active goals yet',
            note: leadBudgetAlert
                ? `${leadBudgetAlert.pct.toFixed(0)}% used already. A small adjustment now can protect the month.`
                : topGoal
                    ? `${formatCurrency(topGoal.current_amount || 0)} saved of ${formatCurrency(topGoal.target_amount || 0)} target.`
                    : 'Create a goal to turn spare cash into progress.',
            tone: leadBudgetAlert ? 'negative' : topGoal ? 'positive' : 'neutral',
            actionLabel: leadBudgetAlert ? 'Open budget' : 'Open goals',
            action: () => navigate(leadBudgetAlert ? '/budget' : '/goals'),
        },
    ];

    if (loading) return <div className="loading-spinner" />;

    return (
        <div className="fade-in dashboard-page">
            <div className="card dashboard-toolbar">
                <div className="dashboard-toolbar-top">
                    <div>
                        <div className="dashboard-section-kicker">Overview</div>
                        <h2 className="dashboard-section-title">Your money at a glance</h2>
                        <div className="dashboard-section-note">{currentPeriodLabel}</div>
                    </div>
                    <div className="dashboard-toolbar-actions">
                        <div className="dashboard-date-nav">
                            <button className="btn btn-ghost btn-sm btn-icon" onClick={prevMonth}><ChevronLeft size={18} /></button>
                            <button className="btn btn-ghost btn-sm month-nav-label" onClick={goToToday} style={{ fontWeight: 700, fontSize: 15, minWidth: 160, textAlign: 'center' }}>
                                {filterMode === 'custom' ? 'Custom Range' : formatMonth(currentMonth)}
                            </button>
                            <button className="btn btn-ghost btn-sm btn-icon" onClick={nextMonth}><ChevronRight size={18} /></button>
                        </div>
                        <div className="dashboard-filter-switch">
                            <button
                                className={`btn btn-sm ${filterMode === 'month' ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => setFilterMode('month')}
                                style={{ fontSize: 12 }}
                            >Month</button>
                            <button
                                className={`btn btn-sm ${filterMode === 'custom' ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => setFilterMode('custom')}
                                style={{ fontSize: 12 }}
                            ><Calendar size={13} /> Custom</button>
                        </div>
                    </div>
                </div>

                {filterMode === 'custom' && (
                    <div className="dashboard-custom-range">
                        <div className="dashboard-date-input">
                            <span>From</span>
                            <input type="date" className="input" style={{ width: 'auto', padding: '6px 10px', fontSize: 13 }}
                                value={fromDate} onChange={e => setFromDate(e.target.value)} />
                        </div>
                        <div className="dashboard-date-input">
                            <span>To</span>
                            <input type="date" className="input" style={{ width: 'auto', padding: '6px 10px', fontSize: 13 }}
                                value={toDate} onChange={e => setToDate(e.target.value)} />
                        </div>
                    </div>
                )}
            </div>

            <div className="stats-grid">
                {statCards.map((card) => {
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

            {isMobile ? (
                <div className="dashboard-mobile-home">
                    <div className="card hero-panel snapshot-panel">
                        <div className="hero-panel-head">
                            <div>
                                <div className="dashboard-section-kicker">Money Home</div>
                                <div className="hero-panel-title">Everything important for {currentPeriodLabel}</div>
                            </div>
                            {finlyScore && filterMode === 'month' && (
                                <span className="score-pill" style={{ background: `${scoreColor}22`, color: scoreColor }}>
                                    {clampedScore}/100
                                </span>
                            )}
                        </div>
                        <div className="dashboard-mini-metrics">
                            <div className="mini-metric">
                                <span className="mini-metric-label">Avg daily spend</span>
                                <strong>{avgDailyExpense > 0 ? formatCurrency(avgDailyExpense) : formatCurrency(0)}</strong>
                            </div>
                            <div className="mini-metric">
                                <span className="mini-metric-label">Budget alerts</span>
                                <strong>{budgetAlertCount}</strong>
                            </div>
                            <div className="mini-metric">
                                <span className="mini-metric-label">Net worth</span>
                                <strong>{formatCurrency(totalNetWorth)}</strong>
                            </div>
                        </div>
                        <div className="hero-panel-actions">
                            <button className="btn btn-primary btn-sm" onClick={() => navigate('/add')}><Plus size={14} /> Add</button>
                            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/charts')}>Reports</button>
                            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/transactions')}>Ledger</button>
                        </div>
                    </div>

                    <div className="dashboard-planner-grid">
                        {plannerCards.map((card) => {
                            const Icon = card.icon;
                            return (
                                <button key={card.key} type="button" className={`planner-card ${card.tone || 'neutral'}`} onClick={card.action}>
                                    <div className="planner-card-top">
                                        <span className="planner-card-icon"><Icon size={18} /></span>
                                        <span className="planner-card-label">{card.label}</span>
                                    </div>
                                    <div className="planner-card-value">{card.value}</div>
                                    <div className="planner-card-note">{card.note}</div>
                                </button>
                            );
                        })}
                    </div>

                    <div className="card dashboard-list-card">
                        <div className="card-header">
                            <div>
                                <div className="card-title">Recent transactions</div>
                                <div className="card-subtitle">The latest activity, without the long dashboard scroll.</div>
                            </div>
                            <button className="btn btn-ghost btn-sm dashboard-card-action" onClick={() => navigate('/transactions')}>View all</button>
                        </div>
                        {recentTx.length > 0 ? (
                            <div className="tx-list">
                                {recentTx.slice(0, 4).map(tx => (
                                    <div key={tx.id} className="tx-item" onClick={() => navigate(`/add?edit=${tx.id}`)}>
                                        <div className="tx-icon" style={{ background: tx.category_color ? `${tx.category_color}20` : 'var(--bg-input)' }}>
                                            {tx.category_icon || (tx.type === 'income' ? '💰' : '💸')}
                                        </div>
                                        <div className="tx-info">
                                            <div className="tx-category">{tx.category_name || tx.type}</div>
                                            <div className="tx-note">{tx.note || tx.date}</div>
                                        </div>
                                        <div className="tx-amount-col">
                                            <div className={`tx-amount ${tx.type}`}>
                                                {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                                            </div>
                                            <div className="tx-account">{tx.account_parent_name || tx.account_name}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="empty-state" style={{ padding: '20px' }}>
                                <p>No transactions for this period</p>
                                <button className="btn btn-primary btn-sm" onClick={() => navigate('/add')} style={{ marginTop: 12 }}>
                                    <Plus size={16} /> Add Transaction
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="card dashboard-list-card">
                        <div className="card-header">
                            <div>
                                <div className="card-title">Accounts and plans</div>
                                <div className="card-subtitle">Jump straight into the next screen that matters.</div>
                            </div>
                        </div>
                        <div className="dashboard-chip-list">
                            <button type="button" className="dashboard-data-chip" onClick={() => navigate('/accounts')}>
                                <span>{visibleAccounts.length} accounts</span>
                            </button>
                            <button type="button" className="dashboard-data-chip" onClick={() => navigate('/budget')}>
                                <span>{budgets.length} budgets</span>
                            </button>
                            <button type="button" className="dashboard-data-chip" onClick={() => navigate('/goals')}>
                                <span>{topGoal ? `${Math.round((topGoal.ratio || 0) * 100)}% top goal` : 'Goals'}</span>
                            </button>
                            <button type="button" className="dashboard-data-chip" onClick={() => navigate('/charts')}>
                                <span>Open analytics</span>
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
            <>
            <div className="dashboard-hero">
                {finlyScore && filterMode === 'month' && (
                    <div className={`card hero-panel score-panel ${clampedScore >= 80 ? 'positive' : clampedScore >= 50 ? 'warning' : 'negative'}`}>
                        <div className="hero-panel-head">
                            <div>
                                <div className="dashboard-section-kicker">Finly Score</div>
                                <div className="hero-panel-title">Your financial health score</div>
                            </div>
                            <span className="score-pill" style={{ background: `${scoreColor}22`, color: scoreColor }}>
                                {scoreLabel}
                            </span>
                        </div>
                        <div className="score-summary-row">
                            <div>
                                <div className="score-value" style={{ color: scoreColor }}>{clampedScore}<span>/100</span></div>
                                <div className="hero-panel-note">
                                    {clampedScore >= 80
                                        ? 'Great momentum. Your money habits look strong this month.'
                                        : clampedScore >= 50
                                            ? 'You are doing well, but a few smarter moves can lift this quickly.'
                                            : 'This month needs attention. Finly can help you tighten spending.'}
                                </div>
                            </div>
                        </div>
                        <div className="budget-progress-track score-track">
                            <div
                                className="budget-progress-bar score-bar"
                                style={{
                                    width: `${clampedScore}%`,
                                    background: scoreColor,
                                }}
                            />
                        </div>
                    </div>
                )}

                <div className="card hero-panel snapshot-panel">
                    <div className="hero-panel-head">
                        <div>
                            <div className="dashboard-section-kicker">Money Home</div>
                            <div className="hero-panel-title">Focus areas for {currentPeriodLabel}</div>
                        </div>
                    </div>
                    <div className="dashboard-mini-metrics">
                        <div className="mini-metric">
                            <span className="mini-metric-label">Avg daily spend</span>
                            <strong>{avgDailyExpense > 0 ? formatCurrency(avgDailyExpense) : formatCurrency(0)}</strong>
                        </div>
                        <div className="mini-metric">
                            <span className="mini-metric-label">Budget alerts</span>
                            <strong>{budgetAlertCount}</strong>
                        </div>
                        <div className="mini-metric">
                            <span className="mini-metric-label">Net worth</span>
                            <strong>{formatCurrency(totalNetWorth)}</strong>
                        </div>
                    </div>
                    <div className="hero-panel-note">
                        {summary.balance >= 0
                            ? 'Income is still ahead of expenses. Keep building consistency across budgets and goals.'
                            : 'Expenses are higher than income right now. Review categories and adjust the next few transactions carefully.'}
                    </div>
                    <div className="hero-panel-actions">
                        <button className="btn btn-primary btn-sm" onClick={() => navigate('/add')}><Plus size={14} /> Add transaction</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/charts')}>Open charts</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/goals')}>View goals</button>
                    </div>
                </div>
            </div>

            <div className="dashboard-planner-grid">
                {plannerCards.map((card) => {
                    const Icon = card.icon;
                    return (
                        <button key={card.key} type="button" className={`planner-card ${card.tone || 'neutral'}`} onClick={card.action}>
                            <div className="planner-card-top">
                                <span className="planner-card-icon"><Icon size={18} /></span>
                                <span className="planner-card-label">{card.label}</span>
                            </div>
                            <div className="planner-card-value">{card.value}</div>
                            <div className="planner-card-note">{card.note}</div>
                            <div className="planner-card-action">{card.actionLabel} <ArrowRight size={14} /></div>
                        </button>
                    );
                })}
            </div>

            {/* Weekly Financial Report (last 4 weeks) */}
            {shouldShowWeeklyReport && (
                <div className="card" style={{ marginBottom: 20, padding: '16px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Calendar size={16} />
                            <div style={{ fontWeight: 600, fontSize: 14 }}>Weekly financial report (last 4 weeks)</div>
                        </div>
                        <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            style={{ padding: 4 }}
                            onClick={() => {
                                if (!latestWeek) return;
                                try {
                                    localStorage.setItem('finly_hide_weekly_report_week', latestWeek);
                                } catch { }
                                setHiddenWeeklyWeek(latestWeek);
                            }}
                            title="Hide this week's report"
                        >
                            <X size={14} />
                        </button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
                        {weeklySummary.slice(-4).map((w) => {
                            const netBalance = (w.income || 0) - (w.expense || 0);
                            const isPositive = netBalance >= 0;
                            return (
                                <div key={w.week} className="insight-card" style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{w.week}</div>
                                    <div style={{ fontSize: 13 }}>
                                        <div>Income: <strong>{formatCurrency(w.income)}</strong></div>
                                        <div>Expense: <strong>{formatCurrency(w.expense)}</strong></div>
                                        <div style={{ marginTop: 2, fontWeight: 700, color: isPositive ? 'var(--income)' : 'var(--expense)' }}>
                                            Net balance: {formatCurrency(netBalance)}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Smart Budget Alerts (overview) */}
            {budgetAlerts?.hasAlerts && filterMode === 'month' && showBudgetAlerts && (
                <div className="card" style={{ marginBottom: 20, padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <AlertTriangle size={18} style={{ color: 'var(--warning)' }} />
                            <div style={{ fontWeight: 600, fontSize: 14 }}>Budget alerts this month</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                style={{ fontSize: 12 }}
                                onClick={() => navigate('/budget')}
                            >
                                View budgets
                            </button>
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
                                <X size={14} />
                            </button>
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {budgetAlerts.criticalAlerts.slice(0, 2).map((a) => (
                            <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                                <span>{a.icon} {a.name}</span>
                                <span style={{ fontWeight: 600, color: 'var(--danger)' }}>{a.pct.toFixed(0)}% · Over budget</span>
                            </div>
                        ))}
                        {budgetAlerts.warningAlerts.slice(0, 2).map((a) => (
                            <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                                <span>{a.icon} {a.name}</span>
                                <span style={{ fontWeight: 600, color: 'var(--warning)' }}>{a.pct.toFixed(0)}% · Close to budget</span>
                            </div>
                        ))}
                        {(budgetAlerts.criticalAlerts.length + budgetAlerts.warningAlerts.length) > 4 && (
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                                +{(budgetAlerts.criticalAlerts.length + budgetAlerts.warningAlerts.length) - 4} more categories near or over budget
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Auto insight cards */}
            {insightCards.length > 0 && filterMode === 'month' && isCurrentMonthView && (
                <div className="card dashboard-insights-section">
                    <div className="dashboard-insights-header">
                        <div>
                            <div className="dashboard-section-kicker">Smart insights</div>
                            <div className="dashboard-section-title with-icon"><Sparkles size={18} /> Insights this month</div>
                            <div className="dashboard-section-note">Clear signals to help you understand how this month is going.</div>
                        </div>
                    </div>
                    <div className="dashboard-insights-grid">
                        {insightCards.map((item) => {
                            const Icon = item.icon;
                            return (
                                <div key={item.key} className={`insight-card ${item.tone || 'neutral'}`}>
                                    <div className="insight-kicker"><Icon size={14} /> <span>{item.label}</span></div>
                                    <div className="insight-value">{item.value}</div>
                                    {item.meta && <div className="insight-meta">{item.meta}</div>}
                                    {item.key === 'goals' && (
                                        <div className="budget-progress-track insight-progress">
                                            <div
                                                className="budget-progress-bar"
                                                style={{
                                                    width: `${Math.min(100, Math.max(0, goalProgressPct))}%`,
                                                    background: goalProgressPct >= 100 ? 'var(--income)' : 'var(--accent-primary)',
                                                }}
                                            />
                                        </div>
                                    )}
                                    <div className="insight-note">{item.note}</div>
                                    {item.action && (
                                        <button type="button" className="btn btn-link dashboard-inline-link" onClick={item.action}>
                                            {item.actionLabel}
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="dashboard-home-layout">
                <div className="dashboard-main-column">
                    <div className="dashboard-section-heading">
                        <div>
                            <div className="dashboard-section-kicker">Activity</div>
                            <div className="dashboard-section-title">Spending and recent movement</div>
                            <div className="dashboard-section-note">See how this period is unfolding, then drill into the transactions behind it.</div>
                        </div>
                        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/charts')}>Full reports</button>
                    </div>

                    <div className="grid-2 dashboard-analytics-grid">
                        <div className="card dashboard-feature-card">
                            <div className="card-header">
                                <div>
                                    <div className="card-title">Cash flow trend</div>
                                    <div className="card-subtitle">{filterMode === 'custom' ? 'Custom range' : formatMonth(currentMonth)}</div>
                                </div>
                            </div>
                            <div className="chart-container" style={{ height: 220 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={trendData}>
                                        <XAxis dataKey="period" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false}
                                            tickFormatter={(v) => { const d = new Date(v); return d.toLocaleDateString('en', { day: 'numeric' }); }} />
                                        <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                                        <Tooltip
                                            contentStyle={{ background: '#fff', color: '#1a1a2e', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12, padding: '8px 12px' }}
                                            formatter={(v) => formatCurrency(v)}
                                        />
                                        <Bar dataKey="income" fill="var(--income)" radius={[6, 6, 0, 0]} />
                                        <Bar dataKey="expense" fill="var(--expense)" radius={[6, 6, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="dashboard-card-footer-note">
                                {summary.balance >= 0
                                    ? 'You are still positive for this period, which gives room to keep investing in goals.'
                                    : 'This period has flipped negative, so the next few transactions matter more than usual.'}
                            </div>
                        </div>

                        <div className="card dashboard-feature-card">
                            <div className="card-header">
                                <div>
                                    <div className="card-title">Top expense mix</div>
                                    <div className="card-subtitle">Your highest-impact categories right now</div>
                                </div>
                            </div>
                            {categoryData.length > 0 ? (
                                <>
                                    <div className="chart-container" style={{ height: 220 }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie data={categoryData} dataKey="total" nameKey="name"
                                                    cx="50%" cy="50%" innerRadius={52} outerRadius={82} paddingAngle={3}>
                                                    {categoryData.map((entry, i) => (
                                                        <Cell key={i} fill={entry.color || CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <Tooltip
                                                    contentStyle={{ background: '#fff', color: '#1a1a2e', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12, padding: '8px 12px' }}
                                                    formatter={(v) => formatCurrency(v)}
                                                />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div className="dashboard-chip-list">
                                        {categoryData.map((cat, i) => (
                                            <button
                                                key={i}
                                                type="button"
                                                className="dashboard-data-chip"
                                                onClick={() => navigate('/charts')}
                                            >
                                                <span className="dashboard-data-chip-dot" style={{ background: cat.color || CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} />
                                                <span>{cat.icon} {cat.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <div className="empty-state" style={{ padding: '20px' }}>
                                    <p>No expenses for this period</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="card dashboard-list-card">
                        <div className="card-header">
                            <div>
                                <div className="card-title">Recent transactions</div>
                                <div className="card-subtitle">Latest activity across your accounts for the selected range.</div>
                            </div>
                            <button className="btn btn-ghost btn-sm dashboard-card-action" onClick={() => navigate('/transactions')}>View all</button>
                        </div>
                        {recentTx.length > 0 ? (
                            <div className="tx-list">
                                {recentTx.map(tx => (
                                    <div key={tx.id} className="tx-item" onClick={() => navigate(`/add?edit=${tx.id}`)}>
                                        <div className="tx-icon" style={{ background: tx.category_color ? `${tx.category_color}20` : 'var(--bg-input)' }}>
                                            {tx.category_icon || (tx.type === 'income' ? '💰' : '💸')}
                                        </div>
                                        <div className="tx-info">
                                            <div className="tx-category">{tx.category_name || tx.type}</div>
                                            <div className="tx-note">{tx.note || tx.date}</div>
                                        </div>
                                        <div className="tx-amount-col">
                                            <div className={`tx-amount ${tx.type}`}>
                                                {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                                            </div>
                                            <div className="tx-account">{tx.account_parent_name || tx.account_name}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="empty-state" style={{ padding: '20px' }}>
                                <p>No transactions for this period</p>
                                <button className="btn btn-primary btn-sm" onClick={() => navigate('/add')} style={{ marginTop: 12 }}>
                                    <Plus size={16} /> Add Transaction
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="dashboard-side-column">
                    <div className="dashboard-section-heading">
                        <div>
                            <div className="dashboard-section-kicker">Planning</div>
                            <div className="dashboard-section-title">Accounts, recurring, and budgets</div>
                            <div className="dashboard-section-note">Keep an eye on what is coming up and where your money is parked.</div>
                        </div>
                    </div>

                    {upcomingRecurring.length > 0 && (
                        <div className="card dashboard-list-card">
                            <div className="card-header">
                                <div>
                                    <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <Repeat size={18} /> Upcoming recurring
                                    </div>
                                    <div className="card-subtitle">Scheduled items that will affect the next few days.</div>
                                </div>
                                <button className="btn btn-ghost btn-sm dashboard-card-action" onClick={() => navigate('/transactions')}>View all</button>
                            </div>
                            <div className="tx-list">
                                {upcomingRecurring.map(tx => (
                                    <div key={tx.id} className="tx-item" onClick={() => navigate(`/add?edit=${tx.id}`)}>
                                        <div className="tx-icon" style={{ background: tx.category_color ? `${tx.category_color}20` : 'var(--bg-input)' }}>
                                            {tx.category_icon || (tx.type === 'income' ? '💰' : '💸')}
                                        </div>
                                        <div className="tx-info">
                                            <div className="tx-category">{tx.category_name || tx.type}</div>
                                            <div className="tx-note">{tx.note || tx.date}</div>
                                        </div>
                                        <div className="tx-amount-col">
                                            <div className={`tx-amount ${tx.type}`}>
                                                {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                                            </div>
                                            <div className="tx-account">{tx.date}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="card dashboard-list-card">
                        <div className="card-header">
                            <div>
                                <div className="card-title">Accounts overview</div>
                                <div className="card-subtitle">{visibleAccounts.length} primary accounts tracking {formatCurrency(totalNetWorth)}</div>
                            </div>
                            <button className="btn btn-ghost btn-sm dashboard-card-action" onClick={() => navigate('/accounts')}>Manage</button>
                        </div>
                        <div className="dashboard-accounts-list">
                            {visibleAccounts.map(acc => (
                                <div key={acc.id} className="dashboard-account-row">
                                    <div className="dashboard-account-info">
                                        <span className="dashboard-account-icon">{acc.icon}</span>
                                        <div>
                                            <div className="dashboard-account-name">{acc.name}</div>
                                            <div className="dashboard-account-type">{acc.type.replace('_', ' ')}</div>
                                        </div>
                                    </div>
                                    <div className={`dashboard-account-balance ${parseFloat(acc.balance || 0) >= 0 ? 'positive' : 'negative'}`}>
                                        {formatCurrency(parseFloat(acc.balance || 0))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {budgets.length > 0 && (
                        <div className="card dashboard-list-card">
                            <div className="card-header">
                                <div>
                                    <div className="card-title">Budget checkpoints</div>
                                    <div className="card-subtitle">The categories that deserve attention first.</div>
                                </div>
                                <button className="btn btn-ghost btn-sm dashboard-card-action" onClick={() => navigate('/budget')}>View all</button>
                            </div>
                            <div className="dashboard-budget-stack">
                                {budgets.map(b => {
                                    const pct = b.amount > 0 ? Math.min((b.spent / b.amount) * 100, 100) : 0;
                                    const color = pct > 90 ? 'var(--danger)' : pct > 70 ? 'var(--warning)' : 'var(--income)';
                                    return (
                                        <div key={b.id} className="dashboard-budget-row">
                                            <div className="dashboard-budget-head">
                                                <div className="budget-info">
                                                    <span style={{ fontSize: 20 }}>{b.category_icon}</span>
                                                    <div>
                                                        <div className="dashboard-account-name">{b.category_name}</div>
                                                        <div className="dashboard-account-type">{formatCurrency(b.spent)} of {formatCurrency(b.amount)}</div>
                                                    </div>
                                                </div>
                                                <span className="dashboard-budget-pct">{pct.toFixed(0)}%</span>
                                            </div>
                                            <div className="budget-progress-track">
                                                <div className="budget-progress-bar" style={{ width: `${pct}%`, background: color }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
            </>
            )}
        </div>
    );
}
