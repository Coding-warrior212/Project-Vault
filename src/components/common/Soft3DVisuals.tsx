import React from 'react';

// ==========================================
// 1. Vault 3D Logo / Brand Insignia
// ==========================================
interface Vault3DLogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const Vault3DLogo: React.FC<Vault3DLogoProps> = ({ size = 'md', className = '' }) => {
  const dimensions = size === 'sm' ? 'w-7 h-7' : size === 'lg' ? 'w-12 h-12' : 'w-9 h-9';

  return (
    <div className={`relative ${dimensions} shrink-0 ${className}`}>
      <svg
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full filter drop-shadow-[0_4px_8px_rgba(37,36,95,0.25)] dark:drop-shadow-[0_4px_12px_rgba(85,199,194,0.3)] transition-transform hover:scale-105"
      >
        <defs>
          {/* Outer Bevel Gradient */}
          <linearGradient id="vaultOuter" x1="6" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse">
            <stop stopColor="#F36B3F" />
            <stop offset="0.5" stopColor="#E0572C" />
            <stop offset="1" stopColor="#55C7C2" />
          </linearGradient>

          {/* Core Body Gradient */}
          <linearGradient id="vaultBody" x1="8" y1="8" x2="40" y2="40" gradientUnits="userSpaceOnUse">
            <stop stopColor="#2F2D73" />
            <stop offset="0.5" stopColor="#25245F" />
            <stop offset="1" stopColor="#171640" />
          </linearGradient>

          {/* Metallic / Clay Rim */}
          <linearGradient id="vaultHighlight" x1="10" y1="8" x2="38" y2="14" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FFFFFF" stopOpacity="0.45" />
            <stop offset="1" stopColor="#FFFFFF" stopOpacity="0.05" />
          </linearGradient>

          {/* Internal Lock Hub */}
          <radialGradient id="vaultHub" cx="24" cy="24" r="10" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FFF4E3" />
            <stop offset="0.7" stopColor="#E5B25D" />
            <stop offset="1" stopColor="#C49138" />
          </radialGradient>

          {/* Turquoise Accent Light */}
          <radialGradient id="turquoiseGlow" cx="24" cy="24" r="6" gradientUnits="userSpaceOnUse">
            <stop stopColor="#55C7C2" />
            <stop offset="1" stopColor="#2A8B87" />
          </radialGradient>
        </defs>

        {/* Outer Clay Rounded Square */}
        <rect x="4" y="4" width="40" height="40" rx="11" fill="url(#vaultOuter)" />
        <rect x="4.5" y="4.5" width="39" height="39" rx="10.5" stroke="rgba(255,255,255,0.35)" strokeWidth="1" />

        {/* Inner Chamber Facet */}
        <rect x="7" y="7" width="34" height="34" rx="9" fill="url(#vaultBody)" />
        
        {/* Top Rim Specular Soft 3D Highlight */}
        <path
          d="M 12 8 C 9 8 8 9 8 12 L 8 16 C 12 12 20 10 36 10 L 40 10 C 40 9 39 8 36 8 Z"
          fill="url(#vaultHighlight)"
        />

        {/* Diamond Lock Mechanism - Rotating Geometric Axis */}
        <g transform="rotate(45 24 24)">
          {/* Dimensional Plate */}
          <rect
            x="14"
            y="14"
            width="20"
            height="20"
            rx="4"
            fill="#1B1A48"
            stroke="#55C7C2"
            strokeWidth="1.75"
          />
          {/* Subtle Inset Shadow */}
          <rect x="15" y="15" width="18" height="18" rx="3" fill="#25245F" />
        </g>

        {/* Central Golden Core / Provenance Node */}
        <circle cx="24" cy="24" r="5.5" fill="url(#vaultHub)" />
        <circle cx="24" cy="24" r="2.5" fill="url(#turquoiseGlow)" />
        <circle cx="23" cy="23" r="1" fill="#FFFFFF" fillOpacity="0.8" />

        {/* Corner Micro-Bolts (Tactile Details) */}
        <circle cx="11" cy="11" r="1.25" fill="#FFF4E3" fillOpacity="0.4" />
        <circle cx="37" cy="11" r="1.25" fill="#FFF4E3" fillOpacity="0.4" />
        <circle cx="11" cy="37" r="1.25" fill="#FFF4E3" fillOpacity="0.4" />
        <circle cx="37" cy="37" r="1.25" fill="#FFF4E3" fillOpacity="0.4" />
      </svg>
    </div>
  );
};

