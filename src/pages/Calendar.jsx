import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { statsAPI, transactionsAPI } from '../services/api';
import { useApp } from '../context/AppContext';
import { useIsMobile } from '../hooks/useIsMobile';

export default function Calendar() {
    const navigate = useNavigate();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [calendarData, setCalendarData] = useState([]);
    const [selectedDay, setSelectedDay] = useState(null);
    const [dayTransactions, setDayTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const { addToast, formatCurrency } = useApp();
    const isMobile = useIsMobile();

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;

    useEffect(() => { loadCalendar(); }, [year, month]);

    const loadCalendar = async () => {
        try {
            const data = await statsAPI.calendar(year, month);
            setCalendarData(data);
        } catch { addToast('Failed to load calendar', 'error'); }
        finally { setLoading(false); }
    };

    const loadDayTransactions = async (day) => {
        setSelectedDay(day);
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        try {
            const txs = await transactionsAPI.list({ startDate: dateStr, endDate: dateStr });
            setDayTransactions(txs);
        } catch { addToast('Failed to load transactions', 'error'); }
    };

    const prevMonth = () => setCurrentDate(new Date(year, month - 2, 1));
    const nextMonth = () => setCurrentDate(new Date(year, month, 1));

    const daysInMonth = new Date(year, month, 0).getDate();
    const firstDayOfWeek = new Date(year, month - 1, 1).getDay();
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

    const getDataForDay = (day) => calendarData.find(d => d.day === day);

    const today = new Date();
    const isToday = (day) => today.getFullYear() === year && today.getMonth() + 1 === month && today.getDate() === day;


    if (loading) return <div className="loading-spinner" />;

    return (
        <div className="fade-in page-stack calendar-page">
            {isMobile ? (
                <div className="mv2-month-nav">
                    <button className="mv2-month-arrow" onClick={prevMonth}><ChevronLeft size={20} /></button>
                    <button className="mv2-month-label" onClick={() => setCurrentDate(new Date())}>{monthName}</button>
                    <button className="mv2-month-arrow" onClick={nextMonth}><ChevronRight size={20} /></button>
                </div>
            ) : (
            <div className="card page-toolbar-card">
                <div className="page-toolbar-header">
                    <div>
                        <div className="dashboard-section-kicker">Calendar</div>
                        <div className="dashboard-section-title">Daily money view</div>
                        <div className="dashboard-section-note">Spot busy spending days and drill into transactions for any date.</div>
                    </div>
                    <button className="btn btn-secondary btn-sm" onClick={() => setCurrentDate(new Date())}>This month</button>
                </div>
                <div className="dashboard-date-nav" style={{ justifyContent: 'space-between' }}>
                    <button className="btn btn-ghost btn-icon" onClick={prevMonth}><ChevronLeft size={20} /></button>
                    <h2 style={{ fontSize: 20, fontWeight: 700 }}>{monthName}</h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button className="btn btn-ghost btn-icon" onClick={nextMonth}><ChevronRight size={20} /></button>
                    </div>
                </div>
            </div>
            )}

            <div className="grid-2">
                {/* Calendar Grid */}
                <div className="card">
                    <div className="calendar-grid">
                        {dayNames.map(d => <div key={d} className="calendar-header-cell">{d}</div>)}
                        {Array.from({ length: firstDayOfWeek }, (_, i) => <div key={`e-${i}`} className="calendar-cell empty" />)}
                        {Array.from({ length: daysInMonth }, (_, i) => {
                            const day = i + 1;
                            const data = getDataForDay(day);
                            return (
                                <div key={day} className={`calendar-cell ${isToday(day) ? 'today' : ''} ${selectedDay === day ? 'today' : ''}`}
                                    onClick={() => loadDayTransactions(day)}>
                                    <div className="calendar-day">{day}</div>
                                    {data && (
                                        <div className="calendar-amounts">
                                            {data.income > 0 && <div className="calendar-income">+{(data.income / 1000).toFixed(data.income >= 1000 ? 0 : 1)}k</div>}
                                            {data.expense > 0 && <div className="calendar-expense">-{(data.expense / 1000).toFixed(data.expense >= 1000 ? 0 : 1)}k</div>}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Day Detail */}
                <div className="card">
                    <div className="card-header">
                        <div className="card-title">
                            {selectedDay
                                ? `${monthName.split(' ')[0]} ${selectedDay}, ${year}`
                                : 'Select a day'}
                        </div>
                    </div>
                    {selectedDay ? (
                        dayTransactions.length > 0 ? (
                            <div className="tx-list">
                                {dayTransactions.map(tx => (
                                    <div key={tx.id} className="tx-item" onClick={() => navigate(`/add?edit=${tx.id}`)} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && navigate(`/add?edit=${tx.id}`)}>
                                        <div className="tx-icon" style={{ background: tx.category_color ? `${tx.category_color}20` : 'var(--bg-input)' }}>
                                            {tx.category_icon || '💸'}
                                        </div>
                                        <div className="tx-info">
                                            <div className="tx-category">{tx.category_name || tx.type}</div>
                                            <div className="tx-note">{tx.note || '—'}</div>
                                        </div>
                                        <div className={`tx-amount ${tx.type}`}>
                                            {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="empty-state" style={{ padding: 20 }}>
                                <p>No transactions on this day</p>
                            </div>
                        )
                    ) : (
                        <div className="empty-state" style={{ padding: 20 }}>
                            <p>Click a day to see transactions</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
