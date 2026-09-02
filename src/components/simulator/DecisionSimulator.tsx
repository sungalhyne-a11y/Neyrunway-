import React, { useMemo } from 'react';
import { useTranslation } from '../../i18n';
import { useAuth } from '../../context/AuthContext';
import { useSimulation } from '../../context/SimulationContext';
import { ScenarioType } from '../../shared/runwayCalculator';
import { analytics } from '../../lib/analytics';
import { 
  Sparkles, 
  ArrowRight, 
  Sliders, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  XCircle,
  HelpCircle,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DecisionSimulatorProps {
  onConsultNey?: (amount: number, title?: string, simulatedDays?: number) => void;
  className?: string;
  compact?: boolean;
}

export type { ScenarioType };

export const DecisionSimulator: React.FC<DecisionSimulatorProps> = ({
  onConsultNey,
  className = '',
  compact = false,
}) => {
  const { t, formatCurrency, formatDays, formatDaysShort, language } = useTranslation();
  const { computedRunway, userProfile } = useAuth();
  const { 
    simulatedAmount, 
    setSimulatedAmount, 
    expenseTitle, 
    setExpenseTitle, 
    handlePresetClick, 
    simulationResult, 
    maxSliderValue 
  } = useSimulation();

  const currentBalance = computedRunway?.currentBalance ?? userProfile?.initialBalance ?? 1250;
  const runwayDays = computedRunway?.runwayDays ?? 34;
  const safeToSpendToday = computedRunway?.safeToSpendToday ?? 24;
  const nextIncomeDate = computedRunway?.nextIncomeDate;
  const nextIncomeAmount = computedRunway?.nextIncomeAmount ?? 0;

  const getScenarioDetails = (scenario: ScenarioType) => {
    switch (scenario) {
      case 'GO':
        return {
          badge: 'GO',
          label: t.views.chat.scenarios.go.label,
          desc: t.views.chat.scenarios.go.desc,
          color: 'text-[#D4FF3D]',
          bg: 'bg-[#D4FF3D]/10',
          border: 'border-[#D4FF3D]/30',
          icon: CheckCircle2,
        };
      case 'WAIT':
        return {
          badge: 'WAIT',
          label: t.views.chat.scenarios.wait.label,
          desc: nextIncomeDate 
            ? `${t.views.chat.scenarios.wait.desc} (+${formatCurrency(nextIncomeAmount)})`
            : t.views.chat.scenarios.wait.desc,
          color: 'text-[#FACC15]',
          bg: 'bg-[#FACC15]/10',
          border: 'border-[#FACC15]/30',
          icon: Clock,
        };
      case 'ADJUST':
        return {
          badge: 'ADJUST',
          label: t.views.chat.scenarios.adjust.label,
          desc: t.views.chat.scenarios.adjust.desc,
          color: 'text-[#38BDF8]',
          bg: 'bg-[#38BDF8]/10',
          border: 'border-[#38BDF8]/30',
          icon: AlertTriangle,
        };
      case 'NO':
        return {
          badge: 'NO',
          label: t.views.chat.scenarios.no.label,
          desc: t.views.chat.scenarios.no.desc,
          color: 'text-[#F43F5E]',
          bg: 'bg-[#F43F5E]/10',
          border: 'border-[#F43F5E]/30',
          icon: XCircle,
        };
    }
  };

  const scenarioInfo = getScenarioDetails(simulationResult.scenario);
  const ScenarioIcon = scenarioInfo.icon;

  const handleConsultNey = () => {
    analytics.track('scenario_simulated', {
      simulatedAmount,
      expenseTitle,
      projectedDays: simulationResult.projectedDays,
      scenario: simulationResult.scenario,
    });
    analytics.track('financial_decision_assisted', {
      amount: simulatedAmount,
      title: expenseTitle,
      scenario: simulationResult.scenario,
    });
    if (onConsultNey) {
      onConsultNey(simulatedAmount, expenseTitle, simulationResult.projectedDays);
    }
  };


  return (
    <div 
      id="decision-simulator-container"
      className={`bg-[#161b27] border border-[#1e293b] rounded-3xl p-5 sm:p-7 shadow-2xl relative overflow-hidden ${className}`}
    >
      {/* Decorative subtle ambient backdrop */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-[#D4FF3D]/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#D4FF3D]/10 border border-[#D4FF3D]/20 flex items-center justify-center text-[#D4FF3D]">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm sm:text-base font-medium text-[#F5F5F0]">
              {t.views.simulator.title}
            </h4>
            {!compact && (
              <p className="text-[11px] text-[#8A8F98]">
                {t.views.simulator.subtitle}
              </p>
            )}
          </div>
        </div>

        <span className="text-[10px] font-mono text-[#D4FF3D] px-2.5 py-1 rounded-full bg-[#D4FF3D]/10 border border-[#D4FF3D]/20 hidden sm:inline-block">
          {t.views.simulator.philosophyReminder}
        </span>
      </div>

      {/* Amount Controls */}
      <div className="space-y-4">
        {/* Input & Quick Display */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#0B0E17] border border-[#1e293b] p-3 sm:p-4 rounded-2xl">
          <div className="flex-1 flex items-center gap-3">
            <span className="text-xs text-[#8A8F98] font-mono whitespace-nowrap">
              {t.views.simulator.expenseLabel} :
            </span>
            <div className="flex items-baseline gap-1">
              <input
                id="input-simulated-amount"
                type="number"
                min="0"
                max={currentBalance}
                value={simulatedAmount || ''}
                onChange={(e) => setSimulatedAmount(Math.max(0, Number(e.target.value)))}
                className="w-24 sm:w-28 bg-[#161b27] border border-[#1e293b] rounded-xl px-2.5 py-1 text-lg font-mono text-[#D4FF3D] font-bold focus:outline-none focus:border-[#D4FF3D]"
                placeholder="0"
              />
              <span className="text-sm font-mono text-[#8A8F98]">
                {userProfile?.currency || 'EUR'}
              </span>
            </div>
          </div>

          <input
            id="input-simulated-title"
            type="text"
            value={expenseTitle}
            onChange={(e) => setExpenseTitle(e.target.value)}
            placeholder={t.views.simulator.expensePlaceholder}
            className="bg-[#161b27] border border-[#1e293b] rounded-xl px-3 py-1.5 text-xs text-[#F5F5F0] placeholder-[#8A8F98] focus:outline-none focus:border-[#D4FF3D] flex-1 sm:max-w-[220px]"
          />
        </div>

        {/* Amount Slider */}
        <div className="space-y-1.5 px-1">
          <div className="flex justify-between text-[11px] text-[#8A8F98] font-mono">
            <span>0</span>
            <span>{formatCurrency(simulatedAmount)}</span>
            <span>{formatCurrency(maxSliderValue)}</span>
          </div>
          <input
            id="slider-simulated-amount"
            type="range"
            min="0"
            max={maxSliderValue}
            step="5"
            value={simulatedAmount}
            onChange={(e) => setSimulatedAmount(Number(e.target.value))}
            className="w-full h-2 bg-[#1e293b] rounded-lg appearance-none cursor-pointer accent-[#D4FF3D]"
          />
        </div>

        {/* Quick Presets */}
        <div className="space-y-1.5 pt-1">
          <span className="text-[10px] uppercase font-mono text-[#8A8F98] tracking-wider">
            {t.views.simulator.presetsTitle}
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {t.views.simulator.presets.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handlePresetClick(preset.amount, preset.name)}
                className={`px-2.5 py-2 rounded-xl text-left border transition-all text-xs font-mono flex flex-col justify-between cursor-pointer ${
                  simulatedAmount === preset.amount
                    ? 'bg-[#D4FF3D]/15 border-[#D4FF3D] text-[#F5F5F0]'
                    : 'bg-[#0B0E17] border-[#1e293b] text-[#8A8F98] hover:border-[#8A8F98] hover:text-[#F5F5F0]'
                }`}
              >
                <span className="text-[10px] truncate">{preset.name}</span>
                <span className="text-[#D4FF3D] font-bold text-xs mt-0.5">
                  {formatCurrency(preset.amount)}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Dynamic Results Card */}
      <div className="mt-6 pt-5 border-t border-[#1e293b] space-y-4">
        {/* Scenario Diagnostic Badge */}
        <div className={`p-3.5 rounded-2xl border ${scenarioInfo.bg} ${scenarioInfo.border} flex items-start gap-3`}>
          <ScenarioIcon className={`w-5 h-5 ${scenarioInfo.color} shrink-0 mt-0.5`} />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded-md bg-[#0B0E17] ${scenarioInfo.color}`}>
                {scenarioInfo.badge}
              </span>
              <span className="text-xs font-medium text-[#F5F5F0]">
                {scenarioInfo.label}
              </span>
            </div>
            <p className="text-[11px] text-[#8A8F98] mt-1 leading-relaxed">
              {scenarioInfo.desc}
            </p>
          </div>
        </div>

        {/* Metrics Transition Comparison */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Runway Impact */}
          <div className="bg-[#0B0E17] border border-[#1e293b] rounded-2xl p-3.5 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-mono text-[#8A8F98] uppercase">
                {t.views.simulator.runwayImpactLabel}
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-sm font-mono text-[#8A8F98] line-through">
                  {formatDaysShort(runwayDays)}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-[#D4FF3D]" />
                <span className="text-lg font-bold font-mono text-[#F5F5F0]">
                  {formatDaysShort(simulationResult.projectedDays)}
                </span>
              </div>
            </div>
            <span className={`text-xs font-mono font-bold px-2 py-1 rounded-lg ${
              simulationResult.daysDifference <= 0 ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'
            }`}>
              {simulationResult.daysDifference > 0 ? `+${simulationResult.daysDifference}` : simulationResult.daysDifference}{language === 'fr' ? 'j' : 'd'}
            </span>
          </div>

          {/* Safe to Spend Impact */}
          <div className="bg-[#0B0E17] border border-[#1e293b] rounded-2xl p-3.5 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-mono text-[#8A8F98] uppercase">
                {t.views.simulator.safeDailyImpactLabel}
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-xs font-mono text-[#8A8F98] line-through">
                  {formatCurrency(safeToSpendToday)}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-[#D4FF3D]" />
                <span className="text-sm font-bold font-mono text-[#D4FF3D]">
                  {formatCurrency(simulationResult.postSafeToSpend)}
                </span>
              </div>
            </div>
            <span className="text-[10px] font-mono text-[#8A8F98]">
              {t.views.simulator.perDayUnit}
            </span>
          </div>
        </div>

        {/* Interactive CTA to ask Ney */}
        {onConsultNey && (
          <button
            id="btn-simulator-ask-ney"
            type="button"
            onClick={handleConsultNey}
            className="w-full py-3 px-4 rounded-2xl bg-[#D4FF3D] hover:bg-[#C2F028] text-[#0B0E17] font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(212,255,61,0.2)] cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>{t.views.simulator.askNeyCta}</span>
          </button>
        )}
      </div>
    </div>
  );
};
