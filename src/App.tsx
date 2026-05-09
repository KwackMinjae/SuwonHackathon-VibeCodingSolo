import { useState, useEffect } from 'react'
import SplashScreen from './components/SplashScreen'
import LoginScreen from './components/LoginScreen'
import ForgotPasswordScreen from './components/ForgotPasswordScreen'

type Screen = 'splash' | 'login' | 'forgot' | 'signup'

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
        <LoginScreen
          onForgot={() => setScreen('forgot')}
          onSignup={() => setScreen('signup')}
        />
      )}
      {screen === 'forgot' && (
        <ForgotPasswordScreen onBack={() => setScreen('login')} />
      )}
    </div>
  )
}
