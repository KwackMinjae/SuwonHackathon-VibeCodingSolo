import { useState, useEffect } from 'react'
import SplashScreen from './components/SplashScreen'
import LoginScreen from './components/LoginScreen'
import ForgotPasswordScreen from './components/ForgotPasswordScreen'
import SignupScreen from './components/SignupScreen'
import MainScreen from './components/MainScreen'
import { UserProfile } from './components/RandomMatchScreen'

type Screen = 'splash' | 'login' | 'forgot' | 'signup' | 'main'

const DEFAULT_USER: UserProfile = {
  nickname: '나',
  studentId: '20241234',
  gender: '남',
  dept: '컴퓨터학부',
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('splash')
  const [currentUser, setCurrentUser] = useState<UserProfile>(DEFAULT_USER)

  useEffect(() => {
    const timer = setTimeout(() => setScreen('login'), 2000)
    return () => clearTimeout(timer)
  }, [])

  const handleSignupComplete = (user: UserProfile) => {
    setCurrentUser(user)
    setScreen('login')
  }

  return (
    <div className="phone-frame">
      {screen === 'splash' && <SplashScreen />}
      {screen === 'main' && (
        <MainScreen
          onLogout={() => setScreen('login')}
          onAccountDeleted={() => setScreen('login')}
          onPasswordReset={() => setScreen('login')}
          currentUser={currentUser}
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
            <SignupScreen
              onBack={() => setScreen('login')}
              onComplete={handleSignupComplete}
            />
          )}
        </div>
      )}
    </div>
  )
}
