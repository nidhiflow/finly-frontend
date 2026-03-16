import { useState, useEffect } from 'react';
import { Plus, Edit3, Trash2, ChevronRight, RefreshCw } from 'lucide-react';
import { categoriesAPI } from '../services/api';
import { useApp } from '../context/AppContext';

export default function Categories() {
    const [categories, setCategories] = useState([]);
    const [activeTab, setActiveTab] = useState('expense');
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingCat, setEditingCat] = useState(null);
    const [form, setForm] = useState({ name: '', icon: '📁', color: '#6c63ff', parent_id: null });
    const [expandedCat, setExpandedCat] = useState(null);
    const [syncing, setSyncing] = useState(false);
    const { addToast } = useApp();

    useEffect(() => { autoSyncAndLoad(); }, []);

    const autoSyncAndLoad = async () => {
        try {
            const res = await categoriesAPI.syncDefaults();
            if (res.added > 0) addToast(`Added ${res.added} new default categories`);
            if (res.removed > 0) addToast(`Removed ${res.removed} duplicate categories`);
        } catch { /* ignore sync errors */ }
        await loadCategories();
    };

    const loadCategories = async () => {
        try {
            const cats = await categoriesAPI.list();
            setCategories(cats);
        } catch { addToast('Failed to load categories', 'error'); }
        finally { setLoading(false); }
    };

    const filteredCats = categories.filter(c => c.type === activeTab);

    const emojis = [
        '🍔', '🚗', '🛍️', '🎬', '💡', '🏥', '📚', '🏠', '✈️', '📦', '💰', '💻', '📈', '🎁', '💵', '🎮',
        '☕', '🏋️', '🎵', '🐱', '💊', '🎨', '📱', '🔧', '💳', '🏦', '🧾', '🎓', '👶', '🐾', '💼', '🍕', '🏢',
        '🏡', '💅', '🛒', '🏖️', '🏛️', '🚌', '🚂', '✂️', '🧴', '👗', '👜', '💎', '🥛', '🥩', '🥬', '🍎',
        '📋', '🏧', '⛽', '🔩', '🛵', '🎭', '📺', '🛋️', '🍳', '🧹', '🧪', '💊', '🩺', '🏗️', '🪙', '📊',
        '💸', '🧾', '🎪', '🎟️', '🏘️', '🔌', '🔥', '💧', '📡', '🛡️', '🎓', '💍', '🍺', '🧃',
    ];

    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#AEB6BF', '#2ECC71', '#E74C3C', '#3498DB', '#F39C12', '#1ABC9C'];

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingCat) {
                await categoriesAPI.update(editingCat.id, form);
                addToast('Category updated');
            } else {
                await categoriesAPI.create({ ...form, type: activeTab });
                addToast('Category created');
            }
            setShowModal(false);
            setEditingCat(null);
            setForm({ name: '', icon: '📁', color: '#6c63ff', parent_id: null });
            loadCategories();
        } catch (err) { addToast(err.message, 'error'); }
    };

    const handleDelete = async (id) => {
        if (!confirm('Delete this category and all subcategories?')) return;
        try {
            await categoriesAPI.delete(id);
            addToast('Category deleted');
            loadCategories();
        } catch (err) { addToast(err.message, 'error'); }
    };

    const openEdit = (cat) => {
        setEditingCat(cat);
        setForm({ name: cat.name, icon: cat.icon, color: cat.color, parent_id: cat.parent_id });
        setShowModal(true);
    };

    const openAddSub = (parentId) => {
        setEditingCat(null);
        setForm({ name: '', icon: '📁', color: '#6c63ff', parent_id: parentId });
        setShowModal(true);
    };

    if (loading) return <div className="loading-spinner" />;

    return (
        <div className="fade-in">
            <div className="tabs" style={{ maxWidth: 300 }}>
                <button className={`tab expense ${activeTab === 'expense' ? 'active' : ''}`} onClick={() => setActiveTab('expense')}>Expense</button>
                <button className={`tab income ${activeTab === 'income' ? 'active' : ''}`} onClick={() => setActiveTab('income')}>Income</button>
            </div>

            <div style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn btn-primary btn-sm" onClick={() => { setEditingCat(null); setForm({ name: '', icon: '📁', color: '#6c63ff', parent_id: null }); setShowModal(true); }}>
                    <Plus size={16} /> Add Category
                </button>
                <button className="btn btn-secondary btn-sm" disabled={syncing} onClick={async () => {
                    setSyncing(true);
                    try {
                        const res = await categoriesAPI.syncDefaults();
                        if (res.added > 0) addToast(`Added ${res.added} new categories`);
                        if (res.removed > 0) addToast(`Removed ${res.removed} duplicate categories`);
                        if (res.added === 0 && res.removed === 0) addToast('All categories are up to date');
                        if (res.added > 0 || res.removed > 0) loadCategories();
                    } catch { addToast('Failed to sync', 'error'); }
                    finally { setSyncing(false); }
                }}>
                    <RefreshCw size={14} className={syncing ? 'spin' : ''} /> {syncing ? 'Syncing...' : 'Sync Defaults'}
                </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {categories.length === 0 ? (
                    <div className="empty-state" style={{ padding: 32 }}>
                        <div className="empty-state-icon" style={{ fontSize: 48, marginBottom: 12 }}>📁</div>
                        <h3>No categories yet</h3>
                        <p>Create your first category to organize transactions.</p>
                        <button className="btn btn-primary" onClick={() => { setEditingCat(null); setForm({ name: '', icon: '📁', color: '#6c63ff', parent_id: null }); setShowModal(true); }} style={{ marginTop: 16 }}>
                            <Plus size={18} /> Add Category
                        </button>
                    </div>
                ) : filteredCats.map(cat => (
                    <div key={cat.id} className="card" style={{ padding: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', cursor: 'pointer' }}
                            onClick={() => setExpandedCat(expandedCat === cat.id ? null : cat.id)}>
                            <div style={{ position: 'relative', marginRight: 14 }}>
                                <span style={{ fontSize: 28 }}>{cat.icon}</span>
                                <div style={{ position: 'absolute', bottom: -2, right: -2, width: 12, height: 12, borderRadius: '50%', background: cat.color || '#AEB6BF', border: '2px solid var(--bg-card)' }} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600, fontSize: 15 }}>{cat.name}</div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                    {cat.subcategories?.length || 0} subcategories
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 4 }}>
                                <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); openEdit(cat); }}>
                                    <Edit3 size={14} />
                                </button>
                                <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); handleDelete(cat.id); }}
                                    style={{ color: 'var(--danger)' }}>
                                    <Trash2 size={14} />
                                </button>
                                <ChevronRight size={18} style={{
                                    color: 'var(--text-muted)', transition: 'var(--transition)',
                                    transform: expandedCat === cat.id ? 'rotate(90deg)' : 'none'
                                }} />
                            </div>
                        </div>
                        {expandedCat === cat.id && (
                            <div style={{ borderTop: '1px solid var(--border)', padding: '12px 20px 16px', background: 'var(--bg-input)' }}>
                                {cat.subcategories?.map(sub => (
                                    <div key={sub.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span style={{ fontSize: 16 }}>{sub.icon}</span>
                                            <span style={{ fontSize: 13 }}>{sub.name}</span>
                                        </div>
                                        <div style={{ display: 'flex', gap: 4 }}>
                                            <button className="btn btn-ghost btn-sm" onClick={() => openEdit(sub)}><Edit3 size={12} /></button>
                                            <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(sub.id)} style={{ color: 'var(--danger)' }}>
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                <button className="btn btn-secondary btn-sm" onClick={() => openAddSub(cat.id)} style={{ marginTop: 8 }}>
                                    <Plus size={14} /> Add Subcategory
                                </button>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-title">{editingCat ? 'Edit Category' : form.parent_id ? 'Add Subcategory' : 'Add Category'}</div>
                            <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                <div className="input-group">
                                    <label className="input-label">Name</label>
                                    <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="Category name" />
                                </div>
                                <div className="input-group">
                                    <label className="input-label">Icon</label>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                        {emojis.map(e => (
                                            <button key={e} type="button" onClick={() => setForm(f => ({ ...f, icon: e }))}
                                                style={{
                                                    fontSize: 22, padding: '6px 8px', border: form.icon === e ? '2px solid var(--accent-primary)' : '2px solid transparent',
                                                    borderRadius: 8, background: form.icon === e ? 'var(--accent-primary-light)' : 'var(--bg-input)', cursor: 'pointer'
                                                }}>
                                                {e}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="input-group">
                                    <label className="input-label">Color</label>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                        {colors.map(c => (
                                            <button key={c} type="button" onClick={() => setForm(f => ({ ...f, color: c }))}
                                                style={{
                                                    width: 28, height: 28, border: form.color === c ? '3px solid var(--text-primary)' : '2px solid transparent',
                                                    borderRadius: '50%', background: c, cursor: 'pointer'
                                                }} />
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">{editingCat ? 'Update' : 'Create'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
