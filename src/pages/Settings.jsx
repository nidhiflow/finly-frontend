import { useState, useEffect } from 'react';
import { Sun, Moon, Download, LogOut, Globe, CalendarDays, User, Lock, Trash2, Edit3, Check, X, Eye, EyeOff, Upload, HardDrive, AlertTriangle, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { settingsAPI, authAPI, exportAPI, gdriveAPI } from '../services/api';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { saveTextFile } from '../utils/fileDownloads';
import { getAppScheme, isNativeApp, openExternalUrl } from '../utils/native';
import { useIsMobile } from '../hooks/useIsMobile';

export default function Settings() {
    const { user, logout, updateUser } = useAuth();
    const { theme, toggleTheme, addToast, setSettings: setGlobalSettings } = useApp();
    const navigate = useNavigate();
    const [settings, setSettings] = useState({});
    const [loading, setLoading] = useState(true);

    // Edit profile state
    const [editingName, setEditingName] = useState(false);
    const [newName, setNewName] = useState('');
    const [savingName, setSavingName] = useState(false);

    // Change password state
    const [showPasswordForm, setShowPasswordForm] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [savingPassword, setSavingPassword] = useState(false);
    const [showCurrentPw, setShowCurrentPw] = useState(false);
    const [showNewPw, setShowNewPw] = useState(false);

    // Delete account state
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deletePassword, setDeletePassword] = useState('');
    const [deletingAccount, setDeletingAccount] = useState(false);

    // CSV export date range (optional)
    const [exportStartDate, setExportStartDate] = useState('');
    const [exportEndDate, setExportEndDate] = useState('');

    // Backup state
    const [backupStatus, setBackupStatus] = useState(null);
    const [backingUp, setBackingUp] = useState(false);
    const [restoring, setRestoring] = useState(false);
    const [backupDue, setBackupDue] = useState(false);

    // Google Drive state
    const [gdriveStatus, setGdriveStatus] = useState({ connected: false, email: null, lastBackup: null, autoBackup: false });
    const [gdriveLoading, setGdriveLoading] = useState(false);
    const [gdriveBackups, setGdriveBackups] = useState([]);
    const [showDriveBackups, setShowDriveBackups] = useState(false);
    const [searchParams] = useSearchParams();

    useEffect(() => {
        loadSettings(); loadBackupStatus(); loadGdriveStatus();
        // Check for OAuth redirect result
        const gdriveResult = searchParams.get('gdrive');
        if (gdriveResult === 'connected') {
            addToast('Google Drive connected successfully!');
            loadGdriveStatus();
        } else if (gdriveResult === 'error') {
            addToast('Failed to connect Google Drive', 'error');
        }
    }, []);

    const loadSettings = async () => {
        try { setSettings(await settingsAPI.get()); }
        catch { /* silently fail */ }
        finally { setLoading(false); }
    };

    const updateSetting = async (key, value) => {
        try {
            await settingsAPI.update({ [key]: value });
            setSettings(prev => ({ ...prev, [key]: value }));
            setGlobalSettings(prev => ({ ...prev, [key]: value }));
            addToast('Settings saved');
        } catch { addToast('Failed to save setting', 'error'); }
    };

    const handleExport = async () => {
        try {
            await exportAPI.csv({
                startDate: exportStartDate || undefined,
                endDate: exportEndDate || undefined,
            });
            addToast('Export downloaded');
        } catch { addToast('Export failed', 'error'); }
    };

    const loadBackupStatus = async () => {
        try {
            const status = await settingsAPI.backupStatus();
            setBackupStatus(status.lastBackupAt);
            if (status.lastBackupAt) {
                const daysSince = (Date.now() - new Date(status.lastBackupAt).getTime()) / (1000 * 60 * 60 * 24);
                setBackupDue(daysSince >= 30);
            } else {
                setBackupDue(true);
            }
        } catch { /* silently fail */ }
    };

    const handleBackup = async () => {
        setBackingUp(true);
        try {
            const backup = await settingsAPI.backup();
            await saveTextFile({
                contents: JSON.stringify(backup, null, 2),
                fileName: `finly-backup-${new Date().toISOString().split('T')[0]}.json`,
            });
            setBackupStatus(new Date().toISOString());
            setBackupDue(false);
            addToast('Backup downloaded successfully');
        } catch { addToast('Backup failed', 'error'); }
        finally { setBackingUp(false); }
    };

    const handleRestore = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setRestoring(true);
        try {
            const text = await file.text();
            const backup = JSON.parse(text);
            const result = await settingsAPI.restore(backup);
            addToast(`Restored: ${result.counts.transactions} transactions, ${result.counts.accounts} accounts, ${result.counts.categories} categories`);
            window.location.reload();
        } catch (err) {
            addToast(err.message || 'Restore failed. Invalid backup file.', 'error');
        } finally {
            setRestoring(false);
            e.target.value = '';
        }
    };

    // Google Drive handlers
    const loadGdriveStatus = async () => {
        try {
            const status = await gdriveAPI.status();
            setGdriveStatus(status);
        } catch { /* silently fail */ }
    };

    const handleGdriveConnect = async () => {
        setGdriveLoading(true);
        try {
            const { url } = await gdriveAPI.getAuthUrl(
                isNativeApp()
                    ? { mobile: '1', appScheme: getAppScheme() }
                    : {}
            );
            await openExternalUrl(url);
        } catch {
            addToast('Failed to start Google Drive connection', 'error');
        } finally {
            setGdriveLoading(false);
        }
    };

    const handleGdriveDisconnect = async () => {
        if (!confirm('Disconnect Google Drive? Your existing backups on Drive will remain.')) return;
        try {
            await gdriveAPI.disconnect();
            setGdriveStatus({ connected: false, email: null, lastBackup: null, autoBackup: false });
            addToast('Google Drive disconnected');
        } catch { addToast('Failed to disconnect', 'error'); }
    };

    const handleGdriveAutoToggle = async () => {
        try {
            const newVal = !gdriveStatus.autoBackup;
            await gdriveAPI.toggleAuto(newVal);
            setGdriveStatus(prev => ({ ...prev, autoBackup: newVal }));
            addToast(newVal ? 'Auto backup enabled' : 'Auto backup disabled');
        } catch { addToast('Failed to update setting', 'error'); }
    };

    const handleGdriveBackup = async () => {
        setGdriveLoading(true);
        try {
            const result = await gdriveAPI.backup();
            setGdriveStatus(prev => ({ ...prev, lastBackup: result.lastBackup }));
            setBackupStatus(result.lastBackup);
            setBackupDue(false);
            addToast('Backup saved to Google Drive!');
        } catch (err) {
            if (err.message?.includes('expired') || err.message?.includes('reconnect')) {
                setGdriveStatus({ connected: false, email: null, lastBackup: null, autoBackup: false });
                addToast('Google Drive access expired. Please reconnect.', 'error');
            } else {
                addToast('Google Drive backup failed', 'error');
            }
        } finally { setGdriveLoading(false); }
    };

    const handleLoadDriveBackups = async () => {
        if (showDriveBackups) { setShowDriveBackups(false); return; }
        setGdriveLoading(true);
        try {
            const { backups } = await gdriveAPI.listBackups();
            setGdriveBackups(backups);
            setShowDriveBackups(true);
        } catch { addToast('Failed to load backups', 'error'); }
        finally { setGdriveLoading(false); }
    };

    const handleGdriveRestore = async (fileId, fileName) => {
        if (!confirm(`Restore from "${fileName}"? This will replace ALL your current data.`)) return;
        setGdriveLoading(true);
        try {
            await gdriveAPI.restore(fileId);
            addToast('Data restored from Google Drive!');
            window.location.reload();
        } catch { addToast('Restore failed', 'error'); }
        finally { setGdriveLoading(false); }
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    // Edit profile
    const startEditingName = () => {
        setNewName(user?.name || '');
        setEditingName(true);
    };

    const handleSaveName = async () => {
        if (!newName.trim()) {
            addToast('Name cannot be empty', 'error');
            return;
        }
        setSavingName(true);
        try {
            const updatedUser = await authAPI.updateProfile({ name: newName.trim() });
            updateUser(updatedUser);
            setEditingName(false);
            addToast('Name updated successfully');
        } catch (err) {
            addToast(err.message || 'Failed to update name', 'error');
        } finally {
            setSavingName(false);
        }
    };

    const cancelEditingName = () => {
        setEditingName(false);
        setNewName('');
    };

    // Change password
    const handleChangePassword = async () => {
        if (!currentPassword || !newPassword) {
            addToast('Please fill in all password fields', 'error');
            return;
        }
        if (newPassword.length < 6) {
            addToast('New password must be at least 6 characters', 'error');
            return;
        }
        if (newPassword !== confirmPassword) {
            addToast('New passwords do not match', 'error');
            return;
        }
        setSavingPassword(true);
        try {
            await authAPI.changePassword({ currentPassword, newPassword });
            setShowPasswordForm(false);
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setShowCurrentPw(false);
            setShowNewPw(false);
            addToast('Password changed successfully');
        } catch (err) {
            addToast(err.message || 'Failed to change password', 'error');
        } finally {
            setSavingPassword(false);
        }
    };

    // Delete account
    const handleDeleteAccount = async () => {
        if (!deletePassword) {
            addToast('Please enter your password', 'error');
            return;
        }
        setDeletingAccount(true);
        try {
            await authAPI.deleteAccount({ password: deletePassword });
            addToast('Account deleted');
            logout();
            navigate('/login');
        } catch (err) {
            addToast(err.message || 'Failed to delete account', 'error');
        } finally {
            setDeletingAccount(false);
        }
    };

    const currencies = [
        { code: 'INR', symbol: '₹' },
        { code: 'USD', symbol: '$' },
        { code: 'EUR', symbol: '€' },
        { code: 'GBP', symbol: '£' },
        { code: 'JPY', symbol: '¥' },
        { code: 'AUD', symbol: 'A$' },
        { code: 'CAD', symbol: 'C$' },
    ];

    const isMobile = useIsMobile();

    if (loading) return <div className="loading-spinner" />;

    return (
        <div className="fade-in page-stack settings-page" style={{ maxWidth: 760 }}>
            {!isMobile && (
            <div className="card page-toolbar-card">
                <div className="page-toolbar-header">
                    <div>
                        <div className="dashboard-section-kicker">Settings</div>
                        <div className="dashboard-section-title">Preferences and account</div>
                        <div className="dashboard-section-note">Control appearance, backups, privacy, account details, and connected services.</div>
                    </div>
                </div>
            </div>
            )}
            {/* User Info */}
            <div className="card settings-profile-card" style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{
                    width: 56, height: 56, borderRadius: 'var(--radius-full)',
                    background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: 22, fontWeight: 700
                }}>
                    {user?.name?.[0]?.toUpperCase() || 'U'}
                </div>
                <div>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>{user?.name}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{user?.email}</div>
                </div>
            </div>

            {/* Appearance */}
            <div className="settings-group">
                <div className="settings-group-title">Appearance</div>
                <div className="card" style={{ padding: 0 }}>
                    <div className="settings-item" style={{ padding: '14px 20px' }}>
                        <div className="settings-item-info">
                            {theme === 'dark' ? <Moon size={20} /> : <Sun size={20} />}
                            <div>
                                <div className="settings-item-label">Dark Mode</div>
                                <div className="settings-item-desc">Toggle between light and dark themes</div>
                            </div>
                        </div>
                        <label className="toggle-switch">
                            <input type="checkbox" checked={theme === 'dark'} onChange={toggleTheme} />
                            <span className="toggle-slider" />
                        </label>
                    </div>
                </div>
            </div>

            {/* Preferences */}
            <div className="settings-group">
                <div className="settings-group-title">Preferences</div>
                <div className="card" style={{ padding: 0 }}>
                    <div className="settings-item" style={{ padding: '14px 20px' }}>
                        <div className="settings-item-info">
                            <Globe size={20} />
                            <div>
                                <div className="settings-item-label">Currency</div>
                                <div className="settings-item-desc">Display currency for amounts</div>
                            </div>
                        </div>
                        <select className="input" style={{ width: 'auto', maxWidth: 130 }}
                            value={settings.currency || 'INR'}
                            onChange={e => {
                                const curr = currencies.find(c => c.code === e.target.value);
                                updateSetting('currency', e.target.value);
                                if (curr) updateSetting('currencySymbol', curr.symbol);
                            }}>
                            {currencies.map(c => <option key={c.code} value={c.code}>{c.symbol} {c.code}</option>)}
                        </select>
                    </div>
                    <div className="settings-item" style={{ padding: '14px 20px' }}>
                        <div className="settings-item-info">
                            <CalendarDays size={20} />
                            <div>
                                <div className="settings-item-label">Start of Week</div>
                                <div className="settings-item-desc">First day of the week</div>
                            </div>
                        </div>
                        <select className="input" style={{ width: 'auto', maxWidth: 130 }}
                            value={settings.startDayOfWeek || '1'}
                            onChange={e => updateSetting('startDayOfWeek', e.target.value)}>
                            <option value="0">Sunday</option>
                            <option value="1">Monday</option>
                            <option value="6">Saturday</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Data */}
            <div className="settings-group">
                <div className="settings-group-title">Data</div>
                <div className="card" style={{ padding: 0 }}>
                    <div className="settings-item" style={{ padding: '14px 20px', cursor: 'pointer' }} onClick={handleExport}>
                        <div className="settings-item-info">
                            <Download size={20} />
                            <div>
                                <div className="settings-item-label">Export Data</div>
                                <div className="settings-item-desc">Download transactions as CSV</div>
                            </div>
                        </div>
                    </div>
                    <div className="settings-item" style={{ padding: '12px 20px 16px', borderTop: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
                        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Date range (optional)</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>From</span>
                            <input type="date" className="input" style={{ width: 'auto', padding: '6px 10px', fontSize: 13 }}
                                value={exportStartDate} onChange={e => setExportStartDate(e.target.value)} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>To</span>
                            <input type="date" className="input" style={{ width: 'auto', padding: '6px 10px', fontSize: 13 }}
                                value={exportEndDate} onChange={e => setExportEndDate(e.target.value)} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Privacy & AI */}
            <div className="settings-group">
                <div className="settings-group-title">Privacy & AI</div>
                <div className="card" style={{ padding: '16px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                        <Shield size={20} style={{ color: 'var(--accent-primary)', flexShrink: 0, marginTop: 2 }} />
                        <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                            <p style={{ marginBottom: 10 }}>Finly AI helps with receipt scanning, chat guidance, spending insights, and budget suggestions.</p>
                            <p style={{ marginBottom: 10 }}>Data sent to AI: transaction summaries, category names, amounts. No passwords or sensitive account details are sent.</p>
                            <p style={{ margin: 0 }}>AI features require an internet connection. You can avoid AI by not using AI Agent, AI Scan, or AI suggestions.</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Backup & Restore */}
            <div className="settings-group">
                <div className="settings-group-title">Backup & Restore</div>
                {backupDue && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', marginBottom: 12, borderRadius: 'var(--radius)', background: 'rgba(255, 170, 0, 0.1)', border: '1px solid rgba(255, 170, 0, 0.3)', color: 'var(--text-primary)', fontSize: 13 }}>
                        <AlertTriangle size={18} style={{ color: '#ffaa00', flexShrink: 0 }} />
                        <span>{backupStatus ? 'Your last backup was over 30 days ago.' : 'You haven\'t backed up yet.'} Backup now to keep your data safe!</span>
                    </div>
                )}
                <div className="card" style={{ padding: 0 }}>
                    <div className="settings-item" style={{ padding: '14px 20px', cursor: 'pointer' }} onClick={handleBackup}>
                        <div className="settings-item-info">
                            <HardDrive size={20} />
                            <div>
                                <div className="settings-item-label">{backingUp ? 'Creating backup...' : 'Backup Now'}</div>
                                <div className="settings-item-desc">
                                    {backupStatus
                                        ? `Last backup: ${new Date(backupStatus).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
                                        : 'Export all your data as a backup file'}
                                </div>
                            </div>
                        </div>
                    </div>
                    <label className="settings-item" style={{ padding: '14px 20px', cursor: restoring ? 'wait' : 'pointer' }}>
                        <div className="settings-item-info">
                            <Upload size={20} />
                            <div>
                                <div className="settings-item-label">{restoring ? 'Restoring...' : 'Restore from Backup'}</div>
                                <div className="settings-item-desc">Upload a backup file to restore your data</div>
                            </div>
                        </div>
                        <input type="file" accept=".json" onChange={handleRestore} style={{ display: 'none' }} disabled={restoring} />
                    </label>
                </div>
            </div>

            {/* Google Drive Backup */}
            <div className="settings-group">
                <div className="settings-group-title">Google Drive Backup</div>
                <div className="card" style={{ padding: 0 }}>
                    {/* Connection Status / Connect */}
                    <div className="settings-item" style={{ padding: '14px 20px' }}>
                        <div className="settings-item-info">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                <path d="M12 2L2.5 17h19L12 2z" fill="#FBBC04" />
                                <path d="M12 2L2.5 17l4.75-8.25L12 2z" fill="#34A853" />
                                <path d="M7.25 8.75L2.5 17h9.5l-4.75-8.25z" fill="#4285F4" />
                                <path d="M12 2l4.75 6.75L21.5 17h-9.5L7.25 8.75 12 2z" fill="#EA4335" />
                            </svg>
                            <div style={{ flex: 1 }}>
                                <div className="settings-item-label">
                                    {gdriveStatus.connected ? 'Google Drive Connected' : 'Connect Google Drive'}
                                </div>
                                <div className="settings-item-desc">
                                    {gdriveStatus.connected
                                        ? `Connected as ${gdriveStatus.email}`
                                        : 'Backup your data to Google Drive automatically'}
                                </div>
                            </div>
                        </div>
                        {gdriveStatus.connected ? (
                            <button className="btn btn-secondary btn-sm" onClick={handleGdriveDisconnect} style={{ fontSize: 12 }}>
                                Disconnect
                            </button>
                        ) : (
                            <button className="btn btn-primary btn-sm" onClick={handleGdriveConnect} disabled={gdriveLoading} style={{ fontSize: 12 }}>
                                {gdriveLoading ? 'Connecting...' : 'Connect'}
                            </button>
                        )}
                    </div>

                    {gdriveStatus.connected && (
                        <>
                            {/* Auto Backup Toggle */}
                            <div className="settings-item" style={{ padding: '14px 20px' }}>
                                <div className="settings-item-info">
                                    <HardDrive size={20} />
                                    <div>
                                        <div className="settings-item-label">Google Drive automated backup</div>
                                        <div className="settings-item-desc">
                                            {gdriveStatus.autoBackup ? 'Auto backup every 30 days' : 'Automated backup is off'}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ fontSize: 13, fontWeight: 600, color: gdriveStatus.autoBackup ? 'var(--income)' : 'var(--danger)' }}>
                                        {gdriveStatus.autoBackup ? 'On' : 'Off'}
                                    </span>
                                    <label className="toggle-switch">
                                        <input type="checkbox" checked={gdriveStatus.autoBackup} onChange={handleGdriveAutoToggle} />
                                        <span className="toggle-slider" />
                                    </label>
                                </div>
                            </div>

                            {/* Backup to Drive */}
                            <div className="settings-item" style={{ padding: '14px 20px', cursor: gdriveLoading ? 'wait' : 'pointer' }} onClick={!gdriveLoading ? handleGdriveBackup : undefined}>
                                <div className="settings-item-info">
                                    <Upload size={20} />
                                    <div>
                                        <div className="settings-item-label">{gdriveLoading ? 'Backing up...' : 'Backup to Drive Now'}</div>
                                        <div className="settings-item-desc">
                                            {gdriveStatus.lastBackup
                                                ? `Last Drive backup: ${new Date(gdriveStatus.lastBackup).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`
                                                : 'Save all data including images to your Google Drive'}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Restore from Drive */}
                            <div className="settings-item" style={{ padding: '14px 20px', cursor: 'pointer', flexDirection: 'column', alignItems: 'stretch' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }} onClick={handleLoadDriveBackups}>
                                    <div className="settings-item-info">
                                        <Download size={20} />
                                        <div>
                                            <div className="settings-item-label">Restore from Drive</div>
                                            <div className="settings-item-desc">Restore data from a Google Drive backup</div>
                                        </div>
                                    </div>
                                    <button className="btn btn-ghost btn-sm">{showDriveBackups ? 'Hide' : 'Show'}</button>
                                </div>
                                {showDriveBackups && (
                                    <div style={{ marginTop: 12, paddingLeft: 32 }}>
                                        {gdriveBackups.length > 0 ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                {gdriveBackups.map(b => (
                                                    <div key={b.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-input)', borderRadius: 'var(--radius)', fontSize: 13 }}>
                                                        <div>
                                                            <div style={{ fontWeight: 600 }}>{b.name}</div>
                                                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                                                {new Date(b.createdTime).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                            </div>
                                                        </div>
                                                        <button className="btn btn-primary btn-sm" onClick={() => handleGdriveRestore(b.id, b.name)} disabled={gdriveLoading} style={{ fontSize: 11 }}>
                                                            Restore
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: 8 }}>No backups found on Google Drive</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Account */}
            <div className="settings-group">
                <div className="settings-group-title">Account</div>
                <div className="card" style={{ padding: 0 }}>
                    {/* Edit Name */}
                    <div className="settings-item" style={{ padding: '14px 20px' }}>
                        <div className="settings-item-info" style={{ flex: 1 }}>
                            <User size={20} />
                            {editingName ? (
                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <input
                                        type="text"
                                        className="input"
                                        value={newName}
                                        onChange={e => setNewName(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                                        style={{ flex: 1, padding: '8px 12px' }}
                                        autoFocus
                                    />
                                    <button className="btn btn-primary btn-sm" onClick={handleSaveName} disabled={savingName}>
                                        <Check size={16} />
                                    </button>
                                    <button className="btn btn-secondary btn-sm" onClick={cancelEditingName}>
                                        <X size={16} />
                                    </button>
                                </div>
                            ) : (
                                <div style={{ flex: 1 }}>
                                    <div className="settings-item-label">{user?.name}</div>
                                    <div className="settings-item-desc">Your display name</div>
                                </div>
                            )}
                        </div>
                        {!editingName && (
                            <button className="btn btn-ghost btn-sm" onClick={startEditingName}>
                                <Edit3 size={16} /> Edit
                            </button>
                        )}
                    </div>

                    {/* Change Password */}
                    <div className="settings-item" style={{ padding: '14px 20px', flexDirection: 'column', alignItems: 'stretch' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div className="settings-item-info">
                                <Lock size={20} />
                                <div>
                                    <div className="settings-item-label">Password</div>
                                    <div className="settings-item-desc">Change your password</div>
                                </div>
                            </div>
                            <button className="btn btn-ghost btn-sm" onClick={() => {
                                setShowPasswordForm(!showPasswordForm);
                                setCurrentPassword('');
                                setNewPassword('');
                                setConfirmPassword('');
                                setShowCurrentPw(false);
                                setShowNewPw(false);
                            }}>
                                {showPasswordForm ? 'Cancel' : 'Change'}
                            </button>
                        </div>
                        {showPasswordForm && (
                            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12, paddingLeft: 32 }}>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type={showCurrentPw ? 'text' : 'password'}
                                        className="input"
                                        placeholder="Current password"
                                        value={currentPassword}
                                        onChange={e => setCurrentPassword(e.target.value)}
                                        style={{ paddingRight: 40 }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowCurrentPw(!showCurrentPw)}
                                        style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                                    >
                                        {showCurrentPw ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type={showNewPw ? 'text' : 'password'}
                                        className="input"
                                        placeholder="New password (min 6 chars)"
                                        value={newPassword}
                                        onChange={e => setNewPassword(e.target.value)}
                                        style={{ paddingRight: 40 }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowNewPw(!showNewPw)}
                                        style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                                    >
                                        {showNewPw ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                                <input
                                    type="password"
                                    className="input"
                                    placeholder="Confirm new password"
                                    value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleChangePassword()}
                                />
                                <button className="btn btn-primary" onClick={handleChangePassword} disabled={savingPassword} style={{ alignSelf: 'flex-start' }}>
                                    {savingPassword ? 'Saving...' : 'Update Password'}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Log Out */}
                    <div className="settings-item" style={{ padding: '14px 20px', cursor: 'pointer' }} onClick={handleLogout}>
                        <div className="settings-item-info">
                            <LogOut size={20} />
                            <div>
                                <div className="settings-item-label" style={{ color: 'var(--text-primary)' }}>Log Out</div>
                                <div className="settings-item-desc">Sign out of your account</div>
                            </div>
                        </div>
                    </div>

                    {/* Delete Account */}
                    <div className="settings-item" style={{ padding: '14px 20px', cursor: 'pointer', borderBottom: 'none' }} onClick={() => setShowDeleteModal(true)}>
                        <div className="settings-item-info">
                            <Trash2 size={20} style={{ color: 'var(--danger)' }} />
                            <div>
                                <div className="settings-item-label" style={{ color: 'var(--danger)' }}>Delete Account</div>
                                <div className="settings-item-desc">Permanently delete your account and all data</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Delete Account Modal */}
            {showDeleteModal && (
                <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-title" style={{ color: 'var(--danger)' }}>Delete Account</div>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowDeleteModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body">
                            <p style={{ color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
                                This action is <strong style={{ color: 'var(--danger)' }}>permanent and cannot be undone</strong>.
                                All your transactions, budgets, categories, and settings will be permanently deleted.
                            </p>
                            <div className="input-group" style={{ marginBottom: 0 }}>
                                <label className="input-label">Enter your password to confirm</label>
                                <input
                                    type="password"
                                    className="input"
                                    placeholder="Your password"
                                    value={deletePassword}
                                    onChange={e => setDeletePassword(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleDeleteAccount()}
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => { setShowDeleteModal(false); setDeletePassword(''); }}>
                                Cancel
                            </button>
                            <button className="btn btn-danger" onClick={handleDeleteAccount} disabled={deletingAccount || !deletePassword}>
                                {deletingAccount ? 'Deleting...' : 'Delete My Account'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
