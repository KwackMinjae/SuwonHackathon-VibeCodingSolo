export default function SplashScreen() {
  return (
    <div className="splash">
      <div className="splash-logo-wrap">
        <div className="splash-emblem">
          <svg viewBox="0 0 120 120" width="120" height="120">
            <circle cx="60" cy="60" r="58" fill="#fff" stroke="#87CEEB" strokeWidth="3" />
            <text x="60" y="44" textAnchor="middle" fontSize="11" fontWeight="700" fill="#2196A6" fontFamily="serif">수원대학교</text>
            <text x="60" y="62" textAnchor="middle" fontSize="9" fill="#2196A6" fontFamily="serif">UNIVERSITY OF</text>
            <text x="60" y="76" textAnchor="middle" fontSize="9" fill="#2196A6" fontFamily="serif">SUWON</text>
            <path d="M30 88 Q60 100 90 88" stroke="#2196A6" strokeWidth="2" fill="none" />
          </svg>
        </div>
      </div>

      <div className="splash-title-wrap">
        <h1 className="splash-title">수원시그널</h1>
        <p className="splash-subtitle">수원대학교 과팅 매칭 앱</p>
      </div>

      <div className="splash-waves">
        <span />
        <span />
        <span />
      </div>
    </div>
  )
}
