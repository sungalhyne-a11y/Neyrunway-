import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { 
  calculateDecisionSimulation, 
  DecisionSimulationOutput, 
  ScenarioType 
} from '../lib/runwayEngine';

interface SimulationContextValue {
  simulatedAmount: number;
  setSimulatedAmount: (amount: number) => void;
  expenseTitle: string;
  setExpenseTitle: (title: string) => void;
  handlePresetClick: (amount: number, name: string) => void;
  resetSimulation: () => void;
  simulationResult: DecisionSimulationOutput;
  maxSliderValue: number;
  runSimulationForAmount: (amount: number, title?: string) => DecisionSimulationOutput;
}

const SimulationContext = createContext<SimulationContextValue | null>(null);

export const SimulationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { computedRunway, userProfile } = useAuth();

  const currentBalance = computedRunway?.currentBalance ?? userProfile?.initialBalance ?? 1250;
  const runwayDays = computedRunway?.runwayDays ?? 34;
  const safeToSpendToday = computedRunway?.safeToSpendToday ?? 24;
  const totalFixedExpenses = computedRunway?.totalFixedExpenses ?? 450;
  const daysUntilNextIncome = computedRunway?.daysUntilNextIncome ?? 18;
  const nextIncomeDate = computedRunway?.nextIncomeDate;
  const nextIncomeAmount = computedRunway?.nextIncomeAmount ?? 0;
  const nextIncomeSource = computedRunway?.nextIncomeSource;

  const [simulatedAmount, setSimulatedAmountState] = useState<number>(85);
  const [expenseTitle, setExpenseTitleState] = useState<string>('');

  const setSimulatedAmount = useCallback((amount: number) => {
    setSimulatedAmountState(Math.max(0, amount));
  }, []);

  const setExpenseTitle = useCallback((title: string) => {
    setExpenseTitleState(title);
  }, []);

  const handlePresetClick = useCallback((amount: number, name: string) => {
    setSimulatedAmountState(Math.max(0, amount));
    setExpenseTitleState(name);
  }, []);

  const resetSimulation = useCallback(() => {
    setSimulatedAmountState(85);
    setExpenseTitleState('');
  }, []);

  // Shared max slider value calculation
  const maxSliderValue = useMemo(() => {
    return Math.min(Math.max(500, Math.round(currentBalance * 0.8)), 1000);
  }, [currentBalance]);

  // Shared deterministic simulation result
  const simulationResult = useMemo(() => {
    return calculateDecisionSimulation({
      currentBalance,
      runwayDays,
      safeToSpendToday,
      totalFixedExpenses,
      daysUntilNextIncome,
      nextIncomeDate,
      nextIncomeAmount,
      nextIncomeSource,
      simulatedAmount,
      expenseTitle,
    });
  }, [
    currentBalance,
    runwayDays,
    safeToSpendToday,
    totalFixedExpenses,
    daysUntilNextIncome,
    nextIncomeDate,
    nextIncomeAmount,
    nextIncomeSource,
    simulatedAmount,
    expenseTitle,
  ]);

  const runSimulationForAmount = useCallback((amount: number, title?: string): DecisionSimulationOutput => {
    return calculateDecisionSimulation({
      currentBalance,
      runwayDays,
      safeToSpendToday,
      totalFixedExpenses,
      daysUntilNextIncome,
      nextIncomeDate,
      nextIncomeAmount,
      nextIncomeSource,
      simulatedAmount: amount,
      expenseTitle: title || '',
    });
  }, [
    currentBalance,
    runwayDays,
    safeToSpendToday,
    totalFixedExpenses,
    daysUntilNextIncome,
    nextIncomeDate,
    nextIncomeAmount,
    nextIncomeSource,
  ]);

  return (
    <SimulationContext.Provider
      value={{
        simulatedAmount,
        setSimulatedAmount,
        expenseTitle,
        setExpenseTitle,
        handlePresetClick,
        resetSimulation,
        simulationResult,
        maxSliderValue,
        runSimulationForAmount,
      }}
    >
      {children}
    </SimulationContext.Provider>
  );
};

export function useSimulation(): SimulationContextValue {
  const context = useContext(SimulationContext);
  if (!context) {
    throw new Error('useSimulation must be used within a SimulationProvider');
  }
  return context;
}
