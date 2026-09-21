import { useEffect, useRef, useState } from 'react';

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3l18 18" />
      <path d="M10.6 5.1A10.9 10.9 0 0 1 12 5c7 0 10.5 7 10.5 7a17.6 17.6 0 0 1-3.4 4.4M6.6 6.6C3.5 8.5 1.5 12 1.5 12s3.5 7 10.5 7a10.6 10.6 0 0 0 4.2-.86" />
      <path d="M9.9 9.9a3 3 0 0 0 4.24 4.24" />
    </svg>
  );
}

// mode: 'login' | 'signup' | 'forgot' | 'reset'
export default function AuthModal({ isOpen, onClose, auth, onToast, initialMode = 'login', resetToken }) {
  const [mode, setMode] = useState(initialMode);
  const [identifier, setIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [gender, setGender] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [isPeeking, setIsPeeking] = useState(false);
  const [isIdentifierFocused, setIsIdentifierFocused] = useState(false);
const [look, setLook] = useState({ x: 0, y: 0 });
const handleIllustrationMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();

    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = ((e.clientY - rect.top) / rect.height) * 2 - 1;

    setLook({
      x: Math.max(-1, Math.min(1, x)),
      y: Math.max(-1, Math.min(1, y)),
    });
  };

  const handleIllustrationMouseLeave = () => {
    setLook({ x: 0, y: 0 });
  };
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const firstFieldRef = useRef(null);

  // Re-sync the mode every time the page opens — in particular this is
  // how a "?resetToken=…" link from the reset email drops the user
  // straight into the reset-password form.
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setError('');
      setInfo('');
      setShowPassword(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) firstFieldRef.current?.focus();
  }, [isOpen, mode]);

  if (!isOpen) return null;

  // The characters in the illustration "look away" while a password is
  // actively being typed — mirrors the little easter egg this page is
  // modeled after.
