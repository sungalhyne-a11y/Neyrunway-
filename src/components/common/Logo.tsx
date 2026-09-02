import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ size = 'md', showTagline = false }) => {
  const iconSizes = {
    sm: 'w-6 h-6 sm:w-7 sm:h-7',
    md: 'w-7 h-7 sm:w-8 sm:h-8',
    lg: 'w-9 h-9 sm:w-11 sm:h-11',
  };

  const textSizes = {
    sm: 'text-xs sm:text-sm',
    md: 'text-sm sm:text-xl',
    lg: 'text-lg sm:text-2xl',
  };

  return (
    <div className="flex items-center gap-2 sm:gap-3.5 select-none shrink-0">
      {/* Luxury Runway N Monogram */}
      <div 
        id="neyrunway-logo-mark"
        className={`relative shrink-0 ${iconSizes[size]} bg-[#D4FF3D] rounded-sm flex items-center justify-center overflow-hidden shadow-[0_0_15px_rgba(212,255,61,0.25)] group`}
      >
        <div className="w-full h-[2px] sm:h-[2.5px] bg-[#0B0E17] rotate-45 transform"></div>
      </div>

      <div className="flex flex-col">
        <span className={`font-semibold tracking-[0.12em] sm:tracking-[0.2em] uppercase ${textSizes[size]} text-[#F5F5F0]`}>
          Neyrunway
        </span>
        {showTagline && (
          <span className="text-[10px] text-[#8A8F98] tracking-[0.12em] sm:tracking-[0.2em] uppercase font-medium">
            AI Financial Runway OS
          </span>
        )}
      </div>
    </div>
  );
};
