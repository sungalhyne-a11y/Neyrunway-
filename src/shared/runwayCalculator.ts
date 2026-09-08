export interface TransactionInput {
  amount: number | string;
  type: string;
  isRecurring?: boolean;
  status?: string;
}

export interface IncomeEventInput {
  amount: number | string;
  expectedDate?: string;
  source?: string;
  type?: string;
  status?: string;
}

export interface RunwayEngineInput {
  currentBalance: number;
  transactions: TransactionInput[];
  incomeEvents: IncomeEventInput[];
  referenceDate?: Date;
}

export interface RunwayEngineOutput {
  runwayDays: number;
  safeToSpendToday: number;
  projectedBurnPerDay: number;
  currentBalance: number;
  daysUntilNextIncome: number;
  nextIncomeAmount: number;
  nextIncomeDate?: string;
  nextIncomeSource?: string;
  totalFixedExpenses: number;
}

/**
 * Shared pure calculation engine for student financial runway
 * Used identically by React client (optimistic calculation) and Firebase Cloud Functions (canonical server calculation)
 */
export function calculateRunway(input: RunwayEngineInput): RunwayEngineOutput {
  const now = input.referenceDate || new Date();
  const rawBaseBalance = Math.max(0, Number(input.currentBalance) || 0);

  // 1. Calculate Monthly Fixed/Recurring Commitments
  const fixedTransactions = (input.transactions || []).filter(
    (t) => t.type === 'fixed' || t.isRecurring || t.status === 'recurring_active'
  );
  const totalFixedExpenses = fixedTransactions.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
  const dailyFixedBurn = totalFixedExpenses > 0 ? totalFixedExpenses / 30 : 0;

  // 2. Identify Variable Expense Deductions from liquid cash
  const variableExpenses = (input.transactions || []).filter(
    (t) => (t.type === 'variable' || !t.type) && !t.isRecurring && t.status !== 'recurring_active'
  );
  const totalVariableSpent = variableExpenses.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);

  // Available liquid balance after variable spending
  const currentBalance = Math.max(0, rawBaseBalance - totalVariableSpent);

  // 3. Identify Next Known Income Event (Grants, Part-time job, Family, etc.)
  const validUpcomingIncomes = (input.incomeEvents || [])
    .filter((inc) => {
      if (!inc.expectedDate) return false;
      const incDate = new Date(inc.expectedDate);
      return !isNaN(incDate.getTime());
    })
    .sort((a, b) => new Date(a.expectedDate!).getTime() - new Date(b.expectedDate!).getTime());

  // Filter for next upcoming income on or after today
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const nextIncome = validUpcomingIncomes.find((inc) => {
    const incTime = new Date(inc.expectedDate!).getTime();
    return incTime >= todayStart;
  });

  let daysUntilNextIncome = 30;
  let nextIncomeAmount = 0;
  let nextIncomeDate: string | undefined = undefined;
  let nextIncomeSource: string | undefined = undefined;

  if (nextIncome && nextIncome.expectedDate) {
    const incDate = new Date(nextIncome.expectedDate);
    const diffMs = incDate.getTime() - todayStart;
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    daysUntilNextIncome = Math.max(1, diffDays);
    nextIncomeAmount = Number(nextIncome.amount) || 0;
    nextIncomeDate = nextIncome.expectedDate;
    nextIncomeSource = nextIncome.source;
  }

  // 4. Safe to Spend Today calculation
  // Logic: Current liquid balance minus fixed commitments projected until next income, divided by days remaining
  const fixedBurnUntilNextIncome = dailyFixedBurn * daysUntilNextIncome;
  const discretionaryPool = currentBalance - fixedBurnUntilNextIncome;
  const safeToSpendToday = Math.max(0, Math.round((discretionaryPool / daysUntilNextIncome) * 10) / 10);

  // 5. Day-by-Day Cash Flow Simulation (up to 365 days horizon)
  let simBalance = currentBalance;
  let simulatedRunwayDays = 0;
  const assumedVariableBurn = safeToSpendToday > 0 ? safeToSpendToday : (totalFixedExpenses > 0 ? 12 : 20);
  const baselineDailyBurn = dailyFixedBurn + assumedVariableBurn;

  // Build an income map by date for simulation
  const incomeByDateStr: Record<string, number> = {};
  (input.incomeEvents || []).forEach((inc) => {
    if (inc.expectedDate) {
      incomeByDateStr[inc.expectedDate] = (incomeByDateStr[inc.expectedDate] || 0) + (Number(inc.amount) || 0);
    }
  });

  if (simBalance <= 0) {
    simulatedRunwayDays = 0;
  } else {
    for (let day = 1; day <= 365; day++) {
      const simDate = new Date(now);
      simDate.setDate(simDate.getDate() + day);
      const dateKey = simDate.toISOString().split('T')[0];

      // Add scheduled income if any on this day
      if (incomeByDateStr[dateKey]) {
        simBalance += incomeByDateStr[dateKey];
      }

      // Deduct day's fixed and daily discretionary spend
      simBalance -= baselineDailyBurn;

      if (simBalance <= 0) {
        simulatedRunwayDays = day;
        break;
      }
      simulatedRunwayDays = day;
    }
  }

  const finalRunwayDays = Math.max(0, simulatedRunwayDays);
  const projectedBurnPerDay = Math.round(baselineDailyBurn * 10) / 10;

  return {
    runwayDays: finalRunwayDays,
    safeToSpendToday: safeToSpendToday,
    projectedBurnPerDay: projectedBurnPerDay,
    currentBalance: currentBalance,
    daysUntilNextIncome: daysUntilNextIncome,
    nextIncomeAmount: nextIncomeAmount,
    nextIncomeDate: nextIncomeDate,
    nextIncomeSource: nextIncomeSource,
    totalFixedExpenses: totalFixedExpenses,
  };
}

