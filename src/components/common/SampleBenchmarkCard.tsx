import React, { useState } from 'react';
import { useTranslation } from '../../i18n';
import { Sparkles, ArrowRight, ShieldCheck, Zap, Compass, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const SampleBenchmarkCard: React.FC = () => {
  const { t, formatCurrency, formatDays } = useTranslation();
  const [simulatedPurchase, setSimulatedPurchase] = useState<boolean>(false);

  return (
    <div id="sample-i18n-benchmark-card" className="w-full bg-[#161b27] border border-[#1e293b] rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
      {/* Background ambient runway line */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-[#D4FF3D]/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header with Step 1 badge */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-5 border-b border-[#1e293b]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#D4FF3D]/10 border border-[#D4FF3D]/30 flex items-center justify-center text-[#D4FF3D] shadow-[0_0_12px_rgba(212,255,61,0.2)]">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-semibold text-[#F5F5F0] text-sm md:text-base">
              {t.skeletons.sampleComponent.title}
            </h3>
            <p className="text-xs text-[#8A8F98]">
              {t.skeletons.sampleComponent.description}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#D4FF3D]/15 text-[#D4FF3D] border border-[#D4FF3D]/40 font-mono">
            <Zap className="w-3 h-3" />
            {t.skeletons.activePhase}
          </span>
        </div>
      </div>

      {/* Product Mental Model Ribbon (SEE → UNDERSTAND → FORECAST → DECIDE → ACT) */}
      <div className="mb-6">
        <div className="text-[10px] font-bold text-[#8A8F98] uppercase tracking-[0.2em] mb-3 flex items-center gap-1.5 font-mono">
          <Compass className="w-3.5 h-3.5 text-[#D4FF3D]" />
          <span>Product Mental Model (SEE → UNDERSTAND → FORECAST → DECIDE → ACT)</span>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { ...t.mentalModel.see, color: 'border-[#1e293b]' },
            { ...t.mentalModel.understand, color: 'border-[#1e293b]' },
            { ...t.mentalModel.forecast, color: 'border-[#1e293b]' },
            { ...t.mentalModel.decide, color: 'border-[#D4FF3D]/40 bg-[#D4FF3D]/5' },
            { ...t.mentalModel.act, color: 'border-[#1e293b]' },
          ].map((item, idx) => (
            <div 
              key={idx}
              className={`p-3.5 rounded-2xl bg-[#0B0E17] border ${item.color} flex flex-col justify-between`}
            >
              <div>
                <span className="text-[10px] font-bold text-[#D4FF3D] uppercase tracking-wider block mb-1 font-mono">
                  {item.step}
                </span>
                <span className="font-semibold text-xs text-[#F5F5F0] block mb-1">
                  {item.title}
                </span>
                <p className="text-[11px] text-[#8A8F98] leading-snug">
                  {item.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Philosophy of Tone & Non-Guilt Demonstration */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
        {/* Anti-patterns vs Ney Way */}
        <div className="p-4 sm:p-5 rounded-2xl bg-[#0B0E17] border border-[#1e293b]">
          <div className="text-[10px] font-semibold text-[#8A8F98] uppercase tracking-[0.2em] mb-3 flex items-center justify-between font-mono">
            <span>{t.skeletons.sampleComponent.exampleToneTitle}</span>
            <span className="text-[10px] text-[#D4FF3D] font-mono">{t.brand.philosophies.aiAdvises}</span>
          </div>
          
          <div className="space-y-2.5 text-xs">
            <div className="p-3 rounded-xl bg-[#F43F5E]/10 border border-[#F43F5E]/20 text-[#F43F5E] flex items-start gap-2.5">
              <span className="w-full break-words leading-relaxed text-xs">{t.skeletons.sampleComponent.exampleToneOld}</span>
            </div>
            <div className="p-3 rounded-xl bg-[#D4FF3D]/10 border border-[#D4FF3D]/30 text-[#F5F5F0] flex items-start gap-2.5">
              <span className="w-full break-words leading-relaxed text-xs">{t.skeletons.sampleComponent.exampleToneNew}</span>
            </div>
          </div>
        </div>

        {/* Live Simulation Card Preview */}
        <div className="p-4 sm:p-5 rounded-2xl bg-[#0B0E17] border border-[#1e293b] flex flex-col justify-between">
          <div>
            <div className="text-[10px] font-semibold text-[#8A8F98] uppercase tracking-[0.2em] mb-2 flex items-center justify-between font-mono">
              <span>{t.brand.copilotName} Decision Engine</span>
              <span className="text-[10px] text-[#38BDF8] flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                No Guilt Policy
              </span>
            </div>

            <p className="text-xs text-[#B8BCC4] mb-3 leading-relaxed break-words">
              {t.skeletons.sampleComponent.simulateDecision}
            </p>
          </div>

          <div className="mt-2">
            <button
              id="btn-toggle-simulation-preview"
              onClick={() => setSimulatedPurchase(!simulatedPurchase)}
              className="w-full py-2.5 px-3.5 rounded-xl bg-[#161b27] hover:bg-[#1e293b] border border-[#1e293b] hover:border-[#D4FF3D]/30 text-xs font-medium text-[#F5F5F0] flex items-center justify-between gap-2 transition-all cursor-pointer shadow-sm text-left"
            >
              <span className="break-words leading-snug flex-1">
                {simulatedPurchase ? t.skeletons.sampleComponent.btnReset : t.skeletons.sampleComponent.btnCalculate}
              </span>
              <RefreshCw className={`w-3.5 h-3.5 text-[#D4FF3D] shrink-0 ${simulatedPurchase ? 'rotate-180' : ''} transition-transform duration-300`} />
            </button>

            <AnimatePresence>
              {simulatedPurchase && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3 p-3.5 rounded-xl bg-[#161b27] border border-[#D4FF3D]/40 text-xs shadow-lg"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2 font-mono text-xs">
                    <span className="text-[#8A8F98]">Runway : <strong className="text-[#F5F5F0]">23 {t.skeletons.runwayDays}</strong></span>
                    <ArrowRight className="w-3.5 h-3.5 text-[#D4FF3D] shrink-0" />
                    <span className="text-[#D4FF3D]">{t.skeletons.sampleComponent.afterLabel} <strong className="text-[#D4FF3D]">18 {t.skeletons.runwayDays}</strong></span>
                  </div>
                  <p className="text-[#F5F5F0] italic text-[11px] leading-relaxed break-words">
                    {t.skeletons.sampleComponent.simulatedOutcome}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};
