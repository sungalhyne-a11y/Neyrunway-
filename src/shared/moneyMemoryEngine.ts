import { 
  Transaction, 
  IncomeEvent, 
  Goal, 
  ComputedRunway, 
  SupportedRegion, 
  SupportedLanguage,
  LongitudinalMemorySummary,
  CandidatePatternSuggestion,
  FinancialOpportunityMatch,
  ResourceCategory,
  MemoryTrace,
  UncertaintyLevel,
  MemorySource,
  StudentLifeEvent
} from '../types';
import { REGIONAL_RESOURCES_DATA } from '../data/studentResources';

interface AnalyzeMoneyMemoryParams {
  transactions: Transaction[];
  incomeEvents: IncomeEvent[];
  goals: Goal[];
  computedRunway: ComputedRunway | null;
  region: SupportedRegion;
  language: SupportedLanguage;
  currentBalance: number;
}

export interface PersonalizedNextMove {
  type: 'habit_transport_alert' | 'commitment_before_income' | 'inflow_incoming' | 'defend_runway' | 'optimal_pacing';
  badge: string;
  badgeColor: string;
  title: string;
  message: string;
  what: string;
  why: string;
  impact: string;
  actionLabel: string;
  query: string;
  iconName: 'Bus' | 'Clock' | 'AlertCircle' | 'ShieldCheck' | 'Sparkles';
  financialOpportunity?: FinancialOpportunityMatch;
  decisionTrace?: MemoryTrace;
}

// Known subscription patterns for lightweight zero-homework detection
const SUBSCRIPTION_KEYWORDS = [
  'spotify', 'netflix', 'deezer', 'prime', 'amazon prime', 'forfait', 'mobile',
  'orange', 'free mobile', 'sfr', 'bouygues', 'gym', 'fitness', 'basic-fit',
  'apple', 'icloud', 'chatgpt', 'openai', 'canva', 'adobe', 'navigo', 'tbm',
  'tcl', 'cts', 'stib', 'tfl', 'pass transport', 'assurance', 'mutuelle'
];

/**
 * Deterministic Longitudinal Money Memory Analyzer
 * Extracts WHAT HAPPENED, WHAT REPEATS, WHAT MATTERS, WHAT MAY COME NEXT.
 */
