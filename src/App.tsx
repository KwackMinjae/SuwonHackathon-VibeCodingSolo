import { useState, useEffect } from 'react'
import SplashScreen from './components/SplashScreen'
import LoginScreen from './components/LoginScreen'
import ForgotPasswordScreen from './components/ForgotPasswordScreen'
import SignupScreen from './components/SignupScreen'
import MainScreen from './components/MainScreen'

type Screen = 'splash' | 'login' | 'forgot' | 'signup' | 'main'

export default function App() {
  const [screen, setScreen] = useState<Screen>('splash')

  useEffect(() => {
    const timer = setTimeout(() => setScreen('login'), 2000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="phone-frame">
      {screen === 'splash' && <SplashScreen />}
      {screen === 'main'   && (
        <MainScreen
          onLogout={() => setScreen('login')}
          onAccountDeleted={() => setScreen('login')}
          onPasswordReset={() => setScreen('login')}
        />
      )}
      {screen !== 'splash' && screen !== 'main' && (
        <div className="app-shell">
          {screen === 'login' && (
            <LoginScreen
              onForgot={() => setScreen('forgot')}
              onSignup={() => setScreen('signup')}
              onLogin={() => setScreen('main')}
            />
          )}
          {screen === 'forgot' && (
            <ForgotPasswordScreen onBack={() => setScreen('login')} />
          )}
          {screen === 'signup' && (
            <SignupScreen onBack={() => setScreen('login')} />
          )}
        </div>
      )}
    </div>
  )
}
