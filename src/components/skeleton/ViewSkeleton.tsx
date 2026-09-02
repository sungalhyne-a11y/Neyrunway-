import React, { ReactNode } from 'react';
import { useTranslation } from '../../i18n';
import { Layers, ArrowRight } from 'lucide-react';

interface ViewSkeletonProps {
  title: string;
  subtitle: string;
  badgeText?: string;
  children?: ReactNode;
}

export const ViewSkeleton: React.FC<ViewSkeletonProps> = ({
  title,
  subtitle,
  badgeText = 'Prévu pour Étape 2/3/4',
  children,
}) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#1e293b]">
        <div>
          <div className="flex items-center gap-2 mb-1 font-mono">
            <span className="text-[10px] font-bold text-[#D4FF3D] uppercase tracking-[0.2em]">
              Neyrunway OS
            </span>
            <span className="text-[#8A8F98]">/</span>
            <span className="text-[10px] text-[#8A8F98] uppercase tracking-[0.2em]">
              {badgeText}
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-light text-[#F5F5F0] tracking-tight">
            {title}
          </h1>
          <p className="text-xs md:text-sm text-[#8A8F98] mt-1">
            {subtitle}
          </p>
        </div>

        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#161b27] border border-[#1e293b] text-xs text-[#B8BCC4]">
          <Layers className="w-3.5 h-3.5 text-[#D4FF3D]" />
          <span className="font-mono text-[11px]">Squelette d'architecture</span>
        </div>
      </div>

      {children}
    </div>
  );
};
