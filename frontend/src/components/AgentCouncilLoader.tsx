/**
 * AgentCouncilLoader - Animated visualization of the Prebloom AI Squads
 * Pure React + SVG + CSS animations
 */

interface AgentCouncilLoaderProps {
  phase?: 'intake' | 'catalyst' | 'fire' | 'squads' | 'synthesis'
}

export function AgentCouncilLoader({ phase = 'intake' }: AgentCouncilLoaderProps) {
  // 'squads' means both catalyst and fire are active simultaneously
  const isCatalystActive = phase === 'catalyst' || phase === 'squads'
  const isFireActive = phase === 'fire' || phase === 'squads'

  return (
    <div className="w-full flex justify-center">
      <svg 
        viewBox="0 0 800 700" 
        className="w-full max-w-[800px] h-auto"
        style={{ minHeight: '500px' }}
      >
        <defs>
          {/* Glow filters */}
          <filter id="glow-green" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glow-red" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glow-yellow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* === CONNECTION LINES === */}
        
        {/* Intake to Catalyst Squad */}
        <path 
          d="M 400 95 Q 300 130 165 175" 
          stroke="rgba(255,255,255,0.2)" 
          strokeWidth="1.5" 
          fill="none" 
          strokeDasharray="5 5"
        />
        
        {/* Intake to Fire Squad */}
        <path 
          d="M 400 95 Q 500 130 635 175" 
          stroke="rgba(255,255,255,0.2)" 
          strokeWidth="1.5" 
          fill="none" 
          strokeDasharray="5 5"
        />

        {/* Catalyst sub-agents to Lead */}
        <line x1="90" y1="330" x2="140" y2="280" stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="3 3" />
        <line x1="165" y1="330" x2="165" y2="280" stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="3 3" />
        <line x1="240" y1="330" x2="190" y2="280" stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="3 3" />

        {/* Fire sub-agents to Lead */}
        <line x1="560" y1="330" x2="610" y2="280" stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="3 3" />
        <line x1="635" y1="330" x2="635" y2="280" stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="3 3" />
        <line x1="710" y1="330" x2="660" y2="280" stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="3 3" />

        {/* Catalyst Lead to Debate - curves below the sub-agents */}
        <path 
          d="M 165 280 L 165 420 Q 200 470 340 470" 
          stroke="rgba(255,255,255,0.2)" 
          strokeWidth="1.5" 
          fill="none" 
          strokeDasharray="5 5"
        />

        {/* Fire Lead to Debate - curves below the sub-agents */}
        <path 
          d="M 635 280 L 635 420 Q 600 470 460 470" 
          stroke="rgba(255,255,255,0.2)" 
          strokeWidth="1.5" 
          fill="none" 
          strokeDasharray="5 5"
        />

        {/* Debate to Synthesis */}
        <path 
          d="M 400 510 L 400 560" 
          stroke="rgba(255,255,255,0.2)" 
          strokeWidth="1.5" 
          fill="none" 
          strokeDasharray="5 5"
        />

        {/* === ANIMATED FLOW DOTS === */}
        {/* Paths are absolute coords. Varied durations create natural stagger without begin delays (which cause origin flash). */}
        
        {/* Intake to Catalyst */}
        <circle r="4" fill="#22c55e" filter="url(#glow-green)">
          <animateMotion dur="2.5s" repeatCount="indefinite" path="M 400 95 Q 300 130 165 175" />
        </circle>
        
        {/* Intake to Fire */}
        <circle r="4" fill="#22c55e" filter="url(#glow-green)">
          <animateMotion dur="2.9s" repeatCount="indefinite" path="M 400 95 Q 500 130 635 175" />
        </circle>

        {/* Catalyst sub-agents to Lead */}
        <circle r="3" fill="#4ade80" filter="url(#glow-green)">
          <animateMotion dur="1.6s" repeatCount="indefinite" path="M 90 330 L 140 280" />
        </circle>
        <circle r="3" fill="#4ade80" filter="url(#glow-green)">
          <animateMotion dur="1.8s" repeatCount="indefinite" path="M 165 330 L 165 280" />
        </circle>
        <circle r="3" fill="#4ade80" filter="url(#glow-green)">
          <animateMotion dur="2.0s" repeatCount="indefinite" path="M 240 330 L 190 280" />
        </circle>

        {/* Fire sub-agents to Lead */}
        <circle r="3" fill="#f87171" filter="url(#glow-red)">
          <animateMotion dur="1.7s" repeatCount="indefinite" path="M 560 330 L 610 280" />
        </circle>
        <circle r="3" fill="#f87171" filter="url(#glow-red)">
          <animateMotion dur="1.9s" repeatCount="indefinite" path="M 635 330 L 635 280" />
        </circle>
        <circle r="3" fill="#f87171" filter="url(#glow-red)">
          <animateMotion dur="2.1s" repeatCount="indefinite" path="M 710 330 L 660 280" />
        </circle>

        {/* Catalyst Lead to Debate */}
        <circle r="4" fill="#4ade80" filter="url(#glow-green)">
          <animateMotion dur="2.5s" repeatCount="indefinite" path="M 165 280 L 165 420 Q 200 470 340 470" />
        </circle>

        {/* Fire Lead to Debate */}
        <circle r="4" fill="#f87171" filter="url(#glow-red)">
          <animateMotion dur="2.7s" repeatCount="indefinite" path="M 635 280 L 635 420 Q 600 470 460 470" />
        </circle>

        {/* Debate to Synthesis */}
        <circle r="4" fill="#fbbf24" filter="url(#glow-yellow)">
          <animateMotion dur="1.5s" repeatCount="indefinite" path="M 400 510 L 400 560" />
        </circle>

        {/* === INTAKE NODE === */}
        <g className={`transition-opacity duration-300 ${phase === 'intake' ? 'opacity-100' : 'opacity-60'}`}>
          <rect x="360" y="30" width="80" height="65" fill="#0a0a0a" stroke={phase === 'intake' ? '#22c55e' : 'rgba(255,255,255,0.3)'} strokeWidth={phase === 'intake' ? 2 : 1} />
          <g transform="translate(400, 55)">
            <rect x="-12" y="-10" width="24" height="28" fill="none" stroke={phase === 'intake' ? '#22c55e' : 'rgba(255,255,255,0.5)'} strokeWidth="1.5" rx="2" />
            <line x1="-6" y1="0" x2="6" y2="0" stroke={phase === 'intake' ? '#22c55e' : 'rgba(255,255,255,0.5)'} strokeWidth="1.5" />
            <line x1="-6" y1="6" x2="6" y2="6" stroke={phase === 'intake' ? '#22c55e' : 'rgba(255,255,255,0.5)'} strokeWidth="1.5" />
            <line x1="-6" y1="12" x2="2" y2="12" stroke={phase === 'intake' ? '#22c55e' : 'rgba(255,255,255,0.5)'} strokeWidth="1.5" />
          </g>
          <text x="400" y="115" textAnchor="middle" fill={phase === 'intake' ? '#22c55e' : 'rgba(255,255,255,0.7)'} fontSize="13" fontWeight="700" fontFamily="system-ui" letterSpacing="0.1em">INTAKE</text>
          <text x="400" y="132" textAnchor="middle" fill="rgba(255,255,255,0.55)" fontSize="8" fontFamily="monospace" letterSpacing="0.05em">PROBLEM ANALYSIS</text>
        </g>

        {/* === CATALYST SQUAD === */}
        <g className={`transition-opacity duration-300 ${isCatalystActive ? 'opacity-100' : 'opacity-60'}`}>
          <text x="165" y="175" textAnchor="middle" fill={isCatalystActive ? '#4ade80' : 'rgba(74,222,128,0.5)'} fontSize="10" fontWeight="700" fontFamily="system-ui" letterSpacing="0.15em">CATALYST SQUAD</text>
          
          <rect x="125" y="195" width="80" height="65" fill="#0a0a0a" stroke={isCatalystActive ? '#4ade80' : 'rgba(74,222,128,0.4)'} strokeWidth={isCatalystActive ? 2 : 1} />
          <g transform="translate(165, 220)">
            <path d="M 0 -12 L -8 2 L -2 2 L -4 14 L 8 -2 L 2 -2 Z" fill="none" stroke={isCatalystActive ? '#4ade80' : 'rgba(74,222,128,0.6)'} strokeWidth="1.5" />
          </g>
          <text x="165" y="275" textAnchor="middle" fill={isCatalystActive ? '#4ade80' : 'rgba(74,222,128,0.7)'} fontSize="11" fontWeight="700" fontFamily="system-ui">LEAD</text>
          <text x="165" y="290" textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize="8" fontFamily="monospace">ADVOCATE</text>

          {/* Sub-agents */}
          <rect x="60" y="310" width="60" height="45" fill="#0a0a0a" stroke="rgba(74,222,128,0.3)" strokeWidth="1" />
          <rect x="80" y="322" width="20" height="14" fill="none" stroke="rgba(74,222,128,0.5)" strokeWidth="1" rx="1" />
          <text x="90" y="370" textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize="8" fontFamily="monospace">VC PARTNER</text>

          <rect x="135" y="310" width="60" height="45" fill="#0a0a0a" stroke="rgba(74,222,128,0.3)" strokeWidth="1" />
          <rect x="155" y="320" width="20" height="18" fill="none" stroke="rgba(74,222,128,0.5)" strokeWidth="1" rx="1" />
          <text x="165" y="370" textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize="8" fontFamily="monospace">PRODUCT OWNER</text>

          <rect x="210" y="310" width="60" height="45" fill="#0a0a0a" stroke="rgba(74,222,128,0.3)" strokeWidth="1" />
          <rect x="225" y="323" width="8" height="18" fill="none" stroke="rgba(74,222,128,0.5)" strokeWidth="1" />
          <rect x="237" y="328" width="8" height="13" fill="none" stroke="rgba(74,222,128,0.5)" strokeWidth="1" />
          <rect x="249" y="320" width="8" height="21" fill="none" stroke="rgba(74,222,128,0.5)" strokeWidth="1" />
          <text x="240" y="370" textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize="8" fontFamily="monospace">MARKET ANALYST</text>
        </g>

        {/* === FIRE SQUAD === */}
        <g className={`transition-opacity duration-300 ${isFireActive ? 'opacity-100' : 'opacity-60'}`}>
          <text x="635" y="175" textAnchor="middle" fill={isFireActive ? '#f87171' : 'rgba(248,113,113,0.5)'} fontSize="10" fontWeight="700" fontFamily="system-ui" letterSpacing="0.15em">FIRE SQUAD</text>
          
          <rect x="595" y="195" width="80" height="65" fill="#0a0a0a" stroke={isFireActive ? '#f87171' : 'rgba(248,113,113,0.4)'} strokeWidth={isFireActive ? 2 : 1} />
          <g transform="translate(635, 222)">
            <path d="M 0 -14 Q 6 -8 4 -2 Q 8 -6 6 -12 Q 12 -4 8 6 Q 6 10 0 12 Q -6 10 -8 6 Q -12 -4 -6 -12 Q -8 -6 -4 -2 Q -6 -8 0 -14" fill="none" stroke={isFireActive ? '#f87171' : 'rgba(248,113,113,0.6)'} strokeWidth="1.5" />
          </g>
          <text x="635" y="275" textAnchor="middle" fill={isFireActive ? '#f87171' : 'rgba(248,113,113,0.7)'} fontSize="11" fontWeight="700" fontFamily="system-ui">LEAD</text>
          <text x="635" y="290" textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize="8" fontFamily="monospace">SKEPTIC</text>

          {/* Sub-agents */}
          <rect x="530" y="310" width="60" height="45" fill="#0a0a0a" stroke="rgba(248,113,113,0.3)" strokeWidth="1" />
          <text x="560" y="338" textAnchor="middle" fill="rgba(248,113,113,0.5)" fontSize="14" fontFamily="monospace">&lt;/&gt;</text>
          <text x="560" y="370" textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize="8" fontFamily="monospace">TECHNICAL LEAD</text>

          <rect x="605" y="310" width="60" height="45" fill="#0a0a0a" stroke="rgba(248,113,113,0.3)" strokeWidth="1" />
          <circle cx="635" cy="327" r="8" fill="none" stroke="rgba(248,113,113,0.5)" strokeWidth="1" />
          <circle cx="635" cy="325" r="3" fill="rgba(248,113,113,0.5)" />
          <text x="635" y="370" textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize="8" fontFamily="monospace">TARGET USER</text>

          <rect x="680" y="310" width="60" height="45" fill="#0a0a0a" stroke="rgba(248,113,113,0.3)" strokeWidth="1" />
          <path d="M 710 322 L 700 342 L 720 342 Z" fill="none" stroke="rgba(248,113,113,0.5)" strokeWidth="1.5" />
          <text x="710" y="335" textAnchor="middle" fill="rgba(248,113,113,0.5)" fontSize="10" fontWeight="bold">!</text>
          <text x="710" y="370" textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize="7" fontFamily="monospace">DEVIL'S ADVOCATE</text>
        </g>

        {/* === DELIBERATION / DEBATE ZONE === */}
        <g>
          <rect x="320" y="450" width="160" height="60" fill="#0a0a0a" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
          <text x="400" y="478" textAnchor="middle" fill="rgba(255,255,255,0.8)" fontSize="14" fontWeight="700" fontFamily="system-ui" fontStyle="italic">Deliberation</text>
          <text x="400" y="495" textAnchor="middle" fill="rgba(255,255,255,0.55)" fontSize="8" fontFamily="monospace" letterSpacing="0.1em">BULL VS BEAR DEBATE</text>
        </g>

        {/* === SYNTHESIS NODE === */}
        <g className={`transition-opacity duration-300 ${phase === 'synthesis' ? 'opacity-100' : 'opacity-60'}`}>
          <rect x="360" y="560" width="80" height="65" fill="#0a0a0a" stroke={phase === 'synthesis' ? '#fbbf24' : 'rgba(251,191,36,0.4)'} strokeWidth={phase === 'synthesis' ? 2 : 1} />
          <g transform="translate(400, 585)">
            <path d="M 0 -14 L 12 -8 L 12 4 Q 12 12 0 16 Q -12 12 -12 4 L -12 -8 Z" fill="none" stroke={phase === 'synthesis' ? '#fbbf24' : 'rgba(251,191,36,0.6)'} strokeWidth="1.5" />
            <path d="M -4 0 L -1 4 L 6 -4" fill="none" stroke={phase === 'synthesis' ? '#fbbf24' : 'rgba(251,191,36,0.6)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </g>
          <text x="400" y="645" textAnchor="middle" fill={phase === 'synthesis' ? '#fbbf24' : 'rgba(251,191,36,0.7)'} fontSize="13" fontWeight="700" fontFamily="system-ui" letterSpacing="0.1em">SYNTHESIS</text>
          <text x="400" y="662" textAnchor="middle" fill="rgba(255,255,255,0.55)" fontSize="8" fontFamily="monospace" letterSpacing="0.05em">MARKET FIT SCAN</text>
        </g>

        {/* Grid overlay */}
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect x="0" y="0" width="100%" height="100%" fill="url(#grid)" />
      </svg>
    </div>
  )
}