// ==========================================
// 2. Knowledge Network 3D Hero Visual
// ==========================================
interface KnowledgeNetwork3DProps {
  className?: string;
}

export const KnowledgeNetwork3D: React.FC<KnowledgeNetwork3DProps> = ({ className = '' }) => {
  return (
    <div className={`relative w-full max-w-[340px] h-[160px] select-none ${className}`}>
      <svg
        viewBox="0 0 340 160"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full overflow-visible"
      >
        <defs>
          <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          <linearGradient id="netNode1" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
            <stop stopColor="#F36B3F" />
            <stop offset="1" stopColor="#D94E22" />
          </linearGradient>

          <linearGradient id="netNode2" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
            <stop stopColor="#55C7C2" />
            <stop offset="1" stopColor="#258D89" />
          </linearGradient>

          <linearGradient id="netNodeCore" x1="0" y1="0" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FFF4E3" />
            <stop offset="0.6" stopColor="#E5B25D" />
            <stop offset="1" stopColor="#B3822B" />
          </linearGradient>

          <linearGradient id="linkGradient1" x1="60" y1="80" x2="170" y2="60" gradientUnits="userSpaceOnUse">
            <stop stopColor="#F36B3F" stopOpacity="0.8" />
            <stop offset="1" stopColor="#55C7C2" stopOpacity="0.8" />
          </linearGradient>

          <linearGradient id="linkGradient2" x1="170" y1="60" x2="280" y2="85" gradientUnits="userSpaceOnUse">
            <stop stopColor="#55C7C2" stopOpacity="0.8" />
            <stop offset="1" stopColor="#FFF4E3" stopOpacity="0.9" />
          </linearGradient>

          <radialGradient id="ambientPlate" cx="170" cy="80" r="110" gradientUnits="userSpaceOnUse">
            <stop stopColor="#55C7C2" stopOpacity="0.15" />
            <stop offset="1" stopColor="#25245F" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Ambient Backing Plate */}
        <ellipse cx="170" cy="85" rx="130" ry="55" fill="url(#ambientPlate)" filter="url(#softGlow)" />

        {/* Isometric Grid Floor Accent */}
        <g stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="3 3">
          <line x1="50" y1="120" x2="290" y2="120" />
          <line x1="70" y1="100" x2="270" y2="100" />
          <line x1="100" y1="50" x2="130" y2="130" />
          <line x1="210" y1="50" x2="240" y2="130" />
        </g>

        {/* Connecting Ribbons (Evidence Links) */}
        <path
          d="M 60 75 Q 110 40 160 55"
          stroke="url(#linkGradient1)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="4 3"
        />
        <path
          d="M 185 62 Q 225 105 270 85"
          stroke="url(#linkGradient2)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M 75 110 Q 140 135 170 85"
          stroke="rgba(85,199,194,0.4)"
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* NODE 1: Ingested Source (Left) */}
        <g transform="translate(40, 52)">
          {/* Shadow */}
          <ellipse cx="18" cy="40" rx="16" ry="6" fill="rgba(0,0,0,0.3)" />
          {/* Rounded Clay Tile */}
          <rect x="2" y="4" width="32" height="32" rx="7" fill="url(#netNode1)" />
          {/* Specular highlight */}
          <rect x="3" y="5" width="30" height="14" rx="6" fill="rgba(255,255,255,0.3)" />
          {/* Icon Lines */}
          <line x1="9" y1="14" x2="25" y2="14" stroke="#FFF4E3" strokeWidth="2" strokeLinecap="round" />
          <line x1="9" y1="20" x2="21" y2="20" stroke="#FFF4E3" strokeWidth="2" strokeLinecap="round" />
          <line x1="9" y1="26" x2="16" y2="26" stroke="#FFF4E3" strokeWidth="2" strokeLinecap="round" />
          {/* Tag Pill */}
          <text x="18" y="47" textAnchor="middle" fill="#FFF4E3" fontSize="8" fontFamily="monospace" fontWeight="bold">
            SOURCE
          </text>
        </g>

        {/* NODE 2: Reconstructed Core (Center - Dominant) */}
        <g transform="translate(142, 28)">
          {/* Shadow */}
          <ellipse cx="28" cy="66" rx="26" ry="9" fill="rgba(0,0,0,0.35)" />
          {/* Hexagonal / Rounded Core Cylinder */}
          <rect x="4" y="6" width="48" height="48" rx="14" fill="url(#netNodeCore)" />
          {/* Highlight ring */}
          <rect x="5.5" y="7.5" width="45" height="45" rx="12.5" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" />
          <ellipse cx="28" cy="18" rx="18" ry="7" fill="rgba(255,255,255,0.45)" />

          {/* Central Grounding Invariant Key */}
          <circle cx="28" cy="30" r="11" fill="#25245F" />
          <path
            d="M 24 30 L 27 33 L 33 27"
            stroke="#55C7C2"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <text x="28" y="65" textAnchor="middle" fill="#FFF4E3" fontSize="8" fontFamily="monospace" fontWeight="bold">
            VERIFIED
          </text>
        </g>

        {/* NODE 3: Handover Deliverable (Right) */}
        <g transform="translate(250, 60)">
          {/* Shadow */}
          <ellipse cx="22" cy="38" rx="18" ry="6" fill="rgba(0,0,0,0.3)" />
          {/* Rounded Clay Folder */}
          <rect x="2" y="4" width="38" height="28" rx="6" fill="url(#netNode2)" />
          <rect x="3" y="5" width="36" height="12" rx="5" fill="rgba(255,255,255,0.3)" />
          {/* Wax seal */}
          <circle cx="21" cy="18" r="6" fill="#F36B3F" />
          <circle cx="21" cy="18" r="3.5" fill="#FFF4E3" />
          <text x="21" y="44" textAnchor="middle" fill="#55C7C2" fontSize="8" fontFamily="monospace" fontWeight="bold">
            HANDOVER
          </text>
        </g>

        {/* Floating Satellite Particles (Dimensional Depth) */}
        <circle cx="110" cy="98" r="4" fill="#55C7C2" filter="url(#softGlow)" />
        <circle cx="230" cy="45" r="3.5" fill="#F36B3F" filter="url(#softGlow)" />
        <circle cx="130" cy="32" r="2.5" fill="#FFF4E3" />
        <circle cx="215" cy="120" r="3" fill="#E5B25D" />
      </svg>
    </div>
  );
};

