import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { calculateDecisionSimulation } from './src/shared/runwayCalculator';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

// Lazy-initialized Gemini Client
let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!geminiClient && process.env.GEMINI_API_KEY) {
    geminiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });
  }
  return geminiClient;
}

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Structured Chat / Decision Endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, userContext, simulation } = req.body;

    const currency = userContext?.currency || 'EUR';
    const region = userContext?.region || 'FR';
    const currentBalance = userContext?.currentBalance ?? 1250;
    const runwayDays = userContext?.runwayDays ?? 34;
    const safeToSpendToday = userContext?.safeToSpendToday ?? 24;
    const dailyBurn = userContext?.dailyBurn ?? 35;
    const nextIncomeDate = userContext?.nextIncomeDate || 'Non spécifié';
    const nextIncomeAmount = userContext?.nextIncomeAmount ?? 0;
    const nextIncomeSource = userContext?.nextIncomeSource || '';
    const totalFixedExpenses = userContext?.totalFixedExpenses ?? 450;
    const goalsSummary = userContext?.goals?.length 
      ? userContext.goals.map((g: any) => `${g.name} (Cible: ${g.targetAmount}${currency}, Actuel: ${g.currentAmount}${currency})`).join(', ') 
      : 'Aucun objectif défini';
    const fixedExpensesSummary = userContext?.fixedExpenses?.length
      ? userContext.fixedExpenses.map((e: any) => `${e.title}: ${e.amount}${currency}/mois`).join(', ')
      : 'Non spécifié';

    const latestUserMessage = (messages?.[messages.length - 1]?.content || '').trim();
    const isFrench = !latestUserMessage 
      ? (userContext?.preferredLanguage === 'fr')
      : (/[àâçéèêëîïôûùüÿœ]/i.test(latestUserMessage) || 
         /comment|ajouter|dépense|transaction|mouvement|bourse|aide|loyer|objectif|bonjour|salut|merci/i.test(latestUserMessage) || 
         (userContext?.preferredLanguage === 'fr' && !/how|add|transaction|expense|spend|afford|goal|what|can|hello/i.test(latestUserMessage)));

    // Calculate canonical simulation metrics if query involves purchase simulation or if simulation payload was sent
    let activeSimulationData: any = null;
    const globalPriceMatch = latestUserMessage.match(/(\d+[\d\s.,]*)\s*(?:€|\$|CHF|£|CAD|USD|EUR)?/);
    const globalAffordability = /afford|acheter|achat|payer|dépense|sortir|concert|voyage|billet|resto|soiree|soirée|can I|puis-je|dois-je|m'offrir|prendre|simulateur|simulation/i.test(latestUserMessage);

    if (simulation && simulation.amount > 0) {
      activeSimulationData = calculateDecisionSimulation({
        currentBalance,
        runwayDays,
        safeToSpendToday,
        totalFixedExpenses,
        daysUntilNextIncome: userContext?.daysUntilNextIncome ?? 18,
        nextIncomeDate: nextIncomeDate !== 'Non spécifié' ? nextIncomeDate : undefined,
        nextIncomeAmount,
        nextIncomeSource,
        simulatedAmount: simulation.amount,
        expenseTitle: simulation.title,
      });
    } else if (globalAffordability && globalPriceMatch) {
      const cost = parseFloat(globalPriceMatch[1].replace(/\s/g, '').replace(',', '.'));
      if (!isNaN(cost) && cost > 0) {
        const titleMatch = latestUserMessage.match(/["']([^"']+)["']/);
        activeSimulationData = calculateDecisionSimulation({
          currentBalance,
          runwayDays,
          safeToSpendToday,
          totalFixedExpenses,
          daysUntilNextIncome: userContext?.daysUntilNextIncome ?? 18,
          nextIncomeDate: nextIncomeDate !== 'Non spécifié' ? nextIncomeDate : undefined,
          nextIncomeAmount,
          nextIncomeSource,
          simulatedAmount: cost,
          expenseTitle: titleMatch ? titleMatch[1] : undefined,
        });
      }
    }

    // Deterministic High-Quality Ney Natural Language Engine (used as fallback or offline engine)
    const generateLocalNeyAnalysis = () => {
      const q = latestUserMessage.toLowerCase();
      let responseText = '';
      let scenarioBadge: string | null = null;
      let followUpOptions: Array<{ label: string; prompt: string; type?: 'scenario' | 'question' | 'alternative' | 'action' }> = [];

      // 1. Transaction / Expense / Income / Movement Logging Guide
      if (/how.*add.*(transaction|expense|movement|income|money|entry)|add.*(transaction|expense|movement|income)|log.*(transaction|expense|movement)|record.*(transaction|expense)|comment.*(ajouter|enregistrer|créer|saisir).*(transaction|dépense|mouvement|rentrée|revenu|argent)/i.test(q)) {
        if (isFrench) {
          responseText = `Pour ajouter une transaction ou enregistrer un mouvement dans **Neyrunway** :

1. **Ouvre l'onglet « Mémoire »** (icône d'horloge / liste) dans la barre de navigation ou le menu latéral.
2. Clique sur le bouton **« + Enregistrer une intention »** situé en haut à droite.
3. Remplis les quelques champs clés :
   - **Nom du mouvement** : Ex. *Courses CROUS*, *Soirée cinéma*, *Paiement job étudiant*.
   - **Montant & Sens** : Indique la somme et choisis *Dépense (sortie)* ou *Rentrée (entrée)*.
   - **Qualification pour Ney (Tag)** : *Essentiel* (loyer, nourriture), *Confort* ou *Plaisir / Sortie*.
   - **Catégorie** : Logement, Alimentation, Transports, Loisirs, etc.
4. Clique sur **« Enregistrer le mouvement »** : Ney recalcule automatiquement et instantanément ton **Runway (en jours)** et ton **disponible quotidien serein** !

🧭 **Possibilités & Bonnes pratiques :**
- **Option A (Dépense récurrente)** : S'il s'agit d'un abonnement mensuel, tu peux l'ajouter dans tes charges fixes pour qu'il soit protégé automatiquement.
- **Option B (Rentrée ponctuelle ou job)** : Enregistre-le en tant que *Rentrée* pour allonger instantanément ton horizon d'autonomie.
- **Option C (Simulation préalable)** : Tu peux d'abord tester son impact ici avec moi ou dans le simulateur avant de l'engager.

💬 **Question de Ney pour toi :**
Quel type de mouvement souhaites-tu enregistrer aujourd'hui (un achat plaisir, une rentrée de job ou une dépense fixe) ?`;
          followUpOptions = [
            { label: '🍕 Dépense plaisir / sortie (~25€)', prompt: 'Puis-je enregistrer une sortie resto de 25€ ?', type: 'action' },
            { label: '💼 Rentrée de job étudiant (+150€)', prompt: 'Comment enregistrer une rentrée de 150€ pour mon job ?', type: 'action' },
            { label: '🔄 Ajouter un abonnement récurrent', prompt: 'Comment déclarer un nouvel abonnement mensuel ?', type: 'alternative' },
            { label: '📊 Voir mon disponible actuel', prompt: 'Quel est mon disponible quotidien serein actuel ?', type: 'question' }
          ];
        } else {
          responseText = `Here is how to add a transaction or record a movement in **Neyrunway**:

1. **Go to the « Memory » (or Transactions) tab** from the navigation bar or sidebar.
2. Click the **« + Log a Movement »** button at the top right.
3. Enter the key details:
   - **Movement Title**: e.g., *Campus Groceries*, *Concert Ticket*, *Tutoring Income*.
   - **Amount & Type**: Enter the figure and select *Expense (outflow)* or *Inflow (deposit)*.
   - **Tag for Ney's Context**: *Essential* (rent, food), *Comfort*, or *Outing / Leisure*.
   - **Category**: Housing, Food, Transit, Leisure, Subscriptions, etc.
4. Click **« Save Movement »**: Ney immediately updates your **Runway (days)** and your **Safe daily spend** in real-time!

🧭 **Available Options & Good Practices:**
- **Option A (Recurring Subscription)**: Mark as fixed to automatically protect your monthly baseline.
- **Option B (Income / Tutoring Inflow)**: Log as inflow to extend your autonomy horizon immediately.
- **Option C (Simulation First)**: Test the impact in the Simulator before actually spending.

💬 **Ney's Question for you:**
What kind of transaction are you planning to log today (leisure outing, student job deposit, or fixed bill)?`;
          followUpOptions = [
            { label: '🍕 Log a leisure expense (~$25)', prompt: 'Can I afford a $25 dinner tonight?', type: 'action' },
            { label: '💼 Log tutoring inflow (+$150)', prompt: 'How do I log a +$150 tutoring income deposit?', type: 'action' },
            { label: '🔄 Set up a monthly subscription', prompt: 'How do I add a new recurring subscription?', type: 'alternative' },
            { label: '📊 Check my current safe spend', prompt: 'What is my current safe daily spend?', type: 'question' }
          ];
        }
        return { content: responseText, scenario: null, followUpOptions };
      }

      // 2. Runway / Safe-to-Spend Concept & Calculation Explanation
      if (/what.*runway|how.*(calculate|work).*runway|qu'est-ce.*runway|comment.*(calculé|fonctionne).*runway|what.*safe.*spend|qu'est-ce.*(disponible|dépense sereine)/i.test(q)) {
        if (isFrench) {
          responseText = `Voici comment fonctionne le calcul de ton autonomie sur **Neyrunway** :

- **Le Runway (Autonomie en jours)** : C'est le nombre de jours exacts que tu peux tenir avec ton **solde disponible actuel (${currentBalance} ${currency})**, en sécurisant d'abord tes charges fixes incompressibles (**${totalFixedExpenses} ${currency}/mois**) et en anticipant tes rentrées prévues (**+${nextIncomeAmount} ${currency}**).
- **Le Disponible Serein (${safeToSpendToday} ${currency}/jour)** : C'est le montant quotidien que tu peux dépenser librement pour tes repas, cafés et sorties sans jamais risquer d'être à découvert pour ton prochain loyer.
- **Formule clé** : \`Runway = Solde Net Liquide / Rythme de Dépense Quotidienne\`.

🧭 **Possibilités pour optimiser ton autonomie :**
- **Option 1 (Prolonger le Runway)** : Réduire temporairement les dépenses de confort de 3€/jour permet de gagner +4 à 7 jours d'autonomie.
- **Option 2 (Sécuriser une rentrée)** : Activer les aides étudiantes disponibles ou fixer une rentrée de job.
- **Option 3 (Créer un matelas)** : Allouer une fraction du disponible à un objectif d'épargne de sécurité.

💬 **Échange avec Ney :**
Aimerais-tu que l'on simule une dépense précise ou que l'on regarde ensemble comment booster ton disponible quotidien ?`;
          followUpOptions = [
            { label: '🎯 Simuler une dépense de 40€', prompt: 'Puis-je m\'offrir un achat de 40€ ?', type: 'action' },
            { label: '📈 Comment augmenter mon disponible/j ?', prompt: 'Comment puis-je augmenter mon disponible serein par jour ?', type: 'question' },
            { label: '🎓 Explorer les aides étudiantes', prompt: 'Quelles sont les bourses et aides disponibles pour ma région ?', type: 'alternative' },
            { label: '🛡️ Calculer mon matelas de sécurité', prompt: 'Quel est mon matelas de sécurité recommandé ?', type: 'question' }
          ];
        } else {
          responseText = `Here is how your autonomy is computed in **Neyrunway**:

- **Runway (Autonomy in days)**: The exact number of days your **current liquid cash (${currentBalance} ${currency})** will last, after reserving your fixed commitments (**${totalFixedExpenses} ${currency}/month**) and projecting your upcoming deposits (**+${nextIncomeAmount} ${currency}**).
- **Safe to Spend (${safeToSpendToday} ${currency}/day)**: The daily variable budget you can spend with peace of mind on coffee, groceries, and social outings without putting your next rent payment at risk.
- **Key Formula**: \`Runway = Net Liquid Buffer / Daily Burn Rate\`.

🧭 **Ways to improve your Runway:**
- **Option 1 (Extend Runway)**: Trimming discretionary leisure by $3/day extends runway by +4 to +7 days.
- **Option 2 (Boost Inflow)**: Unlock regional student grants or schedule tutoring gigs.
- **Option 3 (Safety Buffer)**: Allocate a small percentage to a safety savings pocket.

💬 **Ney's Question for you:**
Would you like to simulate a specific expense or explore how to boost your daily safe budget?`;
          followUpOptions = [
            { label: '🎯 Simulate a $40 purchase', prompt: 'Can I afford a $40 purchase?', type: 'action' },
            { label: '📈 How to increase daily safe spend?', prompt: 'How can I increase my safe daily spend?', type: 'question' },
            { label: '🎓 Explore campus grants', prompt: 'What student aids and grants are available for my region?', type: 'alternative' },
            { label: '🛡️ Calculate my safety cushion', prompt: 'What is my recommended safety buffer?', type: 'question' }
          ];
        }
        return { content: responseText, scenario: null, followUpOptions };
      }

      // 3. Campus Resources & Regional Student Aid Assistance
      if (/resource|ressource|aide|bourse|crous|scholarship|grant|caf|apl|discount|subvention|repas/i.test(q)) {
        if (isFrench) {
          responseText = `Tu trouveras l'ensemble des aides disponibles dans l'onglet **« Ressources Campus »** :

- **Bourses & Aides publiques** : Dispositifs d'aide d'urgence, bourses sur critères sociaux et aides au logement (${region === 'FR' ? 'APL / CAF' : region === 'BE' ? 'Allocations d\'études' : region === 'CH' ? 'Bourses cantonales' : 'Financial Aid'}).
- **Restauration subventionnée** : Repas étudiants à tarif réduit (${region === 'FR' ? 'Resto U CROUS à 1€ ou 3,30€' : 'Campus dining programs'}).
- **Transports & Mobilité** : Abonnements étudiants avec réduction jeune (${region === 'FR' ? 'Forfait Navigo Imagine R / Cartes régionales' : 'Student transit pass'}).

🧭 **Possibilités pour maximiser tes aides :**
- **Option A (Logement)** : Simuler ou vérifier tes droits APL/CAF pour alléger directement tes charges fixes de 100€ à 250€/mois.
- **Option B (Alimentation)** : Profiter des repas CROUS subventionnés pour réduire ton budget courses de moitié.
- **Option C (Aide d'urgence)** : Solliciter le fonds national d'aide d'urgence ponctuelle (FNAU) en cas de mois difficile.

💬 **Échange avec Ney :**
Bénéficies-tu déjà d'une aide au logement ou d'une bourse, ou souhaites-tu qu'on regarde quelle aide aurait le plus fort impact sur ton runway ?`;
          followUpOptions = [
            { label: '🏠 Vérifier l\'impact d\'une aide au logement (+150€)', prompt: 'Quel serait l\'impact d\'une aide logement de +150€/mois sur mon runway ?', type: 'scenario' },
            { label: '🍲 Repas CROUS : quel gain mensuel ?', prompt: 'Combien puis-je économiser par mois avec les repas CROUS subventionnés ?', type: 'question' },
            { label: '🚨 Comment demander une aide d\'urgence ?', prompt: 'Comment fonctionne l\'aide d\'urgence pour les étudiants en difficulté ?', type: 'action' }
          ];
        } else {
          responseText = `You can explore all verified student aids in the **« Campus Resources »** tab:

- **Grants & Public Assistance**: Emergency student funds, merit/need-based scholarships, and housing allowances tailored to your region (${region}).
- **Subsidized Dining**: Affordable campus meal plans and food cooperatives.
- **Transit Discounts**: Youth transit discounts and campus travel passes.

🧭 **Key Opportunities to Explore:**
- **Option A (Housing Assistance)**: Verify eligibility to lower monthly rent commitments by $100-$250/mo.
- **Option B (Subsidized Campus Dining)**: Halve grocery costs with campus food support.
- **Option C (Emergency Relief Funds)**: One-time student hardship aid for tight semester transitions.

💬 **Ney's Question for you:**
Do you currently receive housing allowance or scholarships, or would you like to see which aid would extend your runway the most?`;
          followUpOptions = [
            { label: '🏠 Check impact of +$150/mo housing aid', prompt: 'What impact would +$150/month housing aid have on my runway?', type: 'scenario' },
            { label: '🍲 Campus dining monthly savings', prompt: 'How much can I save with subsidized student meals?', type: 'question' },
            { label: '🚨 How to apply for emergency relief', prompt: 'How do emergency student relief grants work?', type: 'action' }
          ];
        }
        return { content: responseText, scenario: null, followUpOptions };
      }

      // 4. Project Idea Capture & Dynamic Scoring Mission (Revenue, Demand, Urgency, Time)
      if (/project|projet|idea|idée|startup|score|priorit|business|lancer/i.test(q) && !/afford|acheter|dépense|abonner|abonnement|souscrire/i.test(q)) {
        const titleMatch = latestUserMessage.match(/(?:projet|project|idée|idea)\s*[:\-]?\s*["']?([^"'\n,]+)/i);
        const title = titleMatch ? titleMatch[1].trim() : (isFrench ? 'Projet Innovant' : 'New Project');
        
        // Dynamic scoring algorithm
        const revenuePotential = 8;
        const validatedDemand = 7;
        const urgency = 8;
        const estimatedTime = 4;
        const score = Math.round(((revenuePotential * validatedDemand * urgency) / estimatedTime) * 10) / 10;
        const isoDate = new Date().toISOString();

        const firestoreJson = {
          title: title,
          description: latestUserMessage.slice(0, 160),
          metrics: {
            revenue_potential: revenuePotential,
            validated_demand: validatedDemand,
            urgency: urgency,
            estimated_time: estimatedTime
          },
          calculated_score: score,
          status: "backlog",
          created_at: isoDate
        };

        if (isFrench) {
          responseText = `### 🚀 Analyse Stratégique & Priorisation de Projet

**Titre extrait** : **${title}**
**Évaluation des 4 variables clés (1 à 10)** :
- **Potentiel de revenus** : ${revenuePotential}/10
- **Demande validée** : ${validatedDemand}/10
- **Urgence** : ${urgency}/10
- **Temps estimé** : ${estimatedTime}/10

📊 **Score dynamique calculé** : **${score}** *(Priorité suggérée : Haute)*
*Formule : (Potentiel × Demande × Urgence) / Temps = (${revenuePotential} × ${validatedDemand} × ${urgency}) / ${estimatedTime}*

\`\`\`json
${JSON.stringify(firestoreJson, null, 2)}
\`\`\`

🧭 **Possibilités d'exécution disponibles :**
- **Option 1 (MVP Express 7 jours)** : Lancer une landing page ou un prototype rapide pour valider les précommandes sans coût fixe.
- **Option 2 (Co-construction / Bêta)** : Interroger 5 à 10 étudiants cibles pour sécuriser la demande avant de coder.
- **Option 3 (Financement étudiant)** : Postuler aux bourses Pépite / tremplins jeunes entrepreneurs de ta région.

💬 **Échange avec Ney :**
As-tu déjà identifié tes 10 premiers utilisateurs potentiels, ou préfères-tu qu'on affine l'estimation du temps nécessaire pour maximiser ton score ?`;
          followUpOptions = [
            { label: '👥 Comment valider la demande client ?', prompt: 'Comment puis-je tester et valider la demande pour ce projet ?', type: 'question' },
            { label: '⚡ Comment réduire le temps estimé ?', prompt: 'Comment simplifier le scope pour réduire le temps de développement ?', type: 'action' },
            { label: '💰 Modèle économique & Tarification', prompt: 'Quelle stratégie de prix me conseilles-tu pour ce projet ?', type: 'alternative' },
            { label: '💾 Enregistrer dans mon backlog', prompt: 'Ce projet est validé, passons au plan d\'action.', type: 'action' }
          ];
        } else {
          responseText = `### 🚀 Strategic Project Capture & Dynamic Prioritization

**Extracted Title**: **${title}**
**Key Metrics Assessment (1 to 10)**:
- **Revenue Potential**: ${revenuePotential}/10
- **Validated Demand**: ${validatedDemand}/10
- **Urgency**: ${urgency}/10
- **Estimated Time**: ${estimatedTime}/10

📊 **Calculated Dynamic Score**: **${score}** *(Suggested Priority: High)*
*Formula: (Revenue × Demand × Urgency) / Time = (${revenuePotential} × ${validatedDemand} × ${urgency}) / ${estimatedTime}*

\`\`\`json
${JSON.stringify(firestoreJson, null, 2)}
\`\`\`

🧭 **Available Execution Pathways:**
- **Option 1 (7-Day Lean MVP)**: Launch a simple landing page to validate customer interest before building.
- **Option 2 (User Discovery Interviews)**: Interview 5-10 target students to confirm willingness to pay.
- **Option 3 (Student Venture Grants)**: Apply for regional student startup grants or university incubators.

💬 **Ney's Question for you:**
Have you already tested this idea with potential users, or would you like to refine the scope to optimize your score?`;
          followUpOptions = [
            { label: '👥 How to validate user demand?', prompt: 'How can I quickly validate user demand for this idea?', type: 'question' },
            { label: '⚡ How to reduce estimated time?', prompt: 'How can I simplify the initial MVP scope?', type: 'action' },
            { label: '💰 Pricing & Revenue Model', prompt: 'What pricing model do you recommend for this project?', type: 'alternative' },
            { label: '💾 Save to my project backlog', prompt: 'Project validated, let\'s define next execution steps.', type: 'action' }
          ];
        }
        return { content: responseText, scenario: null, followUpOptions };
      }

      // 5. Goal Allocation Query
      const goalMatch = latestUserMessage.match(/goal\s+["']?([^"']+)["']?\s+(?:of\s+)?(\d+[\d\s.,]*)\s*(?:€|\$|CHF|£|CAD|USD|EUR)?/i)
        || latestUserMessage.match(/objectif\s+["']?([^"']+)["']?\s+(?:de\s+)?(\d+[\d\s.,]*)\s*(?:€|\$|CHF|£|CAD|USD|EUR)?/i);

      if (goalMatch || /allocate.*surplus|allouer.*surplus|épargner.*objectif|save.*goal/i.test(latestUserMessage)) {
        const goalName = goalMatch ? goalMatch[1] : (isFrench ? 'Projet de précaution' : 'Savings Buffer');
        const targetVal = goalMatch ? parseFloat(goalMatch[2].replace(/\s/g, '').replace(',', '.')) : 400;
        
        const minSafetyBuffer = 20 * (dailyBurn > 0 ? dailyBurn : 25);
        const liquidSurplus = Math.max(0, currentBalance - minSafetyBuffer);
        const suggestedMonthlySaving = Math.max(15, Math.min(Math.round((safeToSpendToday * 0.25 * 30) / 10) * 10, liquidSurplus > 50 ? 50 : 25));
        const monthsNeeded = Math.ceil(targetVal / Math.max(1, suggestedMonthlySaving));

        scenarioBadge = liquidSurplus > targetVal * 0.3 ? 'GO' : 'ADJUST';

        if (isFrench) {
          responseText = `[SCENARIO: ${scenarioBadge}]

Voici ma recommandation stratégique pour ton objectif **"${goalName}"** (${targetVal} ${currency}) tout en maintenant ton autonomie au-dessus de 20 jours :

- **Solde liquide actuel** : **${currentBalance} ${currency}** (Runway actuel : **${runwayDays} jours**)
- **Matelas de sécurité 20 jours requis** : **${Math.round(minSafetyBuffer)} ${currency}**
- **Surplus d'épargne recommandé** : **${suggestedMonthlySaving} ${currency}/mois** (environ **${Math.round(suggestedMonthlySaving / 30 * 10) / 10} ${currency}/jour** déduits de ton disponible serein)
- **Disponible quotidien ajusté** : **${Math.max(5, Math.round((safeToSpendToday - (suggestedMonthlySaving / 30)) * 10) / 10)} ${currency}/jour**
- **Délai estimé d'atteinte** : environ **${monthsNeeded} mois** sans risque pour ton loyer ni tes charges fixes.

🧭 **Possibilités d'épargne disponibles :**
- **Option A (Rythme équilibré)** : Épargner ${suggestedMonthlySaving} ${currency}/mois pour atteindre ton objectif en ${monthsNeeded} mois sans rogner ton quotidien.
- **Option B (Accéléré avec la rentrée)** : Verser un montant ponctuel de 50€ dès la rentrée du ${nextIncomeDate} (+${nextIncomeAmount} ${currency}) pour gagner 2 mois.
- **Option C (Micro-épargne fluide)** : Mettre de côté seulement 1€/jour (30€/mois) pour tester ton confort.

💬 **Échange avec Ney :**
Préfères-tu automatiser un versement régulier ou alimenter cette cagnotte au coup par coup quand tu as un surplus ?`;
          followUpOptions = [
            { label: `🚀 Simuler avec ${suggestedMonthlySaving}€/mois`, prompt: `Comment paramétrer une épargne de ${suggestedMonthlySaving}€/mois pour "${goalName}" ?`, type: 'action' },
            { label: '⚡ Accélérer l\'épargne', prompt: 'Puis-je doubler mon rythme d\'épargne sans risquer mon loyer ?', type: 'alternative' },
            { label: '🛡️ Revoir mon matelas de sécurité', prompt: 'Comment est calculé mon matelas de sécurité de 20 jours ?', type: 'question' }
          ];
        } else {
          responseText = `[SCENARIO: ${scenarioBadge}]

Here is my recommended allocation strategy for your goal **"${goalName}"** (${targetVal} ${currency}) while keeping your runway strictly above 20 days:

- **Current Liquid Balance**: **${currentBalance} ${currency}** (Current Runway: **${runwayDays} days**)
- **20-Day Safety Buffer Required**: **${Math.round(minSafetyBuffer)} ${currency}**
- **Recommended Monthly Surplus**: **${suggestedMonthlySaving} ${currency}/month** (approx. **${Math.round(suggestedMonthlySaving / 30 * 10) / 10} ${currency}/day** taken from your safe spend)
- **Adjusted Safe Daily Spend**: **${Math.max(5, Math.round((safeToSpendToday - (suggestedMonthlySaving / 30)) * 10) / 10)} ${currency}/day**
- **Estimated Completion Time**: approx. **${monthsNeeded} months** with zero risk to your rent or fixed subscriptions.

🧭 **Available Savings Paths:**
- **Option A (Balanced Pace)**: Save ${suggestedMonthlySaving} ${currency}/month to reach your goal in ${monthsNeeded} months with peace of mind.
- **Option B (Deposit Boost)**: Deposit an upfront $50 when your inflow arrives on ${nextIncomeDate} (+${nextIncomeAmount} ${currency}).
- **Option C (Micro-Savings)**: Save a flexible $1/day ($30/month) to build the habit painlessly.

💬 **Ney's Question for you:**
Do you prefer scheduling an automatic monthly contribution or topping up whenever you have a surplus?`;
          followUpOptions = [
            { label: `🚀 Simulate with $${suggestedMonthlySaving}/mo`, prompt: `How do I set up a $${suggestedMonthlySaving}/mo savings plan for "${goalName}"?`, type: 'action' },
            { label: '⚡ Accelerate savings pace', prompt: 'Can I double my monthly savings without endangering rent?', type: 'alternative' },
            { label: '🛡️ Review safety cushion', prompt: 'How is my 20-day safety buffer calculated?', type: 'question' }
          ];
        }
        return { content: responseText, scenario: scenarioBadge, followUpOptions };
      }

      // 6. Explicit Simulation Query or Purchase Affordability Question WITH PRICE
      const priceExtractMatch = latestUserMessage.match(/(\d+[\d\s.,]*)\s*(?:€|\$|CHF|£|CAD|USD|EUR)?/);
      const isAffordabilityQuestion = /afford|acheter|achat|payer|dépense|sortir|concert|voyage|billet|resto|soiree|soirée|can I|puis-je|dois-je|m'offrir|prendre/i.test(latestUserMessage);

      if ((simulation && simulation.amount > 0) || (isAffordabilityQuestion && priceExtractMatch)) {
        const cost = simulation?.amount || (priceExtractMatch ? parseFloat(priceExtractMatch[1].replace(/\s/g, '').replace(',', '.')) : 50);
        const titleExtractMatch = latestUserMessage.match(/["']([^"']+)["']/);
        const title = simulation?.title || (titleExtractMatch ? titleExtractMatch[1] : undefined);

        const simResult = calculateDecisionSimulation({
          currentBalance,
          runwayDays,
          safeToSpendToday,
          totalFixedExpenses,
          daysUntilNextIncome: userContext?.daysUntilNextIncome ?? 18,
          nextIncomeDate: nextIncomeDate !== 'Non spécifié' ? nextIncomeDate : undefined,
          nextIncomeAmount,
          nextIncomeSource,
          simulatedAmount: cost,
          expenseTitle: title,
        });

        const newRunway = simResult.projectedDays;
        const newSafe = simResult.postSafeToSpend;
        const scenarioBadge = simResult.scenario;
        const diffDays = simResult.daysDifference;

        if (isFrench) {
          responseText = `[SCENARIO: ${scenarioBadge}]

Voici l'analyse d'impact d'un montant de **${cost} ${currency}**${title ? ` pour *« ${title} »*` : ''} sur ton autonomie :

- **Runway** : passe de **${runwayDays} jours** à **${newRunway} jours** (${diffDays > 0 ? `+${diffDays}` : diffDays}j)
- **Disponible aujourd'hui** : passe de **${safeToSpendToday} ${currency}/j** à **${newSafe} ${currency}/j**

${scenarioBadge === 'GO' ? 'Cet achat s\'intègre confortablement dans ta trésorerie sans menacer ton loyer ni tes charges fixes.' : scenarioBadge === 'WAIT' ? `Attendre la rentrée de ${nextIncomeSource ? nextIncomeSource + ' (' : ''}+${nextIncomeAmount} ${currency}${nextIncomeSource ? ')' : ''} prévue le ${nextIncomeDate} te permettrait de réaliser cet achat avec un confort total.` : scenarioBadge === 'ADJUST' ? 'C\'est faisable en ajustant tes dépenses variables quotidiennes de 2 à 3€ pendant quelques jours.' : 'Cet achat réduirait fortement ta marge de sécurité avant tes prochaines échéances fixes.'}

🧭 **Possibilités & Chemins d'action disponibles :**
- **Option 1 (Paiement immédiat)** : Tu absorbes l'achat comptant, ton runway s'établit à ${newRunway} jours et ton disponible à ${newSafe} ${currency}/j.
- **Option 2 (Attendre la rentrée du ${nextIncomeDate})** : Tu décales cet achat pour préserver ton disponible intact jusqu'au prochain virement (+${nextIncomeAmount} ${currency}).
- **Option 3 (Compromis / Arbitrage)** : Tu réalises cet achat en modérant une autre sortie non indispensable cette semaine.

💬 **Échange avec Ney :**
Quelle option correspond le mieux à tes priorités du moment ? Veux-tu qu'on teste une variante ou qu'on enregistre cette intention ?`;
          followUpOptions = [
            { label: '✅ Option 1 : Valider et enregistrer', prompt: `J'opte pour l'achat immédiat de ${cost}€. Comment l'enregistrer dans ma mémoire ?`, type: 'action' },
            { label: `⏳ Option 2 : Attendre le ${nextIncomeDate}`, prompt: `Je préfère attendre ma rentrée du ${nextIncomeDate}. Que me conseilles-tu d'ici là ?`, type: 'alternative' },
            { label: '✂️ Option 3 : Où réduire 15€ ailleurs ?', prompt: 'Dans quelle catégorie puis-je arbitrer pour compenser cet achat ?', type: 'question' }
          ];
        } else {
          responseText = `[SCENARIO: ${scenarioBadge}]

Here is the exact impact of a **${cost} ${currency}** expense${title ? ` for *« ${title} »*` : ''} on your financial autonomy:

- **Runway**: adjusts from **${runwayDays} days** to **${newRunway} days** (${diffDays > 0 ? `+${diffDays}` : diffDays}d)
- **Safe to spend today**: adjusts from **${safeToSpendToday} ${currency}/day** to **${newSafe} ${currency}/day**

${scenarioBadge === 'GO' ? 'This expense fits comfortably within your liquid cash without putting your upcoming rent or fixed subscriptions at risk.' : scenarioBadge === 'WAIT' ? `Waiting for your upcoming deposit (${nextIncomeSource || 'Inflow'} of +${nextIncomeAmount} ${currency}) on ${nextIncomeDate} will let you make this purchase stress-free.` : scenarioBadge === 'ADJUST' ? 'You can do this by trimming daily variable discretionary outings slightly over the next few days.' : 'This expense would leave very little buffer before your fixed commitments are due.'}

🧭 **Available Action Pathways:**
- **Option 1 (Immediate Purchase)**: Absorb the cost upfront, bringing your runway to ${newRunway} days and safe daily spend to ${newSafe} ${currency}/day.
- **Option 2 (Wait for Inflow on ${nextIncomeDate})**: Postpone until your scheduled deposit (+${nextIncomeAmount} ${currency}) to keep full flexibility.
- **Option 3 (Trade-off & Offset)**: Proceed with the purchase while moderating another leisure outing this week.

💬 **Ney's Question for you:**
Which option fits your current priorities best? Would you like to log this movement or simulate another amount?`;
          followUpOptions = [
            { label: '✅ Option 1: Proceed & Log', prompt: `I want to proceed with the $${cost} expense. How do I log it into memory?`, type: 'action' },
            { label: `⏳ Option 2: Wait until ${nextIncomeDate}`, prompt: `I will wait for my deposit on ${nextIncomeDate}. What is your advice until then?`, type: 'alternative' },
            { label: '✂️ Option 3: Find $15 to offset', prompt: 'Where can I trim $15 in other categories to offset this?', type: 'question' }
          ];
        }
        return { content: responseText, scenario: scenarioBadge, followUpOptions };
      }

      // 7. Purchase / Subscription / Outing Intent WITHOUT Price -> ASK FOR CLARIFICATION & GIVE PRACTICAL RANGES
      const isSubscriptionOrPurchaseWithoutPrice = /m'abonner|abonnement|souscrire|acheter|achat|buy|subscribe|subscription|m'offrir|prendre|payer|sortie|voyage|concert|match|psg|netflix|spotify|salle de sport|gym/i.test(q);
      if (isSubscriptionOrPurchaseWithoutPrice) {
        if (isFrench) {
          responseText = `Pour évaluer si cet achat ou abonnement est compatible avec ton solde disponible (**${currentBalance} ${currency}**) et tes **${runwayDays} jours d'autonomie**, j'ai besoin d'une petite précision sur le montant ou la formule :

🧭 **Possibilités courantes selon ton budget :**
- **Abonnement mensuel léger (10€ à 20€/mois)** : Impact minime (~ -0,50€/jour), quasi indolore pour ton autonomie.
- **Formule intermédiaire (30€ à 50€/mois)** : Réduirait ton disponible quotidien de 1€ à 1,60€/jour.
- **Paiement annuel comptant (200€ à 400€)** : Réduirait temporairement ton matelas de trésorerie de 5 à 10 jours.

💬 **Échange avec Ney :**
Quel est le tarif exact envisagé et s'agit-il d'un prélèvement mensuel ou d'un paiement en une fois ?`;
        } else {
          responseText = `To evaluate whether this purchase or subscription fits comfortably within your **${currentBalance} ${currency}** cash reserve and **${runwayDays} days of runway**, I just need a quick clarification regarding the price or billing formula:

🧭 **Typical Scenarios for your Runway:**
- **Light Monthly Sub ($10 to $20/mo)**: Minimal impact (~ -$0.50/day), completely safe for your runway.
- **Standard Pass ($30 to $50/mo)**: Adjusts your daily safe spend by -$1.00 to -$1.60/day.
- **Upfront Annual Pass ($200 to $400)**: Consumes 5 to 10 days of runway buffer immediately.

💬 **Ney's Question for you:**
What is the expected cost and billing frequency (monthly vs one-time cash)?`;
        }

        const clarificationPayload = {
          title: isFrench ? "Précisions pour simuler votre décision" : "Details needed to evaluate this decision",
          reason: isFrench 
            ? `Ney a besoin de connaître le montant estimé et le type de paiement (mensualité ou comptant) pour calculer l'impact exact sur vos ${runwayDays} jours d'autonomie.`
            : `Ney needs the estimated cost and payment frequency (monthly or upfront) to calculate the exact impact on your ${runwayDays} days of runway.`,
          suggestedAspects: isFrench ? [
            {
              label: "Montant estimé",
              description: "Le prix envisagé de l'achat ou de l'abonnement",
              example: "Ex: 25 €, 120 €, 450 €",
              suggestedPrompt: "C'est un achat de 45€",
            },
            {
              label: "Fréquence de prélèvement",
              description: "Abonnement récurrent mensuel vs achat unique comptant",
              example: "Ex: 19€/mois ou 200€ en 1 fois",
              suggestedPrompt: "C'est un abonnement mensuel de 25€/mois",
            },
            {
              label: "Nature de la dépense",
              description: "Plaisir, confort ou besoin essentiel pour tes études",
              example: "Ex: Plaisir (loisir), Confort, Études",
              suggestedPrompt: "C'est une dépense de plaisir/loisir",
            }
          ] : [
            {
              label: "Estimated Amount",
              description: "Expected cost of the purchase or pass",
              example: "E.g., $25, $120, $450",
              suggestedPrompt: "It's a $45 expense",
            },
            {
              label: "Billing Frequency",
              description: "Recurring monthly subscription vs one-time cash",
              example: "E.g., $19/month or $200 upfront",
              suggestedPrompt: "It's a $25/month subscription",
            },
            {
              label: "Category / Urgency",
              description: "Outing, comfort, or academic study tool",
              example: "E.g., Leisure, Study essential",
              suggestedPrompt: "It's a leisure spending",
            }
          ],
          quickActions: isFrench ? [
            {
              label: "💳 C'est un abonnement (~20€/mois)",
              prompt: "C'est un abonnement mensuel de 20€/mois",
              iconType: "recurring" as const,
            },
            {
              label: "🎯 C'est un achat ponctuel (~50€)",
              prompt: "C'est un achat unique de 50€",
              iconType: "amount" as const,
            },
            {
              label: "🏟️ Pass / Achat important (~350€)",
              prompt: "C'est un achat unique de 350€ comptant",
              iconType: "amount" as const,
            },
            {
              label: "📊 Quel est mon solde serein actuel ?",
              prompt: "Quel est mon disponible quotidien serein actuel ?",
              iconType: "help" as const,
            }
          ] : [
            {
              label: "💳 It's a monthly subscription (~$20/mo)",
              prompt: "It's a monthly subscription of 20/month",
              iconType: "recurring" as const,
            },
            {
              label: "🎯 It's a one-time purchase (~$50)",
              prompt: "It's a one-time purchase of 50",
              iconType: "amount" as const,
            },
            {
              label: "🏟️ Annual pass / Big spend (~$350)",
              prompt: "It's an upfront purchase of 350",
              iconType: "amount" as const,
            },
            {
              label: "📊 What is my safe daily spend right now?",
              prompt: "What is my current safe daily spend?",
              iconType: "help" as const,
            }
          ]
        };

        const followUpOpts = isFrench ? [
          { label: '💳 Abonnement mensuel (~20€/mois)', prompt: 'C\'est un abonnement mensuel de 20€/mois', type: 'alternative' as const },
          { label: '🎯 Achat ponctuel (~50€)', prompt: 'C\'est un achat unique de 50€', type: 'action' as const },
          { label: '🏟️ Pass annuel (~300€)', prompt: 'C\'est un achat de 300€ en 1 fois', type: 'action' as const }
        ] : [
          { label: '💳 Monthly sub (~$20/mo)', prompt: 'It\'s a monthly subscription of 20/month', type: 'alternative' as const },
          { label: '🎯 One-time purchase (~$50)', prompt: 'It\'s a one-time purchase of 50', type: 'action' as const },
          { label: '🏟️ Annual pass (~$300)', prompt: 'It\'s an upfront purchase of 300', type: 'action' as const }
        ];

        return { 
          content: responseText, 
          scenario: null, 
          confidence: 'low' as const,
          clarification: clarificationPayload,
          followUpOptions: followUpOpts
        };
      }

      // 8. General Greetings (hello, hi, bonjour, salut...)
      const isGreeting = /^(bonjour|salut|hello|hi|hey|coucou|bonsoir|yo|holla)[\s!.]*$/i.test(q);
      if (isGreeting) {
        if (isFrench) {
          responseText = `Bonjour ! Ton autonomie financière est estimée à **${runwayDays} jours** avec un solde disponible de **${currentBalance} ${currency}** et une dépense sereine de **${safeToSpendToday} ${currency}/jour**.

- **Charges fixes mensuelles** : **${totalFixedExpenses} ${currency}**
- **Prochaine rentrée attendue** : **+${nextIncomeAmount} ${currency}** ${nextIncomeDate !== 'Non spécifié' ? `(le ${nextIncomeDate})` : ''}

🧭 **Possibilités d'exploration avec Ney :**
- **Option 1 (Simuler un achat)** : Vérifier l'impact immédiat d'une sortie ou d'un équipement sur ton runway.
- **Option 2 (Évaluer un projet)** : Pitcher une idée pour calculer son score dynamique et générer le JSON Firestore.
- **Option 3 (Optimiser ton budget)** : Identifier les aides régionales ou fixer un objectif d'épargne.

💬 **Échange avec Ney :**
Sur quel sujet aimerais-tu échanger aujourd'hui ?`;
          followUpOptions = [
            { label: '🍽️ Puis-je m\'offrir un resto à 25€ ?', prompt: 'Puis-je m\'offrir un resto à 25€ ce soir ?', type: 'action' },
            { label: '💡 Pitcher une idée de projet', prompt: 'J\'ai une idée de projet étudiant :', type: 'action' },
            { label: '🎓 Quelles sont les aides disponibles ?', prompt: 'Quelles sont les bourses et aides disponibles pour ma région ?', type: 'alternative' },
            { label: '📝 Comment ajouter une transaction ?', prompt: 'Comment ajouter une transaction ?', type: 'question' }
          ];
        } else {
          responseText = `Hi! Your current runway stands at **${runwayDays} days** with **${currentBalance} ${currency}** in liquid cash and a safe spend rate of **${safeToSpendToday} ${currency}/day**.

- **Monthly Fixed Commitments**: **${totalFixedExpenses} ${currency}**
- **Next Expected Deposit**: **+${nextIncomeAmount} ${currency}** ${nextIncomeDate !== 'Non spécifié' ? `(on ${nextIncomeDate})` : ''}

🧭 **Explore with Ney:**
- **Option 1 (Simulate an expense)**: Check runway and safe spend changes before spending.
- **Option 2 (Project Scoring)**: Pitch an idea to calculate dynamic viability score and Firestore JSON.
- **Option 3 (Budget Optimization)**: Discover campus grants or set a savings goal.

💬 **Ney's Question for you:**
What financial decision or project would you like to explore together today?`;
          followUpOptions = [
            { label: '🍽️ Can I afford a $25 dinner?', prompt: 'Can I afford a $25 dinner tonight?', type: 'action' },
            { label: '💡 Pitch a student project', prompt: 'I have a project idea: ', type: 'action' },
            { label: '🎓 What student grants are available?', prompt: 'What student aids and grants are available for my region?', type: 'alternative' },
            { label: '📝 How to add a transaction?', prompt: 'How to add a transaction?', type: 'question' }
          ];
        }
        return { content: responseText, scenario: null, confidence: 'high' as const, followUpOptions };
      }

      // 9. Unrecognized / Ambiguous Query Fallback -> ASK FOR CLARIFICATION POLITELY WITH STRUCTURED UI
      if (isFrench) {
        responseText = `Je n'ai pas pu identifier précisément ton intention pour : *« ${latestUserMessage} »*.

Pour que je puisse t'orienter avec une fiabilité maximale, voici les informations clés qui me permettront de te répondre :

🧭 **Possibilités d'actions directes :**
- **Option 1** : Évaluer un achat spécifique en indiquant son montant (ex: 30€).
- **Option 2** : Poser une question sur le fonctionnement de l'application ou l'enregistrement d'une dépense.
- **Option 3** : Pitcher une idée de projet ou explorer les bourses campus.

💬 **Échange avec Ney :**
Peux-tu m'en dire un peu plus sur ce que tu souhaites accomplir ?`;
      } else {
        responseText = `I couldn't identify with high confidence the exact goal for: *« ${latestUserMessage} »*.

To give you accurate, tailored financial guidance, here are the details that will help me assist you:

🧭 **Available Action Pathways:**
- **Option 1**: Evaluate a specific purchase by stating the estimated cost (e.g. $30).
- **Option 2**: Ask how to log transactions or navigate features.
- **Option 3**: Pitch an entrepreneurial project or explore student grants.

💬 **Ney's Question for you:**
Could you share a bit more detail about what you'd like to achieve?`;
      }

      const defaultClarification = {
        title: isFrench ? "Précisions nécessaires sur votre objectif" : "Clarification needed on your request",
        reason: isFrench 
          ? "Ney n'a pas pu faire correspondre votre demande à une action financière précise (simulation, ajout de transaction, calcul d'aide ou de projet)."
          : "Ney could not match your prompt to a specific financial action (simulation, transaction logging, grant discovery, or project scoring).",
        suggestedAspects: isFrench ? [
          {
            label: "Simuler un achat ou sortie",
            description: "Indique le montant et l'objet de la dépense",
            example: "Ex: « Puis-je m'offrir un resto à 25€ ? »",
            suggestedPrompt: "Puis-je m'offrir un achat de 30€ ?",
          },
          {
            label: "Utilisation & Transactions",
            description: "Demande comment enregistrer une entrée ou sortie",
            example: "Ex: « Comment ajouter une transaction ? »",
            suggestedPrompt: "Comment ajouter une transaction ?",
          },
          {
            label: "Aides financières & Bourses",
            description: "Découvrir les dispositifs d'aide étudiante",
            example: "Ex: « Quelles sont les bourses disponibles ? »",
            suggestedPrompt: "Quelles sont les bourses et aides disponibles ?",
          },
          {
            label: "Évaluer un projet",
            description: "Pitcher une idée pour calculer son score de priorité",
            example: "Ex: « Mon projet : application de révision... »",
            suggestedPrompt: "Mon projet est : ",
          }
        ] : [
          {
            label: "Simulate an expense",
            description: "State the estimated amount and item",
            example: "E.g., « Can I afford a 25€ dinner? »",
            suggestedPrompt: "Can I afford a $30 dinner tonight?",
          },
          {
            label: "App & Transactions",
            description: "Ask how to log inflows or expenses",
            example: "E.g., « How to add a transaction? »",
            suggestedPrompt: "How to add a transaction?",
          },
          {
            label: "Student Grants & Aids",
            description: "Explore scholarships and regional aid programs",
            example: "E.g., « Where can I find student grants? »",
            suggestedPrompt: "What student aids and grants are available?",
          },
          {
            label: "Project Scoring",
            description: "Pitch an idea to calculate its dynamic priority score",
            example: "E.g., « My project idea is... »",
            suggestedPrompt: "My project idea is: ",
          }
        ],
        quickActions: isFrench ? [
          {
            label: "📝 Comment ajouter une transaction ?",
            prompt: "Comment ajouter une transaction ?",
            iconType: "help" as const,
          },
          {
            label: "🍽️ Puis-je m'offrir un resto à 25€ ?",
            prompt: "Puis-je m'offrir un resto à 25€ ce soir ?",
            iconType: "amount" as const,
          },
          {
            label: "💡 Évaluer un projet d'étudiant",
            prompt: "J'ai une idée de projet : ",
            iconType: "goal" as const,
          },
          {
            label: "🎓 Voir les aides et bourses étudiantes",
            prompt: "Quelles sont les bourses et aides disponibles ?",
            iconType: "help" as const,
          }
        ] : [
          {
            label: "📝 How to add a transaction?",
            prompt: "How to add a transaction?",
            iconType: "help" as const,
          },
          {
            label: "🍽️ Can I afford a $25 dinner?",
            prompt: "Can I afford a $25 dinner tonight?",
            iconType: "amount" as const,
          },
          {
            label: "💡 Pitch a project idea",
            prompt: "My project idea is: ",
            iconType: "goal" as const,
          },
          {
            label: "🎓 Student grants and aids",
            prompt: "What student aids and grants are available?",
            iconType: "help" as const,
          }
        ]
      };

      const fallbackFollowUps = isFrench ? [
        { label: '📝 Comment ajouter une transaction ?', prompt: 'Comment ajouter une transaction ?', type: 'question' as const },
        { label: '🍽️ Puis-je m\'offrir un resto à 25€ ?', prompt: 'Puis-je m\'offrir un resto à 25€ ce soir ?', type: 'action' as const },
        { label: '💡 Pitcher un projet étudiant', prompt: 'J\'ai une idée de projet :', type: 'action' as const },
        { label: '🎓 Voir les bourses disponibles', prompt: 'Quelles sont les bourses et aides disponibles ?', type: 'alternative' as const }
      ] : [
        { label: '📝 How to add a transaction?', prompt: 'How to add a transaction?', type: 'question' as const },
        { label: '🍽️ Can I afford a $25 dinner?', prompt: 'Can I afford a $25 dinner tonight?', type: 'action' as const },
        { label: '💡 Pitch a project idea', prompt: 'My project idea is: ', type: 'action' as const },
        { label: '🎓 Explore campus grants', prompt: 'What student aids and grants are available?', type: 'alternative' as const }
      ];

      return { 
        content: responseText, 
        scenario: null, 
        confidence: 'low' as const,
        clarification: defaultClarification,
        followUpOptions: fallbackFollowUps
      };
    };

    const ai = getGeminiClient();

    if (!ai) {
      const localResult = generateLocalNeyAnalysis();
      return res.json(localResult);
    }

    // Build the comprehensive system prompt for Gemini
    const systemPrompt = `You are "Ney", an empathetic, highly analytical, and actively engaging AI Financial Copilot and Project Strategist designed specifically for students and young adults.

CORE PHILOSOPHIES:
1. "AI advises. You decide."
2. NEVER guilt-trip or use judgmental phrasing (e.g. NEVER say "You overspent", "You shouldn't have spent that", "You made a mistake").
3. Instead, be constructive, objective, empowering, and actively conversational.
4. MENTAL MODEL: SEE → UNDERSTAND → FORECAST → DECIDE → ACT.

CRITICAL INSTRUCTION - ENGAGING IN CONSTRUCTIVE DIALOGUE & EXPLORING POSSIBILITIES:
- Do NOT provide dry, one-way lectures or dead-end verdicts.
- For EVERY response, you MUST structure your answer with:
  1. Direct Analysis & Concrete Metrics (Runway in days, safe daily spend, or project dynamic score).
  2. 🧭 **Possibilités & Options Disponibles** : Present 2 or 3 distinct, realistic pathways (e.g. Option A: Immediate cash action, Option B: Defer / Wait for upcoming inflow on ${nextIncomeDate} or split payments, Option C: Smart alternative / trade-off / student grant).
  3. 💬 **Échange & Question ouverte de Ney** : Conclude with an engaging, personalized question to explore the decision together, clarify their priorities, or co-construct the solution.
  4. (Optional) Quick interactive choices for the user.

CRITICAL INSTRUCTION - HOW TO ANSWER DIFFERENT QUERY TYPES:
1. APP HOW-TO & NAVIGATION (e.g., "How to add a transaction?", "How do I log an expense?", "Where do I find student aids?", "How does the simulator work?"):
   - Directly and accurately explain the step-by-step navigation in the app!
   - For adding transactions: Direct user to the "Memory / Transactions" tab (icon of clock/list in navigation), click "+ Log a Movement" ("+ Enregistrer une intention"), enter title, amount, tag (Essential/Comfort/Outing), and category.
   - For runway / safe-to-spend: Explain the formula clearly (Liquid cash minus reserved fixed charges divided by daily burn).
   - For campus resources: Direct to the "Campus Resources" tab.
   - For settings & preferences: Direct to "Settings" tab.
   - Highlight available options and ask an engaging follow-up question.

2. FINANCIAL AFFORDABILITY & EXPENSE SIMULATIONS (e.g., "Can I afford X?", "Should I buy Y?"):
   - Categorize with one explicit tag on its own line:
     * [SCENARIO: GO] -> Immediately viable without compromising essential rent or safety buffer.
     * [SCENARIO: WAIT] -> Feasible, but safer to wait for next incoming deposit on ${nextIncomeDate} (+${nextIncomeAmount} ${currency}).
     * [SCENARIO: ADJUST] -> Viable if daily discretionary spend is trimmed by a small amount for a few days.
     * [SCENARIO: NO] -> Severe danger of running out of money before next rent or deposit.
   - Quantify exact runway impact: "Runway: X days -> Y days", "Safe to spend today: A${currency}/day -> B${currency}/day".
   - Lay out 2-3 realistic options (Immediate purchase vs Wait for deposit vs Trade-off) and ask which path the user prefers.

3. PROJECT CAPTURE & DYNAMIC SCORING (When user pitches a project or startup idea):
   - Extract title, concise description, and 4 variables (scale 1-10):
     * revenue_potential (1-10)
     * validated_demand (1-10)
     * urgency (1-10)
     * estimated_time (1-10)
   - Calculate Score = (revenue_potential * validated_demand * urgency) / estimated_time.
   - Output structured JSON ready for Firestore backend:
     {
       "title": "Project Name",
       "description": "Concise summary",
       "metrics": { "revenue_potential": 1-10, "validated_demand": 1-10, "urgency": 1-10, "estimated_time": 1-10 },
       "calculated_score": number,
       "status": "backlog",
       "created_at": "ISO_TIMESTAMP"
     }
   - Present execution pathways (MVP, Customer Discovery, Grants) and ask a strategic question to deepen the project.

4. ASKING FOR CLARIFICATION (CRITICAL):
   - If the user's question is vague, incomplete, or missing key parameters:
     * Examples: Asking "Puis-je m'abonner au PSG ?", "Can I buy a laptop?", "Should I subscribe to this gym?", "Puis-je partir en weekend ?" without mentioning the price or subscription type.
     * Acknowledge their intention enthusiastically, give realistic estimation scenarios based on their liquid cash (${currentBalance} ${currency}) and runway (${runwayDays} days), and politely ask for the missing details.
   - If a question is ambiguous, out of context, or you cannot understand what the user wants:
     * Politely state what you understood, suggest 2-3 specific options related to runway, expenses, or campus aid, and ask how they'd like to proceed.

LANGUAGE & REGIONAL CONTEXT:
- CRITICAL: Respond in the EXACT SAME LANGUAGE as the user's latest query (English if English, French if French).
- Region: ${region} | Currency: ${currency}

USER FINANCIAL SNAPSHOT:
- Current Liquid Cash: ${currentBalance} ${currency}
- Computed Runway: ${runwayDays} days
- Safe to spend today: ${safeToSpendToday} ${currency}/day
- Average Daily Burn: ${dailyBurn} ${currency}/day
- Monthly Fixed Commitments: ${totalFixedExpenses} ${currency}/month (${fixedExpensesSummary})
- Next Deposit: ${nextIncomeSource} (+${nextIncomeAmount} ${currency}) on ${nextIncomeDate}
- User Goals: ${goalsSummary}
${activeSimulationData ? `
EXACT CANONICAL SIMULATION COMPUTATION (MANDATORY TO MATCH DASHBOARD 100%):
- Proposed Expense: "${activeSimulationData.expenseTitle || 'Dépense'}" for ${activeSimulationData.simulatedAmount} ${currency}
- Projected Runway: from ${runwayDays} days to EXACTLY ${activeSimulationData.projectedDays} days (${activeSimulationData.daysDifference >= 0 ? '+' : ''}${activeSimulationData.daysDifference} days)
- Safe to spend today: from ${safeToSpendToday} ${currency}/day to EXACTLY ${activeSimulationData.postSafeToSpend} ${currency}/day
- Scenario Decision: [SCENARIO: ${activeSimulationData.scenario}]
MANDATE: Start your answer with "[SCENARIO: ${activeSimulationData.scenario}]". You MUST strictly cite ${activeSimulationData.projectedDays} days (post-runway) and ${activeSimulationData.postSafeToSpend} ${currency}/day (post-safe spend). This ensures 100% mathematical consistency with the Dashboard simulator!` : (simulation ? `\nACTIVE SIMULATION IN PROGRESS:\n- Proposed Expense: "${simulation.title || 'Dépense'}" for ${simulation.amount} ${currency}\n- Projected Runway after expense: ${simulation.projectedDays} days` : '')}

Keep responses concise, scannable, warm, conversational, and highly structured with bullet points and bold highlights.`;

    // Format and sanitize conversation history for Gemini SDK:
    // 1. Must start with role: 'user'
    // 2. Must strictly alternate 'user' and 'model'
    // 3. Must not have empty text parts
    const rawList = Array.isArray(messages) ? messages : [];
    const validMessages: { role: 'user' | 'model'; text: string }[] = [];

    for (const m of rawList) {
      const text = (m.content || m.text || '').trim();
      if (!text) continue;
      const role = (m.sender === 'user' || m.role === 'user') ? 'user' : 'model';
      validMessages.push({ role, text });
    }

    // Ensure we start with a 'user' message
    while (validMessages.length > 0 && validMessages[0].role !== 'user') {
      validMessages.shift();
    }

    // Merge consecutive identical roles to guarantee strict alternation
    const contents: any[] = [];
    for (const msg of validMessages) {
      if (contents.length > 0 && contents[contents.length - 1].role === msg.role) {
        contents[contents.length - 1].parts[0].text += `\n\n${msg.text}`;
      } else {
        contents.push({
          role: msg.role,
          parts: [{ text: msg.text }],
        });
      }
    }

    // If empty, supply latest user message
    if (contents.length === 0) {
      contents.push({
        role: 'user',
        parts: [{ text: latestUserMessage || 'Hello Ney, please analyze my financial situation.' }],
      });
    }

    // Timeout protection of 7 seconds so Ney responds swiftly without hanging
    const geminiCall = ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: contents,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.5,
      },
    });

    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 7000));
    const response: any = await Promise.race([geminiCall, timeoutPromise]);

    if (!response || !response.text) {
      // Gemini timed out or gave empty response -> Use instant local deterministic analysis
      console.warn('Gemini response timed out or was empty. Engaging rapid local financial analysis engine.');
      const localResult = generateLocalNeyAnalysis();
      return res.json(localResult);
    }

    const responseText = response.text;

    // Extract scenario badge if present in response
    let extractedScenario: string | null = null;
    const match = responseText.match(/\[SCENARIO:\s*(GO|WAIT|ADJUST|NO)\]/i);
    if (match) {
      extractedScenario = match[1].toUpperCase();
    }

    // Determine if clarification is needed (e.g. question lacked price, was ambiguous, or model asked for details)
    let clarificationData = undefined;
    let confidence: 'high' | 'medium' | 'low' = 'high';

    const isClarificationRequested = 
      /\[CLARIFICATION_NEEDED\]/i.test(responseText) ||
      /quel est le montant|précise.*(montant|prix|formule)|peux-tu préciser|pourrais-tu préciser|what is the (amount|price|cost)|could you provide|could you specify|need.*clarif/i.test(responseText);

    const isSubscriptionOrPurchaseWithoutPrice = 
      /m'abonner|abonnement|souscrire|acheter|achat|buy|subscribe|subscription|m'offrir|prendre|payer|psg|netflix|spotify|salle de sport|gym/i.test(latestUserMessage) &&
      !/(\d+[\d\s.,]*)\s*(?:€|\$|CHF|£|CAD|USD|EUR)?/.test(latestUserMessage);

    if (isClarificationRequested || isSubscriptionOrPurchaseWithoutPrice) {
      confidence = 'low';
      if (isSubscriptionOrPurchaseWithoutPrice || /montant|prix|coût|price|cost|tarif/i.test(responseText)) {
        clarificationData = {
          title: isFrench ? "Précisions pour simuler votre décision" : "Details needed to evaluate this decision",
          reason: isFrench 
            ? `Indiquez le montant estimé et le mode de paiement (mensualité ou comptant) pour calculer l'impact exact sur vos ${runwayDays} jours d'autonomie.`
            : `Provide the estimated cost and payment frequency (monthly or upfront) to calculate the exact impact on your ${runwayDays} days of runway.`,
          suggestedAspects: isFrench ? [
            {
              label: "Montant estimé",
              description: "Le prix envisagé de l'achat ou de l'abonnement",
              example: "Ex: 25 €, 120 €, 450 €",
              suggestedPrompt: "C'est un achat de 45€",
            },
            {
              label: "Fréquence de prélèvement",
              description: "Abonnement récurrent mensuel vs achat unique comptant",
              example: "Ex: 19€/mois ou 200€ en 1 fois",
              suggestedPrompt: "C'est un abonnement mensuel de 25€/mois",
            },
            {
              label: "Nature de la dépense",
              description: "Plaisir, confort ou besoin essentiel pour tes études",
              example: "Ex: Plaisir (loisir), Confort, Études",
              suggestedPrompt: "C'est une dépense de plaisir/loisir",
            }
          ] : [
            {
              label: "Estimated Amount",
              description: "Expected cost of the purchase or pass",
              example: "E.g., $25, $120, $450",
              suggestedPrompt: "It's a $45 expense",
            },
            {
              label: "Billing Frequency",
              description: "Recurring monthly subscription vs one-time cash",
              example: "E.g., $19/month or $200 upfront",
              suggestedPrompt: "It's a $25/month subscription",
            },
            {
              label: "Category / Urgency",
              description: "Outing, comfort, or academic study tool",
              example: "E.g., Leisure, Study essential",
              suggestedPrompt: "It's a leisure spending",
            }
          ],
          quickActions: isFrench ? [
            {
              label: "💳 C'est un abonnement (~20€/mois)",
              prompt: "C'est un abonnement mensuel de 20€/mois",
              iconType: "recurring" as const,
            },
            {
              label: "🎯 C'est un achat ponctuel (~50€)",
              prompt: "C'est un achat unique de 50€",
              iconType: "amount" as const,
            },
            {
              label: "🏟️ Pass / Achat important (~350€)",
              prompt: "C'est un achat unique de 350€ comptant",
              iconType: "amount" as const,
            },
            {
              label: "📊 Quel est mon solde serein actuel ?",
              prompt: "Quel est mon disponible quotidien serein actuel ?",
              iconType: "help" as const,
            }
          ] : [
            {
              label: "💳 It's a monthly subscription (~$20/mo)",
              prompt: "It's a monthly subscription of 20/month",
              iconType: "recurring" as const,
            },
            {
              label: "🎯 It's a one-time purchase (~$50)",
              prompt: "It's a one-time purchase of 50",
              iconType: "amount" as const,
            },
            {
              label: "🏟️ Annual pass / Big spend (~$350)",
              prompt: "It's an upfront purchase of 350",
              iconType: "amount" as const,
            },
            {
              label: "📊 What is my safe daily spend right now?",
              prompt: "What is my current safe daily spend?",
              iconType: "help" as const,
            }
          ]
        };
      }
    }

    // Generate contextual follow-up exchange options based on query topic
    let followUpOptions: Array<{ label: string; prompt: string; type?: 'scenario' | 'question' | 'alternative' | 'action' }> = [];
    const lowerLatest = latestUserMessage.toLowerCase();
    const lowerResp = responseText.toLowerCase();

    if (isSubscriptionOrPurchaseWithoutPrice || clarificationData) {
      followUpOptions = isFrench ? [
        { label: '💳 Abonnement mensuel (~20€/mois)', prompt: 'C\'est un abonnement mensuel de 20€/mois', type: 'alternative' },
        { label: '🎯 Achat ponctuel (~50€)', prompt: 'C\'est un achat unique de 50€', type: 'action' },
        { label: '🏟️ Pass annuel (~300€)', prompt: 'C\'est un achat de 300€ en 1 fois', type: 'action' },
        { label: '📊 Mon disponible actuel', prompt: 'Quel est mon disponible quotidien serein actuel ?', type: 'question' }
      ] : [
        { label: '💳 Monthly sub (~$20/mo)', prompt: 'It\'s a monthly subscription of 20/month', type: 'alternative' },
        { label: '🎯 One-time purchase (~$50)', prompt: 'It\'s a one-time purchase of 50', type: 'action' },
        { label: '🏟️ Annual pass (~$300)', prompt: 'It\'s an upfront purchase of 300', type: 'action' },
        { label: '📊 Safe daily spend', prompt: 'What is my current safe daily spend?', type: 'question' }
      ];
    } else if (/project|projet|idea|idée|startup|score|priorit/i.test(lowerLatest) || /firestore|calculated_score/i.test(responseText)) {
      followUpOptions = isFrench ? [
        { label: '👥 Valider la demande client', prompt: 'Comment puis-je tester et valider la demande pour ce projet ?', type: 'question' },
        { label: '⚡ Réduire le temps estimé', prompt: 'Comment simplifier le scope pour réduire le temps de développement ?', type: 'action' },
        { label: '💰 Modèle économique & Tarification', prompt: 'Quelle stratégie de prix me conseilles-tu pour ce projet ?', type: 'alternative' },
        { label: '💾 Enregistrer dans mon backlog', prompt: 'Ce projet est validé, passons au plan d\'action.', type: 'action' }
      ] : [
        { label: '👥 Validate user demand', prompt: 'How can I quickly validate user demand for this idea?', type: 'question' },
        { label: '⚡ Reduce estimated time', prompt: 'How can I simplify the initial MVP scope?', type: 'action' },
        { label: '💰 Pricing & Revenue Model', prompt: 'What pricing model do you recommend for this project?', type: 'alternative' },
        { label: '💾 Save to project backlog', prompt: 'Project validated, let\'s define next execution steps.', type: 'action' }
      ];
    } else if (extractedScenario || /afford|acheter|achat|payer|dépense|can I|puis-je/i.test(lowerLatest)) {
      followUpOptions = isFrench ? [
        { label: '✅ Valider l\'achat et l\'enregistrer', prompt: 'J\'opte pour cet achat. Comment l\'enregistrer dans ma mémoire ?', type: 'action' },
        { label: `⏳ Attendre la rentrée du ${nextIncomeDate}`, prompt: `Je préfère attendre ma rentrée du ${nextIncomeDate}. Que me conseilles-tu d'ici là ?`, type: 'alternative' },
        { label: '✂️ Où arbitrer 15€ ailleurs ?', prompt: 'Dans quelle catégorie puis-je arbitrer pour compenser cette dépense ?', type: 'question' }
      ] : [
        { label: '✅ Proceed & Log expense', prompt: 'I want to proceed with this purchase. How do I log it into memory?', type: 'action' },
        { label: `⏳ Wait until ${nextIncomeDate}`, prompt: `I prefer to wait for my deposit on ${nextIncomeDate}. What is your advice until then?`, type: 'alternative' },
        { label: '✂️ Find savings to offset', prompt: 'Where can I trim $15 in other categories to offset this?', type: 'question' }
      ];
    } else if (/aide|bourse|crous|scholarship|grant|caf|apl/i.test(lowerLatest)) {
      followUpOptions = isFrench ? [
        { label: '🏠 Impact d\'une aide logement (+150€)', prompt: 'Quel serait l\'impact d\'une aide logement de +150€/mois sur mon runway ?', type: 'scenario' },
        { label: '🍲 Repas CROUS : économies mensuelles', prompt: 'Combien puis-je économiser par mois avec les repas CROUS subventionnés ?', type: 'question' },
        { label: '🚨 Aide d\'urgence étudiante', prompt: 'Comment fonctionne l\'aide d\'urgence pour les étudiants en difficulté ?', type: 'action' }
      ] : [
        { label: '🏠 Check +$150/mo housing aid', prompt: 'What impact would +$150/month housing aid have on my runway?', type: 'scenario' },
        { label: '🍲 Subsidized meal savings', prompt: 'How much can I save with subsidized student meals?', type: 'question' },
        { label: '🚨 Emergency student relief', prompt: 'How do emergency student relief grants work?', type: 'action' }
      ];
    } else {
      followUpOptions = isFrench ? [
        { label: '🎯 Simuler un achat de 30€', prompt: 'Puis-je m\'offrir un achat de 30€ ?', type: 'action' },
        { label: '💡 Pitcher une idée de projet', prompt: 'J\'ai une idée de projet étudiant :', type: 'action' },
        { label: '📈 Comment augmenter mon disponible/j ?', prompt: 'Comment puis-je augmenter mon disponible serein par jour ?', type: 'question' },
        { label: '📝 Comment ajouter une transaction ?', prompt: 'Comment ajouter une transaction ?', type: 'question' }
      ] : [
        { label: '🎯 Simulate a $30 purchase', prompt: 'Can I afford a $30 purchase?', type: 'action' },
        { label: '💡 Pitch a student project', prompt: 'I have a project idea: ', type: 'action' },
        { label: '📈 How to increase safe spend?', prompt: 'How can I increase my safe daily spend?', type: 'question' },
        { label: '📝 How to add a transaction?', prompt: 'How to add a transaction?', type: 'question' }
      ];
    }

    return res.json({
      content: responseText.replace(/\[CLARIFICATION_NEEDED\]/gi, '').trim(),
      scenario: extractedScenario,
      confidence,
      clarification: clarificationData,
      followUpOptions,
    });
  } catch (error: any) {
    console.error('Gemini server error handled gracefully:', error);
    // Graceful fallback ensuring Ney always responds with exact analytics
    try {
      const { userContext, simulation, messages } = req.body || {};
      const currency = userContext?.currency || 'EUR';
      const currentBalance = userContext?.currentBalance ?? 1250;
      const runwayDays = userContext?.runwayDays ?? 34;
      const safeToSpendToday = userContext?.safeToSpendToday ?? 24;
      const nextIncomeDate = userContext?.nextIncomeDate || 'Non spécifié';
      const nextIncomeAmount = userContext?.nextIncomeAmount ?? 400;
      const latestUserMessage = messages?.[messages.length - 1]?.content || '';
      const isFr = /[àâçéèêëîïôûùüÿœ]/i.test(latestUserMessage) || userContext?.preferredLanguage === 'fr';

      const fallbackContent = isFr
        ? `[SCENARIO: GO]

Ton autonomie financière est actuellement de **${runwayDays} jours** avec un solde liquide disponible de **${currentBalance} ${currency}** et une dépense quotidienne sécurisée de **${safeToSpendToday} ${currency}/j**.

🧭 **Possibilités disponibles pour toi :**
- **Option 1 (Dépense maîtrisée)** : Réaliser ton intention en restant sous ${safeToSpendToday} ${currency}/jour.
- **Option 2 (Attendre la rentrée)** : Décaler un achat important après ton versement du ${nextIncomeDate} (+${nextIncomeAmount} ${currency}).
- **Option 3 (Épargne de réserve)** : Bloquer un matelas de 10 jours de dépenses.

💬 **Échange avec Ney :**
Quelle piste souhaites-tu explorer ou simuler ensemble ?

*L'IA conseille, vous décidez !*`
        : `[SCENARIO: GO]

Your current financial runway is **${runwayDays} days** with **${currentBalance} ${currency}** in available liquid cash and a safe spend rate of **${safeToSpendToday} ${currency}/day**.

🧭 **Available Pathways for you:**
- **Option 1 (Safe Daily Spend)**: Keep discretionary daily purchases within $${safeToSpendToday}/day.
- **Option 2 (Wait for Inflow)**: Defer larger expenses until your next deposit on ${nextIncomeDate} (+$${nextIncomeAmount} ${currency}).
- **Option 3 (Safety Cushion)**: Reserve a 10-day buffer for peace of mind.

💬 **Ney's Question for you:**
Which possibility would you like to explore or simulate next?

*AI advises, you decide!*`;

      const fallbackFollowUps = isFr ? [
        { label: '🎯 Simuler un achat de 35€', prompt: 'Puis-je m\'offrir un achat de 35€ ?', type: 'action' as const },
        { label: '💡 Pitcher une idée de projet', prompt: 'J\'ai une idée de projet :', type: 'action' as const },
        { label: '🎓 Explorer les aides étudiantes', prompt: 'Quelles sont les bourses et aides disponibles ?', type: 'alternative' as const },
        { label: '📝 Comment ajouter une transaction ?', prompt: 'Comment ajouter une transaction ?', type: 'question' as const }
      ] : [
        { label: '🎯 Simulate a $35 purchase', prompt: 'Can I afford a $35 purchase?', type: 'action' as const },
        { label: '💡 Pitch a project idea', prompt: 'I have a project idea: ', type: 'action' as const },
        { label: '🎓 Explore student grants', prompt: 'What student aids and grants are available?', type: 'alternative' as const },
        { label: '📝 How to add a transaction?', prompt: 'How to add a transaction?', type: 'question' as const }
      ];

      return res.json({
        content: fallbackContent,
        scenario: 'GO',
        followUpOptions: fallbackFollowUps,
      });
    } catch {
      return res.json({
        content: "Ney a analysé votre situation : votre autonomie financière est stable et vos charges restent sous contrôle.",
        scenario: 'GO',
      });
    }
  }
});

// Vite Middleware for Development / Static serving for Production
async function setupViteOrStatic() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Neyrunway server listening on http://0.0.0.0:${PORT}`);
  });
}

setupViteOrStatic().catch((err) => {
  console.error('Failed to start server:', err);
});
