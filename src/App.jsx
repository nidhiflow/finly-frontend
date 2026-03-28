import { useState, useEffect, useRef, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, ArrowLeftRight, CalendarDays, BarChart3, Wallet, Tag, PiggyBank, Settings as SettingsIcon, Plus, Sun, Moon, Sparkles, Search, X, Clock, Bookmark, Menu, Target, MoreHorizontal, Bell, Trash2, AlertTriangle, ArrowLeft } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppProvider, useApp } from './context/AppContext';
import { transactionsAPI, bookmarksAPI, accountsAPI, budgetsAPI, savingsGoalsAPI, statsAPI } from './services/api';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useIsMobile } from './hooks/useIsMobile';
import { addNativeAppUrlListener, applyNativeWindowStyling, getNativeLaunchUrl, hideNativeSplash, isNativeApp } from './utils/native';

import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import AddTransaction from './pages/AddTransaction';
import Categories from './pages/Categories';
import Accounts from './pages/Accounts';
import Calendar from './pages/Calendar';
import Charts from './pages/Charts';
import Budget from './pages/Budget';
import SettingsPage from './pages/Settings';
import AiAgent from './pages/AiAgent';
import ForgotPassword from './pages/ForgotPassword';
import SavingsGoals from './pages/SavingsGoals';

import './index.css';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-spinner" />;
  if (!user) return <Navigate to="/login" />;
  return children;
}

function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState(() => {
    try { return JSON.parse(localStorage.getItem('finly_recent_searches') || '[]'); } catch { return []; }
  });
  const searchRef = useRef(null);
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const debounceRef = useRef(null);
  const { formatCurrency } = useApp();

  // Keyboard shortcut Ctrl+K
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
      if (e.key === 'Escape') { setIsOpen(false); setQuery(''); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (searchRef.current && !searchRef.current.contains(e.target)) setIsOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const doSearch = useCallback(async (q) => {
    if (!q || q.length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const data = await transactionsAPI.list({ search: q, limit: 8 });
      setResults(data);
    } catch { setResults([]); }
    finally { setLoading(false); }
  }, []);

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    setIsOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 300);
  };

  const saveRecentSearch = (q) => {
    const updated = [q, ...recentSearches.filter(s => s !== q)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem('finly_recent_searches', JSON.stringify(updated));
  };

  const handleResultClick = (tx) => {
    saveRecentSearch(query);
    setIsOpen(false);
    setQuery('');
    navigate(`/add?edit=${tx.id}`);
  };

  const handleRecentClick = (s) => {
    setQuery(s);
    doSearch(s);
  };

  const clearRecent = () => {
    setRecentSearches([]);
    localStorage.removeItem('finly_recent_searches');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.length >= 2) {
      saveRecentSearch(query);
      setIsOpen(false);
      navigate(`/transactions`);
    }
  };

  return (
    <div className="global-search" ref={searchRef}>
      <form onSubmit={handleSubmit} className="global-search-form">
        <Search size={16} className="global-search-icon" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search transactions, notes, categories... (Ctrl+K)"
          value={query}
          onChange={handleChange}
          onFocus={() => setIsOpen(true)}
          className="global-search-input"
        />
        {query && <button type="button" className="global-search-clear" onClick={() => { setQuery(''); setResults([]); }}><X size={14} /></button>}
      </form>

      {isOpen && (
        <div className="global-search-dropdown">
          {loading && <div className="global-search-loading">Searching...</div>}

          {!loading && query.length >= 2 && results.length > 0 && (
            <>
              <div className="global-search-section-title">Transactions</div>
              {results.map(tx => (
                <div key={tx.id} className="global-search-result" onClick={() => handleResultClick(tx)}>
                  <div className="global-search-result-icon" style={{ background: tx.category_color ? `${tx.category_color}20` : 'var(--bg-input)' }}>
                    {tx.category_icon || (tx.type === 'income' ? '💰' : '💸')}
                  </div>
                  <div className="global-search-result-info">
                    <div className="global-search-result-name">{tx.category_name || tx.type}</div>
                    <div className="global-search-result-note">{tx.note || tx.date}</div>
                  </div>
                  <div className={`global-search-result-amount ${tx.type}`}>
                    {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                  </div>
                </div>
              ))}
            </>
          )}

          {!loading && query.length >= 2 && results.length === 0 && (
            <div className="global-search-empty">No results found for "{query}"</div>
          )}

          {!loading && query.length < 2 && recentSearches.length > 0 && (
            <>
              <div className="global-search-section-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Recent Searches</span>
                <button className="btn btn-ghost" style={{ fontSize: 11, padding: '2px 6px' }} onClick={clearRecent}>Clear</button>
              </div>
              {recentSearches.map((s, i) => (
                <div key={i} className="global-search-result" onClick={() => handleRecentClick(s)}>
                  <Clock size={14} style={{ color: 'var(--text-muted)', marginRight: 8 }} />
                  <span>{s}</span>
                </div>
              ))}
            </>
          )}

          {!loading && query.length < 2 && recentSearches.length === 0 && (
            <div className="global-search-empty">Type to search transactions by notes, categories, amounts...</div>
          )}
        </div>
      )}
    </div>
  );
}