// ==========================================
// 3. Workflow Milestone 3D Badges (Stages 1 to 5)
// ==========================================
interface WorkflowMilestone3DProps {
  step: number;
  status: 'completed' | 'in_progress' | 'awaiting' | 'planned';
  size?: 'sm' | 'md';
}

export const WorkflowMilestone3D: React.FC<WorkflowMilestone3DProps> = ({
  step,
  status,
  size = 'md',
}) => {
  const isCompleted = status === 'completed';
  const isInProgress = status === 'in_progress';
  const boxDim = size === 'sm' ? 'w-7 h-7' : 'w-9 h-9';

  const getGradient = () => {
    if (isCompleted) {
      return {
        outer: '#45B3AE',
        inner: '#55C7C2',
        accent: '#175A57',
        highlight: '#FFFFFF',
      };
    }
    if (isInProgress) {
      return {
        outer: '#D94E22',
        inner: '#F36B3F',
        accent: '#8E2809',
        highlight: '#FFE4DB',
      };
    }
    return {
      outer: '#38367A',
      inner: '#25245F',
      accent: '#191845',
      highlight: '#5654A8',
    };
  };

  const colors = getGradient();

  return (
    <div className={`relative ${boxDim} shrink-0 select-none`}>
      <svg viewBox="0 0 36 36" fill="none" className="w-full h-full drop-shadow-sm">
        {/* Soft Ambient Shadow */}
        <ellipse cx="18" cy="33" rx="12" ry="3" fill="rgba(0,0,0,0.2)" />

        {/* Base Cylinder Layer */}
        <rect x="4" y="5" width="28" height="26" rx="8" fill={colors.outer} />

        {/* Top Clay Surface */}
        <rect x="4" y="3" width="28" height="26" rx="8" fill={colors.inner} />

        {/* Specular Highlight Rim */}
        <path
          d="M 9 5 C 7 5 6 6 6 8 L 6 12 C 9 9 15 8 27 8 L 30 8 C 30 6 29 5 27 5 Z"
          fill={colors.highlight}
          fillOpacity="0.45"
        />

        {/* Step Glyphs based on Step Number */}
        {step === 1 && (
          // Connect: Two interlocking plugs/nodes
          <g stroke="#FFFFFF" strokeWidth="1.75" strokeLinecap="round">
            <rect x="11" y="11" width="14" height="10" rx="3" fill="rgba(0,0,0,0.15)" />
            <line x1="8" y1="16" x2="11" y2="16" />
            <line x1="25" y1="16" x2="28" y2="16" />
          </g>
        )}

        {step === 2 && (
          // Reconstruct: Isometric Synthesis Cube
          <g fill="#FFFFFF" fillOpacity="0.9">
            <path d="M 18 10 L 26 14 L 18 18 L 10 14 Z" />
            <path d="M 10 16 L 18 20 L 18 26 L 10 22 Z" fillOpacity="0.75" />
            <path d="M 26 16 L 18 20 L 18 26 L 26 22 Z" fillOpacity="0.6" />
          </g>
        )}

        {step === 3 && (
          // Verify: Grounded Shield
          <g>
            <path
              d="M 18 10 L 25 13 C 25 20 20 23 18 25 C 16 23 11 20 11 13 Z"
              fill="rgba(0,0,0,0.18)"
              stroke="#FFFFFF"
              strokeWidth="1.5"
            />
            <path
              d="M 15 17 L 17.5 19.5 L 21.5 15"
              stroke="#FFFFFF"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        )}

        {step === 4 && (
          // Review: Balance Comparator
          <g stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round">
            <line x1="18" y1="11" x2="18" y2="24" />
            <line x1="11" y1="14" x2="25" y2="14" />
            <circle cx="11" cy="18" r="2.5" fill="rgba(255,255,255,0.4)" />
            <circle cx="25" cy="18" r="2.5" fill="rgba(255,255,255,0.4)" />
            <line x1="15" y1="24" x2="21" y2="24" />
          </g>
        )}

        {step === 5 && (
          // Handover: Architectural Seal & Ribbon
          <g>
            <rect x="11" y="11" width="14" height="14" rx="3" fill="rgba(255,255,255,0.2)" stroke="#FFFFFF" strokeWidth="1.5" />
            <circle cx="18" cy="18" r="3.5" fill="#FFF4E3" />
            <circle cx="18" cy="18" r="1.5" fill="#F36B3F" />
          </g>
        )}
      </svg>
    </div>
  );
};

