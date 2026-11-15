import { useEffect, useState } from 'react'
import { ArrowRight, Check, Copy, Heart, Link2, LogOut, ShieldCheck, Sparkles } from 'lucide-react'
import App from './App'
import { supabase } from './lib/supabase'

export default function CoupleGate() {
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [hasCouple, setHasCouple] = useState(false)
  const [inviteLink, setInviteLink] = useState('')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let active = true

    async function initialize() {
      if (!supabase) {
        setError('Conexão com o Supabase indisponível.')
        setLoading(false)
        return
      }

      const { data: { user }, error: userError } = await supabase.auth.getUser()

      if (userError || !user) {
        if (active) {
          setError('Não foi possível identificar sua conta. Entre novamente.')
          setLoading(false)
        }
        return
      }

      const params = new URLSearchParams(window.location.search)
      const token = params.get('invite')

      if (token) {
        const { error: inviteError } = await supabase.rpc('accept_couple_invite', {
          p_token: token,
        })

        if (inviteError) {
          if (active) setError('Não foi possível aceitar o convite: ' + inviteError.message)
        } else {
          window.history.replaceState({}, '', window.location.pathname + window.location.hash)
        }
      }

      const { data: membership, error: membershipError } = await supabase
        .from('couple_members')
        .select('couple_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle()

      if (!active) return

      if (membershipError) {
        setError('Erro ao consultar seu espaço: ' + membershipError.message)
      } else if (membership) {
        setHasCouple(true)
      }

      setLoading(false)
    }

    initialize()

    return () => {
      active = false
    }
  }, [])

  async function createSpace() {
    if (!supabase) return
    setBusy(true)
    setError('')

    const { data: coupleId, error: createError } = await supabase.rpc('create_couple', {
      p_name: 'Nosso espaço',
    })

    if (createError || !coupleId) {
      setError('Não foi possível criar o espaço: ' + (createError?.message || 'Erro desconhecido'))
      setBusy(false)
      return
    }

    const { data: token, error: inviteError } = await supabase.rpc('create_couple_invite', {
      p_couple_id: coupleId,
    })

    if (inviteError || !token) {
      setError('Espaço criado, mas não foi possível gerar o convite: ' + (inviteError?.message || 'Erro desconhecido'))
      setHasCouple(true)
      setReady(true)
      setBusy(false)
      return
    }

    setInviteLink(`${window.location.origin}/?invite=${token}`)
    setHasCouple(true)
    setReady(true)
    setBusy(false)
  }

  async function copyInvite() {
    if (!inviteLink) return
    try {
      await navigator.clipboard.writeText(inviteLink)
      setCopied(true)
    } catch {
      setError('Não foi possível copiar automaticamente. Selecione e copie o link.')
    }
  }

  async function signOut() {
    if (!supabase) return
    await supabase.auth.signOut()
  }

  if (loading) {
    return <div className="auth-loading"><span className="auth-loader" />Preparando seu espaço...</div>
  }

  if (hasCouple && !ready) return <App onSignOut={signOut} />

  return (
    <main className="auth-screen couple-screen">
      <div className="auth-glow auth-glow-one" />
      <div className="auth-glow auth-glow-two" />
      <section className="auth-card couple-card">
        <div className="auth-topline">
          <span>PERSONAL & COUPLE OS</span>
          <span className="auth-secure"><ShieldCheck size={13} /> PRIVATE SPACE</span>
        </div>

        <div className="auth-brand">OUR<span>.</span></div>

        {inviteLink ? (
          <>
            <div className="auth-intro">
              <span className="auth-kicker"><Heart size={13} /> YOUR SPACE TOGETHER</span>
              <h1>Seu espaço está criado.</h1>
              <p>Agora convide Ana Clara para compartilhar planos, tarefas e a vida com você.</p>
            </div>
            <div className="couple-invite-box">
              <span>LINK DE CONVITE</span>
              <div className="couple-link"><Link2 size={16} /><input readOnly value={inviteLink} /></div>
              <button className="auth-submit" onClick={copyInvite}>
                {copied ? <><Check size={17} /> Link copiado</> : <><Copy size={17} /> Copiar convite</>}
              </button>
              <p>Este convite é válido por sete dias e só pode ser utilizado uma vez.</p>
            </div>
            <button className="couple-enter" onClick={() => setReady(true)}>
              Abrir meu OUR <ArrowRight size={17} />
            </button>
          </>
        ) : (
          <>
            <div className="auth-intro">
              <span className="auth-kicker"><Sparkles size={13} /> YOUR LIFE. YOUR PLANS. YOUR WORLD.</span>
              <h1>Uma vida. Dois caminhos. Um espaço.</h1>
              <p>Crie o espaço compartilhado para organizar a vida a dois, mantendo os dados pessoais de cada um protegidos.</p>
            </div>
            <div className="couple-benefits">
              <div><Heart size={17} /><span><strong>Espaço compartilhado</strong><small>Um ambiente para os dois.</small></span></div>
              <div><ShieldCheck size={17} /><span><strong>Contas individuais</strong><small>Cada um acessa com seu próprio login.</small></span></div>
              <div><Link2 size={17} /><span><strong>Convite privado</strong><small>Entre por um link seguro e temporário.</small></span></div>
            </div>
            {error && <p className="auth-feedback auth-error">{error}</p>}
            <button className="auth-submit" onClick={createSpace} disabled={busy}>
              {busy ? 'Criando espaço...' : 'Criar nosso espaço'} {!busy && <ArrowRight size={17} />}
            </button>
          </>
        )}

        {error && inviteLink && <p className="auth-feedback auth-error">{error}</p>}
        <div className="auth-switch">
          <button onClick={signOut}><LogOut size={14} /> Sair da conta</button>
        </div>
        <div className="auth-bottom"><span>YOUR SPACE. YOUR STORY.</span><span>OUR © 2026</span></div>
      </section>
    </main>
  )
}
