import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, Sankey } from 'recharts';
import { ChevronLeft, ChevronRight, Calendar, Sparkles, TrendingUp, TrendingDown, Wallet, BarChart3, ArrowLeftRight, CircleDollarSign, Landmark, Filter } from 'lucide-react';
import { statsAPI, aiAPI, budgetsAPI, transactionsAPI, categoriesAPI } from '../services/api';
import { useApp } from '../context/AppContext';
import { getPresetRange, getGroupByForRange } from '../utils/datePresets';

const CATEGORY_COLORS = [
    '#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6',
    '#8b5cf6', '#ef4444', '#14b8a6', '#f97316', '#06b6d4',
    '#84cc16', '#e11d48', '#0ea5e9', '#a855f7', '#22c55e',
    '#d946ef', '#f43f5e', '#0891b2', '#65a30d', '#7c3aed',
];

const tooltipStyle = {
    background: '#fff',
    color: '#1a1a2e',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    fontSize: 12,
    padding: '8px 12px',
};

const compactNumberFormatter = new Intl.NumberFormat('en-IN', {
    notation: 'compact',
    maximumFractionDigits: 1,
});

const formatChartPeriod = (value, options = { month: 'short', day: 'numeric' }) => {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('en-IN', options);
};

const truncateText = (value, maxChars) => {
    if (!value || value.length <= maxChars) return value;
    return `${value.slice(0, Math.max(0, maxChars - 1)).trim()}…`;
};