export function analyzeMoneyMemory({
  transactions,
  incomeEvents,
  goals,
  computedRunway,
  region,
  language,
  currentBalance,
}: AnalyzeMoneyMemoryParams): LongitudinalMemorySummary {
  const isFr = language === 'fr';

  // 1. WHAT REPEATS — 01: COMMITMENTS (excluding disabled memories)
  const recurringTxs = transactions.filter(
    (tx) => (tx.isRecurring === true || tx.type === 'fixed' || tx.category === 'housing') && !tx.isDisabledInRunway
  );

  let monthlyFixedTotal = 0;
  if (computedRunway?.totalFixedExpenses && computedRunway.totalFixedExpenses > 0) {
    monthlyFixedTotal = computedRunway.totalFixedExpenses;
  } else {
    monthlyFixedTotal = recurringTxs.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
  }

  // Find next commitment (e.g. rent due next month or specific recurring item)
  const housingTx = recurringTxs.find((tx) => tx.category === 'housing');
  const nextCommitment = housingTx ? {
    title: housingTx.title,
    amount: housingTx.amount,
    date: housingTx.date,
  } : (recurringTxs.length > 0 ? {
    title: recurringTxs[0].title,
    amount: recurringTxs[0].amount,
    date: recurringTxs[0].date,
  } : undefined);

  // 2. WHAT MAY COME NEXT — 02: INCOME
  const activeIncomes = [...incomeEvents].sort((a, b) => {
    return new Date(a.expectedDate).getTime() - new Date(b.expectedDate).getTime();
  });

  const now = new Date();
  const nextIncomeEvent = activeIncomes.find((inc) => new Date(inc.expectedDate).getTime() >= now.getTime() - 86400000);
  
  let daysUntilNext = computedRunway?.daysUntilNextIncome ?? 14;
  if (nextIncomeEvent) {
    const diffMs = new Date(nextIncomeEvent.expectedDate).getTime() - now.getTime();
    daysUntilNext = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  }

  const monthlyProjectedIncome = activeIncomes.reduce((sum, inc) => {
    return sum + (inc.isRecurringMonthly ? inc.amount : (inc.amount / 3));
  }, 0);

  // 3. WHAT HAPPENED & WHAT MATTERS — 03: HABITS (excluding disabled memories)
  const variableTxs = transactions.filter(
    (tx) => tx.isRecurring !== true && tx.type !== 'fixed' && !tx.isDisabledInRunway
  );

  const nowYearMonth = now.toISOString().slice(0, 7); // e.g. 2026-09
  const thisMonthVariable = variableTxs.filter((tx) => !tx.date || tx.date.startsWith(nowYearMonth));

  const totalVariableSpentThisMonth = (thisMonthVariable.length > 0 ? thisMonthVariable : variableTxs)
    .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

  // Category aggregates
  const categoryTotals: Record<string, number> = {};
  const titleCounts: Record<string, number> = {};

  transactions.forEach((tx) => {
    const cat = tx.category || 'other';
    categoryTotals[cat] = (categoryTotals[cat] || 0) + Number(tx.amount || 0);

    const normTitle = tx.title.trim().toLowerCase();
    titleCounts[normTitle] = (titleCounts[normTitle] || 0) + 1;
  });

  let topCategory = 'food';
  let topCatAmount = 0;
  Object.entries(categoryTotals).forEach(([cat, amt]) => {
    if (amt > topCatAmount && cat !== 'housing') {
      topCatAmount = amt;
      topCategory = cat;
    }
  });

  let mostFreqTitle = '';
  let maxCount = 0;
  Object.entries(titleCounts).forEach(([t, count]) => {
    if (count > maxCount) {
      maxCount = count;
      mostFreqTitle = t;
    }
  });

  // Longitudinal Transport Tracking
  const transportTxs = transactions.filter((tx) => tx.category === 'transport');
  const transportSpendThisMonth = transportTxs
    .filter((tx) => !tx.date || tx.date.startsWith(nowYearMonth))
    .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

  // Baseline student transit: regional default ~38€/mo or historical average
  const transportBaselineAvg = region === 'CH' ? 30 : region === 'GB' ? 45 : region === 'BE' ? 15 : 38;
  let transportShiftPercent = 0;
  if (transportSpendThisMonth > transportBaselineAvg) {
    transportShiftPercent = Math.round(((transportSpendThisMonth - transportBaselineAvg) / transportBaselineAvg) * 100);
  }

  const foodSpendThisMonth = categoryTotals['food'] || 0;
  const daysInMonthSoFar = Math.max(1, now.getDate());
  const dailyVariablePace = Math.round((totalVariableSpentThisMonth / daysInMonthSoFar) * 10) / 10;

  // Synthesize Habit Insight
  let habitInsight = '';
  if (transportShiftPercent >= 20) {
    habitInsight = isFr
      ? `Dépenses de transport ${transportShiftPercent}% au-dessus de ton niveau habituel.`
      : `Transit expenses ${transportShiftPercent}% above your usual baseline.`;
  } else if (dailyVariablePace > (computedRunway?.safeToSpendToday || 24)) {
    habitInsight = isFr
      ? `Rythme quotidien supérieur au disponible serein (${dailyVariablePace}€/j vs ${computedRunway?.safeToSpendToday || 24}€/j).`
      : `Daily variable pace exceeds safe daily spend (${dailyVariablePace}€/d vs ${computedRunway?.safeToSpendToday || 24}€/d).`;
  } else {
    habitInsight = isFr
      ? `Rythme de dépenses maîtrisé et conforme à tes habitudes.`
      : `Pacing is steady and consistent with your habits.`;
  }

  // 4. WHAT MATTERS — 04: GOALS
  const totalGoalTarget = goals.reduce((sum, g) => sum + (Number(g.targetAmount) || 0), 0);
  const totalGoalCurrent = goals.reduce((sum, g) => sum + (Number(g.currentAmount) || 0), 0);

  // 5. MEMORY WITHOUT HOMEWORK — Pattern Recognition for candidate subscriptions
  const candidateSuggestions: CandidatePatternSuggestion[] = [];
  variableTxs.forEach((tx) => {
    const norm = tx.title.toLowerCase();
    const isMatched = SUBSCRIPTION_KEYWORDS.some((kw) => norm.includes(kw));
    if (isMatched && !tx.isRecurring) {
      candidateSuggestions.push({
        id: `sugg-${tx.id}`,
        transactionId: tx.id,
        title: tx.title,
        amount: tx.amount,
        category: tx.category,
        detectedPattern: 'recurring_subscription',
        message: isFr 
          ? `Cette dépense de ${tx.amount} € (${tx.title}) ressemble à ton abonnement mensuel.`
          : `This expense of ${tx.amount} € (${tx.title}) looks like your monthly subscription.`,
        suggestedAction: 'mark_recurring',
        status: 'pending',
      });
    }
  });

  // 6. FINANCIAL OPPORTUNITY LAYER (Signal → Resource → Potential Impact)
  const matchedOpportunity = matchFinancialOpportunity({
    region,
    language,
    transportShiftPercent,
    transportSpendThisMonth,
    monthlyFixedTotal,
    currentBalance,
    runwayDays: computedRunway?.runwayDays ?? 34,
    foodSpendThisMonth,
  });

  // 7. STUDENT LIFE EVENTS LAYER
  // Progressively understands student milestones: rentrée, voyage, déménagement, vacances, nouveau semestre, loyer, bourse, rentrée d'argent
  const lifeEvents: StudentLifeEvent[] = [];

  // Life Event 1: Rent / Housing Due
  if (nextCommitment && nextCommitment.amount > 0) {
    lifeEvents.push({
      id: 'event-rent',
      type: 'rent_due',
      title: isFr ? 'Échéance Loyer & Charges' : 'Rent & Housing Due',
      dateOrPeriod: nextCommitment.date || (isFr ? 'Début de mois' : 'Start of month'),
      impactDescription: isFr
        ? `Loyer de ${nextCommitment.amount} € sanctuarisé : ton disponible du jour ne met jamais ce montant en danger.`
        : `Rent of €${nextCommitment.amount} ring-fenced: safe daily spend never jeopardizes this payment.`,
      estimatedAmount: nextCommitment.amount,
      status: 'ongoing',
      suggestedPrompt: isFr
        ? `Mon loyer de ${nextCommitment.amount}€ arrive bientôt. Comment garder assez jusqu'à ma prochaine rentrée ?`
        : `My rent of €${nextCommitment.amount} is due soon. How do I keep enough until my next deposit?`,
    });
  }

  // Life Event 2: Inflow / Grant Payout
  if (nextIncomeEvent) {
    const isGrant = /bourse|crous|caf|apl|aide|grant|scholarship/i.test(nextIncomeEvent.source);
    lifeEvents.push({
      id: 'event-income',
      type: isGrant ? 'grant_payout' : 'income_inflow',
      title: nextIncomeEvent.source,
      dateOrPeriod: isFr ? `Dans ${daysUntilNext} jours` : `In ${daysUntilNext} days`,
      impactDescription: isFr
        ? `Rentrée de +${nextIncomeEvent.amount} € prévue. Attendre cette échéance te permet de préserver ton autonomie.`
        : `Expected inflow of +€${nextIncomeEvent.amount}. Waiting for this date preserves your cushion.`,
      financialImpactDays: Math.round(nextIncomeEvent.amount / Math.max(15, computedRunway?.safeToSpendToday || 24)),
      estimatedAmount: nextIncomeEvent.amount,
      status: 'upcoming',
      suggestedPrompt: isFr
        ? `Mon virement de +${nextIncomeEvent.amount}€ arrive dans ${daysUntilNext} jours. Que me conseilles-tu d'ici là ?`
        : `My deposit of +€${nextIncomeEvent.amount} arrives in ${daysUntilNext} days. What do you recommend until then?`,
    });
  }

  // Life Event 3: Transit / Trip / Rentrer chez soi
  if (transportSpendThisMonth > 30 || goals.some(g => g.category === 'trip')) {
    const tripGoal = goals.find(g => g.category === 'trip');
    lifeEvents.push({
      id: 'event-trip',
      type: 'trip',
      title: isFr ? 'Voyage & Visite aux proches' : 'Travel & Family Visit',
      dateOrPeriod: isFr ? 'Ce mois-ci' : 'This month',
      impactDescription: isFr
        ? (tripGoal 
            ? `Projet "${tripGoal.name}" (${tripGoal.targetAmount} €). Mettre de côté préserve ton horizon.` 
            : `Trajets récents (${transportSpendThisMonth} €). Une aide transport pourrait réduire ce poste.`)
        : `Transit spending (€${transportSpendThisMonth}). A transit pass discount could lower this line.`,
      status: 'ongoing',
      suggestedPrompt: isFr
        ? 'Je peux rentrer chez moi ce week-end ? Quel impact sur mon runway ?'
        : 'Can I go home this weekend? What impact on my runway?',
    });
  }

  // Life Event 4: Semester & University Rhythm
  lifeEvents.push({
    id: 'event-semester',
    type: 'semester_start',
    title: isFr ? 'Rythme Universitaire & Semestre' : 'Academic Semester Rhythm',
    dateOrPeriod: isFr ? 'Semestre en cours' : 'Ongoing term',
    impactDescription: isFr
      ? 'Examens, fournitures et abonnements : adapter le rythme journalier maintient ton horizon prévisionnel stable.'
      : 'Classes, supplies and passes: pacing daily spending keeps your projected runway stable.',
    status: 'ongoing',
    suggestedPrompt: isFr
      ? 'Pourquoi mon argent part aussi vite ce semestre et comment me réajuster ?'
      : 'Why is my money going so fast this semester and how do I adjust?',
  });

  const moatSignalsCount = transactions.length + activeIncomes.length + recurringTxs.length + goals.length;

  return {
    commitments: {
      count: recurringTxs.length,
      monthlyTotal: monthlyFixedTotal,
      items: recurringTxs,
      nextCommitment,
    },
    income: {
      count: activeIncomes.length,
      monthlyProjected: monthlyProjectedIncome,
      events: activeIncomes,
      nextIncome: nextIncomeEvent ? {
        source: nextIncomeEvent.source,
        amount: nextIncomeEvent.amount,
        date: nextIncomeEvent.expectedDate,
        daysRemaining: daysUntilNext,
      } : (computedRunway?.nextIncomeAmount ? {
        source: computedRunway.nextIncomeSource || (isFr ? 'Rentrée prévue' : 'Expected deposit'),
        amount: computedRunway.nextIncomeAmount,
        date: computedRunway.nextIncomeDate,
        daysRemaining: daysUntilNext,
      } : undefined),
    },
    habits: {
      totalVariableSpentThisMonth,
      topExpenseCategory: topCategory,
      topExpenseAmount: topCatAmount,
      mostFrequentTitle: mostFreqTitle,
      transportSpendThisMonth,
      transportBaselineAvg,
      transportShiftPercent,
      foodSpendThisMonth,
      dailyVariablePace,
      habitInsight,
    },
    goals: {
      count: goals.length,
      totalTarget: totalGoalTarget,
      totalCurrent: totalGoalCurrent,
      items: goals,
    },
    candidateSuggestions: candidateSuggestions.slice(0, 3),
    opportunity: matchedOpportunity,
    moatSignalsCount,
    lifeEvents,
  };
}

