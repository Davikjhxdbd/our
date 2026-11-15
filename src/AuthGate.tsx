import { useEffect, useState, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { ArrowLeft, ArrowRight, LockKeyhole, Mail, ShieldCheck, Sparkles } from 'lucide-react'
import CoupleGate from './CoupleGate'
import { supabase } from './lib/supabase'

type AuthMode = 'login' | 'signup' | 'forgot'

export default function AuthGate() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<AuthMode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }

    let active = true
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return
      setSession(data.session)
      if (error) setError(error.message)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setLoading(false)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  function changeMode(next: AuthMode) {
    setMode(next)
    setError('')
    setMessage('')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return
    setBusy(true)
    setError('')
    setMessage('')

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: name.trim() } },
        })
        if (error) throw error
        if (!data.session) setMessage('Cadastro iniciado! Confira seu e-mail para confirmar sua conta.')
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin,
        })
        if (error) throw error
        setMessage('Se este e-mail estiver cadastrado, você receberá um link para redefinir sua senha.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível concluir. Tente novamente.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <div className="auth-loading"><span className="auth-loader" />Preparando seu espaço...</div>
  if (session) return <CoupleGate />

  if (!supabase) {
    return <main className="auth-screen"><section className="auth-card">
      <div className="auth-brand">OUR<span>.</span></div>
      <h1>Conexão necessária</h1>
      <p>Configure as credenciais do Supabase no arquivo .env.local.</p>
    </section></main>
  }

  const isLogin = mode === 'login'
  const isSignup = mode === 'signup'

  return (
    <main className="auth-screen">
      <div className="auth-glow auth-glow-one" />
      <div className="auth-glow auth-glow-two" />
      <section className="auth-card">
        <div className="auth-topline">
          <span>PERSONAL & COUPLE OS</span>
          <span className="auth-secure"><ShieldCheck size={13} /> PRIVATE SPACE</span>
        </div>
        <div className="auth-brand">OUR<span>.</span></div>
        <div className="auth-intro">
          <span className="auth-kicker"><Sparkles size={13} /> YOUR LIFE. YOUR PLANS. YOUR WORLD.</span>
          <h1>{isLogin ? 'Seu mundo começa aqui.' : isSignup ? 'Comecem uma nova história.' : 'Recupere seu acesso.'}</h1>
          <p>{isLogin ? 'Entre no seu espaço pessoal e compartilhado.' : isSignup ? 'Crie sua conta e organize a vida em um só lugar.' : 'Vamos enviar um link para redefinir sua senha.'}</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {isSignup && <label className="auth-field">
            <span>SEU NOME</span>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Como podemos chamar você?" autoComplete="name" required />
          </label>}
          <label className="auth-field">
            <span>E-MAIL</span>
            <div className="auth-input-wrap"><Mail size={17} /><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" autoComplete="email" required /></div>
          </label>
          {mode !== 'forgot' && <label className="auth-field">
            <span>SENHA</span>
            <div className="auth-input-wrap"><LockKeyhole size={17} /><input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo de 6 caracteres" autoComplete={isSignup ? 'new-password' : 'current-password'} minLength={6} required /></div>
          </label>}
          {isLogin && <button type="button" className="auth-forgot" onClick={() => changeMode('forgot')}>Esqueceu sua senha?</button>}
          {error && <p className="auth-feedback auth-error">{error}</p>}
          {message && <p className="auth-feedback auth-success">{message}</p>}
          <button className="auth-submit" type="submit" disabled={busy}>
            {busy ? 'Aguarde...' : isLogin ? 'Entrar no OUR' : isSignup ? 'Criar minha conta' : 'Enviar link de recuperação'}
            {!busy && <ArrowRight size={17} />}
          </button>
        </form>

        <div className="auth-switch">
          {mode === 'forgot'
            ? <button onClick={() => changeMode('login')}><ArrowLeft size={14} /> Voltar para o login</button>
            : <span>{isLogin ? 'Ainda não tem uma conta?' : 'Já tem uma conta?'} <button onClick={() => changeMode(isLogin ? 'signup' : 'login')}>{isLogin ? 'Cadastre-se' : 'Entrar'}</button></span>}
        </div>
        <div className="auth-bottom"><span>YOUR SPACE. YOUR STORY.</span><span>OUR © 2026</span></div>
      </section>
    </main>
  )
}
