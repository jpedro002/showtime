import type { Session } from '@supabase/supabase-js'
import { useEffect, useState, type ReactNode } from 'react'
import { supabase } from './supabase'
import { btn, Logo } from './ui'

/** Current Supabase session; undefined while loading. */
export function useSession() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])
  return session
}

export const signInWithGoogle = () =>
  supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.href } })

/** Presenter area: needs a real (non-anonymous) account. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const session = useSession()
  const [error, setError] = useState('')
  if (session === undefined) return null
  if (session && !session.user.is_anonymous) return children
  const login = async () => {
    setError('')
    const { error } = await signInWithGoogle()
    if (error) setError(error.message)
  }
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <section className="glass animate-fade-up w-full max-w-sm rounded-[2rem] p-8 text-center">
        <div className="flex justify-center"><Logo /></div>
        <h1 className="mt-6 font-display text-2xl font-bold text-white">Área do apresentador</h1>
        <p className="mt-2 text-sm text-emerald-100/70">Entre para enviar apresentações, conduzir sessões e ver relatórios.</p>
        <button onClick={login} className={btn('primary', 'lg', 'mt-6 w-full')}>
          <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
            <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7z" />
            <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.7-4.9h-4v3.1A12 12 0 0 0 12 24z" />
            <path fill="#FBBC05" d="M5.3 14.4a7.2 7.2 0 0 1 0-4.7V6.6h-4a12 12 0 0 0 0 10.9l4-3.1z" />
            <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8z" />
          </svg>
          Entrar com Google
        </button>
        {error && <p role="alert" className="mt-4 text-sm text-rose-300">{error}</p>}
      </section>
    </main>
  )
}