function MobileSearchOverlay({ onClose }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState(() => {
    try { return JSON.parse(localStorage.getItem('finly_recent_searches') || '[]'); } catch { return []; }
  });
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const debounceRef = useRef(null);
  const { formatCurrency } = useApp();

  useEffect(() => {
    inputRef.current?.focus();
    document.documentElement.classList.add('mobile-nav-open');
    return () => document.documentElement.classList.remove('mobile-nav-open');
  }, []);

  const doSearch = useCallback(async (q) => {
    if (!q || q.length < 2) { setResults([]); return; }
    setLoading(true);
    try { setResults(await transactionsAPI.list({ search: q, limit: 10 })); }
    catch { setResults([]); }
    finally { setLoading(false); }
  }, []);

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 300);
  };

  const saveRecent = (q) => {
    const updated = [q, ...recentSearches.filter(s => s !== q)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem('finly_recent_searches', JSON.stringify(updated));
  };

  const handleResultClick = (tx) => {
    saveRecent(query);
    onClose();
    navigate(`/add?edit=${tx.id}`);
  };

  const handleRecentClick = (s) => {
    setQuery(s);
    doSearch(s);
  };

  const clearRecent = () => {
    setRecentSearches([]);
    localStorage.removeItem('finly_recent_searches');
  };

  return (
    <div className="mobile-search-overlay">
      <div className="mobile-search-header">
        <button className="mobile-search-back" onClick={onClose}>
          <X size={22} />
        </button>
        <input
          ref={inputRef}
          type="text"
          placeholder="Search transactions, notes, categories..."
          value={query}
          onChange={handleChange}
          className="mobile-search-input"
        />
        {query && (
          <button className="mobile-search-clear" onClick={() => { setQuery(''); setResults([]); }}>
            <X size={16} />
          </button>
        )}
      </div>
      <div className="mobile-search-results">
        {loading && <div className="global-search-loading">Searching...</div>}

        {!loading && query.length >= 2 && results.length > 0 && (
          <>
            <div className="global-search-section-title">Transactions</div>
            {results.map(tx => (
              <div key={tx.id} className="global-search-result" onClick={() => handleResultClick(tx)}>
                <div className="global-search-result-icon" style={{ background: tx.category_color ? `${tx.category_color}20` : 'var(--bg-input)' }}>
                  {tx.category_icon || (tx.type === 'income' ? '💰' : '💸')}
                </div>
                <div className="global-search-result-info">
                  <div className="global-search-result-name">{tx.category_name || tx.type}</div>
                  <div className="global-search-result-note">{tx.note || tx.date}</div>
                </div>
                <div className={`global-search-result-amount ${tx.type}`}>
                  {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                </div>
              </div>
            ))}
          </>
        )}

        {!loading && query.length >= 2 && results.length === 0 && (
          <div className="global-search-empty">No results found for "{query}"</div>
        )}

        {!loading && query.length < 2 && recentSearches.length > 0 && (
          <>
            <div className="global-search-section-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Recent Searches</span>
              <button className="btn btn-ghost" style={{ fontSize: 11, padding: '2px 6px' }} onClick={clearRecent}>Clear</button>
            </div>
            {recentSearches.map((s, i) => (
              <div key={i} className="global-search-result" onClick={() => handleRecentClick(s)}>
                <Clock size={14} style={{ color: 'var(--text-muted)', marginRight: 8 }} />
                <span>{s}</span>
              </div>
            ))}
          </>
        )}

        {!loading && query.length < 2 && recentSearches.length === 0 && (
          <div className="global-search-empty">Type to search transactions by notes, categories, amounts...</div>
        )}
      </div>
    </div>
  );
}

function getCurrentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function readStoredList(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function NotificationCenter() {
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [dismissedIds, setDismissedIds] = useState(() => readStoredList('finly_notifications_deleted_v1'));
  const [readIds, setReadIds] = useState(() => readStoredList('finly_notifications_read_v1'));
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { formatCurrency } = useApp();

  const persistList = useCallback((key, values) => {
    localStorage.setItem(key, JSON.stringify(values));
  }, []);

  const markAsRead = useCallback((id) => {
    setReadIds((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      persistList('finly_notifications_read_v1', next);
      return next;
    });
  }, [persistList]);

  const loadNotifications = useCallback(async () => {
    try {
      const [weeklySummary, budgets, goals] = await Promise.all([
        statsAPI.weeklySummary().catch(() => []),
        budgetsAPI.list({ month: getCurrentMonthKey() }).catch(() => []),
        savingsGoalsAPI.list({ month: getCurrentMonthKey() }).catch(() => []),
      ]);

      const generated = [];
      const latestWeek = Array.isArray(weeklySummary) ? weeklySummary[weeklySummary.length - 1] : null;
      if (latestWeek) {
        generated.push({
          id: `weekly-${latestWeek.week}`,
          type: 'weekly',
          icon: Sparkles,
          title: 'Weekly AI money summary',
          message: `Income ${formatCurrency(latestWeek.income)}, expense ${formatCurrency(latestWeek.expense)}, and savings ${formatCurrency(latestWeek.savings)} for ${latestWeek.week}.`,
          detail: `Net balance for the week is ${formatCurrency(latestWeek.income - latestWeek.expense)}. Review Reports for the full trend and cash-flow mix.`,
          actionLabel: 'Open reports',
          actionPath: '/charts',
          tone: 'info',
        });
      }

      const monthKey = getCurrentMonthKey();
      (Array.isArray(budgets) ? budgets : [])
        .filter((budget) => budget.amount > 0 && budget.spent >= budget.amount * 0.9)
        .sort((left, right) => (right.spent / right.amount) - (left.spent / left.amount))
        .forEach((budget) => {
          const percentUsed = Math.round((budget.spent / budget.amount) * 100);
          const exceeded = budget.spent > budget.amount;
          generated.push({
            id: `budget-${budget.id}-${monthKey}`,
            type: 'budget',
            icon: AlertTriangle,
            title: exceeded ? `${budget.category_name || 'Budget'} exceeded` : `${budget.category_name || 'Budget'} almost used`,
            message: exceeded
              ? `${formatCurrency(Math.abs(budget.remaining))} over budget at ${percentUsed}% used.`
              : `${formatCurrency(Math.max(budget.remaining, 0))} left before hitting the limit.`,
            detail: `${budget.category_name || 'This budget'} has used ${formatCurrency(budget.spent)} out of ${formatCurrency(budget.amount)} this month.`,
            actionLabel: 'Open budget',
            actionPath: '/budget',
            tone: exceeded ? 'danger' : 'warning',
          });
        });

      (Array.isArray(goals) ? goals : []).forEach((goal) => {
        const progress = goal.target_amount > 0 ? Math.round((goal.current_amount / goal.target_amount) * 100) : 0;
        if (progress >= 100) {
          generated.push({
            id: `goal-complete-${goal.id}`,
            type: 'goal',
            icon: Target,
            title: `${goal.name} is complete`,
            message: `You have reached ${formatCurrency(goal.current_amount)} against the ${formatCurrency(goal.target_amount)} target.`,
            detail: 'This goal is ready for a new milestone or a fresh savings target.',
            actionLabel: 'Open goals',
            actionPath: '/goals',
            tone: 'success',
          });
          return;
        }
        if (progress >= 90) {
          generated.push({
            id: `goal-progress-${goal.id}-90`,
            type: 'goal',
            icon: Target,
            title: `${goal.name} nearly there`,
            message: `${progress}% funded. ${formatCurrency(Math.max(goal.target_amount - goal.current_amount, 0))} left to reach the target.`,
            detail: `Current savings are ${formatCurrency(goal.current_amount)} out of ${formatCurrency(goal.target_amount)}.`,
            actionLabel: 'Open goals',
            actionPath: '/goals',
            tone: 'success',
          });
          return;
        }
        if (progress >= 80) {
          generated.push({
            id: `goal-progress-${goal.id}-80`,
            type: 'goal',
            icon: Target,
            title: `${goal.name} on track`,
            message: `${progress}% funded. ${formatCurrency(Math.max(goal.target_amount - goal.current_amount, 0))} still to save.`,
            detail: `Current savings are ${formatCurrency(goal.current_amount)} out of ${formatCurrency(goal.target_amount)}.`,
            actionLabel: 'Open goals',
            actionPath: '/goals',
            tone: 'warning',
          });
          return;
        }
        if (progress < 50) {
          generated.push({
            id: `goal-progress-${goal.id}-${progress}`,
            type: 'goal',
            icon: Target,
            title: `${goal.name} needs attention`,
            message: `${progress}% funded so far with ${formatCurrency(Math.max(goal.target_amount - goal.current_amount, 0))} still to save.`,
            detail: `Current savings are ${formatCurrency(goal.current_amount)} out of ${formatCurrency(goal.target_amount)}. A small extra contribution this week could move it forward.`,
            actionLabel: 'Open goals',
            actionPath: '/goals',
            tone: 'warning',
          });
        }
      });

      const visibleNotifications = generated.filter((notification) => !dismissedIds.includes(notification.id));
      setNotifications(visibleNotifications);
      setSelectedId((currentSelectedId) => {
        if (isMobile) return '';
        if (visibleNotifications.some((notification) => notification.id === currentSelectedId)) {
          return currentSelectedId;
        }
        return visibleNotifications[0]?.id || '';
      });
    } catch {
      setNotifications([]);
    }
  }, [dismissedIds, formatCurrency, isMobile]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadNotifications();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadNotifications]);

  useEffect(() => {
    const onRefresh = () => loadNotifications();
    window.addEventListener('finly-notifications-refresh', onRefresh);
    return () => window.removeEventListener('finly-notifications-refresh', onRefresh);
  }, [loadNotifications]);

  useEffect(() => {
    const handler = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    ['mousedown', 'touchstart'].forEach((ev) => document.addEventListener(ev, handler));
    return () => ['mousedown', 'touchstart'].forEach((ev) => document.removeEventListener(ev, handler));
  }, []);

  const removeNotification = (event, id) => {
    event.stopPropagation();
    setDismissedIds((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      persistList('finly_notifications_deleted_v1', next);
      return next;
    });
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    setSelectedId((prev) => (prev === id ? '' : prev));
  };

  const clearAllNotifications = () => {
    const allIds = notifications.map((n) => n.id);
    const nextDismissed = [...new Set([...dismissedIds, ...allIds])];
    setDismissedIds(nextDismissed);
    persistList('finly_notifications_deleted_v1', nextDismissed);
    setNotifications([]);
    setSelectedId('');
  };

  const selectedNotification = notifications.find((notification) => notification.id === selectedId) || null;
  const unreadCount = notifications.filter((notification) => !readIds.includes(notification.id)).length;

  return (
    <div className="notifications-dropdown" ref={dropdownRef}>
      <button
        className="btn btn-ghost btn-sm btn-icon bookmarks-btn notifications-btn"
        onClick={() => {
          if (!isOpen) loadNotifications();
          setIsOpen(!isOpen);
        }}
        title="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && <span className="bookmarks-badge notifications-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>

      {isOpen && (
        <div className="bookmarks-panel notifications-panel">
          <div className="bookmarks-panel-header notifications-panel-header">
            <div>
              <span style={{ fontWeight: 700, fontSize: 14 }}>Notifications</span>
              <div className="notifications-panel-subtitle">{notifications.length} active alerts</div>
            </div>
            {notifications.length > 0 && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={clearAllNotifications}>
                <Trash2 size={14} /> Delete all
              </button>
            )}
          </div>

          {notifications.length > 0 ? (
            <div className={`notifications-panel-body ${isMobile && selectedNotification ? 'notifications-mobile-detail' : ''}`}>
              {(!isMobile || !selectedNotification) && (
                <div className="notifications-list">
                  {notifications.map((notification) => {
                    const Icon = notification.icon;
                    return (
                      <div
                        key={notification.id}
                        className={`notifications-item ${selectedId === notification.id ? 'active' : ''}`}
                        onClick={() => {
                          setSelectedId(notification.id);
                          markAsRead(notification.id);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setSelectedId(notification.id);
                            markAsRead(notification.id);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        <div className={`notifications-item-icon ${notification.tone}`}>
                          <Icon size={16} />
                        </div>
                        <div className="notifications-item-copy">
                          <div className="notifications-item-title-row">
                            <span className="notifications-item-title">{notification.title}</span>
                            {!readIds.includes(notification.id) && <span className="notifications-item-dot" />}
                          </div>
                          <div className="notifications-item-message">{notification.message}</div>
                        </div>
                        <button
                          type="button"
                          className="bookmarks-remove notifications-delete"
                          onClick={(event) => removeNotification(event, notification.id)}
                          title="Delete notification"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {selectedNotification && (
                <div className="notifications-preview">
                  <div className="notifications-preview-top">
                    {isMobile && (
                      <button type="button" className="btn btn-ghost btn-sm notifications-back" onClick={() => setSelectedId('')} aria-label="Back to list">
                        <ArrowLeft size={18} />
                      </button>
                    )}
                    <div>
                      <div className="notifications-preview-label">{selectedNotification.type}</div>
                      <div className="notifications-preview-title">{selectedNotification.title}</div>
                    </div>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedId('')} aria-label="Close">
                      <X size={14} />
                    </button>
                  </div>
                  <div className="notifications-preview-message">{selectedNotification.message}</div>
                  <div className="notifications-preview-detail">{selectedNotification.detail}</div>
                  <div className="notifications-preview-actions">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        markAsRead(selectedNotification.id);
                        setIsOpen(false);
                        navigate(selectedNotification.actionPath);
                      }}
                    >
                      {selectedNotification.actionLabel}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={(event) => removeNotification(event, selectedNotification.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bookmarks-empty notifications-empty">
              <Bell size={32} style={{ color: 'var(--text-muted)', marginBottom: 8 }} />
              <p>No notifications right now</p>
              <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Budget alerts, weekly summaries, and goal updates will show here.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BookmarksDropdown() {
  const [bookmarks, setBookmarks] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const { formatCurrency } = useApp();

  const loadBookmarks = useCallback(async () => {
    try {
      const data = await bookmarksAPI.list();
      setBookmarks(data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadBookmarks();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadBookmarks]);

  useEffect(() => {
    const handler = (e) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setIsOpen(false); };
    ['mousedown', 'touchstart'].forEach((ev) => document.addEventListener(ev, handler));
    return () => ['mousedown', 'touchstart'].forEach((ev) => document.removeEventListener(ev, handler));
  }, []);

  const removeBookmark = async (e, txId) => {
    e.stopPropagation();
    try {
      await bookmarksAPI.remove(txId);
      setBookmarks(prev => prev.filter(b => b.id !== txId));
      loadBookmarks();
    } catch { /* ignore */ }
  };

  return (
    <div className="bookmarks-dropdown" ref={dropdownRef}>
      <button className="btn btn-ghost btn-sm btn-icon bookmarks-btn" onClick={() => { setIsOpen(!isOpen); if (!isOpen) loadBookmarks(); }}
        title="Bookmarks">
        <Bookmark size={18} />
        {bookmarks.length > 0 && <span className="bookmarks-badge">{bookmarks.length}</span>}
      </button>

      {isOpen && (
        <div className="bookmarks-panel">
          <div className="bookmarks-panel-header">
            <span style={{ fontWeight: 700, fontSize: 14 }}>Bookmarks</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{bookmarks.length} saved</span>
          </div>

          {bookmarks.length > 0 ? (
            <div className="bookmarks-list">
              {bookmarks.map(tx => (
                <div key={tx.bookmark_id} className="bookmarks-item" onClick={() => { setIsOpen(false); navigate('/transactions'); }}>
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
                      <button className="bookmarks-readd" onClick={(e) => { e.stopPropagation(); setIsOpen(false); navigate(`/add?prefill=${encodeURIComponent(JSON.stringify({ type: tx.type, category_id: tx.category_id, account_id: tx.account_id, amount: tx.amount, note: tx.note }))}`); }} title="Re-add this transaction">
                        <Plus size={12} />
                      </button>
                      <button className="bookmarks-remove" onClick={(e) => removeBookmark(e, tx.id)} title="Remove bookmark">
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bookmarks-empty">
              <Bookmark size={32} style={{ color: 'var(--text-muted)', marginBottom: 8 }} />
              <p>No bookmarked transactions</p>
              <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Bookmark transactions from the Transactions page</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ShortcutsHelpModal({ onClose }) {
  return (
    <div className="modal-overlay" style={{ zIndex: 1000 }} onClick={onClose}>
      <div className="modal" style={{ maxWidth: 360 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Keyboard Shortcuts</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ padding: '16px 24px 24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Add transaction</span>
              <kbd style={{ padding: '4px 8px', background: 'var(--bg-input)', borderRadius: 6, fontSize: 12 }}>N</kbd>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Add transaction</span>
              <kbd style={{ padding: '4px 8px', background: 'var(--bg-input)', borderRadius: 6, fontSize: 12 }}>Ctrl+N</kbd>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Search</span>
              <kbd style={{ padding: '4px 8px', background: 'var(--bg-input)', borderRadius: 6, fontSize: 12 }}>Ctrl+K</kbd>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Show shortcuts</span>
              <kbd style={{ padding: '4px 8px', background: 'var(--bg-input)', borderRadius: 6, fontSize: 12 }}>?</kbd>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function OnboardingModal({ onDismiss, onAddAccount, onAddTransaction }) {
  const dismiss = () => {
    try { localStorage.setItem('finly_onboarding_seen', 'true'); } catch { /* ignore */ }
    onDismiss();
  };
  return (
    <div className="modal-overlay" style={{ zIndex: 1000 }} onClick={dismiss}>
      <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Welcome to Finly!</div>
          <button className="btn btn-ghost btn-sm" onClick={dismiss}>✕</button>
        </div>
        <div className="modal-body" style={{ padding: '20px 24px' }}>
          <p style={{ marginBottom: 20, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Let&apos;s get you started. Add your first account to track balances, then record your transactions.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button className="btn btn-primary" onClick={() => { dismiss(); onAddAccount(); }}>
              Add your first account
            </button>
            <button className="btn btn-secondary" onClick={() => { dismiss(); onAddTransaction(); }}>
              Add a transaction
            </button>
            <button className="btn btn-ghost btn-sm" onClick={dismiss} style={{ marginTop: 8 }}>
              Skip for now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AppLayout() {
  const { user } = useAuth();
  const { theme, toggleTheme, toasts } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);

  useKeyboardShortcuts({
    onAddTransaction: () => navigate('/add'),
    onShowShortcuts: () => setShowShortcutsHelp(true),
  });

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const seen = localStorage.getItem('finly_onboarding_seen');
        if (seen) { setOnboardingChecked(true); return; }
        const [accounts, transactions] = await Promise.all([
          accountsAPI.list(),
          transactionsAPI.list({ limit: 1 }),
        ]);
        if (!cancelled && (accounts.length === 0 || transactions.length === 0)) {
          setShowOnboarding(true);
        }
        setOnboardingChecked(true);
      } catch { setOnboardingChecked(true); }
    };
    check();
    return () => { cancelled = true; };
  }, []);

  const primaryNavItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/transactions', icon: ArrowLeftRight, label: 'Transactions' },
    { path: '/charts', icon: BarChart3, label: 'Reports' },
    { path: '/budget', icon: PiggyBank, label: 'Budget' },
  ];

  const secondaryNavItems = [
    { path: '/calendar', icon: CalendarDays, label: 'Calendar' },
    { path: '/ai-agent', icon: Sparkles, label: 'AI Agent' },
    { path: '/goals', icon: Target, label: 'Goals' },
    { path: '/accounts', icon: Wallet, label: 'Accounts' },
    { path: '/categories', icon: Tag, label: 'Categories' },
    { path: '/settings', icon: SettingsIcon, label: 'Settings' },
  ];

  const navItems = [...primaryNavItems, ...secondaryNavItems];

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const pageTitle = navItems.find(n => n.path === location.pathname)?.label || 'Finly';
  const isSecondaryPage = !primaryNavItems.some(item => item.path === location.pathname);

  useEffect(() => {
    if (mobileNavOpen) {
      document.documentElement.classList.add('mobile-nav-open');
    } else {
      document.documentElement.classList.remove('mobile-nav-open');
    }
    return () => document.documentElement.classList.remove('mobile-nav-open');
  }, [mobileNavOpen]);

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const lightMode = theme === 'light';

    root.classList.toggle('theme-light', lightMode);
    body.classList.toggle('theme-light', lightMode);

    return () => {
      root.classList.remove('theme-light');
      body.classList.remove('theme-light');
    };
  }, [theme]);

  if (!user) return null;

  return (
    <div className={`app-layout ${theme === 'light' ? 'theme-light' : ''}`}>
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img src="/finly-logo.png" alt="Finly" className="sidebar-brand-logo" />
          <div>
            <div className="sidebar-brand-text">Finly</div>
            <div className="sidebar-brand-subtitle">Money clarity, every day</div>
          </div>
        </div>
        <nav className="sidebar-nav">
          <div className="sidebar-section">
            {primaryNavItems.map(item => (
              <NavLink key={item.path} to={item.path} end
                className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}>
                <item.icon size={20} />
                {item.label}
              </NavLink>
            ))}
          </div>
          <div className="sidebar-section">
            <div className="sidebar-section-title">More</div>
            {secondaryNavItems.map(item => (
              <NavLink key={item.path} to={item.path} end
                className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}>
                <item.icon size={20} />
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>
        <div className="sidebar-footer">
          <button className="btn btn-primary" style={{ width: '100%', marginBottom: 10 }} onClick={() => navigate('/add')}>
            <Plus size={16} /> Add Transaction
          </button>
          <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'flex-start' }} onClick={toggleTheme}>
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="page-header">
          <button className="mobile-menu-btn" onClick={() => setMobileNavOpen(true)}>
            <Menu size={22} />
          </button>
          <div className="page-header-title">
            <div className="page-header-eyebrow">Finly</div>
            <h1>{pageTitle}</h1>
          </div>
          <GlobalSearch />
          <div className="page-header-actions">
            <button className="mobile-search-btn" onClick={() => setMobileSearchOpen(true)}>
              <Search size={20} />
            </button>
            <NotificationCenter />
            <BookmarksDropdown />
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/add')}>
              <Plus size={16} /> <span className="btn-text-label">Add Transaction</span>
            </button>
          </div>
        </header>
        <div className="page-shell">
          <div className="page-body">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/transactions" element={<Transactions />} />
              <Route path="/add" element={<AddTransaction />} />
              <Route path="/categories" element={<Categories />} />
              <Route path="/accounts" element={<Accounts />} />
              <Route path="/calendar" element={<Calendar />} />
              <Route path="/charts" element={<Charts />} />
              <Route path="/ai-agent" element={<AiAgent />} />
              <Route path="/budget" element={<Budget />} />
              <Route path="/goals" element={<SavingsGoals />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </div>
        </div>
      </main>

      {/* Mobile slide-out sidebar (kept for hamburger menu, hidden by default) */}
      {mobileNavOpen && (
        <div className="mobile-nav-backdrop" onClick={() => setMobileNavOpen(false)} />
      )}
      <aside className={`mobile-sidebar ${mobileNavOpen ? 'open' : ''}`}>
        <div className="mobile-sidebar-header">
          <div className="mobile-sidebar-brand">
            <img src="/finly-logo.png" alt="Finly" className="sidebar-brand-logo" />
            <div>
              <div className="mobile-sidebar-title">Finly</div>
              <div className="mobile-sidebar-subtitle">{user?.name ? `${user.name}'s workspace` : 'Reports, setup, and tools'}</div>
            </div>
          </div>
          <button className="mobile-sidebar-close" onClick={() => setMobileNavOpen(false)}>
            <X size={20} />
          </button>
        </div>
        <div className="mobile-sidebar-quick-actions">
          <button className="mobile-sidebar-quick-btn" onClick={() => { navigate('/add'); setMobileNavOpen(false); }}>
            <Plus size={16} />
            <span>Add</span>
          </button>
          <button className="mobile-sidebar-quick-btn" onClick={() => { navigate('/charts'); setMobileNavOpen(false); }}>
            <BarChart3 size={16} />
            <span>Reports</span>
          </button>
          <button className="mobile-sidebar-quick-btn" onClick={() => { setMobileNavOpen(false); setMobileSearchOpen(true); }}>
            <Search size={16} />
            <span>Search</span>
          </button>
        </div>
        <nav className="mobile-sidebar-nav">
          <div className="mobile-sidebar-section-title">Explore</div>
          {secondaryNavItems.map(item => (
            <NavLink key={item.path} to={item.path} end
              className={({ isActive }) => `mobile-sidebar-item ${isActive ? 'active' : ''}`}
              onClick={() => setMobileNavOpen(false)}>
              <item.icon size={20} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="mobile-sidebar-footer">
          <button className="mobile-sidebar-item" onClick={() => { navigate('/add'); setMobileNavOpen(false); }}>
            <Plus size={20} />
            Add Transaction
          </button>
          <button className="mobile-sidebar-item" onClick={() => { toggleTheme(); setMobileNavOpen(false); }}>
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </button>
        </div>
      </aside>

      {/* Mobile Search Overlay */}
      {mobileSearchOpen && <MobileSearchOverlay onClose={() => setMobileSearchOpen(false)} />}

      {/* Mobile More Bottom Sheet */}
      {mobileMoreOpen && (
        <>
          <div className="mobile-sheet-backdrop" onClick={() => setMobileMoreOpen(false)} />
          <div className="mobile-sheet">
            <div className="mobile-sheet-handle" />
            <div className="mobile-sheet-header">
              <span className="mobile-sheet-title">More</span>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setMobileMoreOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="mobile-sheet-body">
              <div className="mobile-more-grid">
                {secondaryNavItems.map(item => (
                  <button
                    key={item.path}
                    className={`mobile-more-item ${location.pathname === item.path ? 'active' : ''}`}
                    onClick={() => { navigate(item.path); setMobileMoreOpen(false); }}
                  >
                    <span className="mobile-more-icon"><item.icon size={20} /></span>
                    {item.label}
                  </button>
                ))}
                <button
                  className="mobile-more-item"
                  onClick={() => { toggleTheme(); setMobileMoreOpen(false); }}
                >
                  <span className="mobile-more-icon">
                    {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                  </span>
                  {theme === 'dark' ? 'Light' : 'Dark'}
                </button>
                <button
                  className="mobile-more-item"
                  onClick={() => { setMobileMoreOpen(false); setMobileSearchOpen(true); }}
                >
                  <span className="mobile-more-icon"><Search size={20} /></span>
                  Search
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Mobile Bottom Navigation */}
      <nav className="bottom-nav" aria-label="Primary mobile navigation">
        <NavLink to="/" end className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
          <LayoutDashboard size={20} />
          <span>Home</span>
        </NavLink>
        <NavLink to="/transactions" end className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
          <ArrowLeftRight size={20} />
          <span>Ledger</span>
        </NavLink>
        <button type="button" className="bottom-nav-fab" onClick={() => navigate('/add')}>
          <Plus size={24} />
        </button>
        <NavLink to="/charts" end className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
          <BarChart3 size={20} />
          <span>Reports</span>
        </NavLink>
        <button
          type="button"
          className={`bottom-nav-item ${mobileMoreOpen || isSecondaryPage ? 'active' : ''}`}
          onClick={() => setMobileMoreOpen(true)}
        >
          <MoreHorizontal size={20} />
          <span>More</span>
        </button>
      </nav>

      {/* Toast Notifications */}
      <div className="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            {toast.message}
          </div>
        ))}
      </div>

      {/* First-time Onboarding Modal */}
      {showOnboarding && onboardingChecked && (
        <OnboardingModal
          onDismiss={() => setShowOnboarding(false)}
          onAddAccount={() => navigate('/accounts')}
          onAddTransaction={() => navigate('/add')}
        />
      )}

      {/* Keyboard Shortcuts Help Modal */}
      {showShortcutsHelp && (
        <ShortcutsHelpModal onClose={() => setShowShortcutsHelp(false)} />
      )}
    </div>
  );
}

function AppBoot() {
  const navigate = useNavigate();
  const { theme } = useApp();

  const handleNativeUrl = useCallback((url) => {
    if (!url) {
      return;
    }

    try {
      const parsed = new URL(url);
      const route = `/${[parsed.host, parsed.pathname].filter(Boolean).join('/').replace(/^\/+/, '')}${parsed.search || ''}`;
      navigate(route);
    } catch {
      navigate('/settings');
    }
  }, [navigate]);

  useEffect(() => {
    applyNativeWindowStyling(theme);
  }, [theme]);

  useEffect(() => {
    let cancelled = false;
    const hideSplash = () => {
      if (!cancelled) {
        hideNativeSplash();
      }
    };

    const frameId = window.requestAnimationFrame(() => {
      window.setTimeout(hideSplash, 120);
    });
    const fallbackId = window.setTimeout(hideSplash, 2500);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(fallbackId);
    };
  }, []);

  useEffect(() => {
    if (!isNativeApp()) {
      return undefined;
    }

    let active = true;
    getNativeLaunchUrl().then((url) => {
      if (active && url) {
        handleNativeUrl(url);
      }
    });

    const removeListener = addNativeAppUrlListener(handleNativeUrl);
    return () => {
      active = false;
      removeListener();
    };
  }, [handleNativeUrl]);

  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppProvider>
          <AppBoot />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/*" element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            } />
          </Routes>
        </AppProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