// ==========================================
// 4. Source Type 3D Miniature Glyphs
// ==========================================
interface SourceType3DGlyphProps {
  type: 'pdf' | 'markdown' | 'github' | 'text';
  size?: 'sm' | 'md';
}

export const SourceType3DGlyph: React.FC<SourceType3DGlyphProps> = ({ type, size = 'md' }) => {
  const dim = size === 'sm' ? 'w-5 h-5' : 'w-7 h-7';

  const configs = {
    pdf: {
      colorBg: '#FF6B55',
      colorBase: '#D84934',
      label: 'PDF',
      highlight: '#FFA091',
    },
    markdown: {
      colorBg: '#4FA5E2',
      colorBase: '#2A7BB3',
      label: 'MD',
      highlight: '#85C3EE',
    },
    github: {
      colorBg: '#7A64D8',
      colorBase: '#5642AA',
      label: 'GIT',
      highlight: '#A999EE',
    },
    text: {
      colorBg: '#EAA945',
      colorBase: '#C28220',
      label: 'TXT',
      highlight: '#F3C57C',
    },
  }[type];

  return (
    <div className={`relative ${dim} shrink-0 select-none`}>
      <svg viewBox="0 0 28 28" fill="none" className="w-full h-full drop-shadow-xs">
        {/* Soft 3D base bevel */}
        <rect x="2" y="4" width="24" height="22" rx="6" fill={configs.colorBase} />
        {/* Top tactile clay tile */}
        <rect x="2" y="2" width="24" height="22" rx="6" fill={configs.colorBg} />
        {/* Specular rim */}
        <path d="M 6 4 C 4 4 4 5 4 7 L 4 10 C 6 8 10 6 22 6 L 24 6 C 24 5 23 4 22 4 Z" fill="#FFFFFF" fillOpacity="0.45" />
        
        {/* Crisp Monospace Label */}
        <text
          x="14"
          y="16"
          textAnchor="middle"
          fill="#FFFFFF"
          fontSize="8"
          fontFamily="monospace"
          fontWeight="800"
          letterSpacing="-0.5px"
        >
          {configs.label}
        </text>
      </svg>
    </div>
  );
};