/**
 * Matches verified regional student aids to real signals:
 * SIGNAL → RESOURCE → POTENTIAL IMPACT
 * Uses prudent wording: "pourrait", "semble pertinent", "à vérifier"
 */
function matchFinancialOpportunity({
  region,
  language,
  transportShiftPercent,
  transportSpendThisMonth,
  monthlyFixedTotal,
  currentBalance,
  runwayDays,
  foodSpendThisMonth,
}: {
  region: SupportedRegion;
  language: SupportedLanguage;
  transportShiftPercent: number;
  transportSpendThisMonth: number;
  monthlyFixedTotal: number;
  currentBalance: number;
  runwayDays: number;
  foodSpendThisMonth: number;
}): FinancialOpportunityMatch | undefined {
  const isFr = language === 'fr';
  const rawList = REGIONAL_RESOURCES_DATA[region] || REGIONAL_RESOURCES_DATA.FR;

  // Signal 1: Elevated Transport Habit (Primary Student Trigger)
  if (transportShiftPercent >= 20 || transportSpendThisMonth > 45) {
    const transitResource = rawList.find((r) => r.category === 'transport') || rawList[0];
    const resTitle = transitResource.title[language] || transitResource.title.fr;
    return {
      signalType: 'high_transport',
      signalDescription: isFr
        ? `Tes dépenses de transport (${transportSpendThisMonth} € ce mois) sont ${transportShiftPercent}% au-dessus de ta moyenne.`
        : `Your transit expenses (${transportSpendThisMonth} € this month) are ${transportShiftPercent}% above your usual average.`,
      resourceId: transitResource.id,
      resourceTitle: resTitle,
      provider: transitResource.provider,
      category: 'transport',
      potentialImpact: isFr
        ? `Pourrait réduire tes frais de transport de ~30 € à 45 €/mois et allonger ton runway de +2 à 3 jours.`
        : `Could reduce transit costs by ~€30 to €45/month and extend your runway by +2 to 3 days.`,
      explanationWhy: isFr
        ? `Parce que tes dépenses de transport représentent actuellement une part importante de tes sorties et cette aide pourrait réduire ce poste.`
        : `Because transit expenses represent a significant share of your recurring outflow and this resource could lower this cost.`,
      estimatedMonthlyGain: 35,
      url: transitResource.url,
      prudenceNotice: isFr
        ? `Ressource suggérée à partir de ton contexte de transport réel. Éligibilité à vérifier selon ton statut.`
        : `Resource suggested based on your actual transit context. Eligibility to verify based on status.`,
    };
  }

  // Signal 2: High Fixed Commitments / Housing Pressure
  if (monthlyFixedTotal > 400 || (monthlyFixedTotal > currentBalance * 0.35 && currentBalance > 0)) {
    const housingResource = rawList.find((r) => r.category === 'aid' || r.tags.some(t => String(t).toLowerCase().includes('logement'))) || rawList[0];
    const resTitle = housingResource.title[language] || housingResource.title.fr;
    return {
      signalType: 'high_housing',
      signalDescription: isFr
        ? `Tes charges fixes incompressibles (${monthlyFixedTotal} €/mois) absorbent une part importante de ta trésorerie.`
        : `Your fixed commitments (€${monthlyFixedTotal}/mo) absorb a large share of your available cash.`,
      resourceId: housingResource.id,
      resourceTitle: resTitle,
      provider: housingResource.provider,
      category: 'aid',
      potentialImpact: isFr
        ? `Pourrait alléger ton loyer net mensuel de 100 € à 240 € et sécuriser ton horizon de trésorerie.`
        : `Could reduce your net rent by €100 to €240/mo and secure your cash runway.`,
      explanationWhy: isFr
        ? `Le logement est ton premier engagement fixe. Une prise en charge partielle renforce directement ton disponible quotidien.`
        : `Housing is your largest fixed commitment. Partial assistance directly bolsters your safe daily spend.`,
      estimatedMonthlyGain: 150,
      url: housingResource.url,
      prudenceNotice: isFr
        ? `Aide au logement sous conditions de ressources et de bail. Simulation recommandée sur le portail officiel.`
        : `Housing subsidy subject to income and lease conditions. Official simulation recommended.`,
    };
  }

  // Signal 3: Runway Alert (< 16 days)
  if (runwayDays < 16) {
    const emergencyResource = rawList.find((r) => r.category === 'emergency') || rawList[0];
    const resTitle = emergencyResource.title[language] || emergencyResource.title.fr;
    return {
      signalType: 'low_runway_relief',
      signalDescription: isFr
        ? `Ton autonomie est de ${runwayDays} jours, en zone de vigilance temporaire.`
        : `Your runway is ${runwayDays} days, in temporary alert zone.`,
      resourceId: emergencyResource.id,
      resourceTitle: resTitle,
      provider: emergencyResource.provider,
      category: 'emergency',
      potentialImpact: isFr
        ? `Dispositif d'aide ponctuelle pouvant apporter un soutien rapide sans endettement.`
        : `Emergency one-off support providing rapid relief without debt.`,
      explanationWhy: isFr
        ? `Permet de franchir une période de tension sans entamer ton découvert ni compromettre tes études.`
        : `Helps bridge acute tension without touching overdraft or jeopardizing studies.`,
      url: emergencyResource.url,
      prudenceNotice: isFr
        ? `Aide sociale soumise à évaluation bienveillante du service social étudiant.`
        : `Hardship aid subject to evaluation by student welfare services.`,
    };
  }

  // Signal 4: Food Budget Relief
  if (foodSpendThisMonth > 120) {
    const foodResource = rawList.find((r) => r.category === 'food');
    if (foodResource) {
      const resTitle = foodResource.title[language] || foodResource.title.fr;
      return {
        signalType: 'food_budget_pressure',
        signalDescription: isFr
          ? `L'alimentation représente ton premier poste de dépenses courantes (${foodSpendThisMonth} €).`
          : `Groceries and meals represent your highest variable category (€${foodSpendThisMonth}).`,
        resourceId: foodResource.id,
        resourceTitle: resTitle,
        provider: foodResource.provider,
        category: 'food',
        potentialImpact: isFr
          ? `Permet d'économiser jusqu'à 80 € à 120 €/mois sur tes repas du midi.`
          : `Can save up to €80 to €120/month on campus lunches.`,
        explanationWhy: isFr
          ? `Les repas subventionnés protègent directement ton disponible journalier.`
          : `Subsidized campus meals directly protect your daily safe-to-spend.`,
        estimatedMonthlyGain: 80,
        url: foodResource.url,
        prudenceNotice: isFr
          ? `Accessible sur présentation de la carte étudiante dans les restaurants universitaires conventionnés.`
          : `Accessible with student ID card at certified campus dining halls.`,
      };
    }
  }

  return undefined;
}

