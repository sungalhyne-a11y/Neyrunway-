import React from 'react';
import { useTranslation } from '../../i18n';
import { useAuth } from '../../context/AuthContext';
import { Calendar, ArrowRight, TrendingUp, CheckCircle, AlertCircle } from 'lucide-react';

export const RunwayTimeline: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { t, formatCurrency, formatDate, formatDays, formatDaysShort, language } = useTranslation();
  const { computedRunway, userProfile } = useAuth();

  const nextIncomeDate = computedRunway?.nextIncomeDate;
  const nextIncomeAmount = computedRunway?.nextIncomeAmount ?? 0;
  const nextIncomeSource = computedRunway?.nextIncomeSource || t.views.dashboard.timelineDefaultIncomeSource;
  const daysUntilNextIncome = computedRunway?.daysUntilNextIncome ?? 18;
  const currentBalance = computedRunway?.currentBalance ?? userProfile?.initialBalance ?? 1250;
  const runwayDays = computedRunway?.runwayDays ?? 34;

  const today = new Date();
  const targetDate = nextIncomeDate ? new Date(nextIncomeDate) : new Date(today.getTime() + (daysUntilNextIncome * 24 * 60 * 60 * 1000));

  // Determine progress percentage (e.g. out of 30-day window)
  const isHealthyCoverage = runwayDays >= daysUntilNextIncome;

  return (
    <div 
      id="runway-timeline-card"
      className={`bg-[#161b27] border border-[#1e293b] rounded-3xl p-6 md:p-7 shadow-2xl relative overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#D4FF3D]/10 border border-[#D4FF3D]/20 flex items-center justify-center text-[#D4FF3D]">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm sm:text-base font-medium text-[#F5F5F0]">
              {t.views.dashboard.timelineTitle}
            </h4>
            <p className="text-[11px] text-[#8A8F98]">
              {isHealthyCoverage ? (
                <span className="text-[#D4FF3D] font-mono">
                  {t.views.dashboard.timelineHealthyCoverage.replace('{days}', formatDaysShort(runwayDays))}
                </span>
              ) : (
                <span className="text-[#FACC15] font-mono">
                  {t.views.dashboard.timelineRiskCoverage}
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="text-xs font-mono px-3 py-1 rounded-full bg-[#0B0E17] border border-[#1e293b] text-[#D4FF3D] font-bold">
            {formatDays(daysUntilNextIncome)} {language === 'fr' ? 'restants' : 'remaining'}
          </span>
        </div>
      </div>

      {/* Visual Timeline Track */}
      <div className="relative pt-1 pb-2">
        {/* Track Line - precisely positioned at vertical center of the 32px (w-8 h-8) nodes */}
        <div className="absolute top-[16px] left-6 right-6 h-1.5 -translate-y-1/2 bg-[#1e293b] rounded-full overflow-hidden z-0">
          <div 
            className="h-full bg-gradient-to-r from-[#D4FF3D] via-[#38BDF8] to-[#D4FF3D] opacity-80"
            style={{ width: '100%' }}
          />
        </div>

        {/* Milestone Nodes */}
        <div className="relative flex items-start justify-between z-10">
          {/* Milestone: Today */}
          <div className="flex flex-col items-start">
            <div className="w-8 h-8 rounded-full bg-[#D4FF3D] text-[#0B0E17] font-bold text-xs flex items-center justify-center shadow-[0_0_15px_rgba(212,255,61,0.5)] ring-4 ring-[#161b27]">
              {language === 'fr' ? 'J-0' : 'D-0'}
            </div>
            <div className="mt-3.5 space-y-1">
              <span className="text-[10px] font-mono text-[#D4FF3D] font-bold uppercase tracking-wider block">
                {t.views.dashboard.timelineToday}
              </span>
              <span className="text-xs font-mono text-[#F5F5F0] block">
                {formatDate(today)}
              </span>
              <span className="text-[11px] font-mono text-[#8A8F98] block">
                {formatCurrency(currentBalance)}
              </span>
            </div>
          </div>

          {/* Milestone: Mid-point / Rent Security Checkpoint */}
          <div className="hidden sm:flex flex-col items-center">
            <div className="w-8 h-8 flex items-center justify-center">
              <div className="w-5 h-5 rounded-full bg-[#161b27] border-2 border-[#38BDF8] text-[#38BDF8] text-[9px] flex items-center justify-center ring-4 ring-[#161b27]">
                •
              </div>
            </div>
            <div className="mt-3.5 text-center space-y-1">
              <span className="text-[10px] font-mono text-[#38BDF8] block">
                {t.views.dashboard.timelineMilestoneRent}
              </span>
              <span className="text-[11px] font-mono text-[#8A8F98] block">
                {t.views.dashboard.timelineChargesSecured}
              </span>
            </div>
          </div>

          {/* Milestone: Next Inflow */}
          <div className="flex flex-col items-end">
            <div className="w-8 h-8 rounded-full bg-[#0B0E17] border-2 border-[#D4FF3D] text-[#D4FF3D] font-bold text-xs flex items-center justify-center ring-4 ring-[#161b27] shadow-[0_0_12px_rgba(212,255,61,0.2)]">
              +{nextIncomeAmount > 0 ? formatCurrency(nextIncomeAmount) : '✓'}
            </div>
            <div className="mt-3.5 text-right space-y-1">
              <span className="text-[10px] font-mono text-[#D4FF3D] font-bold uppercase tracking-wider block">
                {nextIncomeSource}
              </span>
              <span className="text-xs font-mono text-[#F5F5F0] block">
                {formatDate(targetDate)}
              </span>
              <span className="text-[11px] font-mono text-[#8A8F98] block">
                +{formatCurrency(nextIncomeAmount || 450)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Footer */}
      <div className="mt-6 pt-4 border-t border-[#1e293b] flex flex-col sm:flex-row sm:items-center justify-between text-xs text-[#8A8F98] gap-2 font-mono">
        <div className="flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5 text-[#D4FF3D]" />
          <span>{t.views.dashboard.timelineInflowPulse} : <strong>+{formatCurrency(nextIncomeAmount || 450)}</strong></span>
        </div>
        <span className="text-[11px] text-[#8A8F98]">
          {t.views.dashboard.timelineRegionalFormat} : <strong>{userProfile?.region || 'FR'} ({userProfile?.currency || 'EUR'})</strong>
        </span>
      </div>
    </div>
  );
};
