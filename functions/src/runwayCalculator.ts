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
  const currentBalance = Math.max(0, Number(input.currentBalance) || 0);

  // 1. Calculate Monthly Fixed/Recurring Commitments
  const fixedTransactions = (input.transactions || []).filter(
    (t) => t.type === 'fixed' || t.isRecurring || t.status === 'recurring_active'
  );
  const totalFixedExpenses = fixedTransactions.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
  const dailyFixedBurn = totalFixedExpenses > 0 ? totalFixedExpenses / 30 : 0;

  // 2. Identify Next Known Income Event (Grants, Part-time job, Family, etc.)
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

  // 3. Safe to Spend Today calculation
  // Logic: Current liquid balance minus fixed commitments projected until next income, divided by days remaining
  const fixedBurnUntilNextIncome = dailyFixedBurn * daysUntilNextIncome;
  const discretionaryPool = currentBalance - fixedBurnUntilNextIncome;
  const safeToSpendToday = Math.max(0, Math.round((discretionaryPool / daysUntilNextIncome) * 10) / 10);

  // 4. Day-by-Day Cash Flow Simulation (up to 365 days horizon)
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