/**
 * Generates the UNIQUE Next Move strictly contextualized with Longitudinal Memory
 * Adheres to:
 * - Signal-based logic
 * - Strictly UNIQUE recommendation
 * - Connects Financial Opportunity when relevant
 */
export function getPersonalizedNextMove(
  memory: LongitudinalMemorySummary,
  computedRunway: ComputedRunway | null,
  language: SupportedLanguage,
  formatCurrency: (val: number) => string
): PersonalizedNextMove {
  const isFr = language === 'fr';
  const runwayDays = computedRunway?.runwayDays ?? 34;
  const safeToSpendToday = computedRunway?.safeToSpendToday ?? 24;
  const daysUntilNextIncome = memory.income.nextIncome?.daysRemaining ?? computedRunway?.daysUntilNextIncome ?? 14;
  const nextIncomeAmount = memory.income.nextIncome?.amount ?? computedRunway?.nextIncomeAmount ?? 0;
  const nextIncomeSource = memory.income.nextIncome?.source || (isFr ? 'Rentrée attendue' : 'Expected inflow');
  const nextCommitment = memory.commitments.nextCommitment;

  // Signal 1: Longitudinal Memory — Transport Habit Surge
  if (memory.habits.transportShiftPercent >= 20) {
    const opp = memory.opportunity?.signalType === 'high_transport' ? memory.opportunity : undefined;
    return {
      type: 'habit_transport_alert',
      badge: isFr ? 'Habitude surveillée' : 'Monitored Habit',
      badgeColor: 'text-[#FACC15] bg-[#FACC15]/10 border-[#FACC15]/30',
      title: isFr
        ? `Tu dépenses plus en transport cette semaine. Une aide pourrait réduire ce coût.`
        : `You're spending more on transit this week. A pass discount could help.`,
      message: isFr
        ? `Tes sorties transport atteignent ${formatCurrency(memory.habits.transportSpendThisMonth)} ce mois (+${memory.habits.transportShiftPercent}%). Modérer les trajets d'ici ta rentrée préserve ton autonomie.`
        : `Your transit costs reached ${formatCurrency(memory.habits.transportSpendThisMonth)} this month (+${memory.habits.transportShiftPercent}%). Pacing rides until your deposit protects your runway.`,
      what: isFr
        ? `Modère les trajets ponctuels non urgents d'ici ta rentrée.`
        : `Pace discretionary rides until your upcoming deposit.`,
      why: isFr
        ? `Tes sorties transport (${formatCurrency(memory.habits.transportSpendThisMonth)}) dépassent ta moyenne habituelle de ${formatCurrency(memory.habits.transportBaselineAvg)}/mois.`
        : `Your transit spending (${formatCurrency(memory.habits.transportSpendThisMonth)}) exceeds your typical baseline of ${formatCurrency(memory.habits.transportBaselineAvg)}/mo.`,
      impact: isFr
        ? `Cette temporisation préserve 2 à 3 jours de runway intacts. À toi de voir.`
        : `This pacing keeps 2 to 3 days of runway intact. Up to you.`,
      actionLabel: opp ? (isFr ? 'Explorer l\'aide transport' : 'Explore transit aid') : (isFr ? 'Voir pourquoi' : 'See why'),
      query: isFr
        ? `Mes dépenses de transport sont ${memory.habits.transportShiftPercent}% plus élevées ce mois-ci. Comment me réajuster et quelles aides transport puis-je solliciter ?`
        : `My transit spending is ${memory.habits.transportShiftPercent}% higher this month. How can I adjust and what student transit pass could help?`,
      iconName: 'Bus',
      financialOpportunity: opp,
      decisionTrace: {
        signal: isFr
          ? `Hausse de ${memory.habits.transportShiftPercent}% des dépenses de transport par rapport à ta moyenne`
          : `Transit spending surge of ${memory.habits.transportShiftPercent}% above your baseline`,
        memoryItem: {
          title: isFr ? 'Poste Transports & Mobilités' : 'Transit & Mobility Spending',
          amount: memory.habits.transportSpendThisMonth,
          status: 'detected',
          statusLabel: isFr ? 'Détecté' : 'Detected',
          source: isFr ? 'Déduit de tes transactions récentes' : 'Inferred from recent movements',
          usedFor: [
            isFr ? 'Surveillance des habitudes' : 'Habit tracking',
            isFr ? 'Simulations de dépenses' : 'Expense simulations',
            isFr ? 'Aide régionale ciblée' : 'Targeted aid matching'
          ],
        },
        reasoning: isFr
          ? `Une accélération non anticipée des trajets réduit le coussin disponible avant ta prochaine rentrée.`
          : `An unplanned acceleration in transit burns through liquid cash before next deposit.`,
        impact: isFr
          ? `Préserve 2 à 3 jours de runway supplémentaires sans découvert.`
          : `Protects 2 to 3 days of extra runway.`,
        recommendation: isFr
          ? `Temporise les trajets discrétionnaires et explore l'abonnement étudiant subventionné.`
          : `Pace discretionary rides and review student pass discounts.`,
        uncertaintyLevel: 'detected',
        uncertaintyLabel: isFr ? 'Comportement détecté automatiquement' : 'Pattern detected automatically',
      },
    };
  }

  // Signal 2: Longitudinal Memory — Commitment (Rent) Due Before Income Arrives
  if (nextCommitment && daysUntilNextIncome > 5 && daysUntilNextIncome > 3 && nextCommitment.amount > 0) {
    const rentAmount = nextCommitment.amount;
    const targetDailyPace = Math.max(8, Math.round(safeToSpendToday * 0.85));
    return {
      type: 'commitment_before_income',
      badge: isFr ? 'Échéance prioritaire' : 'Priority Commitment',
      badgeColor: 'text-[#38BDF8] bg-[#38BDF8]/10 border-[#38BDF8]/30',
      title: isFr
        ? `Ton loyer arrive bientôt. Garde cette marge disponible.`
        : `Your rent is due soon. Keep this margin available.`,
      message: isFr
        ? `Voici ce que cela change pour ton loyer (${formatCurrency(rentAmount)}) : ton disponible du jour est calibré pour le sécuriser avant ta rentrée dans ${daysUntilNextIncome} jours.`
        : `Here is what this means for your rent (${formatCurrency(rentAmount)}): your safe daily spend is calibrated to protect it before your deposit in ${daysUntilNextIncome} days.`,
      what: isFr
        ? `Garde ton disponible journalier sous ~${formatCurrency(targetDailyPace)}/jour jusqu'au prélèvement.`
        : `Keep daily spending under ~${formatCurrency(targetDailyPace)}/day until payment clears.`,
      why: isFr
        ? `L'engagement "${nextCommitment.title}" (${formatCurrency(rentAmount)}) précède la rentrée de ${formatCurrency(nextIncomeAmount)} (${nextIncomeSource}).`
        : `Commitment "${nextCommitment.title}" (${formatCurrency(rentAmount)}) precedes the deposit of ${formatCurrency(nextIncomeAmount)} (${nextIncomeSource}).`,
      impact: isFr
        ? `Le loyer est 100% sécurisé et ton compte reste serein sans tension.`
        : `Rent is 100% protected and your account stays clear of overdraft tension.`,
      actionLabel: isFr ? 'Vérifier avec Ney' : 'Check with Ney',
      query: isFr
        ? `Mon loyer de ${formatCurrency(rentAmount)} arrive avant ma rentrée dans ${daysUntilNextIncome} jours. Comment garder assez jusqu'à ma prochaine rentrée ?`
        : `My rent of ${formatCurrency(rentAmount)} is due before my deposit in ${daysUntilNextIncome} days. How do I keep enough until my next deposit?`,
      iconName: 'Clock',
      financialOpportunity: memory.opportunity?.signalType === 'high_housing' ? memory.opportunity : undefined,
      decisionTrace: {
        signal: isFr
          ? `Échéance "${nextCommitment.title}" (${formatCurrency(rentAmount)}) due avant ta rentrée dans ${daysUntilNextIncome} jours`
          : `Bill "${nextCommitment.title}" (${formatCurrency(rentAmount)}) due before deposit in ${daysUntilNextIncome} days`,
        memoryItem: {
          title: nextCommitment.title,
          amount: rentAmount,
          status: 'confirmed',
          statusLabel: isFr ? 'Confirmé' : 'Confirmed',
          source: isFr ? 'Sanctuarisé dans tes charges fixes' : 'Ring-fenced in your fixed bills',
          usedFor: [
            isFr ? 'Calcul du Runway' : 'Runway calculation',
            isFr ? 'Disponible journalier (Safe-to-Spend)' : 'Safe-to-Spend',
            isFr ? 'Priorisation du Next Move' : 'Next Move recommendation'
          ],
        },
        reasoning: isFr
          ? `Cette charge est sanctuarisée pour que ton compte ne soit jamais à découvert lors du prélèvement.`
          : `This bill is ring-fenced to prevent overdraft when the payment clears.`,
        impact: isFr
          ? `Loyer couvert dans le calcul et risque d'incident minimisé.`
          : `Rent covered in runway and overdraft risk minimized.`,
        recommendation: isFr
          ? `Garde ton rythme journalier sous ~${formatCurrency(targetDailyPace)}/jour jusqu'à cette date. À toi de voir.`
          : `Keep daily spend under ~${formatCurrency(targetDailyPace)}/day until this date. Up to you.`,
        uncertaintyLevel: 'confirmed',
        uncertaintyLabel: isFr ? 'Information confirmée' : 'Confirmed information',
      },
    };
  }

  // Signal 3: Imminent Inflow (within 5 days)
  if (daysUntilNextIncome > 0 && daysUntilNextIncome <= 5 && nextIncomeAmount > 0) {
    return {
      type: 'inflow_incoming',
      badge: isFr ? 'Rentrée imminente' : 'Upcoming Deposit',
      badgeColor: 'text-[#D4FF3D] bg-[#D4FF3D]/10 border-[#D4FF3D]/30',
      title: isFr 
        ? `En attendant ${daysUntilNextIncome} jours jusqu'à ta rentrée, tu préserves ton disponible.` 
        : `Waiting ${daysUntilNextIncome} days until your deposit preserves your cushion.`,
      message: isFr
        ? `Ton versement de +${formatCurrency(nextIncomeAmount)} arrive dans ${daysUntilNextIncome} jours. Attendre cette date préserve ton coussin intact.`
        : `Your deposit of +${formatCurrency(nextIncomeAmount)} arrives in ${daysUntilNextIncome} days. Waiting for it keeps your cushion intact.`,
      what: isFr
        ? `Attends ${daysUntilNextIncome} jours avant de grosses dépenses non planifiées.`
        : `Wait ${daysUntilNextIncome} days before large unplanned spending.`,
      why: isFr
        ? `Ton versement de +${formatCurrency(nextIncomeAmount)} (${nextIncomeSource}) est prévu dans ${daysUntilNextIncome} ${daysUntilNextIncome <= 1 ? 'jour' : 'jours'}.`
        : `Your deposit of +${formatCurrency(nextIncomeAmount)} (${nextIncomeSource}) is scheduled in ${daysUntilNextIncome} ${daysUntilNextIncome <= 1 ? 'day' : 'days'}.`,
      impact: isFr
        ? `Cette temporisation préserve actuellement ton runway de ${runwayDays} jours intact. À toi de voir.`
        : `This pacing keeps your current runway of ${runwayDays} days intact. Up to you.`,
      actionLabel: isFr ? 'Simuler avec Ney' : 'Simulate with Ney',
      query: isFr 
        ? `Mon versement de ${formatCurrency(nextIncomeAmount)} arrive dans ${daysUntilNextIncome} jours. Est-ce que je peux me permettre des sorties d'ici là ?`
        : `My deposit of ${formatCurrency(nextIncomeAmount)} arrives in ${daysUntilNextIncome} days. Can I afford going out until then?`,
      iconName: 'Clock',
      decisionTrace: {
        signal: isFr
          ? `Rentrée ${nextIncomeSource} de +${formatCurrency(nextIncomeAmount)} prévue dans ${daysUntilNextIncome} jours`
          : `Deposit ${nextIncomeSource} of +${formatCurrency(nextIncomeAmount)} scheduled in ${daysUntilNextIncome} days`,
        memoryItem: {
          title: nextIncomeSource,
          amount: nextIncomeAmount,
          status: 'confirmed',
          statusLabel: isFr ? 'Planifié' : 'Scheduled',
          source: isFr ? 'Échéance déclarée dans tes rentrées' : 'Scheduled income entry',
          usedFor: [
            isFr ? 'Extension de Runway' : 'Runway horizon extension',
            isFr ? 'Déblocage de Safe-to-Spend' : 'Safe-to-Spend unlock',
            isFr ? 'Simulation de grosses dépenses' : 'Large expense simulation'
          ],
        },
        reasoning: isFr
          ? `Une rentrée d'argent proche compense les dépenses courantes si le compte n'est pas asséché avant son arrivée.`
          : `An imminent inflow offsets burn provided the balance is not depleted beforehand.`,
        impact: isFr
          ? `Repousse ton horizon de plus de 15 jours supplémentaires.`
          : `Pushes your runway horizon by 15+ days.`,
        recommendation: isFr
          ? `Temporise les achats optionnels jusqu'au versement effectif. À toi de voir.`
          : `Postpone optional purchases until payment clears. Up to you.`,
        uncertaintyLevel: 'confirmed',
        uncertaintyLabel: isFr ? 'Information confirmée' : 'Confirmed information',
      },
    };
  }

  // Signal 4: Runway Alert (< 16 days)
  if (runwayDays < 16) {
    const targetDaily = Math.max(10, Math.round(safeToSpendToday * 0.8));
    return {
      type: 'defend_runway',
      badge: isFr ? 'Vigilance temporaire' : 'Temporary Pressure',
      badgeColor: 'text-[#FACC15] bg-[#FACC15]/10 border-[#FACC15]/30',
      title: isFr
        ? `Tu es un peu juste cette semaine. En dépensant ~${formatCurrency(targetDaily)}/jour, tu maintiens ton équilibre.`
        : `You're a bit tight this week. Spending ~${formatCurrency(targetDaily)}/day maintains your balance.`,
      message: isFr
        ? `Voici ce que cela change pour tes prochains jours : adapter temporairement tes sorties à ce rythme déplace ton point de tension sans déséquilibre. À toi de voir.`
        : `Here is what this implies: pacing daily spend to this target pushes your pressure point without stress. Up to you.`,
      what: isFr
        ? `Plafonne tes dépenses variables à ~${formatCurrency(targetDaily)}/jour cette semaine.`
        : `Cap variable spending at ~${formatCurrency(targetDaily)}/day this week.`,
      why: isFr
        ? `Ton runway actuel est de ${runwayDays} jours, sous le seuil d'attention des 16 jours.`
        : `Your current runway is ${runwayDays} days, below the 16-day attention threshold.`,
      impact: isFr
        ? `Ce rythme temporaire allonge ton autonomie de +4 jours sans stress.`
        : `This temporary pacing extends your runway by +4 days without stress.`,
      actionLabel: isFr ? 'Voir mes options avec Ney' : 'Explore options with Ney',
      query: isFr
        ? `Tu me dis que je suis un peu juste cette semaine. Quels ajustements simples me conseilles-tu ?`
        : `You mentioned I'm a bit tight this week. What simple adjustments do you suggest?`,
      iconName: 'AlertCircle',
      financialOpportunity: memory.opportunity,
      decisionTrace: {
        signal: isFr
          ? `Horizon de ${runwayDays} jours sous le seuil d'attention (16 jours)`
          : `Runway of ${runwayDays} days below attention threshold (16 days)`,
        memoryItem: {
          title: isFr ? 'Rythme de dépenses variables' : 'Variable spend pace',
          amount: Math.round(safeToSpendToday),
          status: 'estimated',
          statusLabel: isFr ? 'Estimé' : 'Estimated',
          source: isFr ? 'Calculé à partir de ton solde liquide et tes charges' : 'Derived from liquid cash and commitments',
          usedFor: [
            isFr ? 'Disponible journalier' : 'Safe-to-Spend',
            isFr ? 'Projection de rupture de trésorerie' : 'Cash runway forecast'
          ],
        },
        reasoning: isFr
          ? `Un ajustement doux de quelques euros par jour repousse le point de tension de plusieurs semaines.`
          : `A small reduction of a few euros per day pushes the pressure point further.`,
        impact: isFr
          ? `+4 jours d'autonomie préservés immédiatement sans privation brutale.`
          : `+4 days of runway gained immediately without extreme sacrifice.`,
        recommendation: isFr
          ? `Plafonne tes dépenses variables à ~${formatCurrency(targetDaily)}/jour cette semaine. À toi de voir.`
          : `Cap variable spending at ~${formatCurrency(targetDaily)}/day this week. Up to you.`,
        uncertaintyLevel: 'estimated',
        uncertaintyLabel: isFr ? 'Modélisation prévisionnelle' : 'Predictive model',
      },
    };
  }

  // Signal 5: Commitments Covered & Steady Habit Baseline
  return {
    type: 'optimal_pacing',
    badge: isFr ? 'Engagements couverts' : 'Commitments Covered',
    badgeColor: 'text-[#38BDF8] bg-[#38BDF8]/10 border-[#38BDF8]/30',
    title: isFr
      ? `Tes charges sont calées. Tu as ${formatCurrency(safeToSpendToday)} disponible aujourd'hui.`
      : `Your bills are set. You have ${formatCurrency(safeToSpendToday)} safe to spend today.`,
    message: isFr
      ? `Loyer et forfaits prévus sont isolés dans ton calcul. Tu peux dépenser ton disponible du jour sans inquiétude.`
      : `Rent and subscriptions are accounted for. You can spend today's safe allowance with total peace of mind.`,
    what: isFr
      ? `Maintiens ton rythme habituel en respectant ton disponible du jour.`
      : `Maintain your steady pace within today's safe spend limit.`,
    why: isFr
      ? `Tes charges fixes (${formatCurrency(memory.commitments.monthlyTotal)}/mois) sont couvertes par ton solde disponible (${formatCurrency(computedRunway?.currentBalance || 1250)}).`
      : `Your fixed commitments (${formatCurrency(memory.commitments.monthlyTotal)}/mo) are covered by your available cash (${formatCurrency(computedRunway?.currentBalance || 1250)}).`,
    impact: isFr
      ? `Ton autonomie de ${runwayDays} jours reste stable et tes échéances sont sécurisées.`
      : `Your ${runwayDays}-day runway remains stable and scheduled obligations are secured.`,
    actionLabel: isFr ? 'Poser une question' : 'Ask Ney',
    query: isFr
      ? `J'ai ${formatCurrency(safeToSpendToday)} de disponible aujourd'hui et ${runwayDays} jours d'autonomie. Quel est ton conseil pour ce week-end ?`
      : `I have ${formatCurrency(safeToSpendToday)} available today and ${runwayDays} days of runway. What is your advice for this weekend?`,
    iconName: 'ShieldCheck',
    financialOpportunity: memory.opportunity,
    decisionTrace: {
      signal: isFr
        ? `Charges vitales couvertes et solde liquide positif (${formatCurrency(computedRunway?.currentBalance || 1250)})`
        : `Vital commitments covered and positive liquid balance (${formatCurrency(computedRunway?.currentBalance || 1250)})`,
      memoryItem: {
        title: isFr ? 'Total des charges sanctuarisées' : 'Total ring-fenced bills',
        amount: memory.commitments.monthlyTotal,
        status: 'confirmed',
        statusLabel: isFr ? 'Confirmé' : 'Confirmed',
        source: isFr ? 'Charges fixes déclarées et vérifiées' : 'Declared & verified fixed bills',
        usedFor: [
          isFr ? 'Calcul du Runway' : 'Runway calculation',
          isFr ? 'Disponible sécurisé (Safe-to-Spend)' : 'Safe-to-Spend'
        ],
      },
      reasoning: isFr
        ? `Toutes les charges vitales du mois sont isolées. Tu peux dépenser ton disponible du jour sans aucun risque de découvert.`
        : `All vital monthly expenses are quarantined. You can spend today's safe allowance safely.`,
      impact: isFr
        ? `Horizon de ${runwayDays} jours stable et sérénité confirmée.`
        : `Stable ${runwayDays}-day runway with total peace of mind.`,
      recommendation: isFr
        ? `Maintiens ton rythme régulier sans changer tes habitudes.`
        : `Keep your steady pace without changing habits.`,
      uncertaintyLevel: 'confirmed',
      uncertaintyLabel: isFr ? 'Information confirmée' : 'Confirmed information',
    },
  };
}
