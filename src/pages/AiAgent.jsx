import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, Sparkles, Trash2, Mic, Square, Bot, User, Paperclip, X, TrendingUp, AlertTriangle, Target, BarChart3, Wallet } from 'lucide-react';
import { aiAPI, statsAPI } from '../services/api';
import { useApp } from '../context/AppContext';

const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;

// lightweight beep helper for mic on/off feedback
const playBeep = (frequency = 880, durationMs = 120) => {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = frequency;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durationMs / 1000);
        osc.stop(ctx.currentTime + durationMs / 1000 + 0.02);
    } catch {
        // ignore audio errors
    }
};

const DEFAULT_GREETING = { role: 'assistant', content: 'Hi! I\'m **Finly AI** 🤖\n\nI can help you with:\n- 📊 Understanding your spending patterns\n- ➕ Adding transactions by text or voice\n- 📸 Scanning receipts and bills\n- 💡 Tips on budgeting and saving\n\nWhat would you like to know?' };

export default function AiAgent() {
    const navigate = useNavigate();
    const { addToast, formatCurrency } = useApp();
    const [messages, setMessages] = useState([DEFAULT_GREETING]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [historyLoaded, setHistoryLoaded] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [autoSpeakReplies, setAutoSpeakReplies] = useState(() => {
        try {
            const v = localStorage.getItem('finly_autoSpeakReplies');
            return v !== 'false';
        } catch { return true; }
    });
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [attachedImage, setAttachedImage] = useState(null);
    const [showAttachmentPreview, setShowAttachmentPreview] = useState(false);
    const [attachmentZoom, setAttachmentZoom] = useState(1);
    const [coachInsights, setCoachInsights] = useState('');
    const [forecast, setForecast] = useState(null);
    const [coachLoading, setCoachLoading] = useState(true);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const attachmentInputRef = useRef(null);
    const recognitionRef = useRef(null);
    const voiceTextRef = useRef('');
    const lastVoiceFlagRef = useRef(false);

    useEffect(() => {
        let cancelled = false;
        aiAPI.getChatHistory()
            .then(({ messages: history }) => {
                if (cancelled) return;
                if (history && history.length > 0) {
                    const normalized = history.map(m => ({
                        ...m,
                        content: m?.content == null ? '' : String(m.content),
                    }));
                    setMessages([DEFAULT_GREETING, ...normalized]);
                }
            })
            .catch(() => { })
            .finally(() => { if (!cancelled) setHistoryLoaded(true); });
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        let cancelled = false;
        const loadCoachHome = async () => {
            setCoachLoading(true);
            try {
                const [insightsRes, forecastRes] = await Promise.all([
                    aiAPI.getInsights().catch(() => ({ reply: '' })),
                    statsAPI.forecast().catch(() => null),
                ]);
                if (cancelled) return;
                setCoachInsights(insightsRes?.reply || '');
                setForecast(forecastRes || null);
            } finally {
                if (!cancelled) setCoachLoading(false);
            }
        };
        loadCoachHome();
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const isScanIntent = (text) => /scan|scan this|scan the (bill|receipt)|add (transaction|expense).*from this (bill|receipt)|extract|read this (bill|receipt)/i.test((text || '').trim());

    const parseTransactionsFilterIntent = (rawText) => {
        const text = (rawText || '').toLowerCase().trim();
        if (!text) return null;

        // Examples:
        // "show swiggy expenses this month"
        // "show zomato transactions this month"
        const match = text.match(/^show\s+(.+?)\s+(expenses?|income|transactions?)\s+(for\s+)?this\s+month/);
        if (!match) return null;

        const term = match[1].trim();
        let type = '';
        if (match[2].startsWith('expense')) type = 'expense';
        else if (match[2].startsWith('income')) type = 'income';

        return {
            search: term || '',
            type,
        };
    };

    const sendMessage = async (overrideMessage, options = { viaVoice: false }) => {
        const { viaVoice } = options || {};
        lastVoiceFlagRef.current = !!viaVoice;
        const messageToSend = overrideMessage != null ? String(overrideMessage).trim() : input.trim();
        if (!messageToSend || loading) return;

        const hasAttachment = !!attachedImage;
        const wantScan = isScanIntent(messageToSend);

        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: messageToSend }]);
        setLoading(true);

        // If there's an attached bill/receipt and the user is asking to scan it,
        // route through AI Scan instead of chat.
        if (hasAttachment && wantScan) {
            const imageToScan = attachedImage;
            setAttachedImage(null);
            try {
                const result = await aiAPI.scanReceipt({ image: imageToScan });
                const today = new Date().toISOString().split('T')[0];
                const hasAmount = typeof result.amount === 'number' && !Number.isNaN(result.amount);
                let totalFromEntries = 0;
                if (!hasAmount && result.entries && result.entries.length >= 1) {
                    totalFromEntries = result.entries.reduce((sum, e) => {
                        const raw = typeof e.amount === 'number' ? e.amount : parseFloat(e.amount);
                        const num = Number.isFinite(raw) ? raw : 0;
                        return sum + num;
                    }, 0);
                }
                const scanMeta = {
                    note: result.note || '',
                    date: result.date || today,
                    type: result.type || 'expense',
                    amount: hasAmount ? result.amount : totalFromEntries || null,
                };
                let scanEntries;
                if (result.entries && result.entries.length >= 1) {
                    scanEntries = result.entries.map(e => ({
                        amount: typeof e.amount === 'number' ? e.amount : parseFloat(e.amount) || 0,
                        category_suggestion: e.category_suggestion || '',
                        categoryId: ''
                    }));
                } else {
                    const single = result.entries && result.entries.length === 1 ? result.entries[0] : result;
                    scanEntries = single.amount != null ? [{
                        amount: typeof single.amount === 'number' ? single.amount : parseFloat(single.amount) || 0,
                        category_suggestion: single.category_suggestion || '',
                        categoryId: ''
                    }] : [];
                }
                navigate('/add', { state: { scanEntries, scanMeta, photo: imageToScan }, replace: false });
            } catch (err) {
                addToast(err.message || 'Failed to scan receipt', 'error');
            } finally {
                setLoading(false);
                inputRef.current?.focus();
            }
            return;
        }

        // Natural-language shortcut: show filtered transactions instead of chat
        const txFilter = parseTransactionsFilterIntent(messageToSend);
        if (txFilter) {
            const params = new URLSearchParams();
            if (txFilter.type) params.set('type', txFilter.type);
            if (txFilter.search) params.set('search', txFilter.search);
            navigate(`/transactions${params.toString() ? `?${params}` : ''}`);
            setLoading(false);
            inputRef.current?.focus();
            return;
        }

        try {
            const response = await aiAPI.chat({ message: messageToSend });
            const { reply, addTransactionPrefill } = response;
            setMessages(prev => [...prev, { role: 'assistant', content: reply }]);

            const hasPrefill = addTransactionPrefill && addTransactionPrefill.type && addTransactionPrefill.amount != null && addTransactionPrefill.account_id && addTransactionPrefill.date;
            const doNavigate = () => {
                if (!hasPrefill) return;
                const prefill = { ...addTransactionPrefill };
                if (prefill.amount != null) prefill.amount = Number(prefill.amount);
                navigate(`/add?prefill=${encodeURIComponent(JSON.stringify(prefill))}`);
            };

            if (lastVoiceFlagRef.current && window.speechSynthesis && autoSpeakReplies) {
                speakReply(reply, doNavigate);
            } else {
                doNavigate();
            }
        } catch (err) {
            let msg = err?.message || 'Failed to get AI response';
            if (typeof msg === 'string' && msg.toLowerCase().includes('rate limit')) {
                msg = 'AI is temporarily busy. Please try again in a few seconds.';
            }
            addToast(msg, 'error');
            const shortErr = typeof msg === 'string' ? msg.slice(0, 80) : '';
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: shortErr ? `Sorry, I couldn't process that. (${shortErr}${shortErr.length >= 80 ? '…' : ''})` : 'Sorry, I couldn\'t process that. Please try again.',
            }]);
        } finally {
            setLoading(false);
            inputRef.current?.focus();
        }
    };

    const clearChat = async () => {
        try {
            await aiAPI.clearChat();
        } catch (e) {
            addToast('Failed to clear chat. Please try again.', 'error');
        }
        setMessages([DEFAULT_GREETING]);
    };

    const speakReply = (content, onEnd) => {
        if (!content || !window.speechSynthesis) {
            if (onEnd) onEnd();
            return;
        }
        const plain = content
            .replace(/\*\*(.*?)\*\*/g, '$1')
            .replace(/`(.*?)`/g, '$1')
            .replace(/\n/g, ' ')
            .trim();
        if (!plain) {
            if (onEnd) onEnd();
            return;
        }
        window.speechSynthesis.cancel();
        setIsSpeaking(true);
        const u = new SpeechSynthesisUtterance(plain);
        u.rate = 0.95;
        u.onend = () => {
            setIsSpeaking(false);
            onEnd && onEnd();
        };
        u.onerror = () => {
            setIsSpeaking(false);
            onEnd && onEnd();
        };
        window.speechSynthesis.speak(u);
    };

    const stopSpeaking = () => {
        if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
        }
        setIsSpeaking(false);
    };

    // Markdown renderer for bold, code, and lists
    const renderMarkdown = (text) => {
        const safe = text == null ? '' : String(text);
        return safe
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/`(.*?)`/g, '<code class="ai-inline-code">$1</code>')
            .replace(/\n- /g, '\n• ')
            .replace(/\n(\d+\.) /g, '\n$1 ')
            .replace(/\n/g, '<br/>');
    };

    const suggestions = [
        { icon: '💬', text: 'How do I add a transaction?' },
        { icon: '📊', text: 'How do I set a budget?' },
        { icon: '📥', text: 'How can I export my data?' },
        { icon: '📸', text: 'What is AI Scan?' },
    ];

    const coachPrompts = [
        { icon: '📉', title: 'Find spending leaks', prompt: 'Where am I overspending this month and how can I reduce it?' },
        { icon: '🎯', title: 'Improve my score', prompt: 'How can I improve my Finly Score this month?' },
        { icon: '🧾', title: 'Plan my budget', prompt: 'Help me plan this month budget using my current spending.' },
        { icon: '🚀', title: 'Goal coaching', prompt: 'How can I reach my savings goal faster?' },
    ];

    const freshChat = messages.length <= 1;
    const topBudgetRisk = forecast?.budgetRisks?.[0] || null;

    const formatTime = () => {
        const now = new Date();
        return now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    };

    return (
        <>
            <div className="ai-agent-container fade-in">
                {/* Header */}
                <div className="ai-agent-header">
                    <div className="ai-agent-header-left">
                        <div className="ai-agent-avatar">
                            <Sparkles size={20} color="#fff" />
                            <span className="ai-agent-status-dot" />
                        </div>
                        <div>
                            <div className="ai-agent-title">Finly AI</div>
                            <div className="ai-agent-subtitle">
                                {loading ? 'Thinking...' : isSpeaking ? 'Speaking...' : isListening ? 'Listening...' : 'Online'}
                            </div>
                        </div>
                    </div>
                    <div className="ai-agent-header-actions">
                        {isSpeaking && (
                            <button
                                type="button"
                                className="ai-agent-stop-btn"
                                onClick={stopSpeaking}
                                title="Stop speaking"
                            >
                                <Square size={12} style={{ fill: 'currentColor' }} /> Stop
                            </button>
                        )}
                        <button className="ai-agent-action-btn" onClick={clearChat} title="New chat">
                            <Trash2 size={16} />
                        </button>
                    </div>
                </div>

                {freshChat && (
                    <div className="ai-coach-home">
                        <div className="ai-coach-grid">
                            <div className="card ai-coach-card">
                                <div className="ai-coach-card-head">
                                    <div>
                                        <div className="dashboard-section-kicker">Finly coach</div>
                                        <div className="ai-coach-card-title">Ask smarter questions</div>
                                    </div>
                                    <Sparkles size={18} style={{ color: 'var(--accent-primary)' }} />
                                </div>
                                <div className="ai-coach-card-note">
                                    Finly AI works best when you ask about spending, budgets, goals, charts, receipts, and money habits inside the app.
                                </div>
                                <div className="ai-coach-prompt-grid">
                                    {coachPrompts.map((item) => (
                                        <button
                                            key={item.title}
                                            type="button"
                                            className="ai-coach-prompt-card"
                                            onClick={() => sendMessage(item.prompt)}
                                        >
                                            <span className="ai-coach-prompt-icon">{item.icon}</span>
                                            <span className="ai-coach-prompt-title">{item.title}</span>
                                            <span className="ai-coach-prompt-text">{item.prompt}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="card ai-coach-card">
                                <div className="ai-coach-card-head">
                                    <div>
                                        <div className="dashboard-section-kicker">Forecast</div>
                                        <div className="ai-coach-card-title">This month outlook</div>
                                    </div>
                                    <TrendingUp size={18} style={{ color: 'var(--accent-primary)' }} />
                                </div>
                                {coachLoading ? (
                                    <div className="ai-coach-card-note">Loading forecast...</div>
                                ) : forecast ? (
                                    <div className="ai-forecast-stack">
                                        <div className="ai-forecast-item">
                                            <div className="ai-forecast-label"><Wallet size={14} /> Projected month-end spend</div>
                                            <div className="ai-forecast-value">{formatCurrency(forecast.projectedExpense || 0)}</div>
                                        </div>
                                        <div className="ai-forecast-item">
                                            <div className="ai-forecast-label"><TrendingUp size={14} /> Projected month-end balance</div>
                                            <div className={`ai-forecast-value ${(forecast.projectedBalance || 0) >= 0 ? 'positive' : 'negative'}`}>
                                                {formatCurrency(forecast.projectedBalance || 0)}
                                            </div>
                                        </div>
                                        <div className="ai-forecast-item">
                                            <div className="ai-forecast-label"><AlertTriangle size={14} /> Budget risk</div>
                                            <div className="ai-forecast-note">
                                                {topBudgetRisk
                                                    ? `${topBudgetRisk.icon} ${topBudgetRisk.name} may reach ${topBudgetRisk.projectedPct}% of budget.`
                                                    : 'No major monthly budget risk detected right now.'}
                                            </div>
                                        </div>
                                        <div className="ai-forecast-item">
                                            <div className="ai-forecast-label"><Target size={14} /> Goal pace</div>
                                            <div className="ai-forecast-note">
                                                {forecast.goalForecast
                                                    ? forecast.goalForecast.etaMonths == null
                                                        ? `${forecast.goalForecast.name} needs a stronger savings pace to stay on track.`
                                                        : `${forecast.goalForecast.name} could be reached in about ${forecast.goalForecast.etaMonths} month${forecast.goalForecast.etaMonths > 1 ? 's' : ''}.`
                                                    : 'Create a goal to unlock savings pace guidance.'}
                                            </div>
                                        </div>
                                        <div className="ai-coach-actions">
                                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate('/charts')}>Open charts</button>
                                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/budget')}>View budgets</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="ai-coach-card-note">Forecast is not available yet.</div>
                                )}
                            </div>
                        </div>

                        <div className="card ai-coach-card ai-coach-insights-card">
                            <div className="ai-coach-card-head">
                                <div>
                                    <div className="dashboard-section-kicker">AI insights</div>
                                    <div className="ai-coach-card-title">What Finly notices right now</div>
                                </div>
                                <BarChart3 size={18} style={{ color: 'var(--accent-primary)' }} />
                            </div>
                            {coachLoading ? (
                                <div className="ai-coach-card-note">Loading AI insights...</div>
                            ) : coachInsights ? (
                                <div
                                    className="ai-coach-insights-preview"
                                    dangerouslySetInnerHTML={{ __html: renderMarkdown(coachInsights) }}
                                />
                            ) : (
                                <div className="ai-coach-card-note">AI insights are not available right now.</div>
                            )}
                            <div className="ai-coach-actions">
                                <button
                                    type="button"
                                    className="btn btn-primary btn-sm"
                                    onClick={() => sendMessage('Show me my spending insights and tell me what to improve this month.')}
                                >
                                    Ask about my insights
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-ghost btn-sm"
                                    onClick={async () => {
                                        setCoachLoading(true);
                                        try {
                                            const [{ reply }, forecastRes] = await Promise.all([
                                                aiAPI.getInsights().catch(() => ({ reply: '' })),
                                                statsAPI.forecast().catch(() => null),
                                            ]);
                                            setCoachInsights(reply || '');
                                            setForecast(forecastRes || null);
                                        } finally {
                                            setCoachLoading(false);
                                        }
                                    }}
                                >
                                    Refresh coach
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Messages Area + Drop Zone */}
                <div
                    className="ai-agent-messages"
                    onDragOver={e => {
                        e.preventDefault();
                        if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
                    }}
                    onDrop={async e => {
                        e.preventDefault();
                        const file = e.dataTransfer.files?.[0];
                        if (!file || loading) return;
                        const isImage = file.type.startsWith('image/');
                        const isPdf = file.type === 'application/pdf';
                        if (!isImage && !isPdf) {
                            addToast('Please choose an image or PDF file', 'error');
                            return;
                        }
                        try {
                            if (isPdf) {
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
                                setAttachedImage(canvas.toDataURL('image/png'));
                            } else {
                                const dataUrl = await new Promise((resolve) => {
                                    const reader = new FileReader();
                                    reader.onloadend = () => resolve(reader.result);
                                    reader.readAsDataURL(file);
                                });
                                setAttachedImage(dataUrl);
                            }
                        } catch {
                            addToast('Failed to process file', 'error');
                        }
                    }}
                >
                    {messages.map((msg, i) => (
                        <div key={i} className={`ai-msg-row ${msg.role === 'user' ? 'ai-msg-user' : 'ai-msg-assistant'}`}>
                            {msg.role === 'assistant' && (
                                <div className="ai-msg-avatar ai-msg-avatar-bot">
                                    <Bot size={16} />
                                </div>
                            )}
                            <div className="ai-msg-content-wrap">
                                <div
                                    className={`ai-msg-bubble ${msg.role === 'user' ? 'ai-msg-bubble-user' : 'ai-msg-bubble-bot'}`}
                                    dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                                />
                            </div>
                            {msg.role === 'user' && (
                                <div className="ai-msg-avatar ai-msg-avatar-user">
                                    <User size={16} />
                                </div>
                            )}
                        </div>
                    ))}

                    {/* Typing Indicator */}
                    {loading && (
                        <div className="ai-msg-row ai-msg-assistant">
                            <div className="ai-msg-avatar ai-msg-avatar-bot">
                                <Bot size={16} />
                            </div>
                            <div className="ai-msg-content-wrap">
                                <div className="ai-msg-bubble ai-msg-bubble-bot ai-typing-indicator">
                                    <span className="ai-typing-dot" />
                                    <span className="ai-typing-dot" />
                                    <span className="ai-typing-dot" />
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Suggestions (only when chat is fresh) */}
                {messages.length <= 1 && (
                    <div className="ai-suggestions">
                        {suggestions.map(s => (
                            <button
                                key={s.text}
                                className="ai-suggestion-chip"
                                onClick={() => { sendMessage(s.text); }}
                            >
                                <span className="ai-suggestion-icon">{s.icon}</span>
                                <span>{s.text}</span>
                            </button>
                        ))}
                        <button
                            className="ai-suggestion-chip"
                            type="button"
                            onClick={async () => {
                                setLoading(true);
                                try {
                                    const { reply } = await aiAPI.getInsights();
                                    setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
                                } catch (err) {
                                    addToast(err?.message || 'Failed to load insights', 'error');
                                } finally {
                                    setLoading(false);
                                }
                            }}
                        >
                            <span className="ai-suggestion-icon">📈</span>
                            <span>Show spending insights</span>
                        </button>
                    </div>
                )}

                {/* Listening indicator */}
                {isListening && (
                    <div className="ai-listening-bar">
                        <div className="ai-listening-pulse" />
                        <Mic size={16} />
                        <span>Listening… Speak now</span>
                        <span className="ai-listening-hint">Tap mic to stop</span>
                    </div>
                )}

                {/* Attachment Preview Chip */}
                {attachedImage && (
                    <div className="ai-attachment-chip">
                        <img
                            src={attachedImage}
                            alt="attached bill"
                            className="ai-attachment-thumb"
                            onClick={() => {
                                setAttachmentZoom(1);
                                setShowAttachmentPreview(true);
                            }}
                        />
                        <span className="ai-attachment-label">Receipt attached</span>
                        <button
                            type="button"
                            className="ai-attachment-remove"
                            onClick={() => { setAttachedImage(null); setShowAttachmentPreview(false); }}
                            title="Remove"
                        >
                            <X size={14} />
                        </button>
                    </div>
                )}

                {/* Input Bar */}
                <div className="ai-input-bar">
                    <input
                        type="file"
                        ref={attachmentInputRef}
                        accept="image/*,.pdf"
                        onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const isImage = file.type.startsWith('image/');
                            const isPdf = file.type === 'application/pdf';
                            if (!isImage && !isPdf) {
                                addToast('Please choose an image or PDF file', 'error');
                                e.target.value = '';
                                return;
                            }
                            try {
                                if (isPdf) {
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
                                    setAttachedImage(canvas.toDataURL('image/png'));
                                } else {
                                    const dataUrl = await new Promise((resolve) => {
                                        const reader = new FileReader();
                                        reader.onloadend = () => resolve(reader.result);
                                        reader.readAsDataURL(file);
                                    });
                                    setAttachedImage(dataUrl);
                                }
                            } catch (err) {
                                addToast('Failed to process file', 'error');
                            } finally {
                                e.target.value = '';
                            }
                        }}
                        style={{ display: 'none' }}
                        disabled={loading}
                    />
                    <button
                        type="button"
                        className="ai-input-action"
                        onClick={() => attachmentInputRef.current?.click()}
                        disabled={loading}
                        title="Attach receipt"
                    >
                        <Paperclip size={18} />
                    </button>
                    <input
                        ref={inputRef}
                        type="text"
                        className="ai-input-field"
                        placeholder="Ask me anything about Finly..."
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && sendMessage()}
                        disabled={loading}
                    />
                    {SpeechRecognitionAPI && (
                        <button
                            type="button"
                            className={`ai-input-action ${isListening ? 'ai-input-action-active' : ''}`}
                            onClick={() => {
                                if (!SpeechRecognitionAPI) {
                                    addToast('Voice input is not supported in this browser. Try Chrome or Edge.', 'error');
                                    return;
                                }
                                if (isListening) {
                                    try {
                                        recognitionRef.current?.stop();
                                    } catch { }
                                    playBeep(440); // mic off
                                    return;
                                }
                                try {
                                    if (isSpeaking && window.speechSynthesis) {
                                        window.speechSynthesis.cancel();
                                        setIsSpeaking(false);
                                    }
                                    const recognition = new SpeechRecognitionAPI();
                                    recognition.continuous = false;
                                    recognition.interimResults = false;
                                    recognition.lang = 'en-IN';

                                    voiceTextRef.current = '';

                                    recognition.onresult = (e) => {
                                        const transcript = Array.from(e.results[0]).map(r => r.transcript).join('');
                                        voiceTextRef.current = transcript.trim();
                                    };

                                    recognition.onend = () => {
                                        setIsListening(false);
                                        recognitionRef.current = null;
                                        const text = voiceTextRef.current.trim();
                                        if (text) {
                                            voiceTextRef.current = '';
                                            setInput('');
                                            sendMessage(text, { viaVoice: true });
                                        }
                                    };

                                    recognition.onerror = (e) => {
                                        if (e.error !== 'aborted') {
                                            addToast('Voice input failed. Try again.', 'error');
                                        }
                                        setIsListening(false);
                                        recognitionRef.current = null;
                                    };

                                    recognitionRef.current = recognition;
                                    recognition.start();
                                    setIsListening(true);
                                    playBeep(880); // mic on
                                } catch {
                                    addToast('Could not start microphone', 'error');
                                    setIsListening(false);
                                }
                            }}
                            disabled={loading}
                            title={isListening ? 'Stop listening' : 'Voice input'}
                        >
                            <Mic size={18} />
                        </button>
                    )}
                    <button
                        className="ai-send-btn"
                        onClick={() => sendMessage()}
                        disabled={loading || !input.trim()}
                    >
                        <Send size={18} />
                    </button>
                </div>
            </div>

            {/* Attachment Full Preview Overlay */}
            {showAttachmentPreview && attachedImage && (
                <div
                    className="ai-preview-overlay"
                    onClick={() => setShowAttachmentPreview(false)}
                >
                    <div
                        className="ai-preview-content"
                        onClick={e => e.stopPropagation()}
                    >
                        <button
                            type="button"
                            className="ai-preview-close"
                            onClick={() => setShowAttachmentPreview(false)}
                            aria-label="Close"
                        >
                            <X size={18} />
                        </button>
                        <div className="ai-preview-image-wrap">
                            <img
                                src={attachedImage}
                                alt="attached bill full preview"
                                style={{
                                    maxWidth: '100%',
                                    maxHeight: '80vh',
                                    borderRadius: 'var(--radius)',
                                    transform: `scale(${attachmentZoom})`,
                                    transformOrigin: 'center center',
                                }}
                            />
                        </div>
                        <div className="ai-preview-controls">
                            <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => setAttachmentZoom(z => Math.max(0.5, z - 0.25))}
                            >
                                −
                            </button>
                            <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => setAttachmentZoom(z => Math.min(3, z + 0.25))}
                            >
                                +
                            </button>
                            <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={() => setAttachmentZoom(1)}
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