// ==========================================
// 5. Sealed Handover Dossier 3D Emblem
// ==========================================
export const HandoverDossier3D: React.FC<{ size?: 'sm' | 'md' | 'lg'; className?: string }> = ({
  size = 'md',
  className = '',
}) => {
  const sizeMap = {
    sm: 'w-12 h-12',
    md: 'w-16 h-16',
    lg: 'w-24 h-24',
  };

  return (
    <div className={`relative ${sizeMap[size]} shrink-0 ${className}`}>
      <svg viewBox="0 0 64 64" fill="none" className="w-full h-full drop-shadow-lg">
        <defs>
          <linearGradient id="dossierCover" x1="8" y1="12" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop stopColor="#2E2C73" />
            <stop offset="1" stopColor="#1B1A48" />
          </linearGradient>
          <linearGradient id="sealGold" x1="26" y1="26" x2="38" y2="38" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FFF4E3" />
            <stop offset="0.6" stopColor="#E5B25D" />
            <stop offset="1" stopColor="#B3822B" />
          </linearGradient>
        </defs>

        {/* Ambient Shadow */}
        <ellipse cx="32" cy="58" rx="24" ry="5" fill="rgba(0,0,0,0.3)" />

        {/* Outer Dossier Folder with neo-brutalist offset */}
        <rect x="10" y="14" width="44" height="42" rx="7" fill="#14133B" />
        <rect x="8" y="12" width="44" height="42" rx="7" fill="url(#dossierCover)" stroke="#55C7C2" strokeWidth="1.5" />

        {/* Top Document Tab */}
        <path d="M 12 12 L 24 12 L 28 17 L 48 17 L 48 20 L 12 20 Z" fill="#55C7C2" fillOpacity="0.3" />

        {/* Architectural Seal Ribbon */}
        <path d="M 28 12 L 28 32 L 32 29 L 36 32 L 36 12 Z" fill="#F36B3F" />

        {/* Embossed Golden Cryptographic Seal */}
        <circle cx="32" cy="36" r="10" fill="url(#sealGold)" stroke="#25245F" strokeWidth="1" />
        <circle cx="32" cy="36" r="7" fill="#25245F" />
        <path d="M 29 36 L 31 38 L 35 33" stroke="#55C7C2" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />

        {/* Binding Stitches */}
        <circle cx="13" cy="24" r="1" fill="#FFF4E3" fillOpacity="0.4" />
        <circle cx="13" cy="34" r="1" fill="#FFF4E3" fillOpacity="0.4" />
        <circle cx="13" cy="44" r="1" fill="#FFF4E3" fillOpacity="0.4" />
      </svg>
    </div>
  );
};