const toLocalDateValue = (value) => {
    const date = value instanceof Date ? value : new Date(value);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getPeriodBucket = (dateValue, groupBy) => {
    const date = new Date(`${dateValue}T00:00:00`);
    if (groupBy === 'month') {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }
    if (groupBy === 'week') {
        const weekday = date.getDay() || 7;
        const weekAnchor = new Date(date);
        weekAnchor.setDate(weekAnchor.getDate() + 4 - weekday);
        const yearStart = new Date(weekAnchor.getFullYear(), 0, 1);
        const weekNumber = Math.ceil((((weekAnchor - yearStart) / 86400000) + 1) / 7);
        return `${weekAnchor.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
    }
    return toLocalDateValue(date);
};

export default function Charts() {
    const navigate = useNavigate();
    const { addToast, formatCurrency } = useApp();

    const [categoryData, setCategoryData] = useState([]);
    const [incomeCategoryData, setIncomeCategoryData] = useState([]);
    const [allCategories, setAllCategories] = useState([]);
    const [trendData, setTrendData] = useState([]);
    const [stackedTrendData, setStackedTrendData] = useState([]);
    const [stackedCategories, setStackedCategories] = useState([]);
    const [summary, setSummary] = useState({ income: 0, expense: 0, balance: 0 });
    const [budgetVsActualData, setBudgetVsActualData] = useState([]);
    const [rangeTransactions, setRangeTransactions] = useState([]);
    const [loading, setLoading] = useState(true);

    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [filterMode, setFilterMode] = useState('month');
    const [datePreset, setDatePreset] = useState('');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [activeReport, setActiveReport] = useState('cashflow');
    const [filterMainId, setFilterMainId] = useState('');
    const [filterSubId, setFilterSubId] = useState('');
    const [spendingView, setSpendingView] = useState('totals');
    const [aiSummary, setAiSummary] = useState('');
    const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
    const [isCompactCharts, setIsCompactCharts] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 768);
    const [showMobileFilters, setShowMobileFilters] = useState(false);
    const [cashFlowChartWidth, setCashFlowChartWidth] = useState(0);
    const [selectedActivityDate, setSelectedActivityDate] = useState('');
    const cashFlowChartRef = useRef(null);

    const dateRange = useMemo(() => {
        if (filterMode === 'preset' && datePreset) {
            const { startDate, endDate } = getPresetRange(datePreset);
            return { startDate, endDate, groupBy: getGroupByForRange(startDate, endDate) };
        }
        if (filterMode === 'custom' && fromDate && toDate) {
            return { startDate: fromDate, endDate: toDate, groupBy: getGroupByForRange(fromDate, toDate) };
        }
        const start = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
        const end = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
        const startDate = toLocalDateValue(start);
        const endDate = toLocalDateValue(end);
        return { startDate, endDate, groupBy: getGroupByForRange(startDate, endDate) };
    }, [filterMode, datePreset, fromDate, toDate, currentMonth]);

    const { startDate, endDate, groupBy: rangeGroupBy } = dateRange;

    useEffect(() => {
        categoriesAPI.list()
            .then((data) => setAllCategories(Array.isArray(data) ? data : []))
            .catch(() => {});
    }, []);

    useEffect(() => {
        const loadCharts = async () => {
            setLoading(true);
            setAiSummary('');
            try {
                const { startDate: rangeStart, endDate: rangeEnd, groupBy } = dateRange;
                const monthKey = rangeStart.slice(0, 7);
                const [cats, incomeCats, trend, sum, trendByCat, budgets, transactions] = await Promise.all([
                    statsAPI.byCategory({ startDate: rangeStart, endDate: rangeEnd }),
                    statsAPI.byCategory({ startDate: rangeStart, endDate: rangeEnd, type: 'income' }).catch(() => []),
                    statsAPI.trend({ startDate: rangeStart, endDate: rangeEnd, groupBy }),
                    statsAPI.summary({ startDate: rangeStart, endDate: rangeEnd }),
                    statsAPI.trendByCategory({ startDate: rangeStart, endDate: rangeEnd, groupBy }).catch(() => ({ data: [], categories: [] })),
                    budgetsAPI.list({ month: monthKey }).catch(() => []),
                    transactionsAPI.list({ startDate: rangeStart, endDate: rangeEnd }).catch(() => []),
                ]);

                const expenseCategories = (cats || []).map((category, index) => ({
                    ...category,
                    total: Number(category.total || 0),
                    color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
                }));
                const incomeCategories = (incomeCats || []).map((category, index) => ({
                    ...category,
                    total: Number(category.total || 0),
                    color: CATEGORY_COLORS[(index + 4) % CATEGORY_COLORS.length],
                }));

                const budgetMap = {};
                (budgets || []).forEach((budget) => {
                    const categoryId = budget.category_id;
                    if (!budgetMap[categoryId]) {
                        budgetMap[categoryId] = {
                            categoryId,
                            name: budget.category_name || 'Category',
                            budget: 0,
                            spent: 0,
                        };
                    }
                    budgetMap[categoryId].budget = Number(budget.amount) || 0;
                });
                expenseCategories.forEach((category) => {
                    if (!budgetMap[category.id]) {
                        budgetMap[category.id] = {
                            categoryId: category.id,
                            name: category.name,
                            budget: 0,
                            spent: 0,
                        };
                    }
                    budgetMap[category.id].name = category.name;
                    budgetMap[category.id].spent = Number(category.total) || 0;
                });

                setCategoryData(expenseCategories);
                setIncomeCategoryData(incomeCategories);
                setTrendData(trend || []);
                setSummary(sum || { income: 0, expense: 0, balance: 0 });
                setStackedTrendData(Array.isArray(trendByCat?.data) ? trendByCat.data : []);
                setStackedCategories(Array.isArray(trendByCat?.categories) ? trendByCat.categories : []);
                setBudgetVsActualData(Object.values(budgetMap).filter((row) => row.budget > 0 || row.spent > 0));
                setRangeTransactions(Array.isArray(transactions) ? transactions : []);
            } catch {
                addToast('Failed to load charts', 'error');
            } finally {
                setLoading(false);
            }
        };

        loadCharts();
    }, [dateRange, addToast]);

    useEffect(() => {
        const handleResize = () => setIsCompactCharts(window.innerWidth <= 768);
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (!cashFlowChartRef.current || typeof ResizeObserver === 'undefined') {
            return undefined;
        }

        const observer = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (entry?.contentRect?.width) {
                setCashFlowChartWidth(entry.contentRect.width);
            }
        });

        observer.observe(cashFlowChartRef.current);
        return () => observer.disconnect();
    }, [activeReport]);

    useEffect(() => {
        if (!isCompactCharts) {
            setShowMobileFilters(false);
        }
    }, [isCompactCharts]);

    const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
    const goToToday = () => setCurrentMonth(new Date());
    const formatMonth = (date) => date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    const resetReportFilters = () => {
        setFromDate('');
        setToDate('');
        setDatePreset('');
        setFilterMainId('');
        setFilterSubId('');
        setFilterMode('month');
        setCurrentMonth(new Date());
    };
    const handleGetAiSummary = async () => {
        setAiSummaryLoading(true);
        setAiSummary('');
        try {
            const { reply } = await aiAPI.getChartSummary({ startDate, endDate });
            setAiSummary(reply || '');
        } catch (error) {
            addToast(error?.message || 'Failed to get AI summary', 'error');
        } finally {
            setAiSummaryLoading(false);
        }
    };
    const formatCompactCurrency = (value) => {
        const amount = Number(value || 0);
        const absolute = Math.abs(amount);
        const formatted = formatCurrency(absolute);
        const symbolMatch = formatted.match(/^[^\d-]+/);
        const symbol = symbolMatch?.[0] || '';
        return `${amount < 0 ? '-' : ''}${symbol}${compactNumberFormatter.format(absolute)}`;
    };

    const expenseCategoryTree = useMemo(
        () => allCategories.filter((category) => category.type === 'expense'),
        [allCategories]
    );
    const categoryLookup = useMemo(() => {
        const lookup = new Map();
        expenseCategoryTree.forEach((category) => {
            lookup.set(category.id, { ...category, parentId: null });
            (category.subcategories || []).forEach((subcategory) => {
                lookup.set(subcategory.id, {
                    ...subcategory,
                    parentId: category.id,
                    parentName: category.name,
                    parentIcon: category.icon,
                    parentColor: category.color,
                });
            });
        });
        return lookup;
    }, [expenseCategoryTree]);
    const mainCategoriesForFilter = expenseCategoryTree.map((category) => ({ id: category.id, name: category.name }));
    const selectedMainCategory = expenseCategoryTree.find((category) => category.id === filterMainId) || null;
    const subcategoryOptions = useMemo(
        () => selectedMainCategory?.subcategories || [],
        [selectedMainCategory]
    );

    useEffect(() => {
        if (filterSubId && !subcategoryOptions.some((subcategory) => subcategory.id === filterSubId)) {
            setFilterSubId('');
        }
    }, [filterSubId, subcategoryOptions]);

    const expenseTransactions = useMemo(() => rangeTransactions.filter((transaction) => {
        if (transaction.type !== 'expense') {
            return false;
        }
        if (!filterMainId) {
            return true;
        }
        const categoryMeta = categoryLookup.get(transaction.category_id);
        if (filterSubId) {
            return transaction.category_id === filterSubId;
        }
        return transaction.category_id === filterMainId || categoryMeta?.parentId === filterMainId;
    }), [rangeTransactions, filterMainId, filterSubId, categoryLookup]);
    const filteredExpenseTotal = expenseTransactions.reduce((sum, transaction) => sum + (Number(transaction.amount) || 0), 0);
    const hasExpenseCategoryFilter = Boolean(filterMainId || filterSubId);
    const visibleSummary = hasExpenseCategoryFilter
        ? { income: summary.income, expense: filteredExpenseTotal, balance: summary.income - filteredExpenseTotal }
        : summary;
    const filteredCategoryData = useMemo(() => {
        if (!filterMainId) {
            return categoryData;
        }

        const totals = new Map();
        expenseTransactions.forEach((transaction) => {
            const amount = Number(transaction.amount || 0);
            if (amount <= 0) {
                return;
            }

            if (filterSubId) {
                const subcategory = categoryLookup.get(filterSubId) || categoryLookup.get(transaction.category_id);
                const key = filterSubId;
                const current = totals.get(key) || {
                    id: key,
                    name: subcategory?.name || transaction.category_name || 'Subcategory',
                    icon: subcategory?.icon || transaction.category_icon || '📦',
                    color: subcategory?.color || selectedMainCategory?.color || CATEGORY_COLORS[0],
                    total: 0,
                };
                current.total += amount;
                totals.set(key, current);
                return;
            }

            if (subcategoryOptions.length > 0) {
                const subcategory = categoryLookup.get(transaction.category_id);
                if (subcategory?.parentId === filterMainId) {
                    const current = totals.get(transaction.category_id) || {
                        id: transaction.category_id,
                        name: subcategory.name,
                        icon: subcategory.icon || transaction.category_icon || '📦',
                        color: subcategory.color || selectedMainCategory?.color || CATEGORY_COLORS[0],
                        total: 0,
                    };
                    current.total += amount;
                    totals.set(transaction.category_id, current);
                    return;
                }
            }

            const current = totals.get(filterMainId) || {
                id: filterMainId,
                name: selectedMainCategory?.name || transaction.category_name || 'Category',
                icon: selectedMainCategory?.icon || transaction.category_icon || '📦',
                color: selectedMainCategory?.color || CATEGORY_COLORS[0],
                total: 0,
            };
            current.total += amount;
            totals.set(filterMainId, current);
        });

        return Array.from(totals.values()).sort((left, right) => right.total - left.total);
    }, [filterMainId, filterSubId, expenseTransactions, categoryData, categoryLookup, subcategoryOptions, selectedMainCategory]);
    const filteredBudgetData = (filterMainId || filterSubId)
        ? budgetVsActualData.filter((category) => category.categoryId === filterMainId)
        : budgetVsActualData;
    const chartTrendData = (filterMode === 'custom' && fromDate && toDate) || (filterMode === 'preset' && datePreset)
        ? trendData
        : trendData.slice(-10);
    const currentPeriodLabel = filterMode === 'custom'
        ? `${fromDate || 'Start date'} - ${toDate || 'End date'}`
        : filterMode === 'preset' && datePreset
            ? (datePreset === 'ytd' ? 'Year to date' : `Last ${datePreset.replace('d', ' days')}`)
            : formatMonth(currentMonth);

    const periodStart = new Date(startDate);
    const periodEnd = new Date(endDate);
    const totalDays = Math.max(1, Math.floor((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    const avgDailyExpense = visibleSummary.expense > 0 ? visibleSummary.expense / totalDays : 0;
    const avgDailyIncome = summary.income > 0 ? summary.income / totalDays : 0;
    const topCategory = filteredCategoryData[0] || categoryData[0] || null;
    const topIncomeSource = incomeCategoryData[0] || null;
    const savingsRate = visibleSummary.income > 0 ? Math.max(0, Math.round(((visibleSummary.income - visibleSummary.expense) / visibleSummary.income) * 100)) : 0;
    const isCurrentMonth = filterMode === 'month'
        && currentMonth.getMonth() === new Date().getMonth()
        && currentMonth.getFullYear() === new Date().getFullYear();
    const daysElapsedThisMonth = isCurrentMonth ? new Date().getDate() : totalDays;
    const daysInCurrentMonth = isCurrentMonth ? new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate() : totalDays;
    const projectedMonthExpense = isCurrentMonth && daysElapsedThisMonth > 0
        ? (visibleSummary.expense / daysElapsedThisMonth) * daysInCurrentMonth
        : visibleSummary.expense;
    const projectedMonthIncome = isCurrentMonth && daysElapsedThisMonth > 0
        ? (summary.income / daysElapsedThisMonth) * daysInCurrentMonth
        : summary.income;
    const projectedMonthBalance = projectedMonthIncome - projectedMonthExpense;

    const incomeTransactions = useMemo(
        () => rangeTransactions.filter((transaction) => transaction.type === 'income'),
        [rangeTransactions]
    );
    const largestExpense = expenseTransactions.reduce(
        (max, transaction) => (Number(transaction.amount || 0) > Number(max?.amount || 0) ? transaction : max),
        null
    );
    const largestIncome = incomeTransactions.reduce(
        (max, transaction) => (Number(transaction.amount || 0) > Number(max?.amount || 0) ? transaction : max),
        null
    );
    const overBudgetCount = filteredBudgetData.filter((row) => row.budget > 0 && row.spent > row.budget).length;

    const reportTabs = [
        { id: 'cashflow', label: 'Cash Flow', icon: ArrowLeftRight },
        { id: 'spending', label: 'Spending', icon: TrendingDown },
        { id: 'income', label: 'Income', icon: CircleDollarSign },
        { id: 'expense', label: 'Expense', icon: Landmark },
    ];

    const reportCards = {
        cashflow: [
            {
                key: 'income',
                className: 'income',
                icon: TrendingUp,
                label: 'Income',
                value: formatCurrency(visibleSummary.income),
                helper: `${formatCurrency(avgDailyIncome)} per day`,
            },
            {
                key: 'expense',
                className: 'expense',
                icon: TrendingDown,
                label: 'Expenses',
                value: formatCurrency(visibleSummary.expense),
                helper: `${formatCurrency(avgDailyExpense)} per day`,
            },
            {
                key: 'balance',
                className: 'balance',
                icon: Wallet,
                label: 'Net cash flow',
                value: formatCurrency(visibleSummary.balance),
                helper: projectedMonthBalance >= 0 ? `${formatCurrency(projectedMonthBalance)} projected month end` : 'Spending is ahead right now',
            },
            {
                key: 'rate',
                className: 'balance',
                icon: BarChart3,
                label: 'Savings rate',
                value: `${savingsRate}%`,
                helper: visibleSummary.balance >= 0 ? 'Income still covers spending' : 'Needs attention',
            },
        ],
        spending: [
            {
                key: 'top-category',
                className: 'expense',
                icon: TrendingDown,
                label: 'Top category',
                value: topCategory ? `${topCategory.icon} ${topCategory.name}` : 'No data',
                helper: topCategory ? formatCurrency(topCategory.total) : 'Add expenses to see a leader',
            },
            {
                key: 'total-spent',
                className: 'expense',
                icon: Wallet,
                label: 'Spent',
                value: formatCurrency(visibleSummary.expense),
                helper: `${expenseTransactions.length} transactions`,
            },
            {
                key: 'avg-daily',
                className: 'balance',
                icon: BarChart3,
                label: 'Daily pace',
                value: formatCurrency(avgDailyExpense),
                helper: 'Average daily outflow',
            },
            {
                key: 'largest-expense',
                className: 'balance',
                icon: Landmark,
                label: 'Largest expense',
                value: largestExpense ? formatCurrency(largestExpense.amount) : formatCurrency(0),
                helper: largestExpense?.category_name || 'No spending yet',
            },
        ],
        income: [
            {
                key: 'top-income',
                className: 'income',
                icon: TrendingUp,
                label: 'Top source',
                value: topIncomeSource ? `${topIncomeSource.icon} ${topIncomeSource.name}` : 'No data',
                helper: topIncomeSource ? formatCurrency(topIncomeSource.total) : 'Add income to unlock source mix',
            },
            {
                key: 'income-total',
                className: 'income',
                icon: CircleDollarSign,
                label: 'Income',
                value: formatCurrency(visibleSummary.income),
                helper: `${formatCurrency(avgDailyIncome)} per day`,
            },
            {
                key: 'projected-income',
                className: 'balance',
                icon: BarChart3,
                label: 'Projected month end',
                value: formatCurrency(projectedMonthIncome),
                helper: isCurrentMonth ? 'Based on current pace' : 'Matches selected period',
            },
            {
                key: 'largest-income',
                className: 'balance',
                icon: Wallet,
                label: 'Largest deposit',
                value: largestIncome ? formatCurrency(largestIncome.amount) : formatCurrency(0),
                helper: largestIncome?.category_name || 'No income yet',
            },
        ],
        expense: [
            {
                key: 'expense-total',
                className: 'expense',
                icon: Landmark,
                label: 'Expenses',
                value: formatCurrency(visibleSummary.expense),
                helper: `${formatCurrency(avgDailyExpense)} per day`,
            },
            {
                key: 'projected-expense',
                className: 'expense',
                icon: TrendingDown,
                label: 'Projected month end',
                value: formatCurrency(projectedMonthExpense),
                helper: isCurrentMonth ? 'Based on current pace' : 'Matches selected period',
            },
            {
                key: 'over-budget',
                className: 'balance',
                icon: Wallet,
                label: 'Over budget',
                value: String(overBudgetCount),
                helper: filteredBudgetData.length > 0 ? `${filteredBudgetData.length} tracked categories` : 'No tracked budgets',
            },
            {
                key: 'biggest-category',
                className: 'balance',
                icon: BarChart3,
                label: 'Biggest category',
                value: topCategory ? `${topCategory.icon} ${topCategory.name}` : 'No data',
                helper: topCategory ? formatCurrency(topCategory.total) : 'Add expenses to see details',
            },
        ],
    };

    const reportLead = {
        cashflow: projectedMonthBalance >= 0
            ? `Cash flow stays positive in ${currentPeriodLabel}. The current pace points to about ${formatCurrency(projectedMonthBalance)} left after spending.`
            : `Spending is outpacing income in ${currentPeriodLabel}. Review the flow map to see where the pressure is building.`,
        spending: topCategory
            ? `${topCategory.name} is leading spending in ${currentPeriodLabel}. Switch between totals and change-over-time to spot the biggest drivers.`
            : 'Add transactions to unlock category mix, daily patterns, and recent expense review.',
        income: topIncomeSource
            ? `${topIncomeSource.name} is the strongest income source in this range, with ${formatCurrency(projectedMonthIncome)} projected at the current pace.`
            : 'Add income transactions to unlock source mix and income trend views.',
        expense: filteredBudgetData.length > 0
            ? `Use this view to compare your biggest expense categories with budget coverage and spot any category already moving past plan.`
            : 'Track expenses here to see ranked categories, pace changes, and the categories that need attention first.',
    };

    const cashFlowTrendData = useMemo(() => chartTrendData.map((row) => ({
        period: row.period,
        income: Number(row.income || 0),
        expense: Number(row.expense || 0),
        balance: Number(row.income || 0) - Number(row.expense || 0),
    })), [chartTrendData]);

    const incomeTrendOnly = useMemo(() => chartTrendData.map((row) => ({
        period: row.period,
        value: Number(row.income || 0),
    })), [chartTrendData]);

    const expenseTrendOnly = useMemo(() => chartTrendData.map((row) => ({
        period: row.period,
        value: Number(row.expense || 0),
    })), [chartTrendData]);

    const cashFlowLayout = useMemo(() => {
        const width = Math.max(cashFlowChartWidth || 0, isCompactCharts ? 320 : 960);

        if (isCompactCharts) {
            return {
                width,
                renderMode: 'sankey',
                maxSources: 2,
                maxExpenses: 4,
                chartHeight: 320,
                nodePadding: 16,
                nodeWidth: 12,
                margin: { top: 12, right: 8, left: 8, bottom: 8 },
                labelOffset: 8,
                labelMaxChars: 12,
                nameFontSize: 10,
                amountFontSize: 9,
            };
        }

        if (width < 1120) {
            return {
                width,
                renderMode: 'sankey',
                maxSources: 3,
                maxExpenses: 5,
                chartHeight: 420,
                nodePadding: 18,
                nodeWidth: 14,
                margin: { top: 14, right: 104, left: 88, bottom: 14 },
                labelOffset: 10,
                labelMaxChars: 16,
                nameFontSize: 11,
                amountFontSize: 10,
            };
        }

        return {
            width,
            renderMode: 'sankey',
            maxSources: 3,
            maxExpenses: 6,
            chartHeight: 480,
            nodePadding: 22,
            nodeWidth: 16,
            margin: { top: 18, right: 128, left: 112, bottom: 18 },
            labelOffset: 12,
            labelMaxChars: 20,
            nameFontSize: 12,
            amountFontSize: 10,
        };
    }, [cashFlowChartWidth, isCompactCharts]);

    const cashFlowBreakdown = useMemo(() => {
        const expenseFlowData = filteredCategoryData.length > 0 ? filteredCategoryData : categoryData;

        if (visibleSummary.income <= 0 || visibleSummary.balance < 0 || expenseFlowData.length === 0) {
            return null;
        }

        const limitItems = (items, limit, type) => {
            const visible = items.filter((item) => Number(item.total || 0) > 0);
            if (visible.length <= limit) return visible;
            const kept = visible.slice(0, Math.max(1, limit - 1));
            const remainder = visible.slice(Math.max(1, limit - 1));
            const remainderTotal = remainder.reduce((sum, item) => sum + Number(item.total || 0), 0);

            if (remainderTotal <= 0) {
                return kept;
            }

            return [
                ...kept,
                {
                    id: `${type}-other`,
                    name: 'Other',
                    icon: type === 'sources' ? '💼' : '•',
                    total: remainderTotal,
                    color: type === 'sources' ? '#7dd3fc' : '#94a3b8',
                },
            ];
        };

        const sources = limitItems(
            incomeCategoryData.length > 0 ? incomeCategoryData : [{ id: 'income-source', name: 'Income', icon: '💰', total: visibleSummary.income }],
            cashFlowLayout.maxSources,
            'sources'
        );
        const expenses = limitItems(expenseFlowData, cashFlowLayout.maxExpenses, 'expenses');

        return { sources, expenses };
    }, [visibleSummary.income, visibleSummary.balance, filteredCategoryData, categoryData, incomeCategoryData, cashFlowLayout.maxSources, cashFlowLayout.maxExpenses]);

    const cashFlowSankeyData = useMemo(() => {
        if (!cashFlowBreakdown || cashFlowLayout.renderMode !== 'sankey') {
            return null;
        }

        const { sources, expenses } = cashFlowBreakdown;
        const nodes = [
            ...sources.map((source, index) => ({
                name: `${source.icon || '💰'} ${source.name}`,
                amount: Number(source.total || 0),
                shareText: visibleSummary.income > 0 ? `${Math.round((Number(source.total || 0) / visibleSummary.income) * 100)}%` : '',
                fill: index === 0 ? '#0ea5e9' : '#38bdf8',
            })),
            {
                name: 'Income',
                amount: visibleSummary.income,
                shareText: '100%',
                fill: '#16a34a',
            },
            ...expenses.map((category) => ({
                name: `${category.icon || '•'} ${category.name}`,
                amount: Number(category.total || 0),
                shareText: visibleSummary.expense > 0 ? `${Math.round((Number(category.total || 0) / visibleSummary.expense) * 100)}%` : '',
                fill: category.color,
            })),
            {
                name: 'Savings',
                amount: Math.max(0, visibleSummary.balance),
                shareText: `${savingsRate}%`,
                fill: '#22c55e',
            },
        ];

        const sourceHubIndex = sources.length;
        const savingsIndex = nodes.length - 1;
        const links = [
            ...sources.map((source, index) => ({
                source: index,
                target: sourceHubIndex,
                value: Number(source.total || 0),
            })),
            ...expenses.map((category, index) => ({
                source: sourceHubIndex,
                target: sourceHubIndex + 1 + index,
                value: Number(category.total || 0),
            })),
            {
                source: sourceHubIndex,
                target: savingsIndex,
                value: Math.max(0, visibleSummary.balance),
            },
        ];

        return { nodes, links };
    }, [cashFlowBreakdown, cashFlowLayout.renderMode, visibleSummary.income, visibleSummary.expense, visibleSummary.balance, savingsRate]);

    const renderCashFlowNode = (nodeProps) => {
        const { x = 0, y = 0, width = 0, height = 0, payload = {} } = nodeProps;
        if (isCompactCharts) {
            return (
                <g>
                    <rect x={x} y={y} width={width} height={height} rx={4} ry={4} fill={payload.fill || '#60a5fa'} fillOpacity={0.95} />
                    {height >= 24 && (
                        <text
                            x={x + (width / 2)}
                            y={y + (height / 2) + 3}
                            textAnchor="middle"
                            fontSize={9}
                            fontWeight={700}
                            fill="#ffffff"
                        >
                            {truncateText(String(payload.name || '').replace(/^[^\w]+/, ''), 6)}
                        </text>
                    )}
                </g>
            );
        }

        const depth = payload.depth ?? 0;
        const rightSide = depth >= 2;
        const labelX = rightSide ? x - cashFlowLayout.labelOffset : x + width + cashFlowLayout.labelOffset;
        const textAnchor = rightSide ? 'end' : 'start';
        const centerY = y + (height / 2);
        const label = truncateText(payload.name, cashFlowLayout.labelMaxChars);
        const amountLine = payload.amount != null
            ? `${formatCompactCurrency(payload.amount)}${payload.shareText ? ` · ${payload.shareText}` : ''}`
            : payload.shareText || '';

        return (
            <g>
                <rect x={x} y={y} width={width} height={height} rx={4} ry={4} fill={payload.fill || '#60a5fa'} fillOpacity={0.95} />
                <text x={labelX} y={centerY - 5} textAnchor={textAnchor} fontSize={cashFlowLayout.nameFontSize} fontWeight={700} fill="var(--text-primary)">
                    {label}
                </text>
                <text x={labelX} y={centerY + 10} textAnchor={textAnchor} fontSize={cashFlowLayout.amountFontSize} fill="var(--text-secondary)">
                    {amountLine}
                </text>
            </g>
        );
    };

    const displayStackedTrend = useMemo(() => {
        if (!hasExpenseCategoryFilter) {
            return { data: stackedTrendData, categories: stackedCategories };
        }

        const periods = new Map();
        const categories = new Map();

        expenseTransactions.forEach((transaction) => {
            const amount = Number(transaction.amount || 0);
            if (amount <= 0) {
                return;
            }

            const bucket = getPeriodBucket(transaction.date, rangeGroupBy);
            const transactionMeta = categoryLookup.get(transaction.category_id);
            let seriesId = filterMainId || transaction.category_id || 'uncategorized';
            let seriesName = selectedMainCategory?.name || transaction.category_name || 'Category';
            let seriesColor = selectedMainCategory?.color || transactionMeta?.color || CATEGORY_COLORS[0];

            if (filterSubId) {
                const subcategory = categoryLookup.get(filterSubId) || transactionMeta;
                seriesId = filterSubId;
                seriesName = subcategory?.name || transaction.category_name || 'Subcategory';
                seriesColor = subcategory?.color || selectedMainCategory?.color || CATEGORY_COLORS[0];
            } else if (!filterMainId) {
                const mainCategoryId = transactionMeta?.parentId || transaction.category_id || 'uncategorized';
                const mainCategory = transactionMeta?.parentId ? categoryLookup.get(transactionMeta.parentId) : transactionMeta;
                seriesId = mainCategoryId;
                seriesName = mainCategory?.name || transaction.category_name || 'Uncategorized';
                seriesColor = mainCategory?.color || transactionMeta?.color || CATEGORY_COLORS[0];
            } else if (subcategoryOptions.length > 0 && transactionMeta?.parentId === filterMainId) {
                seriesId = transaction.category_id;
                seriesName = transactionMeta?.name || transaction.category_name || 'Subcategory';
                seriesColor = transactionMeta?.color || selectedMainCategory?.color || CATEGORY_COLORS[0];
            }

            if (!periods.has(bucket)) {
                periods.set(bucket, { period: bucket });
            }
            periods.get(bucket)[seriesId] = (periods.get(bucket)[seriesId] || 0) + amount;

            if (!categories.has(seriesId)) {
                categories.set(seriesId, { id: seriesId, name: seriesName, color: seriesColor });
            }
        });

        return {
            data: Array.from(periods.values()).sort((left, right) => String(left.period).localeCompare(String(right.period))),
            categories: Array.from(categories.values()),
        };
    }, [hasExpenseCategoryFilter, stackedTrendData, stackedCategories, expenseTransactions, rangeGroupBy, filterMainId, filterSubId, selectedMainCategory, subcategoryOptions, categoryLookup]);

    const displayExpenseTrendOnly = useMemo(() => {
        if (!hasExpenseCategoryFilter) {
            return expenseTrendOnly;
        }
        return displayStackedTrend.data.map((row) => ({
            period: row.period,
            value: Object.entries(row)
                .filter(([key]) => key !== 'period')
                .reduce((sum, [, amount]) => sum + (Number(amount) || 0), 0),
        }));
    }, [hasExpenseCategoryFilter, expenseTrendOnly, displayStackedTrend]);

    const heatmapGrid = useMemo(() => {
        if (!startDate || !endDate) {
            return { cells: [], maxExpense: 0 };
        }

        const expenseByDate = new Map();
        expenseTransactions.forEach((transaction) => {
            const dateKey = transaction.date;
            if (!expenseByDate.has(dateKey)) {
                expenseByDate.set(dateKey, { dateStr: dateKey, expense: 0, count: 0, transactions: [] });
            }
            const current = expenseByDate.get(dateKey);
            current.expense += Number(transaction.amount || 0);
            current.count += 1;
            current.transactions.push(transaction);
        });

        const cells = [];
        const pointer = new Date(`${startDate}T00:00:00`);
        const finalDate = new Date(`${endDate}T00:00:00`);

        while (pointer <= finalDate) {
            const dateStr = toLocalDateValue(pointer);
            const existing = expenseByDate.get(dateStr) || { expense: 0, count: 0, transactions: [] };
            cells.push({
                dateStr,
                expense: existing.expense,
                count: existing.count,
                transactions: existing.transactions,
                dayLabel: pointer.getDate(),
                weekdayLabel: pointer.toLocaleDateString('en-IN', { weekday: 'short' }),
                fullLabel: pointer.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }),
            });
            pointer.setDate(pointer.getDate() + 1);
        }

        return {
            cells,
            maxExpense: Math.max(1, ...cells.map((cell) => cell.expense)),
        };
    }, [expenseTransactions, startDate, endDate]);

    useEffect(() => {
        if (heatmapGrid.cells.length === 0) {
            setSelectedActivityDate('');
            return;
        }

        const defaultCell = [...heatmapGrid.cells]
            .sort((left, right) => (right.expense - left.expense) || right.dateStr.localeCompare(left.dateStr))[0];
        setSelectedActivityDate(defaultCell?.dateStr || heatmapGrid.cells[0]?.dateStr || '');
    }, [heatmapGrid]);

    const selectedActivityCell = useMemo(
        () => heatmapGrid.cells.find((cell) => cell.dateStr === selectedActivityDate) || null,
        [heatmapGrid, selectedActivityDate]
    );
    const selectedActivityLargestPurchase = selectedActivityCell?.transactions?.reduce(
        (largest, transaction) => (Number(transaction.amount || 0) > Number(largest?.amount || 0) ? transaction : largest),
        null
    ) || null;

    const activeCards = reportCards[activeReport] || reportCards.cashflow;

    if (loading) {
        return <div className="loading-spinner" />;
    }

    return (
        <div className="fade-in charts-page">
            <div className="card dashboard-toolbar charts-toolbar">
                <div className="dashboard-toolbar-top">
                    <div className="charts-toolbar-heading">
                        <div>
                            <div className="dashboard-section-kicker">Reports</div>
                            <h2 className="dashboard-section-title">Finly reports</h2>
                            <div className="dashboard-section-note">{currentPeriodLabel}</div>
                        </div>
                        <div className="charts-report-tabs charts-report-tabs-inline">
                            {reportTabs.map((tab) => {
                                const Icon = tab.icon;
                                return (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        className={`charts-report-tab ${activeReport === tab.id ? 'active' : ''}`}
                                        onClick={() => setActiveReport(tab.id)}
                                    >
                                        <Icon size={16} />
                                        <span>{tab.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    <div className="dashboard-toolbar-actions">
                        <div className="dashboard-date-nav">
                            <button className="btn btn-ghost btn-sm btn-icon" onClick={prevMonth}><ChevronLeft size={18} /></button>
                            <button className="btn btn-ghost btn-sm month-nav-label" onClick={goToToday} style={{ fontWeight: 700, fontSize: 15, minWidth: 160, textAlign: 'center' }}>
                                {filterMode === 'custom' ? 'Custom Range' : filterMode === 'preset' && datePreset ? (datePreset === 'ytd' ? 'Year to date' : `Last ${datePreset.replace('d', ' days')}`) : formatMonth(currentMonth)}
                            </button>
                            <button className="btn btn-ghost btn-sm btn-icon" onClick={nextMonth}><ChevronRight size={18} /></button>
                        </div>
                        {!isCompactCharts && (
                            <div className="dashboard-filter-switch">
                                <button className={`btn btn-sm ${filterMode === 'month' && !datePreset ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setFilterMode('month'); setDatePreset(''); }} style={{ fontSize: 12 }}>Month</button>
                                <button className={`btn btn-sm ${filterMode === 'preset' && datePreset === '7d' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setFilterMode('preset'); setDatePreset('7d'); }} style={{ fontSize: 12 }}>7d</button>
                                <button className={`btn btn-sm ${filterMode === 'preset' && datePreset === '30d' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setFilterMode('preset'); setDatePreset('30d'); }} style={{ fontSize: 12 }}>30d</button>
                                <button className={`btn btn-sm ${filterMode === 'preset' && datePreset === '90d' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setFilterMode('preset'); setDatePreset('90d'); }} style={{ fontSize: 12 }}>90d</button>
                                <button className={`btn btn-sm ${filterMode === 'preset' && datePreset === 'ytd' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setFilterMode('preset'); setDatePreset('ytd'); }} style={{ fontSize: 12 }}>YTD</button>
                                <button className={`btn btn-sm ${filterMode === 'custom' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setFilterMode('custom'); setDatePreset(''); }} style={{ fontSize: 12 }}><Calendar size={13} /> Custom</button>
                            </div>
                        )}
                    </div>
                </div>

                {isCompactCharts && (
                    <div className="charts-mobile-toolbar-actions">
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowMobileFilters((value) => !value)}>
                            <Filter size={14} /> {showMobileFilters ? 'Hide filters' : 'Filters'}
                        </button>
                        <button
                            type="button"
                            className="btn btn-secondary btn-sm charts-ai-button charts-mobile-ai-button"
                            disabled={aiSummaryLoading}
                            onClick={handleGetAiSummary}
                        >
                            <Sparkles size={14} /> {aiSummaryLoading ? 'Generating...' : 'Get AI summary'}
                        </button>
                    </div>
                )}

                {isCompactCharts && showMobileFilters && (
                    <div className="charts-mobile-filter-panel slide-up">
                        <div className="dashboard-filter-switch charts-mobile-presets">
                            <button className={`btn btn-sm ${filterMode === 'month' && !datePreset ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setFilterMode('month'); setDatePreset(''); }} style={{ fontSize: 12 }}>Month</button>
                            <button className={`btn btn-sm ${filterMode === 'preset' && datePreset === '7d' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setFilterMode('preset'); setDatePreset('7d'); }} style={{ fontSize: 12 }}>7d</button>
                            <button className={`btn btn-sm ${filterMode === 'preset' && datePreset === '30d' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setFilterMode('preset'); setDatePreset('30d'); }} style={{ fontSize: 12 }}>30d</button>
                            <button className={`btn btn-sm ${filterMode === 'preset' && datePreset === '90d' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setFilterMode('preset'); setDatePreset('90d'); }} style={{ fontSize: 12 }}>90d</button>
                            <button className={`btn btn-sm ${filterMode === 'preset' && datePreset === 'ytd' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setFilterMode('preset'); setDatePreset('ytd'); }} style={{ fontSize: 12 }}>YTD</button>
                            <button className={`btn btn-sm ${filterMode === 'custom' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setFilterMode('custom'); setDatePreset(''); }} style={{ fontSize: 12 }}><Calendar size={13} /> Custom</button>
                        </div>

                        {filterMode === 'custom' && (
                            <div className="dashboard-custom-range charts-mobile-custom-range">
                                <div className="dashboard-date-input">
                                    <span>From</span>
                                    <input type="date" className="input" style={{ width: 'auto', padding: '6px 10px', fontSize: 13 }} value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
                                </div>
                                <div className="dashboard-date-input">
                                    <span>To</span>
                                    <input type="date" className="input" style={{ width: 'auto', padding: '6px 10px', fontSize: 13 }} value={toDate} onChange={(event) => setToDate(event.target.value)} />
                                </div>
                            </div>
                        )}

                        <div className="charts-mobile-filter-bottom">
                            {activeReport !== 'income' && (
                                <div className="dashboard-date-input">
                                    <span>Category</span>
                                    <select
                                        className="input"
                                        style={{ width: 'auto', padding: '6px 10px', fontSize: 13 }}
                                        value={filterMainId}
                                        onChange={(event) => {
                                            setFilterMainId(event.target.value);
                                            setFilterSubId('');
                                        }}
                                    >
                                        <option value="">All</option>
                                        {mainCategoriesForFilter.map((category) => (
                                            <option key={category.id} value={category.id}>{category.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            {filterMainId && subcategoryOptions.length > 0 && (
                                <div className="dashboard-date-input">
                                    <span>Subcategory</span>
                                    <select className="input" style={{ width: 'auto', padding: '6px 10px', fontSize: 13 }} value={filterSubId} onChange={(event) => setFilterSubId(event.target.value)}>
                                        <option value="">All</option>
                                        {subcategoryOptions.map((subcategory) => (
                                            <option key={subcategory.id} value={subcategory.id}>{subcategory.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <button type="button" className="btn btn-ghost btn-sm" style={{ fontSize: 12 }} onClick={resetReportFilters}>
                                Clear all
                            </button>
                        </div>
                    </div>
                )}

                {!isCompactCharts && filterMode === 'custom' && (
                    <div className="dashboard-custom-range">
                        <div className="dashboard-date-input">
                            <span>From</span>
                            <input type="date" className="input" style={{ width: 'auto', padding: '6px 10px', fontSize: 13 }} value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
                        </div>
                        <div className="dashboard-date-input">
                            <span>To</span>
                            <input type="date" className="input" style={{ width: 'auto', padding: '6px 10px', fontSize: 13 }} value={toDate} onChange={(event) => setToDate(event.target.value)} />
                        </div>
                    </div>
                )}

                {!isCompactCharts && (
                    <div className="charts-filter-row">
                        {activeReport !== 'income' && (
                            <div className="dashboard-date-input">
                                <span>Category</span>
                                <select
                                    className="input"
                                    style={{ width: 'auto', padding: '6px 10px', fontSize: 13 }}
                                    value={filterMainId}
                                    onChange={(event) => {
                                        setFilterMainId(event.target.value);
                                        setFilterSubId('');
                                    }}
                                >
                                    <option value="">All</option>
                                    {mainCategoriesForFilter.map((category) => (
                                        <option key={category.id} value={category.id}>{category.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        {activeReport !== 'income' && filterMainId && subcategoryOptions.length > 0 && (
                            <div className="dashboard-date-input">
                                <span>Subcategory</span>
                                <select className="input" style={{ width: 'auto', padding: '6px 10px', fontSize: 13 }} value={filterSubId} onChange={(event) => setFilterSubId(event.target.value)}>
                                    <option value="">All</option>
                                    {subcategoryOptions.map((subcategory) => (
                                        <option key={subcategory.id} value={subcategory.id}>{subcategory.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        {activeReport === 'spending' && (
                            <div className="dashboard-filter-switch" style={{ gap: 6 }}>
                                <button className={`btn btn-sm ${spendingView === 'totals' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSpendingView('totals')} style={{ fontSize: 12 }}>
                                    Totals
                                </button>
                                <button className={`btn btn-sm ${spendingView === 'change' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSpendingView('change')} style={{ fontSize: 12 }}>
                                    Change over time
                                </button>
                            </div>
                        )}
                        <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            style={{ fontSize: 12 }}
                            onClick={resetReportFilters}
                        >
                            Clear all
                        </button>
                        <button
                            type="button"
                            className="btn btn-secondary btn-sm charts-ai-button"
                            disabled={aiSummaryLoading}
                            onClick={handleGetAiSummary}
                        >
                            <Sparkles size={14} /> {aiSummaryLoading ? 'Generating...' : 'Get AI summary'}
                        </button>
                    </div>
                )}

                {isCompactCharts && activeReport === 'spending' && (
                    <div className="charts-mobile-secondary-row">
                        <button className={`btn btn-sm ${spendingView === 'totals' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSpendingView('totals')} style={{ fontSize: 12 }}>
                            Totals
                        </button>
                        <button className={`btn btn-sm ${spendingView === 'change' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSpendingView('change')} style={{ fontSize: 12 }}>
                            Change over time
                        </button>
                    </div>
                )}
            </div>

            <div className="charts-report-hero">
                <div className="card hero-panel charts-report-panel">
                    <div className="hero-panel-head">
                        <div>
                            <div className="dashboard-section-kicker">Focused view</div>
                            <div className="hero-panel-title">
                                {activeReport === 'cashflow' && 'Money in, money out, and what stays with you'}
                                {activeReport === 'spending' && 'Where spending is concentrated and how it moves'}
                                {activeReport === 'income' && 'Which sources are funding the period'}
                                {activeReport === 'expense' && 'Which expenses need attention first'}
                            </div>
                        </div>
                        <BarChart3 size={18} style={{ color: 'var(--accent-primary)' }} />
                    </div>
                    <div className="hero-panel-note">{reportLead[activeReport]}</div>
                </div>

                <div className="card hero-panel charts-ai-panel">
                    <div className="hero-panel-head">
                        <div>
                            <div className="dashboard-section-kicker">AI summary</div>
                            <div className="hero-panel-title">AI highlights</div>
                        </div>
                        <Sparkles size={18} style={{ color: 'var(--accent-primary)' }} />
                    </div>
                    {aiSummary ? (
                        <div
                            className="ai-msg-content-wrap charts-ai-summary"
                            dangerouslySetInnerHTML={{
                                __html: (aiSummary || '')
                                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                    .replace(/\n- /g, '\n• ')
                                    .replace(/\n/g, '<br/>'),
                            }}
                        />
                    ) : (
                        <div className="hero-panel-note">
                            Ask Finly AI for a polished summary with key numbers, quick signals, and a recommended next step.
                        </div>
                    )}
                </div>
            </div>

            <div className="stats-grid charts-stats-grid">
                {activeCards.map((card) => {
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

            {activeReport === 'cashflow' && (
                <>
                    <div ref={cashFlowChartRef} className="card charts-section-card charts-cashflow-map-card">
                        <div className="card-header">
                            <div>
                                <div className="card-title">Cash flow map</div>
                                <div className="card-subtitle">A flow view of income sources, where the money goes, and what remains.</div>
                            </div>
                        </div>
                        {cashFlowSankeyData ? (
                            <>
                                <div className="chart-container charts-cashflow-container" style={{ minHeight: cashFlowLayout.chartHeight }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <Sankey
                                            data={cashFlowSankeyData}
                                            nodePadding={cashFlowLayout.nodePadding}
                                            nodeWidth={cashFlowLayout.nodeWidth}
                                            margin={cashFlowLayout.margin}
                                            node={renderCashFlowNode}
                                        >
                                            <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatCurrency(value)} />
                                        </Sankey>
                                    </ResponsiveContainer>
                                </div>
                                {isCompactCharts && cashFlowBreakdown && (
                                    <div className="cashflow-mobile-summary">
                                        <div className="cashflow-mobile-summary-section">
                                            <div className="cashflow-mobile-label">Income sources</div>
                                            {cashFlowBreakdown.sources.map((source) => (
                                                <div key={source.id} className="cashflow-mobile-node">
                                                    <span className="cashflow-mobile-node-name">{source.icon || '💰'} {truncateText(source.name, 18)}</span>
                                                    <span className="cashflow-mobile-node-value">{formatCompactCurrency(source.total)}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="cashflow-mobile-summary-section">
                                            <div className="cashflow-mobile-label">Outflows</div>
                                            {cashFlowBreakdown.expenses.map((expense) => (
                                                <div key={expense.id} className="cashflow-mobile-node">
                                                    <span className="cashflow-mobile-node-name">{expense.icon || '•'} {truncateText(expense.name, 18)}</span>
                                                    <span className="cashflow-mobile-node-value">{formatCompactCurrency(expense.total)}</span>
                                                </div>
                                            ))}
                                            <div className="cashflow-mobile-node cashflow-mobile-node-savings">
                                                <span className="cashflow-mobile-node-name">Savings</span>
                                                <span className="cashflow-mobile-node-value">{formatCompactCurrency(Math.max(0, visibleSummary.balance))}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="chart-container">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={cashFlowTrendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                                        <XAxis dataKey="period" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(value) => formatChartPeriod(value)} interval="preserveStartEnd" />
                                        <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(value) => formatCurrency(value)} />
                                        <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatCurrency(value)} />
                                        <Legend />
                                        <Area type="monotone" dataKey="income" name="Income" stroke="var(--income)" fill="rgba(16, 185, 129, 0.18)" />
                                        <Area type="monotone" dataKey="expense" name="Expense" stroke="var(--expense)" fill="rgba(239, 68, 68, 0.12)" />
                                        <Line type="monotone" dataKey="balance" name="Net flow" stroke="var(--accent-primary)" strokeWidth={3} dot={false} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>

                    <div className="grid-2 charts-grid-section charts-cashflow-support-grid">
                        <div className="card charts-section-card">
                            <div className="card-header">
                                <div>
                                    <div className="card-title">Flow checkpoints</div>
                                    <div className="card-subtitle">Keep the strongest inflows, biggest outflows, and month-end direction in one place.</div>
                                </div>
                            </div>
                            <div className="charts-category-list">
                                <div className="charts-category-row">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span>📈 Strongest income source</span>
                                    </div>
                                    <span style={{ fontWeight: 600 }}>{topIncomeSource ? `${topIncomeSource.icon} ${topIncomeSource.name}` : 'No data'}</span>
                                </div>
                                <div className="charts-category-row">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span>💸 Biggest outflow</span>
                                    </div>
                                    <span style={{ fontWeight: 600 }}>{topCategory ? `${topCategory.icon} ${topCategory.name}` : 'No data'}</span>
                                </div>
                                <div className="charts-category-row">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span>🗓 Projected month end</span>
                                    </div>
                                    <span style={{ fontWeight: 600 }}>{formatCurrency(projectedMonthBalance)}</span>
                                </div>
                                <div className="charts-category-row">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span>✅ Savings rate</span>
                                    </div>
                                    <span style={{ fontWeight: 600 }}>{savingsRate}%</span>
                                </div>
                            </div>
                        </div>

                        <div className="card charts-section-card">
                            <div className="card-header">
                                <div>
                                    <div className="card-title">Visible in this map</div>
                                    <div className="card-subtitle">The sources and destinations currently highlighted in the cash-flow view.</div>
                                </div>
                            </div>
                            {cashFlowBreakdown ? (
                                <div className="charts-category-list">
                                    {cashFlowBreakdown.sources.map((source) => (
                                        <div key={`source-${source.id}`} className="charts-category-row">
                                            <span>↗ {source.icon || '💰'} {source.name}</span>
                                            <span style={{ fontWeight: 600 }}>{formatCurrency(source.total)}</span>
                                        </div>
                                    ))}
                                    {cashFlowBreakdown.expenses.map((expense) => (
                                        <div key={`expense-${expense.id}`} className="charts-category-row">
                                            <span>↘ {expense.icon || '•'} {expense.name}</span>
                                            <span style={{ fontWeight: 600 }}>{formatCurrency(expense.total)}</span>
                                        </div>
                                    ))}
                                    <div className="charts-category-row">
                                        <span>✓ Savings</span>
                                        <span style={{ fontWeight: 600 }}>{formatCurrency(Math.max(0, visibleSummary.balance))}</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="empty-state" style={{ padding: 20 }}><p>No cash-flow map data for this period.</p></div>
                            )}
                        </div>
                    </div>
                </>
            )}

            {activeReport === 'spending' && (
                <>
                    <div className="grid-2 charts-grid-section">
                        <div className="card charts-section-card">
                            <div className="card-header">
                                <div>
                                    <div className="card-title">{spendingView === 'totals' ? 'Spending mix' : 'Spending change over time'}</div>
                                    <div className="card-subtitle">
                                        {spendingView === 'totals'
                                            ? 'See which categories are taking the largest share of the period.'
                                            : 'Track how category pressure changes across the selected range.'}
                                    </div>
                                </div>
                            </div>
                            {spendingView === 'totals' ? (
                                filteredCategoryData.length > 0 ? (
                                    <>
                                        <div className="chart-container">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={filteredCategoryData}
                                                        dataKey="total"
                                                        nameKey="name"
                                                        cx="50%"
                                                        cy="50%"
                                                    innerRadius={isCompactCharts ? 42 : 60}
                                                    outerRadius={isCompactCharts ? 78 : 102}
                                                        paddingAngle={3}
                                                        onClick={(data) => data?.id && navigate(`/transactions?categoryId=${data.id}&type=expense&startDate=${startDate}&endDate=${endDate}`)}
                                                    >
                                                        {filteredCategoryData.map((entry, index) => (
                                                            <Cell key={entry.id || index} fill={entry.color} style={{ cursor: 'pointer' }} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatCurrency(value)} />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                        <div className="charts-category-list">
                                            {filteredCategoryData.slice(0, 6).map((category) => (
                                                <div
                                                    key={category.id}
                                                    className="charts-category-row"
                                                    onClick={() => navigate(`/transactions?categoryId=${category.id}&type=expense&startDate=${startDate}&endDate=${endDate}`)}
                                                    title="View transactions"
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: category.color, flexShrink: 0 }} />
                                                        <span>{category.icon} {category.name}</span>
                                                    </div>
                                                    <span style={{ fontWeight: 600 }}>{formatCurrency(category.total)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                ) : (
                                    <div className="empty-state" style={{ padding: 20 }}><p>No expenses for this period.</p></div>
                                )
                            ) : (
                                displayStackedTrend.data.length > 0 && displayStackedTrend.categories.length > 0 ? (
                                    <div className="chart-container" style={{ minHeight: 320 }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={displayStackedTrend.data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                                                <XAxis dataKey="period" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(value) => formatChartPeriod(value)} interval="preserveStartEnd" />
                                                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(value) => formatCurrency(value)} domain={[0, (dataMax) => Math.max(dataMax * 1.05 || 1, 1)]} />
                                                <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatCurrency(value)} />
                                                <Legend />
                                                {displayStackedTrend.categories.map((category, index) => (
                                                    <Area key={category.id} dataKey={category.id} name={category.name} type="monotone" fill={category.color || CATEGORY_COLORS[index % CATEGORY_COLORS.length]} stroke={category.color || CATEGORY_COLORS[index % CATEGORY_COLORS.length]} stackId="1" />
                                                ))}
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                ) : (
                                    <div className="empty-state" style={{ padding: 20 }}><p>No trend data available for this period.</p></div>
                                )
                            )}
                        </div>

                        <div className="card charts-section-card">
                            <div className="card-header">
                                <div>
                                    <div className="card-title">Spending summary</div>
                                    <div className="card-subtitle">A compact review of transaction count, ticket size, and the category leading the period.</div>
                                </div>
                            </div>
                            <div className="charts-category-list">
                                <div className="charts-category-row">
                                    <span>Transactions</span>
                                    <span style={{ fontWeight: 600 }}>{expenseTransactions.length}</span>
                                </div>
                                <div className="charts-category-row">
                                    <span>Average ticket</span>
                                    <span style={{ fontWeight: 600 }}>{formatCurrency(expenseTransactions.length ? visibleSummary.expense / expenseTransactions.length : 0)}</span>
                                </div>
                                <div className="charts-category-row">
                                    <span>Largest purchase</span>
                                    <span style={{ fontWeight: 600 }}>{largestExpense ? formatCurrency(largestExpense.amount) : formatCurrency(0)}</span>
                                </div>
                                <div className="charts-category-row">
                                    <span>Top category</span>
                                    <span style={{ fontWeight: 600 }}>{topCategory ? `${topCategory.icon} ${topCategory.name}` : 'No data'}</span>
                                </div>
                            </div>
                            {heatmapGrid.cells.length > 0 && (
                                <div className="charts-activity-panel">
                                    <div className="card-subtitle">Daily activity</div>
                                    <div className="charts-activity-legend">
                                        <span>{formatChartPeriod(startDate)}</span>
                                        <span>Lower spend</span>
                                        <span className="charts-activity-legend-scale">
                                            <span />
                                            <span />
                                            <span />
                                            <span />
                                        </span>
                                        <span>Higher spend</span>
                                        <span>{formatChartPeriod(endDate)}</span>
                                    </div>
                                    <div className="charts-activity-grid">
                                        {heatmapGrid.cells.map((cell, index) => {
                                            const level = heatmapGrid.maxExpense > 0 ? Math.min(4, Math.ceil((cell.expense / heatmapGrid.maxExpense) * 4)) : 0;
                                            const background = level === 0 ? 'var(--bg-input)' : `rgba(239, 68, 68, ${0.18 + (level / 4) * 0.78})`;
                                            return (
                                                <button
                                                    type="button"
                                                    key={index}
                                                    className={`heatmap-cell ${selectedActivityDate === cell.dateStr ? 'active' : ''}`}
                                                    style={{ background }}
                                                    title={`${cell.dateStr}: ${formatCurrency(cell.expense)}`}
                                                    onClick={() => setSelectedActivityDate(cell.dateStr)}
                                                >
                                                    <span className="heatmap-cell-day">{cell.dayLabel}</span>
                                                    <span className="heatmap-cell-count">{cell.count > 0 ? `${cell.count} tx` : 'No spend'}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {selectedActivityCell && (
                                        <div className="charts-activity-summary">
                                            <div className="charts-activity-summary-top">
                                                <div>
                                                    <div className="charts-activity-summary-label">{selectedActivityCell.fullLabel}</div>
                                                    <div className="charts-activity-summary-value">{formatCurrency(selectedActivityCell.expense)}</div>
                                                </div>
                                                <div className="charts-activity-summary-badge">{selectedActivityCell.count} transaction{selectedActivityCell.count === 1 ? '' : 's'}</div>
                                            </div>
                                            <div className="charts-activity-summary-meta">
                                                <span>{selectedActivityLargestPurchase ? `Largest purchase ${formatCurrency(selectedActivityLargestPurchase.amount)}` : 'No purchases recorded on this day'}</span>
                                                <span>{selectedActivityLargestPurchase?.category_name || 'No leading category yet'}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="card charts-section-card">
                        <div className="card-header">
                            <div>
                                <div className="card-title">Recent expense activity</div>
                                <div className="card-subtitle">Quick access to the transactions shaping this spending report.</div>
                            </div>
                        </div>
                        {expenseTransactions.length > 0 ? (
                            <div className="charts-category-list">
                                {expenseTransactions.slice(0, 8).map((transaction) => (
                                    <div key={transaction.id} className="charts-category-row" onClick={() => navigate(`/add?edit=${transaction.id}`)} title="Open transaction">
                                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                            <span style={{ fontWeight: 600 }}>{transaction.category_icon || '💸'} {transaction.category_name || 'Expense'}</span>
                                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{transaction.note || formatChartPeriod(transaction.date)}</span>
                                        </div>
                                        <span style={{ fontWeight: 700, color: 'var(--expense)' }}>{formatCurrency(transaction.amount)}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="empty-state" style={{ padding: 20 }}><p>No expense transactions in this period.</p></div>
                        )}
                    </div>
                </>
            )}

            {activeReport === 'income' && (
                <div className="grid-2 charts-grid-section">
                    <div className="card charts-section-card">
                        <div className="card-header">
                            <div>
                                <div className="card-title">Income sources</div>
                                <div className="card-subtitle">A clean view of which sources are funding the period.</div>
                            </div>
                        </div>
                        {incomeCategoryData.length > 0 ? (
                            <>
                                <div className="chart-container">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={incomeCategoryData}
                                                dataKey="total"
                                                nameKey="name"
                                                cx="50%"
                                                cy="50%"
                                                    innerRadius={isCompactCharts ? 42 : 60}
                                                    outerRadius={isCompactCharts ? 78 : 102}
                                                paddingAngle={3}
                                                onClick={(data) => data?.id && navigate(`/transactions?categoryId=${data.id}&type=income&startDate=${startDate}&endDate=${endDate}`)}
                                            >
                                                {incomeCategoryData.map((entry, index) => (
                                                    <Cell key={entry.id || index} fill={entry.color} style={{ cursor: 'pointer' }} />
                                                ))}
                                            </Pie>
                                            <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatCurrency(value)} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="charts-category-list">
                                    {incomeCategoryData.map((category) => (
                                        <div
                                            key={category.id}
                                            className="charts-category-row"
                                            onClick={() => navigate(`/transactions?categoryId=${category.id}&type=income&startDate=${startDate}&endDate=${endDate}`)}
                                            title="View transactions"
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <div style={{ width: 10, height: 10, borderRadius: '50%', background: category.color, flexShrink: 0 }} />
                                                <span>{category.icon} {category.name}</span>
                                            </div>
                                            <span style={{ fontWeight: 600 }}>{formatCurrency(category.total)}</span>
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div className="empty-state" style={{ padding: 20 }}><p>No income for this period.</p></div>
                        )}
                    </div>

                    <div className="card charts-section-card">
                        <div className="card-header">
                            <div>
                                <div className="card-title">Income trend</div>
                                <div className="card-subtitle">Track how money is arriving across the selected range.</div>
                            </div>
                        </div>
                        {incomeTrendOnly.length > 0 ? (
                            <div className="chart-container">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={incomeTrendOnly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                                        <XAxis dataKey="period" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(value) => formatChartPeriod(value, { day: 'numeric' })} interval="preserveStartEnd" />
                                        <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} domain={[0, (dataMax) => Math.max(dataMax * 1.05 || 1, 1)]} />
                                        <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatCurrency(value)} />
                                        <Line type="monotone" dataKey="value" name="Income" stroke="var(--income)" strokeWidth={3} dot={{ r: 3 }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="empty-state" style={{ padding: 20 }}><p>No income trend available for this period.</p></div>
                        )}
                    </div>
                </div>
            )}

            {activeReport === 'expense' && (
                <>
                    <div className="grid-2 charts-grid-section">
                        <div className="card charts-section-card">
                            <div className="card-header">
                                <div>
                                    <div className="card-title">Expense trend</div>
                                    <div className="card-subtitle">Follow pace changes and spot spikes quickly.</div>
                                </div>
                            </div>
                            {displayExpenseTrendOnly.length > 0 ? (
                                <div className="chart-container">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={displayExpenseTrendOnly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                                            <XAxis dataKey="period" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(value) => formatChartPeriod(value, { day: 'numeric' })} interval="preserveStartEnd" />
                                            <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} domain={[0, (dataMax) => Math.max(dataMax * 1.05 || 1, 1)]} />
                                            <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatCurrency(value)} />
                                            <Bar dataKey="value" name="Expense" fill="var(--expense)" radius={[8, 8, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <div className="empty-state" style={{ padding: 20 }}><p>No expense trend available for this period.</p></div>
                            )}
                        </div>

                        <div className="card charts-section-card">
                            <div className="card-header">
                                <div>
                                    <div className="card-title">Expense ranking</div>
                                    <div className="card-subtitle">The categories drawing the most money right now.</div>
                                </div>
                            </div>
                            {filteredCategoryData.length > 0 ? (
                                <div className="charts-category-list">
                                    {filteredCategoryData.map((category) => (
                                        <div key={category.id} className="charts-category-row" onClick={() => navigate(`/transactions?categoryId=${category.id}&type=expense&startDate=${startDate}&endDate=${endDate}`)} title="View transactions">
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <div style={{ width: 10, height: 10, borderRadius: '50%', background: category.color, flexShrink: 0 }} />
                                                <span>{category.icon} {category.name}</span>
                                            </div>
                                            <span style={{ fontWeight: 600 }}>{formatCurrency(category.total)}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="empty-state" style={{ padding: 20 }}><p>No expense categories for this period.</p></div>
                            )}
                        </div>
                    </div>

                    <div className="card charts-section-card">
                        <div className="card-header">
                            <div>
                                <div className="card-title">Budget coverage</div>
                                <div className="card-subtitle">Compare tracked category limits with actual spend without duplicating the same totals in multiple charts.</div>
                            </div>
                        </div>
                        {filteredBudgetData.length > 0 ? (
                            <div className="charts-category-list">
                                {filteredBudgetData.map((row) => {
                                    const spendPct = row.budget > 0 ? Math.min((row.spent / row.budget) * 100, 100) : 0;
                                    const tone = row.budget > 0 && row.spent > row.budget ? 'var(--danger)' : spendPct > 75 ? 'var(--warning)' : 'var(--income)';
                                    return (
                                        <div key={row.categoryId} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 14px', borderRadius: 14, border: '1px solid var(--border)', background: 'var(--bg-input)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                                                <span style={{ fontWeight: 600 }}>{row.name}</span>
                                                <span style={{ fontWeight: 700 }}>{formatCurrency(row.spent)} / {formatCurrency(row.budget)}</span>
                                            </div>
                                            <div className="budget-progress-track" style={{ margin: 0 }}>
                                                <div className="budget-progress-bar" style={{ width: `${spendPct}%`, background: tone }} />
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)' }}>
                                                <span>{row.budget > 0 ? `${spendPct.toFixed(0)}% used` : 'No budget target yet'}</span>
                                                <span>{row.budget > row.spent ? `${formatCurrency(row.budget - row.spent)} left` : `${formatCurrency(Math.abs(row.spent - row.budget))} over`}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="empty-state" style={{ padding: 20 }}><p>No tracked budget categories for this period.</p></div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
