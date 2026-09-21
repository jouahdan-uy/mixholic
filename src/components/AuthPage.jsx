import { useEffect, useMemo, useState } from 'react';

// Three little characters that react to what's happening in the form:
// curious when the email field is focused, shy (eyes shut) while a
// password is being typed, relaxed otherwise.
function AuthCharacters({ mood }) {
  return (
    <div className="auth-characters" data-mood={mood} aria-hidden="true">
      <div className="auth-character auth-character--a">
        <div className="auth-character__face">
          <div className="auth-character__eyes">
            <span className="auth-character__eye" />
            <span className="auth-character__eye" />
          </div>
        </div>
      </div>
      <div className="auth-character auth-character--b">
        <div className="auth-character__face">
          <div className="auth-character__eyes">
            <span className="auth-character__eye" />
            <span className="auth-character__eye" />
          </div>
          <span className="auth-character__mouth" />
        </div>
      </div>
      <div className="auth-character auth-character--c">
        <div className="auth-character__face">
          <div className="auth-character__eyes">
            <span className="auth-character__eye" />
            <span className="auth-character__eye" />
          </div>
          <span className="auth-character__mouth auth-character__mouth--smile" />
        </div>
      </div>
    </div>
  );
}

// Full-page sign in / sign up / forgot / reset password screen.
// mode: 'login' | 'signup' | 'forgot' | 'reset'
export default function AuthPage({ auth, onToast, initialMode = 'login', resetToken, onDone }) {
  const [mode, setMode] = useState(initialMode);
  const [identifier, setIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [focusedField, setFocusedField] = useState(null);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setMode(initialMode);
    setError('');
    setInfo('');
  }, [initialMode]);

  const mood = useMemo(() => {
    const isPasswordField = focusedField === 'password' || focusedField === 'confirmPassword';
    if (isPasswordField && (password.length > 0 || confirmPassword.length > 0)) return 'shy';
    if (focusedField === 'email' || focusedField === 'identifier' || focusedField === 'username') return 'watching';
    return 'idle';
  }, [focusedField, password, confirmPassword]);

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
        const user = await auth.login({ identifier, password, remember });
        onToast?.(`Selamat datang kembali, ${user.username}!`, 'success');
        onDone?.();
      } else if (mode === 'signup') {
        const user = await auth.signup({ email, username, password });
        onToast?.(`Akun dibuat — halo, ${user.username}!`, 'success');
        onDone?.();
      } else if (mode === 'forgot') {
        const data = await auth.forgotPassword(email);
        setInfo(data.message || 'Kalau email itu terdaftar, link reset sudah dikirim.');
      } else if (mode === 'reset') {
        if (password !== confirmPassword) {
          throw new Error('Konfirmasi password tidak cocok.');
        }
        await auth.resetPassword({ token: resetToken, password });
        onToast?.('Password berhasil diubah. Silakan masuk.', 'success');
        setPassword('');
        setConfirmPassword('');
        switchMode('login');
      }
    } catch (err) {
      setError(err.message || 'Ada yang salah, coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const headers = {
    login: { title: 'Selamat datang kembali', subtitle: 'Masuk untuk lanjut dengerin & simpan favorit kamu.' },
    signup: { title: 'Buat akun', subtitle: 'Gratis, dan favorit kamu ikut tersimpan di mana pun.' },
    forgot: { title: 'Lupa password?', subtitle: 'Masukkan email kamu, kami kirim link buat atur ulang.' },
    reset: { title: 'Atur ulang password', subtitle: 'Bikin password baru buat akun kamu.' },
  };

  return (
    <div className="auth-page">
      <div className="auth-page__card">
        <div className="auth-page__panel auth-page__panel--art">
          <span className="auth-page__brand">Mixholic</span>
          <AuthCharacters mood={mood} />
          <p className="auth-page__art-caption">
            {mode === 'signup' || mode === 'reset'
              ? 'Ketik password kamu. Mereka bakal noleh, kok.'
              : 'Ketik password kamu. Mereka bakal noleh, kok.'}
          </p>
        </div>

        <div className="auth-page__panel auth-page__panel--form">
          <button type="button" className="auth-page__back" onClick={onDone}>
            ← Kembali
          </button>

          <div className="auth-page__form-header">
            <h1>{headers[mode].title}</h1>
            <p>{headers[mode].subtitle}</p>
          </div>

          {mode === 'reset' && !resetToken ? (
            <>
              <p className="auth-panel__info">
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
                      onFocus={() => setFocusedField('email')}
                      onBlur={() => setFocusedField(null)}
                      className="auth-panel__input"
                      placeholder="kamu@email.com"
                      required
                      autoFocus
                    />
                  </label>
                  <label className="auth-panel__label">
                    Username
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      onFocus={() => setFocusedField('username')}
                      onBlur={() => setFocusedField(null)}
                      className="auth-panel__input"
                      placeholder="username"
                      minLength={3}
                      maxLength={24}
                      required
                    />
                  </label>
                </>
              )}

              {mode === 'login' && (
                <label className="auth-panel__label">
                  Email atau username
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    onFocus={() => setFocusedField('identifier')}
                    onBlur={() => setFocusedField(null)}
                    className="auth-panel__input"
                    placeholder="kamu@email.com"
                    required
                    autoFocus
                  />
                </label>
              )}

              {mode === 'forgot' && (
                <label className="auth-panel__label">
                  Email akun kamu
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField(null)}
                    className="auth-panel__input"
                    placeholder="kamu@email.com"
                    required
                    autoFocus
                  />
                </label>
              )}

              {(mode === 'login' || mode === 'signup') && (
                <label className="auth-panel__label">
                  Password
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    className="auth-panel__input"
                    placeholder="••••••••"
                    minLength={6}
                    required
                  />
                </label>
              )}

              {mode === 'reset' && (
                <>
                  <label className="auth-panel__label">
                    Password baru
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => setFocusedField(null)}
                      className="auth-panel__input"
                      placeholder="••••••••"
                      minLength={6}
                      required
                      autoFocus
                    />
                  </label>
                  <label className="auth-panel__label">
                    Ulangi password baru
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      onFocus={() => setFocusedField('confirmPassword')}
                      onBlur={() => setFocusedField(null)}
                      className="auth-panel__input"
                      placeholder="••••••••"
                      minLength={6}
                      required
                    />
                  </label>
                </>
              )}

              {mode === 'login' && (
                <div className="auth-page__row">
                  <label className="auth-page__remember">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                    />
                    Ingat saya 30 hari
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
