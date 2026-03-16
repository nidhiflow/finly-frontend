import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';

export default function Signup() {
    const [step, setStep] = useState(1); // 1 = form, 2 = OTP
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [timer, setTimer] = useState(0);
    const [success, setSuccess] = useState('');
    const navigate = useNavigate();
    const otpRefs = useRef([]);

    // Timer countdown
    useEffect(() => {
        if (timer > 0) {
            const interval = setInterval(() => setTimer(t => t - 1), 1000);
            return () => clearInterval(interval);
        }
    }, [timer]);

    // Step 1: Submit signup form
    const handleSignup = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await authAPI.signup({ name, email, password });
            setStep(2);
            setTimer(300); // 5 minutes
            setSuccess('Verification code sent to ' + email);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // OTP input handling
    const handleOtpChange = (index, value) => {
        if (!/^\d*$/.test(value)) return;
        const newOtp = [...otp];
        newOtp[index] = value.slice(-1);
        setOtp(newOtp);

        if (value && index < 5) {
            otpRefs.current[index + 1]?.focus();
        }
    };

    const handleOtpKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            otpRefs.current[index - 1]?.focus();
        }
    };

    const handleOtpPaste = (e) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        const newOtp = [...otp];
        for (let i = 0; i < 6; i++) {
            newOtp[i] = pasted[i] || '';
        }
        setOtp(newOtp);
        if (pasted.length >= 6) {
            otpRefs.current[5]?.focus();
        }
    };

    // Step 2: Verify OTP
    const handleVerify = async () => {
        const code = otp.join('');
        if (code.length !== 6) {
            setError('Please enter the 6-digit code');
            return;
        }
        setError('');
        setLoading(true);
        try {
            const data = await authAPI.verifyOtp({ email, code, type: 'signup' });
            localStorage.setItem('finly_token', data.token);
            localStorage.setItem('finly_user', JSON.stringify(data.user));
            navigate('/');
            window.location.reload();
        } catch (err) {
            setError(err.message);
            setOtp(['', '', '', '', '', '']);
            otpRefs.current[0]?.focus();
        } finally {
            setLoading(false);
        }
    };

    // Resend OTP
    const handleResend = async () => {
        setError('');
        setSuccess('');
        setLoading(true);
        try {
            await authAPI.resendOtp({ email, type: 'signup' });
            setTimer(300);
            setSuccess('New verification code sent!');
            setOtp(['', '', '', '', '', '']);
            otpRefs.current[0]?.focus();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

    return (
        <div className="auth-container">
            <div className="auth-card slide-up">
                <div className="auth-brand">
                    <div className="auth-brand-icon">F</div>
                    <h1>Finly</h1>
                    <p>{step === 1 ? 'Start tracking your finances today' : 'Verify your email'}</p>
                </div>

                {error && <div className="auth-error">{error}</div>}
                {success && <div className="auth-success">{success}</div>}

                {step === 1 ? (
                    <form className="auth-form" onSubmit={handleSignup}>
                        <div className="input-group">
                            <label className="input-label">Full Name</label>
                            <input
                                type="text"
                                className="input"
                                placeholder="John Doe"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                required
                            />
                        </div>
                        <div className="input-group">
                            <label className="input-label">Email</label>
                            <input
                                type="email"
                                className="input"
                                placeholder="you@example.com"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                            />
                        </div>
                        <div className="input-group">
                            <label className="input-label">Password</label>
                            <input
                                type="password"
                                className="input"
                                placeholder="Min. 6 characters"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                                minLength={6}
                            />
                        </div>
                        <button className="btn btn-primary" type="submit" disabled={loading}>
                            {loading ? 'Sending code...' : 'Create Account'}
                        </button>
                    </form>
                ) : (
                    <div className="auth-form">
                        <p className="otp-info">Enter the 6-digit code sent to <strong>{email}</strong></p>

                        <div className="otp-inputs" onPaste={handleOtpPaste}>
                            {otp.map((digit, i) => (
                                <input
                                    key={i}
                                    ref={el => otpRefs.current[i] = el}
                                    type="text"
                                    inputMode="numeric"
                                    className="otp-input"
                                    value={digit}
                                    onChange={e => handleOtpChange(i, e.target.value)}
                                    onKeyDown={e => handleOtpKeyDown(i, e)}
                                    maxLength={1}
                                    autoFocus={i === 0}
                                />
                            ))}
                        </div>

                        {timer > 0 && (
                            <p className="otp-timer">Code expires in <strong>{formatTime(timer)}</strong></p>
                        )}

                        <button className="btn btn-primary" onClick={handleVerify} disabled={loading || otp.join('').length !== 6}>
                            {loading ? 'Verifying...' : 'Verify & Create Account'}
                        </button>

                        <div className="otp-actions">
                            <button className="btn-link" onClick={handleResend} disabled={loading || timer > 270}>
                                Resend Code
                            </button>
                            <button className="btn-link" onClick={() => { setStep(1); setOtp(['', '', '', '', '', '']); setError(''); setSuccess(''); }}>
                                Change Email
                            </button>
                        </div>
                    </div>
                )}

                <div className="auth-footer">
                    Already have an account? <Link to="/login">Sign In</Link>
                </div>
            </div>
        </div>
    );
}