const isShy = isPasswordFocused && !isPeeking;

  const resetFields = () => {
    setIdentifier('');
    setEmail('');
    setUsername('');
    setPassword('');
    setConfirmPassword('');
    setError('');
    setInfo('');
  };

  const close = () => {
    resetFields();
    onClose();
  };

  const switchMode = (next) => {
    setMode(next);
    setError('');
    setInfo('');
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      if (mode === 'login') {
        const user = await auth.login({ identifier, password, remember: rememberMe });
        onToast?.(`Selamat datang kembali, ${user.username}!`, 'success');
        close();
      } else if (mode === 'signup') {
        const user = await auth.signup({ email, username, password, gender: gender || undefined });
        onToast?.(`Akun dibuat — halo, ${user.username}!`, 'success');
        close();
      } else if (mode === 'forgot') {
        const data = await auth.forgotPassword(email);
        setInfo(data.message || 'Kalau email itu terdaftar, link reset sudah dikirim.');
      } else if (mode === 'reset') {
        if (password !== confirmPassword) {
          throw new Error('Konfirmasi password tidak cocok.');
        }
        await auth.resetPassword({ token: resetToken, password });
        onToast?.('Password berhasil diubah. Silakan masuk.', 'success');
        switchMode('login');
        setPassword('');
        setConfirmPassword('');
      }
    } catch (err) {
      setError(err.message || 'Ada yang salah, coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const titles = {
    login: 'Selamat datang kembali',
    signup: 'Buat akun Mixholic',
    forgot: 'Lupa password',
    reset: 'Atur ulang password',
  };
  const subtitles = {
    login: 'Masuk buat lanjut dengerin & simpen favorit kamu.',
    signup: 'Satu akun buat simpen semua lagu favorit kamu.',
    forgot: 'Masukin email kamu, kita kirimin link reset-nya.',
    reset: 'Bikin password baru buat akun kamu.',
  };

  return (
    <div className="auth-page">
      <div
  className={[
    'auth-page__illustration',
    isShy ? 'is-shy' : '',
    isIdentifierFocused ? 'is-nodding' : '',
    isPeeking ? 'is-peeking' : '',
  ].filter(Boolean).join(' ')}
  onMouseMove={handleIllustrationMouseMove}
  onMouseLeave={handleIllustrationMouseLeave}
>
        <div
  className="auth-cast"
  aria-hidden="true"
  style={{
    '--look-x': look.x,
    '--look-y': look.y,
  }}
>
          <div className="auth-character auth-character--tall" style={{ '--tilt': '-5deg' }}>
            <span className="auth-character__eye auth-character__eye--l" />
            <span className="auth-character__eye auth-character__eye--r" />
            <span className="auth-character__mouth" />
          </div>
          <div className="auth-character auth-character--peek" style={{ '--tilt': '4deg' }}>
            <span className="auth-character__eye auth-character__eye--l auth-character__eye--light" />
            <span className="auth-character__eye auth-character__eye--r auth-character__eye--light" />
          </div>
          <div className="auth-character auth-character--peek-alt" style={{ '--tilt': '7deg' }}>
            <span className="auth-character__eye auth-character__eye--l" />
            <span className="auth-character__mouth" />
          </div>
          <div className="auth-character auth-character--dome" style={{ '--tilt': '-3deg' }}>
            <span className="auth-character__eye auth-character__eye--l" />
            <span className="auth-character__eye auth-character__eye--r" />
            <span className="auth-character__mouth auth-character__mouth--smile" />
          </div>
        </div>
        <p className="auth-page__illustration-caption">
          {isShy ? 'Oke oke, kita gak liat kok…' : 'Ketik password kamu. Lihat mereka nutup mata.'}
        </p>
      </div>

      <div className="auth-page__form-pane">
        <button type="button" className="auth-page__back" onClick={close}>
          ← Kembali ke Mixholic
        </button>

        <div className="auth-page__card">
          <span className="auth-page__spark">✦</span>

          {(mode === 'login' || mode === 'signup') && (
            <div className="auth-panel__tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'login'}
                className={mode === 'login' ? 'is-active' : ''}
                onClick={() => switchMode('login')}
              >
                Masuk
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'signup'}
                className={mode === 'signup' ? 'is-active' : ''}
                onClick={() => switchMode('signup')}
              >
                Daftar
              </button>
            </div>
          )}

          <h1 className="auth-page__title">{titles[mode]}</h1>
          <p className="auth-page__subtitle">{subtitles[mode]}</p>

          {mode === 'reset' && !resetToken ? (
            <>
              <p className="auth-panel__error" style={{ marginTop: 18 }}>
                Link reset ini tidak valid. Minta link baru lewat "Lupa password".
              </p>
              <button type="button" className="auth-panel__submit" onClick={() => switchMode('login')}>
                Kembali ke halaman masuk
              </button>
            </>
          ) : (
            <form onSubmit={submit} className="auth-panel__form">
              {mode === 'signup' && (
                <>
                  <label className="auth-panel__label">
                    Email
                    <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setIsIdentifierFocused(true)}
                    onBlur={() => setIsIdentifierFocused(false)}
                    className="auth-panel__input"
                    placeholder="kamu@email.com"
                    required
                    />
                  </label>
                  <label className="auth-panel__label">
                    Username
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="auth-panel__input"
                      placeholder="username"
                      minLength={3}
                      maxLength={24}
                      required
                    />
                  </label>
                  <label className="auth-panel__label">
                    Jenis kelamin <span className="auth-panel__optional">(opsional)</span>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      className="auth-panel__input"
                    >
                      <option value="">Gak mau bilang</option>
                      <option value="MALE">Laki-laki</option>
                      <option value="FEMALE">Perempuan</option>
                      <option value="OTHER">Lainnya</option>
                    </select>
                  </label>
                </>
              )}

              {mode === 'login' && (
                <label className="auth-panel__label">
                  Email atau username
                  <input
                    ref={firstFieldRef}
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="auth-panel__input"
                    placeholder="kamu@email.com"
                    required
                  />
                </label>
              )}

              {mode === 'forgot' && (
                <label className="auth-panel__label">
                  Email akun kamu
                  <input
                    ref={firstFieldRef}
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="auth-panel__input"
                    placeholder="kamu@email.com"
                    required
                  />
                </label>
              )}

              {(mode === 'login' || mode === 'signup') && (
                <label className="auth-panel__label">
                  Password
                  <div className="auth-panel__input-wrap">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={() => setIsPasswordFocused(true)}
                      onBlur={() => setIsPasswordFocused(false)}
                      className="auth-panel__input"
                      placeholder="••••••••"
                      minLength={6}
                      required
                    />
                    <button
  type="button"
  className="auth-panel__reveal"
  onMouseDown={(e) => e.preventDefault()}
  onClick={() => {
    setShowPassword((v) => !v);
    setIsPeeking((v) => !v);
  }}
  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
>
                      {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
                </label>
              )}

              {mode === 'reset' && (
                <>
                  <label className="auth-panel__label">
                    Password baru
                    <div className="auth-panel__input-wrap">
                      <input
                        ref={firstFieldRef}
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onFocus={() => setIsPasswordFocused(true)}
                        onBlur={() => setIsPasswordFocused(false)}
                        className="auth-panel__input"
                        placeholder="••••••••"
                        minLength={6}
                        required
                      />
                      <button
                        type="button"
                        className="auth-panel__reveal"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                      >
                        {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                      </button>
                    </div>
                  </label>
                  <label className="auth-panel__label">
                    Ulangi password baru
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      onFocus={() => {
                        setIsPasswordFocused(true);
                        setIsPeeking(false);
                      }}
                      onBlur={() => {
                        setIsPasswordFocused(false);
                        setIsPeeking(false);
                      }}

                      className="auth-panel__input"
                      placeholder="••••••••"
                      minLength={6}
                      required
                    />
                  </label>
                </>
              )}

              {mode === 'login' && (
                <div className="auth-panel__row">
                  <label className="auth-panel__checkbox">
                    <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} /> Inget aku 30 hari
                  </label>
                  <button type="button" className="auth-panel__link" onClick={() => switchMode('forgot')}>
                    Lupa password?
                  </button>
                </div>
              )}

              {error && <p className="auth-panel__error">{error}</p>}
              {info && !error && <p className="auth-panel__info">{info}</p>}

              <button type="submit" className="auth-panel__submit" disabled={isSubmitting}>
                {isSubmitting
                  ? 'Memproses…'
                  : mode === 'login'
                  ? 'Masuk'
                  : mode === 'signup'
                  ? 'Buat akun'
                  : mode === 'forgot'
                  ? 'Kirim link reset'
                  : 'Simpan password baru'}
              </button>
            </form>
          )}

          {mode === 'login' && (
            <p className="auth-panel__hint">
              Belum punya akun?{' '}
              <button type="button" className="auth-panel__link" onClick={() => switchMode('signup')}>
                Daftar di sini
              </button>
            </p>
          )}
          {mode === 'signup' && (
            <p className="auth-panel__hint">
              Sudah punya akun?{' '}
              <button type="button" className="auth-panel__link" onClick={() => switchMode('login')}>
                Masuk di sini
              </button>
            </p>
          )}
          {mode === 'forgot' && (
            <p className="auth-panel__hint">
              <button type="button" className="auth-panel__link" onClick={() => switchMode('login')}>
                Kembali ke halaman masuk
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