export type ScenarioType = 'GO' | 'WAIT' | 'ADJUST' | 'NO';

export interface DecisionSimulationInput {
  currentBalance: number;
  runwayDays?: number;
  safeToSpendToday?: number;
  totalFixedExpenses?: number;
  daysUntilNextIncome?: number;
  nextIncomeDate?: string;
  nextIncomeAmount?: number;
  nextIncomeSource?: string;
  simulatedAmount: number;
  expenseTitle?: string;
}

export interface DecisionSimulationOutput {
  simulatedAmount: number;
  expenseTitle: string;
  postBalance: number;
  projectedDays: number;
  postSafeToSpend: number;
  scenario: ScenarioType;
  daysDifference: number;
  totalDailyBurn: number;
}

/**
 * Pure deterministic simulation engine for student financial decision analysis.
 * Shared across Dashboard, Chat, and server APIs to ensure 100% mathematical consistency without divergence.
 */
export function calculateDecisionSimulation(input: DecisionSimulationInput): DecisionSimulationOutput {
  const currentBalance = Math.max(0, Number(input.currentBalance) || 0);
  const runwayDays = Math.max(0, Number(input.runwayDays) || 34);
  const safeToSpendToday = Math.max(0, Number(input.safeToSpendToday) || 24);
  const totalFixedExpenses = Math.max(0, Number(input.totalFixedExpenses) || 450);
  const daysUntilNextIncome = Number(input.daysUntilNextIncome) || 18;
  const nextIncomeDate = input.nextIncomeDate;
  const simulatedAmount = Math.max(0, Number(input.simulatedAmount) || 0);
  const expenseTitle = input.expenseTitle || '';

  const postBalance = Math.max(0, currentBalance - simulatedAmount);

  // Effective daily burn based on current financial horizon or obligations
  const dailyFixedPortion = totalFixedExpenses > 0 ? totalFixedExpenses / 30 : 0;
  const dailyVariableBaseline = Math.max(10, safeToSpendToday);
  const totalDailyBurn = (runwayDays > 0 && currentBalance > 0)
    ? Math.max(10, currentBalance / runwayDays)
    : Math.max(10, dailyFixedPortion + dailyVariableBaseline);

  let projectedDays = runwayDays;
  if (simulatedAmount <= 0) {
    projectedDays = runwayDays;
  } else if (postBalance <= 0) {
    projectedDays = 0;
  } else {
    const daysConsumed = Math.min(runwayDays, Math.max(1, Math.round(simulatedAmount / totalDailyBurn)));
    projectedDays = Math.max(0, runwayDays - daysConsumed);
  }

  // Impact on safe to spend
  const postSafeToSpend = projectedDays > 0 
    ? Math.max(0, Math.round(((postBalance - (totalFixedExpenses * 0.4)) / projectedDays) * 10) / 10)
    : 0;

  // Decision scenario categorization
  let scenario: ScenarioType = 'GO';
  if (projectedDays >= Math.max(21, (daysUntilNextIncome || 0) + 4)) {
    scenario = 'GO';
  } else if (daysUntilNextIncome > 0 && projectedDays < daysUntilNextIncome) {
    scenario = 'NO';
  } else if (projectedDays < 12) {
    scenario = 'NO';
  } else if (nextIncomeDate && daysUntilNextIncome > 5) {
    scenario = 'WAIT';
  } else {
    scenario = 'ADJUST';
  }

  const daysDifference = projectedDays - runwayDays;

  return {
    simulatedAmount,
    expenseTitle,
    postBalance,
    projectedDays,
    postSafeToSpend,
    scenario,
    daysDifference,
    totalDailyBurn,
  };
}

