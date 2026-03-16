import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { ArrowLeft, Camera, Calculator, Sparkles, Loader, X } from 'lucide-react';
import { transactionsAPI, categoriesAPI, accountsAPI, aiAPI } from '../services/api';
import { useApp } from '../context/AppContext';
import { useIsMobile } from '../hooks/useIsMobile';

export default function AddTransaction() {
    const [searchParams] = useSearchParams();
    const location = useLocation();
    const editId = searchParams.get('edit');
    const prefillData = searchParams.get('prefill');
    const navigate = useNavigate();
    const { addToast, formatCurrency } = useApp();

    const [type, setType] = useState('expense');
    const [amount, setAmount] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [accountId, setAccountId] = useState('');
    const [toAccountId, setToAccountId] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [note, setNote] = useState('');
    const [photo, setPhoto] = useState(null);
    const [categories, setCategories] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showCalc, setShowCalc] = useState(false);
    const [scanning, setScanning] = useState(false);
    const [repeatMonths, setRepeatMonths] = useState(1);
    const [isRepeatEnabled, setIsRepeatEnabled] = useState(false);
    const [showPhotoPreview, setShowPhotoPreview] = useState(false);
    const [photoZoom, setPhotoZoom] = useState(1);
    const [suggestions, setSuggestions] = useState([]);
    const [mobileSection, setMobileSection] = useState('details');
    const isMobile = useIsMobile();

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            // Run sync in the background so initial load feels instant
            categoriesAPI.syncDefaults().catch(() => {});
            const [cats, accs, sugg] = await Promise.all([
                categoriesAPI.list(),
                accountsAPI.list(),
                transactionsAPI.getSuggestions().catch(() => []),
            ]);
            setCategories(cats);
            setAccounts(accs);
            setSuggestions(Array.isArray(sugg) ? sugg : []);
            if (accs.length > 0 && !accountId) {
                const first = accs.find(a => !a.parent_id);
                if (first) setAccountId(first.id);
            }

            const scanState = location.state;
            if (scanState?.scanEntries && scanState?.scanMeta && Array.isArray(scanState.scanEntries) && scanState.scanEntries.length > 0) {
                // Local flat list mirroring flatExpenseCategories for consistent mapping
                const flat = cats
                    .filter(c => c.type === 'expense')
                    .flatMap(c => ([
                        { ...c, _isMain: true, _mainId: c.id, _mainName: c.name, _mainIcon: c.icon },
                        ...(c.subcategories || []).map(s => ({
                            ...s,
                            _isMain: false,
                            _mainId: c.id,
                            _mainName: c.name,
                            _mainIcon: c.icon,
                        }))
                    ]));
                const mapId = (suggestion) => {
                    if (!suggestion || !flat.length) return '';
                    const s = String(suggestion).toLowerCase().trim();
                    const foodKeywords = [
                        'snack', 'snacks', 'junk', 'junk food', 'chips',
                        'tea', 'coffee', 'cafe', 'cafeteria',
                        'lunch', 'dinner', 'breakfast', 'meal', 'meals', 'food'
                    ];
                    if (foodKeywords.some(k => s.includes(k))) {
                        const foodMain = flat.find(c =>
                            c._isMain &&
                            c.name &&
                            c.name.toLowerCase() === 'food'
                        );
                        if (foodMain) return foodMain._mainId || foodMain.id;
                    }
                    const bySub = flat.find(c => c.name && (c.name.toLowerCase().includes(s) || (s.length >= 3 && s.includes(c.name.toLowerCase()))));
                    if (bySub) {
                        return bySub._mainId || bySub.id;
                    }
                    const byMain = flat.find(c => !c.parent_id && c.name && (c.name.toLowerCase() === s || c.name.toLowerCase().includes(s) || s.includes(c.name.toLowerCase())));
                    return byMain ? (byMain._mainId || byMain.id) : '';
                };
                const meta = scanState.scanMeta;
                const hasMetaAmount = typeof meta.amount === 'number' && !Number.isNaN(meta.amount);
                const totalFromEntries = scanState.scanEntries.reduce((sum, e) => {
                    const raw = typeof e.amount === 'number' ? e.amount : parseFloat(e.amount);
                    const num = Number.isFinite(raw) ? raw : 0;
                    return sum + num;
                }, 0);
                const first = scanState.scanEntries[0];
                let inferredType = meta.type || 'expense';
                setDate(meta.date || new Date().toISOString().split('T')[0]);
                if (scanState.photo) setPhoto(scanState.photo);
                const total = hasMetaAmount ? meta.amount : totalFromEntries;
                if (total > 0) setAmount(String(total));
                if (first && first.category_suggestion) {
                    const cid = mapId(first.category_suggestion);
                    if (cid) {
                        setCategoryId(cid);
                        const cat = cats.find(c => c.id === cid);
                        if (cat && cat.type) inferredType = cat.type;
                    }
                }
                setType(inferredType);
                setNote(meta.note || '');
                navigate('/add', { replace: true, state: {} });
            }

            if (editId) {
                const tx = await transactionsAPI.get(editId);
                setType(tx.type);
                setAmount(String(tx.amount));
                setCategoryId(tx.category_id || '');
                setAccountId(tx.account_id);
                setToAccountId(tx.to_account_id || '');
                setDate(tx.date);
                setNote(tx.note || '');
                setPhoto(tx.photo);
            } else if (prefillData) {
                try {
                    const pf = JSON.parse(decodeURIComponent(prefillData));
                    if (pf.type) setType(pf.type);
                    if (pf.amount) setAmount(String(pf.amount));
                    if (pf.category_id) setCategoryId(pf.category_id);
                    if (pf.account_id) setAccountId(pf.account_id);
                    if (pf.date) setDate(pf.date);
                    if (pf.note) setNote(pf.note);
                } catch { /* ignore */ }
            }
        } catch {
            addToast('Failed to load data', 'error');
        }
    };

    const filteredCategories = categories.filter(c => c.type === type);
    const getParentForCategory = (id) => filteredCategories.find(c => c.id === id || (c.subcategories || []).some(s => s.id === id));
    const getSelectedCategoryDisplay = (id) => {
        const parent = getParentForCategory(id);
        if (!parent) return null;
        if (parent.id === id) return { main: parent, sub: null };
        const sub = (parent.subcategories || []).find(s => s.id === id);
        return sub ? { main: parent, sub } : { main: parent, sub: null };
    };
    const mainAccounts = accounts.filter(a => !a.parent_id);
    const getChildren = (parentId) => accounts.filter(a => a.parent_id === parentId);
    const accountOptions = mainAccounts.flatMap(a => {
        const children = getChildren(a.id);
        return [{ ...a, _parentName: null }, ...children.map(c => ({ ...c, _parentName: a.name }))];
    });
    const getAccountLabel = (a) => {
        if (a._parentName) return `${a._parentName} – ${a.name}`;
        return `${a.icon || '💰'} ${a.name}`;
    };

    // Flat list of expense categories (main + sub) for scan result mapping
    const flatExpenseCategories = categories
        .filter(c => c.type === 'expense')
        .flatMap(c => ([
            { ...c, _isMain: true, _mainId: c.id, _mainName: c.name, _mainIcon: c.icon },
            ...(c.subcategories || []).map(s => ({
                ...s,
                _isMain: false,
                _mainId: c.id,
                _mainName: c.name,
                _mainIcon: c.icon,
            }))
        ]));

    const mapSuggestionToCategoryId = (suggestion) => {
        if (!suggestion || !flatExpenseCategories.length) return '';
        const s = suggestion.toLowerCase().trim();

        // Keyword mapping for common food-related items -> Food main category
        const foodKeywords = [
            'snack', 'snacks', 'junk', 'junk food', 'chips',
            'tea', 'coffee', 'cafe', 'cafeteria',
            'lunch', 'dinner', 'breakfast', 'meal', 'meals', 'food'
        ];
        if (foodKeywords.some(k => s.includes(k))) {
            const foodMain = flatExpenseCategories.find(c =>
                c._isMain &&
                c.name &&
                c.name.toLowerCase() === 'food'
            );
            if (foodMain) return foodMain._mainId || foodMain.id;
        }

        const bySub = flatExpenseCategories.find(c =>
            c.name && (c.name.toLowerCase().includes(s) || (s.length >= 3 && s.includes(c.name.toLowerCase())))
        );
        if (bySub) {
            // Always prefer main category id for scans
            return bySub._mainId || bySub.id;
        }
        const byMain = flatExpenseCategories.find(c => !c.parent_id && c.name && (
            c.name.toLowerCase() === s || c.name.toLowerCase().includes(s) || s.includes(c.name.toLowerCase())
        ));
        return byMain ? byMain.id : '';
    };

    const handlePhotoChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => setPhoto(reader.result);
            reader.readAsDataURL(file);
        }
    };

    const handleAiScan = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Check file type
        const isImage = file.type.startsWith('image/');
        const isPdf = file.type === 'application/pdf';
        if (!isImage && !isPdf) {
            addToast('Please upload an image (JPEG, PNG) or PDF file', 'error');
            return;
        }

        setScanning(true);
        try {
            let imageData;
            if (isPdf) {
                // For PDF: read as array buffer, render with pdf.js, convert to image
                const arrayBuffer = await file.arrayBuffer();
                const pdfjsLib = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/+esm');
                pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs';
                const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                const page = await pdf.getPage(1);
                const viewport = page.getViewport({ scale: 2 });
                const canvas = document.createElement('canvas');
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
                imageData = canvas.toDataURL('image/png');
            } else {
                // For images: read as data URL
                imageData = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.readAsDataURL(file);
                });
            }

            setPhoto(imageData);
            const result = await aiAPI.scanReceipt({ image: imageData });

            const hasAmount = typeof result.amount === 'number' && !Number.isNaN(result.amount);
            let totalFromEntries = 0;
            if (!hasAmount && result.entries && result.entries.length >= 1) {
                totalFromEntries = result.entries.reduce((sum, e) => {
                    const raw = typeof e.amount === 'number' ? e.amount : parseFloat(e.amount);
                    const num = Number.isFinite(raw) ? raw : 0;
                    return sum + num;
                }, 0);
            }

            let single = result;
            if (result.entries && result.entries.length >= 1) {
                const first = result.entries[0] || {};
                single = {
                    amount: hasAmount ? result.amount : totalFromEntries,
                    category_suggestion: first.category_suggestion,
                    type: result.type,
                    note: result.note,
                    date: result.date
                };
            }

            if (single.amount) setAmount(String(single.amount));
            if (single.note) setNote(single.note);
            if (single.date) setDate(single.date);
            if (single.category_suggestion) {
                const cid = mapSuggestionToCategoryId(single.category_suggestion);
                if (cid) {
                    setCategoryId(cid);
                    const cat = categories.find(c => c.id === cid);
                    if (cat && cat.type) setType(cat.type);
                    else if (single.type) setType(single.type);
                } else if (single.type) {
                    setType(single.type);
                }
            } else if (single.type) {
                setType(single.type);
            }
            addToast('Receipt scanned! Review the details before saving.');
        } catch (err) {
            addToast(err.message || 'Failed to scan receipt', 'error');
        } finally {
            setScanning(false);
        }
    };

    const handleCalcInput = (val) => {
        if (val === 'C') { setAmount(''); return; }
        if (val === '⌫') { setAmount(prev => prev.slice(0, -1)); return; }
        if (val === '=') {
            try {
                const expr = amount.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').trim();
                if (!expr || !/^[\d.\s+\-*/()]+$/.test(expr)) return;
                const result = Function('"use strict"; return (' + expr + ')')();
                if (typeof result === 'number' && !Number.isNaN(result)) setAmount(String(Math.round(result * 100) / 100));
            } catch { /* ignore */ }
            return;
        }
        if (val === '.' && amount.includes('.')) return;
        setAmount(prev => prev + val);
    };

    const saveTransaction = async (continueAdding = false) => {
        let amountNum = parseFloat(amount);
        if (Number.isNaN(amountNum) && /[+\-×÷*\/]/.test(amount)) {
            try {
                const expr = amount.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').trim();
                if (expr && /^[\d.\s+\-*/()]+$/.test(expr)) amountNum = Function('"use strict"; return (' + expr + ')')();
            } catch { /* ignore */ }
        }
        if (!amount || (typeof amountNum !== 'number') || Number.isNaN(amountNum) || amountNum <= 0) { addToast('Enter a valid amount', 'error'); return; }
        if (!accountId) { addToast('Select an account', 'error'); return; }
        if (type === 'transfer' && !toAccountId) { addToast('Select destination account', 'error'); return; }

        setLoading(true);
        try {
            const data = {
                type, amount: amountNum, category_id: categoryId || null,
                account_id: accountId, to_account_id: type === 'transfer' ? toAccountId : null,
                date, note, photo,
                repeat_months: isRepeatEnabled ? repeatMonths : 1,
            };

            if (editId) {
                await transactionsAPI.update(editId, data);
                addToast('Transaction updated');
                window.dispatchEvent(new CustomEvent('finly-notifications-refresh'));
                navigate('/transactions');
            } else {
                await transactionsAPI.create(data);
                addToast('Transaction added');
                window.dispatchEvent(new CustomEvent('finly-notifications-refresh'));
                if (continueAdding) {
                    // Reset form but keep type, account, and date
                    setAmount('');
                    setCategoryId('');
                    setNote('');
                    setPhoto(null);
                    setShowCalc(false);
                } else {
                    navigate('/transactions');
                }
            }
        } catch (err) {
            addToast(err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        saveTransaction(false);
    };

    const calcButtons = ['7', '8', '9', '⌫', '4', '5', '6', 'C', '1', '2', '3', '÷', '0', '.', '×', '−', '+', '='];
    const selectedCategoryDisplay = categoryId && type !== 'transfer' ? getSelectedCategoryDisplay(categoryId) : null;
    const selectedAccount = useMemo(
        () => accountOptions.find((account) => account.id === accountId) || null,
        [accountOptions, accountId]
    );
    const selectedToAccount = useMemo(
        () => accountOptions.find((account) => account.id === toAccountId) || null,
        [accountOptions, toAccountId]
    );

    return (
        <>
        <div className="fade-in page-stack add-transaction-page">
            <div className="card page-toolbar-card">
                <div className="page-toolbar-header">
                    <div>
                        <div className="dashboard-section-kicker">{editId ? 'Edit transaction' : 'New transaction'}</div>
                        <div className="dashboard-section-title">{editId ? 'Update this entry' : 'Add money movement'}</div>
                        <div className="dashboard-section-note">
                            {editId ? 'Review and adjust the details below.' : 'Use quick add, calculator, receipt scan, and categories to save faster.'}
                        </div>
                    </div>
                    <div className="page-toolbar-actions">
                        <button className="btn btn-ghost" onClick={() => navigate(-1)}>
                            <ArrowLeft size={18} /> Back
                        </button>
                    </div>
                </div>
            </div>

            {/* Type Tabs */}
            <div className="tabs">
                <button className={`tab income ${type === 'income' ? 'active' : ''}`} onClick={() => setType('income')}>Income</button>
                <button className={`tab expense ${type === 'expense' ? 'active' : ''}`} onClick={() => setType('expense')}>Expense</button>
                <button className={`tab transfer ${type === 'transfer' ? 'active' : ''}`} onClick={() => setType('transfer')}>Transfer</button>
            </div>

            {isMobile && (
                <div className="card add-transaction-mobile-overview">
                    <div className="page-toolbar-subtitle">Mobile entry flow</div>
                    <div className="dashboard-section-note">
                        Open only the section you need, then save from the sticky action bar.
                    </div>
                    <div className="add-transaction-mobile-overview-grid">
                        <button type="button" className={`add-transaction-mobile-chip ${mobileSection === 'details' ? 'active' : ''}`} onClick={() => setMobileSection('details')}>
                            <span>Amount</span>
                            <strong>{amount ? formatCurrency(Number(amount) || 0) : 'Set amount'}</strong>
                        </button>
                        <button type="button" className={`add-transaction-mobile-chip ${mobileSection === 'category' ? 'active' : ''}`} onClick={() => setMobileSection('category')}>
                            <span>Category</span>
                            <strong>
                                {selectedCategoryDisplay
                                    ? (selectedCategoryDisplay.sub ? `${selectedCategoryDisplay.main.name} / ${selectedCategoryDisplay.sub.name}` : selectedCategoryDisplay.main.name)
                                    : 'Choose'}
                            </strong>
                        </button>
                        <button type="button" className={`add-transaction-mobile-chip ${mobileSection === 'details' ? 'active' : ''}`} onClick={() => setMobileSection('details')}>
                            <span>Account</span>
                            <strong>
                                {type === 'transfer' && selectedAccount && selectedToAccount
                                    ? `${selectedAccount.name} -> ${selectedToAccount.name}`
                                    : selectedAccount
                                        ? getAccountLabel(selectedAccount)
                                        : 'Choose'}
                            </strong>
                        </button>
                        <button type="button" className={`add-transaction-mobile-chip ${mobileSection === 'extras' ? 'active' : ''}`} onClick={() => setMobileSection('extras')}>
                            <span>Extras</span>
                            <strong>{photo ? 'Receipt ready' : note ? 'Note added' : 'Optional'}</strong>
                        </button>
                    </div>
                    <div className="add-transaction-mobile-steps">
                        <button type="button" className={`btn btn-sm ${mobileSection === 'details' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setMobileSection('details')}>Details</button>
                        {type !== 'transfer' && (
                            <button type="button" className={`btn btn-sm ${mobileSection === 'category' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setMobileSection('category')}>Category</button>
                        )}
                        <button type="button" className={`btn btn-sm ${mobileSection === 'extras' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setMobileSection('extras')}>Receipt & note</button>
                    </div>
                </div>
            )}

            {/* Smart suggestions — quick fill from recent */}
            {type === 'expense' && suggestions.length > 0 && (
                <div className="card quick-add-card" style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Quick add</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {suggestions.map((s, i) => (
                            <button key={i} type="button" className="btn btn-secondary btn-sm" style={{ fontSize: 13 }}
                                onClick={() => {
                                    setType(s.type || 'expense');
                                    setAmount(String(s.amount));
                                    setCategoryId(s.categoryId || '');
                                    setAccountId(s.accountId || '');
                                }}>
                                {s.categoryIcon || '📦'} {formatCurrency(s.amount)}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Main transaction form */}
            <form id="transaction-form" onSubmit={handleSubmit}>
                <div className={`grid-2 add-transaction-layout ${isMobile ? 'mobile' : ''}`}>
                    {/* Left column: details + note/receipt + buttons */}
                    <div className="add-transaction-left-col">
                        {(!isMobile || mobileSection === 'details') && (
                        <div className="card form-section-card add-transaction-primary-card">
                            {/* Amount */}
                            <div className="input-group">
                                <label className="input-label">Amount</label>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <input type="text" inputMode="decimal" className="input" placeholder="0" value={amount}
                                        onChange={e => setAmount(e.target.value.replace(/[^0-9.\s+×÷−\-*/]/g, ''))} style={{ fontSize: 24, fontWeight: 700 }} required />
                                    <button type="button" className="btn btn-secondary btn-icon" onClick={() => setShowCalc(!showCalc)}>
                                        <Calculator size={18} />
                                    </button>
                                </div>
                            </div>

                            {/* Calculator */}
                            {showCalc && (
                                <div className="card slide-up calc-panel" style={{ marginBottom: 16, padding: 12 }}>
                                    <div className="calc-grid">
                                        {calcButtons.map(btn => (
                                            <button key={btn} type="button"
                                                className={`btn btn-secondary calc-btn ${['÷', '×', '−', '+'].includes(btn) ? 'calc-operator' : ''}`}
                                                onClick={() => handleCalcInput(btn)}
                                                style={{ padding: '12px', fontSize: 16, fontWeight: 600 }}>{btn}</button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Selected Category Badge */}
                            {selectedCategoryDisplay && (() => {
                                const { main, sub } = selectedCategoryDisplay;
                                const icon = sub ? sub.icon : main.icon;
                                const name = sub ? `${main.name} > ${sub.name}` : main.name;
                                return (
                                    <div className="selected-category-badge">
                                        <span className="selected-category-icon">{icon}</span>
                                        <span className="selected-category-name">{name}</span>
                                        <button type="button" className="selected-category-clear" onClick={() => setCategoryId('')}>
                                            <X size={14} />
                                        </button>
                                    </div>
                                );
                            })()}

                            {/* Account */}
                            <div className="input-group">
                                <label className="input-label">{type === 'transfer' ? 'From Account' : 'Account'}</label>
                                <select className="input" value={accountId} onChange={e => setAccountId(e.target.value)} required>
                                    <option value="">Select account</option>
                                    {accountOptions.map(a => <option key={a.id} value={a.id}>{getAccountLabel(a)}</option>)}
                                </select>
                            </div>

                            {/* To Account (transfers only) */}
                            {type === 'transfer' && (
                                <div className="input-group">
                                    <label className="input-label">To Account</label>
                                    <select className="input" value={toAccountId} onChange={e => setToAccountId(e.target.value)} required>
                                        <option value="">Select destination</option>
                                        {accountOptions.filter(a => a.id !== accountId).map(a => (
                                            <option key={a.id} value={a.id}>{getAccountLabel(a)}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Date */}
                            <div className="input-group">
                                <label className="input-label">Date</label>
                                <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} required />
                            </div>

                            {/* Set repeat (new transactions only) */}
                            {!editId && (
                                <div className="input-group">
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                                        <input type="checkbox" checked={isRepeatEnabled} onChange={e => setIsRepeatEnabled(e.target.checked)} />
                                        <span className="input-label" style={{ margin: 0 }}>Set repeat</span>
                                    </label>
                                    {isRepeatEnabled && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                                            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Repeat for</span>
                                            <select className="input" value={repeatMonths} onChange={e => setRepeatMonths(Number(e.target.value))} style={{ width: 'auto' }}>
                                                {[2,3,4,5,6,7,8,9,10,11,12].map(n => <option key={n} value={n}>{n} months</option>)}
                                            </select>
                                            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>on the same date each month</span>
                                        </div>
                                    )}
                                </div>
                            )}

                        </div>
                        )}

                        {(!isMobile || mobileSection === 'extras') && (
                            <div className="card form-section-card add-transaction-extras-card">
                                <div className="input-group">
                                    <label className="input-label">Note</label>
                                    <textarea className="input" placeholder="Add a note..." value={note} onChange={e => setNote(e.target.value)} rows={3} />
                                </div>

                                <div className="input-group">
                                    <label className="input-label">Receipt Photo</label>
                                    <div className="add-transaction-upload-actions">
                                        <label className="btn btn-secondary" style={{ cursor: 'pointer', flex: 1 }}>
                                            <Camera size={16} /> {photo ? 'Change Photo' : 'Attach Photo'}
                                            <input type="file" accept="image/*" capture="environment" onChange={handlePhotoChange} style={{ display: 'none' }} />
                                        </label>
                                        <label className="btn btn-primary" style={{ cursor: scanning ? 'wait' : 'pointer', flex: 1, opacity: scanning ? 0.7 : 1 }}>
                                            {scanning ? <Loader size={16} className="spin" /> : <Sparkles size={16} />}
                                            {scanning ? 'Scanning...' : 'AI Scan'}
                                            <input type="file" accept="image/*,.pdf" capture="environment" onChange={handleAiScan} style={{ display: 'none' }} disabled={scanning} />
                                        </label>
                                    </div>
                                    {photo && (
                                        <div style={{ marginTop: 8, position: 'relative' }}>
                                            <img
                                                src={photo}
                                                alt="receipt"
                                                style={{ maxWidth: '100%', maxHeight: 150, borderRadius: 'var(--radius)', objectFit: 'cover', cursor: 'pointer' }}
                                                onClick={() => {
                                                    setPhotoZoom(1);
                                                    setShowPhotoPreview(true);
                                                }}
                                            />
                                            <button
                                                type="button"
                                                className="btn btn-danger btn-sm"
                                                onClick={() => {
                                                    setPhoto(null);
                                                    setShowPhotoPreview(false);
                                                }}
                                                style={{ position: 'absolute', top: 4, right: 4 }}
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {isMobile ? (
                            <div className="add-transaction-sticky-actions">
                                <button className="btn btn-primary" type="button" disabled={loading} onClick={() => saveTransaction(false)}>
                                    {loading ? 'Saving...' : 'Save'}
                                </button>
                                {!editId && (
                                    <button className="btn btn-secondary" type="button" disabled={loading} onClick={() => saveTransaction(true)}>
                                        {loading ? 'Working...' : 'Continue'}
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="add-transaction-upload-actions" style={{ marginTop: 8 }}>
                                <button className="btn btn-primary" type="submit" disabled={loading} style={{ flex: 1 }}>
                                    {loading ? 'Saving...' : 'Save'}
                                </button>
                                {!editId && (
                                    <button className="btn btn-secondary" type="button" disabled={loading} style={{ flex: 1 }} onClick={() => saveTransaction(true)}>
                                        {loading ? '...' : 'Continue'}
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Category Picker (right column) */}
                    {type !== 'transfer' && (!isMobile || mobileSection === 'category') && (
                        <div className="card form-section-card add-transaction-category-card">
                            <div className="input-group">
                                <label className="input-label">Category</label>
                            </div>
                            <div className="category-grid">
                                {filteredCategories.map(cat => (
                                    <div key={cat.id} className={`category-item ${categoryId === cat.id || (cat.subcategories || []).some(s => s.id === categoryId) ? 'selected' : ''}`}
                                        onClick={() => setCategoryId(cat.id)}>
                                        <div className="category-item-icon">{cat.icon}</div>
                                        <div className="category-item-name">{cat.name}</div>
                                    </div>
                                ))}
                            </div>
                            {categoryId && getParentForCategory(categoryId)?.subcategories?.length > 0 && (
                                <div style={{ marginTop: 16 }}>
                                    <div className="input-label" style={{ marginBottom: 8 }}>Subcategory</div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                        {getParentForCategory(categoryId).subcategories.map(sub => (
                                            <button key={sub.id} type="button"
                                                className={`btn ${categoryId === sub.id ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                                                onClick={() => setCategoryId(sub.id)}>
                                                {sub.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                </div>
            </form>
        </div>
        {showPhotoPreview && photo && (
            <div
                style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0,0,0,0.75)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 2000,
                }}
                onClick={() => setShowPhotoPreview(false)}
            >
                <div
                    style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}
                    onClick={e => e.stopPropagation()}
                >
                    <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => setShowPhotoPreview(false)}
                        style={{ position: 'absolute', top: 8, right: 8, zIndex: 10 }}
                        aria-label="Close"
                    >
                        <X size={16} />
                    </button>
                    <div style={{ maxWidth: '90vw', maxHeight: '80vh', overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <img
                            src={photo}
                            alt="receipt full preview"
                            style={{
                                maxWidth: '100%',
                                maxHeight: '80vh',
                                borderRadius: 'var(--radius)',
                                boxShadow: 'var(--shadow-lg)',
                                transform: `scale(${photoZoom})`,
                                transformOrigin: 'center center',
                            }}
                        />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 8 }}>
                        <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setPhotoZoom(z => Math.max(0.5, z - 0.25))}
                        >
                            -
                        </button>
                        <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setPhotoZoom(z => Math.min(3, z + 0.25))}
                        >
                            +
                        </button>
                        <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => setPhotoZoom(1)}
                        >
                            Reset
                        </button>
                    </div>
                </div>
            </div>
        )}
        </>
    );
}
