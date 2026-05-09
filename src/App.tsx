import { useState, useEffect } from 'react'
import SplashScreen from './components/SplashScreen'
import LoginScreen from './components/LoginScreen'

type Screen = 'splash' | 'login' | 'signup'

export default function App() {
  const [screen, setScreen] = useState<Screen>('splash')

  useEffect(() => {
    const timer = setTimeout(() => setScreen('login'), 2000)
    return () => clearTimeout(timer)
  }, [])

  if (screen === 'splash') return <SplashScreen />

  return (
    <div className="app-shell">
      {screen === 'login' && (
        <LoginScreen onSignup={() => setScreen('signup')} />
      )}
    </div>
  )
}