// ==========================================
// 6. Empty State 3D Vault Illustration
// ==========================================
export const EmptyVault3D: React.FC<{ message?: string; className?: string }> = ({
  message = 'No records in this sector',
  className = '',
}) => {
  return (
    <div className={`flex flex-col items-center justify-center p-8 space-y-3 ${className}`}>
      <div className="relative w-24 h-24">
        <svg viewBox="0 0 96 96" fill="none" className="w-full h-full drop-shadow-md">
          <defs>
            <radialGradient id="emptyPlatform" cx="48" cy="74" r="38" gradientUnits="userSpaceOnUse">
              <stop stopColor="#55C7C2" stopOpacity="0.25" />
              <stop offset="1" stopColor="#25245F" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="cubeFaceTop" x1="28" y1="20" x2="68" y2="40" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FFF4E3" stopOpacity="0.9" />
              <stop offset="1" stopColor="#E2D6C0" />
            </linearGradient>
            <linearGradient id="cubeFaceLeft" x1="28" y1="40" x2="48" y2="70" gradientUnits="userSpaceOnUse">
              <stop stopColor="#2E2C73" />
              <stop offset="1" stopColor="#1B1A48" />
            </linearGradient>
            <linearGradient id="cubeFaceRight" x1="48" y1="40" x2="68" y2="70" gradientUnits="userSpaceOnUse">
              <stop stopColor="#3E3C8A" />
              <stop offset="1" stopColor="#25245F" />
            </linearGradient>
          </defs>

          {/* Isometric Ground Pedestal */}
          <ellipse cx="48" cy="76" rx="38" ry="14" fill="url(#emptyPlatform)" />

          {/* Open Vault Box / Repository */}
          <g transform="translate(0, 4)">
            {/* Top Opening (Empty Chamber) */}
            <polygon points="48,22 74,36 48,50 22,36" fill="#14133B" stroke="#55C7C2" strokeWidth="1.5" />
            
            {/* Left Outer Wall */}
            <polygon points="22,36 48,50 48,76 22,62" fill="url(#cubeFaceLeft)" stroke="#25245F" strokeWidth="1" />
            
            {/* Right Outer Wall */}
            <polygon points="48,50 74,36 74,62 48,76" fill="url(#cubeFaceRight)" stroke="#25245F" strokeWidth="1" />
            
            {/* Internal Inset Core */}
            <polygon points="48,26 66,36 48,46 30,36" fill="#1C1A4A" />

            {/* Floating Soft 3D Key Shard */}
            <g transform="translate(0, -6)">
              <polygon points="48,16 54,20 48,24 42,20" fill="#F36B3F" />
              <polygon points="42,20 48,24 48,32 42,28" fill="#D94E22" />
              <polygon points="48,24 54,20 54,28 48,32" fill="#FF835A" />
            </g>
          </g>
        </svg>
      </div>

      <div className="text-xs font-bold text-neutral-800 dark:text-[#FFF4E3]">
        {message}
      </div>
    </div>
  );
};
