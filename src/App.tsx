import { useEffect, useState } from 'react'
import {
  LayoutDashboard, UserRound, Heart, CalendarDays,
  CheckSquare, Wallet, Target, House, Plane,
  Settings, Search, Bell, Plus, ArrowUpRight,
  Clock3, Sparkles, Menu, X, Copy, UserPlus, Check,
  ChevronRight, CircleCheck, Zap, LogOut
} from 'lucide-react'
import { supabase } from './lib/supabase'
import './App.css'

const navigation = [
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'Personal', icon: UserRound },
  { label: 'Together', icon: Heart },
]

const modules = [
  { label: 'Agenda', icon: CalendarDays },
  { label: 'Tarefas', icon: CheckSquare },
  { label: 'Finanças', icon: Wallet },
  { label: 'Objetivos', icon: Target },
  { label: 'Nossa casa', icon: House },
  { label: 'Viagens', icon: Plane },
]

type Task = {
  id: string
  title: string
  due_at: string | null
  done: boolean
}

type CoupleMember = { user_id: string; role: string }

function formatTaskTime(value: string | null) {
  if (!value) return 'A definir'
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function App({ onSignOut }: { onSignOut?: () => void }) {
  const [active, setActive] = useState('Overview')
  const [tasks, setTasks] = useState<Task[]>([])
  const [tasksLoading, setTasksLoading] = useState(true)
  const [tasksError, setTasksError] = useState('')
  const [mobileOpen, setMobileOpen] = useState(false)

  const [search, setSearch] = useState('')

  const [coupleId, setCoupleId] = useState<string | null>(null)
  const [coupleName, setCoupleName] = useState('Nosso espaço')
  const [coupleMembers, setCoupleMembers] = useState<CoupleMember[]>([])
  const [currentUserId, setCurrentUserId] = useState('')
  const [sharedTasks, setSharedTasks] = useState<Task[]>([])
  const [sharedLoading, setSharedLoading] = useState(false)
  const [sharedError, setSharedError] = useState('')
  const [newSharedTask, setNewSharedTask] = useState('')
  const [inviteLink, setInviteLink] = useState('')
  const [inviteBusy, setInviteBusy] = useState(false)
  const [inviteCopied, setInviteCopied] = useState(false)


  useEffect(() => {
    let cancelled = false

    async function loadTasks() {
      if (!supabase) {
        setTasksError('Supabase não configurado.')
        setTasksLoading(false)
        return
      }

      const { data: { user }, error: userError } = await supabase.auth.getUser()

      if (userError || !user) {
        if (!cancelled) {
          setTasksError('Não foi possível identificar sua conta.')
          setTasksLoading(false)
        }
        return
      }

      const { data, error } = await supabase
        .from('tasks')
        .select('id, title, due_at, is_completed')
        .eq('created_by', user.id)
        .is('couple_id', null)
        .order('created_at', { ascending: false })

      if (cancelled) return

      if (error) {
        setTasksError('Erro ao carregar tarefas: ' + error.message)
      } else {
        setTasks(data.map(task => ({
          id: task.id,
          title: task.title,
          due_at: task.due_at,
          done: task.is_completed,
        })))
      }

      setTasksLoading(false)
    }

    loadTasks()
    return () => { cancelled = true }
  }, [])


  useEffect(() => {
    let cancelled = false

    async function loadCoupleData() {
      if (!supabase) return
      setSharedLoading(true)

      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        if (!cancelled) {
          setSharedError('Não foi possível identificar sua conta.')
          setSharedLoading(false)
        }
        return
      }

      if (!cancelled) setCurrentUserId(user.id)

      const { data: membership, error: membershipError } = await supabase
        .from('couple_members')
        .select('couple_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle()

      if (cancelled) return
      if (membershipError || !membership) {
        setSharedError(membershipError?.message || 'Seu espaço compartilhado ainda não foi encontrado.')
        setSharedLoading(false)
        return
      }

      setCoupleId(membership.couple_id)

      const [coupleResult, membersResult, tasksResult] = await Promise.all([
        supabase.from('couples').select('name').eq('id', membership.couple_id).single(),
        supabase.from('couple_members').select('user_id, role').eq('couple_id', membership.couple_id),
        supabase.from('tasks').select('id, title, due_at, is_completed')
          .eq('couple_id', membership.couple_id).order('created_at', { ascending: false }),
      ])

      if (cancelled) return

      if (coupleResult.data?.name) setCoupleName(coupleResult.data.name)
      if (membersResult.data) setCoupleMembers(membersResult.data)
      if (tasksResult.error) {
        setSharedError('Erro ao carregar tarefas compartilhadas: ' + tasksResult.error.message)
      } else {
        setSharedTasks((tasksResult.data || []).map(task => ({
          id: task.id,
          title: task.title,
          due_at: task.due_at,
          done: task.is_completed,
        })))
      }

      setSharedLoading(false)
    }

    loadCoupleData()
    return () => { cancelled = true }
  }, [])

  async function createSharedInvite() {
    if (!supabase || !coupleId) return
    setInviteBusy(true)
    setSharedError('')

    const { data: token, error } = await supabase.rpc('create_couple_invite', {
      p_couple_id: coupleId,
    })

    if (error || !token) {
      setSharedError('Não foi possível gerar o convite: ' + (error?.message || 'Erro desconhecido'))
      setInviteBusy(false)
      return
    }

    const link = `${window.location.origin}/?invite=${token}`
    setInviteLink(link)

    try {
      await navigator.clipboard.writeText(link)
      setInviteCopied(true)
    } catch {
      setInviteCopied(false)
    }

    setInviteBusy(false)
  }

  async function addSharedTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const title = newSharedTask.trim()
    if (!supabase || !coupleId || !currentUserId || !title) return

    setSharedError('')
    const { data, error } = await supabase.from('tasks').insert({
      created_by: currentUserId,
      couple_id: coupleId,
      title,
    }).select('id, title, due_at, is_completed').single()

    if (error) {
      setSharedError('Não foi possível salvar a tarefa: ' + error.message)
      return
    }

    setSharedTasks(current => [{
      id: data.id,
      title: data.title,
      due_at: data.due_at,
      done: data.is_completed,
    }, ...current])
    setNewSharedTask('')
  }

  async function toggleSharedTask(id: string) {
    const task = sharedTasks.find(item => item.id === id)
    if (!task || !supabase) return

    const nextDone = !task.done
    const { error } = await supabase.from('tasks').update({
      is_completed: nextDone,
      updated_at: new Date().toISOString(),
    }).eq('id', id)

    if (error) {
      setSharedError('Não foi possível atualizar a tarefa: ' + error.message)
      return
    }

    setSharedTasks(current => current.map(item =>
      item.id === id ? { ...item, done: nextDone } : item
    ))
  }

  const today = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date())

  const completed = tasks.filter(task => task.done).length

  async function toggleTask(id: string) {
    const task = tasks.find(item => item.id === id)
    if (!task || !supabase) return

    const nextDone = !task.done
    const { error } = await supabase
      .from('tasks')
      .update({
        is_completed: nextDone,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) {
      setTasksError('Erro ao atualizar tarefa: ' + error.message)
      return
    }

    setTasks(current =>
      current.map(item => item.id === id ? { ...item, done: nextDone } : item)
    )
  }

  async function addTask() {
    if (!supabase) return
    setTasksError('')

    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      setTasksError('Sua sessão expirou. Entre novamente.')
      return
    }

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        created_by: user.id,
        title: 'Nova tarefa',
        couple_id: null,
      })
      .select('id, title, due_at, is_completed')
      .single()

    if (error) {
      setTasksError('Erro ao salvar tarefa: ' + error.message)
      return
    }

    setTasks(current => [{
      id: data.id,
      title: data.title,
      due_at: data.due_at,
      done: data.is_completed,
    }, ...current])
  }

  const sidebar = (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-symbol">O.</div>
        <span>OUR<span className="brand-dot">.</span></span>
        <button className="mobile-close" onClick={() => setMobileOpen(false)}>
          <X size={19} />
        </button>
      </div>

      <div className="workspace">
        <div className="workspace-avatar">D</div>
        <div>
          <strong>Nosso espaço</strong>
          <span>Personal workspace</span>
        </div>
        <ChevronRight size={15} />
      </div>

      <span className="nav-caption">WORKSPACE</span>
      <nav className="navigation">
        {navigation.map(item => {
          const Icon = item.icon
          return (
            <button
              key={item.label}
              className={`nav-item ${active === item.label ? 'active' : ''}`}
              onClick={() => {
                setActive(item.label)
                setMobileOpen(false)
              }}
            >
              <Icon size={18} />
              <span>{item.label}</span>
              {item.label === 'Together' && <span className="nav-dot" />}
            </button>
          )
        })}
      </nav>

      <span className="nav-caption modules-caption">YOUR LIFE</span>
      <nav className="navigation">
        {modules.map(item => {
          const Icon = item.icon
          return (
            <button
              key={item.label}
              className={`nav-item ${active === item.label ? 'active' : ''}`}
              onClick={() => {
                setActive(item.label)
                setMobileOpen(false)
              }}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>

      <div className="sidebar-bottom">
        <div className="ai-card">
          <div className="ai-icon"><Sparkles size={17} /></div>
          <strong>OUR Intelligence</strong>
          <p>Seu assistente pessoal está chegando.</p>
          <span className="coming-soon">EM BREVE</span>
        </div>
        <button className="nav-item settings-item" onClick={() => setActive('Configurações')}>
          <Settings size={18} />
          <span>Configurações</span>
        </button>
        <div className="profile">
          <div className="profile-avatar">D</div>
          <div className="profile-info">
            <strong>Davi</strong>
            <span>Personal account</span>
          </div>
          <button className="profile-logout" onClick={onSignOut} aria-label="Sair da conta" title="Sair da conta">
            <LogOut size={17} />
          </button>
        </div>
      </div>
    </aside>
  )

  return (
    <div className="app-shell">
      {mobileOpen && <div className="mobile-overlay" onClick={() => setMobileOpen(false)} />}
      <div className={mobileOpen ? 'sidebar mobile-visible' : 'sidebar-wrap'}>
        {sidebar}
      </div>

      <main className="main-area">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMobileOpen(true)}>
            <Menu size={21} />
          </button>
          <div className="breadcrumb">
            <span>OUR</span>
            <ChevronRight size={14} />
            <strong>{active}</strong>
          </div>
          <div className="topbar-actions">
            <label className="search-box">
              <Search size={16} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar..."
              />
              <kbd>⌘ K</kbd>
            </label>
            <button className="icon-button" aria-label="Notificações">
              <Bell size={18} />
              <i />
            </button>
            <div className="top-avatar">D</div>
          </div>
        </header>

        <div className="dashboard">
          {active === 'Together' ? (
            <section className="together-page">
              <div className="together-page-header">
                <div>
                  <span className="section-kicker">YOUR LIFE TOGETHER</span>
                  <h1>{coupleName}<span className="heading-dot">.</span></h1>
                  <p>Um espaço privado para construir e organizar a vida juntos.</p>
                </div>
                <span className="live-label"><span /> PRIVATE SPACE</span>
              </div>

              <div className="together-welcome-card">
                <div className="together-welcome-copy">
                  <span className="hero-tag"><Heart size={14} /> SHARED SPACE</span>
                  <h2>Dois caminhos.<br />Um futuro em comum.</h2>
                  <p>Planos, tarefas e objetivos que vocês constroem lado a lado.</p>
                </div>
                <div className="together-member-list">
                  {coupleMembers.map((member) => (
                    <div className="together-member" key={member.user_id}>
                      <div className="together-member-avatar">{member.user_id === currentUserId ? 'D' : 'A'}</div>
                      <div>
                        <strong>{member.user_id === currentUserId ? 'Você' : 'Ana Clara'}</strong>
                        <span>{member.role === 'owner' ? 'Administrador' : 'Membro'}</span>
                      </div>
                      <Check size={16} />
                    </div>
                  ))}
                  {coupleMembers.length < 2 && (
                    <div className="together-pending">
                      <UserPlus size={18} />
                      <span>Aguardando Ana Clara entrar no espaço</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="together-action-grid">
                <section className="panel together-invite-panel">
                  <div className="panel-header">
                    <div>
                      <span className="section-kicker">INVITE YOUR PERSON</span>
                      <h3>Convide para o OUR</h3>
                    </div>
                    <UserPlus size={19} className="muted-icon" />
                  </div>
                  <p>Gere um link privado para Ana Clara entrar no espaço compartilhado com a própria conta.</p>
                  <button className="primary-button" onClick={createSharedInvite} disabled={inviteBusy || coupleMembers.length >= 2}>
                    {inviteBusy ? 'Gerando convite...' : <><UserPlus size={16} /> Gerar convite</>}
                  </button>
                  {inviteLink && (
                    <div className="together-invite-link">
                      <input readOnly value={inviteLink} aria-label="Link de convite" />
                      <button onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(inviteLink)
                          setInviteCopied(true)
                        } catch {
                          setSharedError('Selecione e copie o link manualmente.')
                        }
                      }}>
                        {inviteCopied ? <Check size={16} /> : <Copy size={16} />}
                        {inviteCopied ? 'Copiado' : 'Copiar'}
                      </button>
                    </div>
                  )}
                  <span className="together-note">O convite expira em sete dias e só pode ser usado uma vez.</span>
                </section>

                <section className="panel together-members-panel">
                  <div className="panel-header">
                    <div>
                      <span className="section-kicker">YOUR PRIVATE CIRCLE</span>
                      <h3>Membros do espaço</h3>
                    </div>
                    <Heart size={19} className="muted-icon" />
                  </div>
                  <strong className="together-member-count">{coupleMembers.length}<small> / 2 pessoas</small></strong>
                  <div className="together-progress"><span style={{ width: `${Math.min(coupleMembers.length / 2 * 100, 100)}%` }} /></div>
                  <p>{coupleMembers.length >= 2 ? 'O espaço de vocês está completo.' : 'Seu espaço está pronto para receber a Ana Clara.'}</p>
                </section>
              </div>

              <section className="panel together-tasks-panel">
                <div className="panel-header">
                  <div>
                    <span className="section-kicker">PLAN TOGETHER</span>
                    <h3>Tarefas compartilhadas</h3>
                  </div>
                  <span className="together-task-total">{sharedTasks.filter(task => task.done).length} / {sharedTasks.length} concluídas</span>
                </div>
                <form className="together-task-form" onSubmit={addSharedTask}>
                  <input value={newSharedTask} onChange={event => setNewSharedTask(event.target.value)} placeholder="O que vocês precisam fazer juntos?" />
                  <button type="submit" disabled={!newSharedTask.trim()}><Plus size={17} /> Adicionar</button>
                </form>
                <div className="task-list">
                  {sharedTasks.map(task => (
                    <button className={`task-row ${task.done ? 'task-done' : ''}`} key={task.id} onClick={() => toggleSharedTask(task.id)}>
                      <span className="task-check">{task.done && <CircleCheck size={18} />}</span>
                      <span className="task-title">{task.title}</span>
                      <span className="task-time"><Clock3 size={13} /> {formatTaskTime(task.due_at)}</span>
                    </button>
                  ))}
                  {sharedLoading && <p className="empty-state">Carregando espaço compartilhado...</p>}
                  {!sharedLoading && sharedTasks.length === 0 && <p className="empty-state">Nenhuma tarefa compartilhada ainda. Criem a primeira juntos.</p>}
                </div>
              </section>

              {sharedError && <p className="auth-feedback auth-error" role="alert">{sharedError}</p>}
            </section>
          ) : (
          <>
          <section className="welcome-section">
            <div>
              <span className="eyebrow"><span className="status-dot" /> YOUR SPACE, YOUR LIFE</span>
              <h1>Bom dia, Davi<span className="heading-dot">.</span></h1>
              <p className="welcome-subtitle">Um novo dia para organizar o que realmente importa.</p>
              <span className="date-label">{today}</span>
            </div>
            <button className="primary-button" onClick={addTask}>
              <Plus size={17} /> Nova tarefa
            </button>
          </section>

          <section className="hero-grid">
            <div className="hero-card">
              <div className="hero-glow" />
              <div className="hero-content">
                <span className="hero-tag"><Sparkles size={14} /> YOUR PERSONAL SPACE</span>
                <h2>Uma vida organizada.<br />Um futuro construído.</h2>
                <p>Seu espaço para planejar, realizar e acompanhar tudo o que importa.</p>
                <button onClick={() => setActive('Personal')}>
                  Explorar meu espaço <ArrowUpRight size={16} />
                </button>
              </div>
              <div className="hero-decoration">
                <div className="orbit orbit-one" />
                <div className="orbit orbit-two" />
                <div className="orbit-core">O<span>.</span></div>
              </div>
              <span className="hero-number">01 / PERSONAL</span>
            </div>

            <div className="together-card">
              <div className="together-top">
                <div className="together-icon"><Heart size={20} /></div>
                <span className="live-label"><span /> SHARED SPACE</span>
              </div>
              <div>
                <span className="card-overline">YOUR LIFE TOGETHER</span>
                <h2>Construindo<br />algo juntos<span>.</span></h2>
                <p>Os planos, os sonhos e a vida que vocês compartilham.</p>
              </div>
              <button onClick={() => setActive('Together')}>
                Nosso espaço <ArrowUpRight size={16} />
              </button>
              <div className="couple-avatars">
                <div>D</div><div>A</div>
                <span>Dois perfis · Um espaço</span>
              </div>
            </div>
          </section>

          <section className="stats-grid">
            <div className="stat-card">
              <div className="stat-top">
                <span>Minhas tarefas</span>
                <CheckSquare size={18} />
              </div>
              <strong>{completed}<small> / {tasks.length}</small></strong>
              <div className="progress-track"><div style={{ width: `${tasks.length ? completed / tasks.length * 100 : 0}%` }} /></div>
              <span className="stat-foot">Concluídas hoje</span>
            </div>
            <div className="stat-card">
              <div className="stat-top">
                <span>Próximos eventos</span>
                <CalendarDays size={18} />
              </div>
              <strong>--</strong>
              <span className="stat-foot">Agenda a configurar</span>
            </div>
            <div className="stat-card">
              <div className="stat-top">
                <span>Objetivos ativos</span>
                <Target size={18} />
              </div>
              <strong>--</strong>
              <span className="stat-foot">Seus próximos objetivos</span>
            </div>
            <div className="stat-card">
              <div className="stat-top">
                <span>Nosso espaço</span>
                <Heart size={18} />
              </div>
              <strong>02<small> perfis</small></strong>
              <span className="stat-foot">Você e sua esposa</span>
            </div>
          </section>

          <section className="content-grid">
            <div className="panel tasks-panel">
              <div className="panel-header">
                <div>
                  <span className="section-kicker">STAY ON TRACK</span>
                  <h3>Minhas tarefas</h3>
                </div>
                <button className="text-button" onClick={addTask}>Adicionar <Plus size={15} /></button>
              </div>
              <div className="task-list">
                {tasks.filter(task => task.title.toLowerCase().includes(search.toLowerCase())).map(task => (
                  <button className={`task-row ${task.done ? 'task-done' : ''}`} key={task.id} onClick={() => toggleTask(task.id)}>
                    <span className="task-check">{task.done && <CircleCheck size={18} />}</span>
                    <span className="task-title">{task.title}</span>
                    <span className="task-time"><Clock3 size={13} /> {formatTaskTime(task.due_at)}</span>
                  </button>
                ))}
                {tasksLoading && <p className="empty-state">Carregando suas tarefas...</p>}
                {!tasksLoading && tasks.length === 0 && <p className="empty-state">Nenhuma tarefa por enquanto. Adicione sua primeira tarefa.</p>}
                {tasksError && <p className="empty-state" role="alert">{tasksError}</p>}
              </div>
              <button className="panel-footer" onClick={() => setActive('Tarefas')}>
                Ver todas as tarefas <ArrowUpRight size={15} />
              </button>
            </div>

            <div className="panel agenda-panel">
              <div className="panel-header">
                <div>
                  <span className="section-kicker">COMING UP</span>
                  <h3>Próximos compromissos</h3>
                </div>
                <CalendarDays size={19} className="muted-icon" />
              </div>
              <div className="empty-agenda">
                <div className="empty-icon"><CalendarDays size={22} /></div>
                <strong>Sua agenda começa aqui.</strong>
                <p>Adicione compromissos pessoais e compartilhados para visualizar tudo em um só lugar.</p>
                <button onClick={() => setActive('Agenda')}>Organizar agenda <ArrowUpRight size={14} /></button>
              </div>
            </div>
          </section>

          <section className="bottom-section">
            <div className="bottom-heading">
              <div>
                <span className="section-kicker">EXPLORE YOUR WORLD</span>
                <h3>Seu universo, em um só lugar.</h3>
              </div>
              <Zap size={19} />
            </div>
            <div className="module-grid">
              {[
                { name: 'Finanças', desc: 'Cuide do seu dinheiro.', icon: Wallet },
                { name: 'Objetivos', desc: 'Transforme planos em conquistas.', icon: Target },
                { name: 'Nossa casa', desc: 'Organizem a rotina juntos.', icon: House },
                { name: 'Viagens', desc: 'Planejem novas experiências.', icon: Plane },
              ].map(item => {
                const Icon = item.icon
                return (
                  <button className="module-card" key={item.name} onClick={() => setActive(item.name)}>
                    <div className="module-icon"><Icon size={19} /></div>
                    <strong>{item.name}</strong>
                    <span>{item.desc}</span>
                    <ArrowUpRight size={15} className="module-arrow" />
                  </button>
                )
              })}
            </div>
          </section>

          <footer className="footer">
            <span>OUR<span className="heading-dot">.</span> <span className="footer-muted">PERSONAL & COUPLE OS</span></span>
            <span>YOUR LIFE. YOUR PLANS. YOUR WORLD.</span>
          </footer>
          </>
          )}
        </div>
      </main>
    </div>
  )
}

export default App
