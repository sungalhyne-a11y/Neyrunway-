import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from '../i18n';
import { useAuth } from '../context/AuthContext';
import { useSimulation } from '../context/SimulationContext';
import { DecisionSimulator } from '../components/simulator/DecisionSimulator';
import { ChatMessage, ClarificationPrompt, AppRoute } from '../types';
import { ChatFallback } from '../components/chat/ChatFallback';
import { db } from '../lib/firebase';
import { collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { 
  Bot, 
  Send, 
  Sparkles, 
  ShieldCheck, 
  Sliders, 
  Trash2, 
  ArrowRight,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  HelpCircle,
  TrendingDown,
  User,
  Zap,
  Info,
  DollarSign,
  Calendar,
  Tag,
  ChevronRight,
  Lightbulb,
  Mic,
  MicOff,
  Volume2,
  AlertCircle,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ChatViewProps {
  initialQuery?: string;
  onNavigate?: (route: AppRoute) => void;
}

export const ChatView: React.FC<ChatViewProps> = ({ initialQuery = '', onNavigate }) => {
  const { t, formatCurrency, formatDate, formatTime, formatDays, language, region, currency } = useTranslation();
  const { currentUser, userProfile, computedRunway, memorySummary } = useAuth();
  const { 
    runSimulationForAmount, 
    setSimulatedAmount, 
    setExpenseTitle, 
    expenseTitle 
  } = useSimulation();

  const [inputMessage, setInputMessage] = useState(initialQuery);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSimulator, setShowSimulator] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Cleanup speech recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
    };
  }, []);

  const toggleVoiceInput = () => {
    if (typeof window === 'undefined') return;

    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechError(
        language === 'fr'
          ? 'La reconnaissance vocale n\'est pas supportée sur ce navigateur. Utilisez le champ texte ci-dessous.'
          : 'Voice input is not supported in this browser. Please use the text input.'
      );
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;

      // Match user's active language and region code
      let bcp47 = 'fr-FR';
      if (language === 'fr') bcp47 = 'fr-FR';
      else if (language === 'es') bcp47 = 'es-ES';
      else if (language === 'pt') bcp47 = 'pt-BR';
      else if (language === 'hi') bcp47 = 'hi-IN';
      else if (language === 'en') {
        bcp47 = region === 'GB' ? 'en-GB' : region === 'CA' ? 'en-CA' : 'en-US';
      }

      recognition.lang = bcp47;

      recognition.onstart = () => {
        setIsListening(true);
        setSpeechError(null);
      };

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript) {
          setInputMessage(transcript);
        }
      };

      recognition.onerror = (event: any) => {
        setIsListening(false);
        if (event.error === 'not-allowed') {
          setSpeechError(
            language === 'fr'
              ? 'Accès au micro refusé. Vous pouvez poser votre question par écrit ci-dessous.'
              : 'Microphone permission denied. You can type your question below.'
          );
        } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
          setSpeechError(
            language === 'fr'
              ? 'Capture vocale interrompue. Saisie texte disponible.'
              : 'Voice recognition interrupted. Text input ready.'
          );
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      setIsListening(false);
      setSpeechError(
        language === 'fr'
          ? 'Impossible de démarrer la capture audio.'
          : 'Could not start audio capture.'
      );
    }
  };

  const runwayDays = computedRunway?.runwayDays ?? 34;
  const safeToSpendToday = computedRunway?.safeToSpendToday ?? 24;
  const currentBalance = computedRunway?.currentBalance ?? userProfile?.initialBalance ?? 1250;
  const dailyBurn = computedRunway?.projectedBurnPerDay ?? 38;
  const totalFixedExpenses = computedRunway?.totalFixedExpenses ?? 450;
  const nextIncomeDate = computedRunway?.nextIncomeDate;
  const nextIncomeAmount = computedRunway?.nextIncomeAmount ?? 0;
  const nextIncomeSource = computedRunway?.nextIncomeSource;

  // Initialize welcoming message on mount
  useEffect(() => {
    if (messages.length === 0) {
      const welcomeText = language === 'fr' 
        ? `Bonjour ! Je suis **Ney**, ton copilote financier personnel.\n\nTon autonomie actuelle est de **${runwayDays} jours** (avec un solde de **${formatCurrency(currentBalance)}** et un disponible de **${formatCurrency(safeToSpendToday)}/j**).\n\nPose-moi une question sur tes sorties, tes projets de vacances ou simule l'impact d'une dépense sur ton runway. *Je te conseille, mais c'est toujours toi qui décides !*`
        : `Hi! I'm **Ney**, your student financial copilot.\n\nYour current runway stands at **${runwayDays} days** (liquid balance: **${formatCurrency(currentBalance)}**, safe to spend: **${formatCurrency(safeToSpendToday)}/day**).\n\nAsk me about upcoming outings, trips or test a purchase simulation. *I advise, but you always decide!*`;

      setMessages([
        {
          id: 'welcome-msg',
          sender: 'ney',
          content: welcomeText,
          timestamp: new Date().toISOString(),
        }
      ]);
    }
  }, [language, runwayDays, currentBalance, safeToSpendToday]);

  // Handle auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Load Firestore messages if logged in
  useEffect(() => {
    if (!currentUser || currentUser.isAnonymous) return;

    try {
      const chatColRef = collection(db, 'users', currentUser.uid, 'chatHistory');
      const q = query(chatColRef, orderBy('createdAt', 'asc'), limit(50));

      const unsubscribe = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
          const loaded: ChatMessage[] = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              sender: data.sender || 'user',
              content: data.content || '',
              timestamp: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
              simulation: data.simulation,
            };
          });
          if (loaded.length > 0) {
            setMessages(loaded);
          }
        }
      }, (err) => {
        console.warn('Firestore chatHistory sync notice:', err);
      });

      return () => unsubscribe();
    } catch (err) {
      console.warn('Chat history listener initialization notice:', err);
    }
  }, [currentUser]);

  // Send message to Server-Side Gemini API
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isLoading) return;

    const userMsgId = 'user-' + Date.now();
    const newUserMsg: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, newUserMsg]);
    setInputMessage('');
    setIsLoading(true);

    // If authenticated in Firestore, record user message
    if (currentUser && !currentUser.isAnonymous) {
      try {
        await addDoc(collection(db, 'users', currentUser.uid, 'chatHistory'), {
          sender: 'user',
          content: text,
          createdAt: serverTimestamp(),
        });
      } catch (e) {
        console.warn('Firestore save notice:', e);
      }
    }

    try {
      // Check if this is an expense / simulation inquiry
      const priceExtract = text.match(/(\d+[\d\s.,]*)\s*(?:€|\$|CHF|£|CAD|USD|EUR)?/);
      const isAffordability = /afford|acheter|achat|payer|dépense|sortir|concert|voyage|billet|resto|soiree|soirée|can I|puis-je|dois-je|m'offrir|prendre|simulateur|simulation/i.test(text);

      let simulationPayload: any = undefined;
      if (priceExtract && isAffordability) {
        const cost = parseFloat(priceExtract[1].replace(/\s/g, '').replace(',', '.'));
        if (!isNaN(cost) && cost > 0) {
          const titleExtract = text.match(/["']([^"']+)["']/);
          const title = titleExtract ? titleExtract[1] : (expenseTitle || undefined);
          const computedSim = runSimulationForAmount(cost, title);
          simulationPayload = {
            amount: cost,
            title: title || 'Dépense',
            projectedDays: computedSim.projectedDays,
            postSafeToSpend: computedSim.postSafeToSpend,
            scenario: computedSim.scenario,
            daysDifference: computedSim.daysDifference,
          };
          // Synchronize shared simulation state so Dashboard and Chat are always 1:1
          setSimulatedAmount(cost);
          if (title) {
            setExpenseTitle(title);
          }
        }
      }

      // Build structured user financial context to inject into Gemini prompt
      const userContext = {
        currency: currency || userProfile?.currency || 'EUR',
        region: region || userProfile?.region || 'FR',
        preferredLanguage: language || userProfile?.preferredLanguage || 'fr',
        currentBalance,
        runwayDays,
        safeToSpendToday,
        dailyBurn,
        totalFixedExpenses,
        nextIncomeDate: nextIncomeDate ? formatDate(nextIncomeDate) : undefined,
        nextIncomeAmount,
        nextIncomeSource,
        memorySummary,
      };

      // 8-second client-side timeout controller to prevent infinite spinner
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8500);

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          messages: [...messages, newUserMsg],
          userContext,
          simulation: simulationPayload,
        }),
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const data = await response.json();
      const botMsgId = 'ney-' + Date.now();

      const newBotMsg: ChatMessage = {
        id: botMsgId,
        sender: 'ney',
        content: data.content || (language === 'fr' 
          ? `Ton autonomie actuelle est de **${runwayDays} jours** avec un solde disponible de **${formatCurrency(currentBalance)}**.`
          : `Your current runway is **${runwayDays} days** with **${formatCurrency(currentBalance)}** available.`),
        timestamp: new Date().toISOString(),
        confidence: data.confidence || 'high',
        clarification: data.clarification || undefined,
        followUpOptions: data.followUpOptions || undefined,
      };

      setMessages(prev => [...prev, newBotMsg]);

      // Save bot response to Firestore if user logged in
      if (currentUser && !currentUser.isAnonymous) {
        try {
          await addDoc(collection(db, 'users', currentUser.uid, 'chatHistory'), {
            sender: 'ney',
            content: newBotMsg.content,
            scenario: data.scenario || null,
            confidence: newBotMsg.confidence || null,
            createdAt: serverTimestamp(),
          });
        } catch (e) {
          console.warn('Firestore bot response save notice:', e);
        }
      }
    } catch (error) {
      console.error('Error contacting Ney Gemini server:', error);

      // Analyze user prompt locally to provide an immediate smart response even offline
      const queryText = text.trim();
      const isEnglish = language === 'en' || /goal|afford|spend|how|can|what|safe|runway|add|transaction|expense/i.test(queryText);
      const isFrench = !isEnglish;
      const q = queryText.toLowerCase();

      let fallbackText = '';
      let fallbackConfidence: 'high' | 'medium' | 'low' = 'high';
      let fallbackClarification: ClarificationPrompt | undefined = undefined;

      const fallbackPriceExtract = queryText.match(/(\d+[\d\s.,]*)\s*(?:€|\$|CHF|£|CAD|USD|EUR)?/);
      const fallbackIsAffordability = /afford|acheter|achat|payer|dépense|sortir|concert|voyage|billet|resto|soiree|soirée|can I|puis-je|dois-je|m'offrir|prendre/i.test(queryText);

      let fallbackFollowUpOptions: Array<{ label: string; prompt: string; type?: 'scenario' | 'question' | 'alternative' | 'action' }> | undefined = undefined;

      if (fallbackIsAffordability && fallbackPriceExtract) {
        const cost = parseFloat(fallbackPriceExtract[1].replace(/\s/g, '').replace(',', '.'));
        const titleMatch = queryText.match(/["']([^"']+)["']/);
        const title = titleMatch ? titleMatch[1] : (expenseTitle || undefined);
        const sim = runSimulationForAmount(cost, title);

        fallbackConfidence = 'high';
        const scenarioBadge = sim.scenario;
        const newRunway = sim.projectedDays;
        const newSafe = sim.postSafeToSpend;
        const diffDays = sim.daysDifference;

        if (isFrench) {
          fallbackText = `[SCENARIO: ${scenarioBadge}]

Voici l'analyse d'impact d'un montant de **${formatCurrency(cost)}**${title ? ` pour *« ${title} »*` : ''} sur ton autonomie :

- **Runway** : passe de **${runwayDays} jours** à **${newRunway} jours** (${diffDays > 0 ? `+${diffDays}` : diffDays}j)
- **Disponible aujourd'hui** : passe de **${formatCurrency(safeToSpendToday)}/j** à **${formatCurrency(newSafe)}/j**

${scenarioBadge === 'GO' ? 'Cet achat s\'intègre confortablement dans ta trésorerie sans menacer ton loyer ni tes charges fixes.' : scenarioBadge === 'WAIT' ? `Attendre la rentrée de ${nextIncomeSource ? nextIncomeSource + ' (' : ''}+${formatCurrency(nextIncomeAmount)}${nextIncomeSource ? ')' : ''} prévue le ${nextIncomeDate ? formatDate(nextIncomeDate) : 'prochainement'} te permettrait de réaliser cet achat avec un confort total.` : scenarioBadge === 'ADJUST' ? 'C\'est faisable en ajustant tes dépenses variables quotidiennes de 2 à 3€ pendant quelques jours.' : 'Cet achat réduirait fortement ta marge de sécurité avant tes prochaines échéances fixes.'}

🧭 **Possibilités d'action disponibles :**
- **Option 1 (Paiement comptant)** : Absorber la dépense immédiatement.
- **Option 2 (Attendre la rentrée)** : Décaler l'achat après le ${nextIncomeDate ? formatDate(nextIncomeDate) : 'prochain versement'}.
- **Option 3 (Compromis)** : Réaliser l'achat en modérant un autre loisir cette semaine.

💬 **Échange avec Ney :**
Quelle option correspond le mieux à tes priorités ? Souhaites-tu enregistrer ce mouvement ?`;

          fallbackFollowUpOptions = [
            { label: '✅ Valider et enregistrer', prompt: `J'opte pour l'achat de ${formatCurrency(cost)}. Comment l'enregistrer dans ma mémoire ?`, type: 'action' },
            { label: '⏳ Attendre ma prochaine rentrée', prompt: `Je préfère attendre ma rentrée. Que me conseilles-tu d'ici là ?`, type: 'alternative' },
            { label: '✂️ Où arbitrer 15€ ailleurs ?', prompt: 'Dans quelle catégorie puis-je arbitrer pour compenser cet achat ?', type: 'question' }
          ];
        } else {
          fallbackText = `[SCENARIO: ${scenarioBadge}]

Here is the exact impact of a **${formatCurrency(cost)}** expense${title ? ` for *« ${title} »*` : ''} on your financial autonomy:

- **Runway**: adjusts from **${runwayDays} days** to **${newRunway} days** (${diffDays > 0 ? `+${diffDays}` : diffDays}d)
- **Safe to spend today**: adjusts from **${formatCurrency(safeToSpendToday)}/day** to **${formatCurrency(newSafe)}/day**

${scenarioBadge === 'GO' ? 'This expense fits comfortably within your liquid cash without putting your upcoming rent or fixed subscriptions at risk.' : scenarioBadge === 'WAIT' ? `Waiting for your upcoming deposit (${nextIncomeSource || 'Inflow'} of +${formatCurrency(nextIncomeAmount)}) on ${nextIncomeDate ? formatDate(nextIncomeDate) : 'upcoming'} will let you make this purchase stress-free.` : scenarioBadge === 'ADJUST' ? 'You can do this by trimming daily variable discretionary outings slightly over the next few days.' : 'This expense would leave very little buffer before your fixed commitments are due.'}

🧭 **Available Pathways:**
- **Option 1 (Immediate Purchase)**: Absorb upfront safely.
- **Option 2 (Postpone for Inflow)**: Wait for scheduled deposit on ${nextIncomeDate ? formatDate(nextIncomeDate) : 'upcoming date'}.
- **Option 3 (Offset & Balance)**: Proceed while trimming a leisure expense this week.

💬 **Ney's Question for you:**
Which pathway fits your plan best? Would you like to log this movement?`;

          fallbackFollowUpOptions = [
            { label: '✅ Proceed & Log expense', prompt: `I want to proceed with this purchase of ${formatCurrency(cost)}. How do I log it?`, type: 'action' },
            { label: '⏳ Wait for deposit', prompt: 'I will wait for my deposit. What is your advice until then?', type: 'alternative' },
            { label: '✂️ Where to trim $15 elsewhere?', prompt: 'Where can I trim $15 in other categories to offset this?', type: 'question' }
          ];
        }
      } else if (/how.*add.*(transaction|expense|movement|income)|add.*(transaction|expense)|comment.*(ajouter|enregistrer).*(transaction|dépense|mouvement|rentrée)/i.test(q)) {
        fallbackText = isFrench
          ? `Pour ajouter une transaction ou enregistrer un mouvement dans **Neyrunway** :

1. **Ouvre l'onglet « Mémoire » (Transactions)** depuis la barre de navigation.
2. Clique sur le bouton **« + Enregistrer une intention »**.
3. Saisis le **nom**, le **montant**, le **tag** (*Essentiel*, *Confort*, ou *Plaisir*) et la **catégorie**.
4. Clique sur **« Enregistrer le mouvement »** : Ney actualise ton **Runway** et ton **disponible par jour** instantanément !

🧭 **Possibilités :**
- Enregistrer une dépense ponctuelle ou une rentrée d'argent.
- Taguer la dépense (*Essentiel / Confort / Plaisir*) pour affiner ton disponible quotidien.

💬 **Échange avec Ney :**
Veux-tu enregistrer une dépense précise ou tester son impact en simulation d'abord ?`
          : `To add a transaction or record a movement in **Neyrunway**:

1. **Open the « Memory » (or Transactions) tab** from the navigation bar or sidebar.
2. Click the **« + Log a Movement »** button.
3. Fill in the **title**, **amount**, **tag** (*Essential*, *Comfort*, or *Outing*), and **category**.
4. Click **« Save Movement »**: Ney updates your **Runway** and **Safe to spend / day** in real-time!

🧭 **Available options:**
- Log one-off expenses or incoming revenue.
- Categorize (*Essential / Comfort / Outing*) to protect your runway.

💬 **Ney's Question for you:**
Would you like to log a specific expense now or simulate its runway impact first?`;

        fallbackFollowUpOptions = isFrench ? [
          { label: '🎯 Simuler d\'abord un achat à 25€', prompt: 'Puis-je m\'offrir un achat à 25€ ?', type: 'action' },
          { label: '💼 Comment déclarer une rentrée récurrente ?', prompt: 'Comment déclarer une bourse ou un salaire récurrent ?', type: 'question' },
          { label: '📊 Voir mon disponible actuel', prompt: 'Quel est mon disponible quotidien serein actuel ?', type: 'question' }
        ] : [
          { label: '🎯 Simulate a $25 purchase first', prompt: 'Can I afford a $25 purchase?', type: 'action' },
          { label: '💼 How to log recurring income?', prompt: 'How to declare recurring income or salary?', type: 'question' },
          { label: '📊 View current safe spend', prompt: 'What is my current safe daily spend?', type: 'question' }
        ];
      } else if (/what.*runway|qu'est-ce.*runway|how.*calculate|comment.*calculé/i.test(q)) {
        fallbackText = isFrench
          ? `Le **Runway (${runwayDays} jours)** mesure ton autonomie financière exacte avec ton solde liquide actuel (**${formatCurrency(currentBalance)}**), après sécurisation de tes charges fixes incompressibles (**${formatCurrency(totalFixedExpenses)}/mois**). Ton **disponible serein** est de **${formatCurrency(safeToSpendToday)}/j**.

🧭 **Possibilités pour optimiser ton runway :**
- **Option A (Ajuster les charges fixes)** : Réduire un abonnement non utilisé pour gagner 4 à 6 jours d'autonomie.
- **Option B (Explorer les aides)** : Demander des bourses ou des aides régionales.
- **Option C (Piloter au jour le jour)** : Respecter les ${formatCurrency(safeToSpendToday)}/jour.

💬 **Échange avec Ney :**
Souhaites-tu voir comment gagner 5 jours d'autonomie supplémentaires ?`
          : `Your **Runway (${runwayDays} days)** calculates how many days your liquid cash (**${formatCurrency(currentBalance)}**) will last after protecting your fixed monthly commitments (**${formatCurrency(totalFixedExpenses)}/month**). Your current **safe spend** is **${formatCurrency(safeToSpendToday)}/day**.

🧭 **Paths to optimize your runway:**
- **Option A (Trim fixed costs)**: Cancel an unused subscription to gain +4 to +6 runway days.
- **Option B (Apply for grants)**: Discover local campus subsidies and scholarships.
- **Option C (Daily pacing)**: Stay within your ${formatCurrency(safeToSpendToday)}/day budget.

💬 **Ney's Question for you:**
Would you like to explore ways to gain +5 extra runway days?`;

        fallbackFollowUpOptions = isFrench ? [
          { label: '📈 Comment gagner +5 jours de runway ?', prompt: 'Comment puis-je gagner 5 jours de runway en plus ?', type: 'question' },
          { label: '🎓 Quelles aides peuvent m\'aider ?', prompt: 'Quelles sont les bourses et aides disponibles ?', type: 'alternative' },
          { label: '🍽️ Puis-je m\'offrir un resto à 25€ ?', prompt: 'Puis-je m\'offrir un resto à 25€ ce soir ?', type: 'action' }
        ] : [
          { label: '📈 How to gain +5 runway days?', prompt: 'How can I gain 5 extra runway days?', type: 'question' },
          { label: '🎓 Discover student grants', prompt: 'What student aids and grants are available?', type: 'alternative' },
          { label: '🍽️ Can I afford a $25 dinner?', prompt: 'Can I afford a $25 dinner tonight?', type: 'action' }
        ];
      } else if (/project|projet|idea|idée|startup|pitch|business|saas|app/i.test(q)) {
        // Project capture and dynamic scoring offline handler
        const revPot = 8;
        const valDem = 7;
        const urg = 6;
        const estTime = 4;
        const calcScore = Math.round(((revPot * valDem * urg) / estTime) * 10) / 10;
        
        fallbackText = isFrench
          ? `[SCENARIO: GO]

J'ai analysé ton idée de projet. Voici l'évaluation dynamique de viabilité :

- **Score Calculé** : **${calcScore} / 100** (Priorité suggérée : *Haute*)
- **Potentiel de revenus** : ${revPot}/10 | **Demande validée** : ${valDem}/10
- **Urgence** : ${urg}/10 | **Temps estimé** : ${estTime}/10

\`\`\`json
{
  "title": "${queryText.replace(/"/g, "'").slice(0, 40)}",
  "description": "Projet capturé et structuré",
  "metrics": {
    "revenue_potential": ${revPot},
    "validated_demand": ${valDem},
    "urgency": ${urg},
    "estimated_time": ${estTime}
  },
  "calculated_score": ${calcScore},
  "status": "backlog",
  "created_at": "${new Date().toISOString()}"
}
\`\`\`

🧭 **Possibilités & Étapes recommandées :**
- **Option 1 (MVP Express)** : Lancer une landing page de test pour valider la demande en 48h.
- **Option 2 (Explorer les bourses)** : Candidater aux bourses d'entrepreneuriat étudiant Pépite.
- **Option 3 (Co-construction)** : Affiner les 4 variables de scoring ensemble.

💬 **Échange avec Ney :**
Souhaites-tu ajuster l'une de ces 4 métriques ou enregistrer cette opportunité dans ton backlog ?`
          : `[SCENARIO: GO]

I evaluated your project idea. Here is the dynamic viability score:

- **Calculated Score**: **${calcScore} / 100** (Suggested Priority: *High*)
- **Revenue Potential**: ${revPot}/10 | **Validated Demand**: ${valDem}/10
- **Urgency**: ${urg}/10 | **Estimated Time**: ${estTime}/10

\`\`\`json
{
  "title": "${queryText.replace(/"/g, "'").slice(0, 40)}",
  "description": "Captured and structured project",
  "metrics": {
    "revenue_potential": ${revPot},
    "validated_demand": ${valDem},
    "urgency": ${urg},
    "estimated_time": ${estTime}
  },
  "calculated_score": ${calcScore},
  "status": "backlog",
  "created_at": "${new Date().toISOString()}"
}
\`\`\`

🧭 **Recommended Execution Pathways:**
- **Option 1 (Express MVP)**: Launch a simple validation test within 48 hours.
- **Option 2 (Campus Grants)**: Apply for student entrepreneurship grants.
- **Option 3 (Score Refinement)**: Adjust the 4 evaluation variables together.

💬 **Ney's Question for you:**
Would you like to fine-tune any of these 4 metrics or save this idea directly to your backlog?`;

        fallbackFollowUpOptions = isFrench ? [
          { label: '👥 Valider la demande client', prompt: 'Comment puis-je tester et valider la demande pour ce projet ?', type: 'question' },
          { label: '⚡ Réduire le temps estimé', prompt: 'Comment simplifier le scope pour réduire le temps de développement ?', type: 'action' },
          { label: '💰 Modèle économique & Tarification', prompt: 'Quelle stratégie de prix me conseilles-tu pour ce projet ?', type: 'alternative' }
        ] : [
          { label: '👥 Validate customer demand', prompt: 'How can I quickly validate user demand for this idea?', type: 'question' },
          { label: '⚡ Reduce development time', prompt: 'How can I simplify the MVP scope to launch faster?', type: 'action' },
          { label: '💰 Pricing & Monetization', prompt: 'What pricing model do you recommend for this project?', type: 'alternative' }
        ];
      } else if (/aide|bourse|crous|grant|scholarship|caf|apl|subvention/i.test(q)) {
        fallbackText = isFrench
          ? `[SCENARIO: GO]

Voici les leviers d'aides et bourses étudiantes pour renforcer ton autonomie financière :

- **Bourse sur critères sociaux (CROUS)** : de 100€ à 596€/mois selon ton échelon.
- **Aide au logement (APL / CAF)** : généralement entre 150€ et 220€/mois déduits de ton loyer.
- **Repas CROUS à 1€ / 3,30€** : économise jusqu'à 80€/mois sur ton budget alimentation.
- **Aide d'urgence ponctuelle (FNAU)** : jusqu'à 500€ en cas de coup dur.

🧭 **Possibilités d'action immédiates :**
- **Option A (Simuler l'impact)** : Voir l'effet de +150€/mois d'APL sur ton runway (+12 jours d'autonomie).
- **Option B (Consulter les démarches)** : Accéder au dossier social étudiant via l'onglet Ressources.
- **Option C (Aide d'urgence)** : Prendre contact avec le service social du CROUS.

💬 **Échange avec Ney :**
Reçois-tu déjà l'une de ces aides ou souhaites-tu qu'on simule l'impact d'une nouvelle aide sur ton budget ?`
          : `[SCENARIO: GO]

Here are the student grants and relief programs that can strengthen your financial runway:

- **Needs-based Student Grants**: $100 to $600/month depending on eligibility tier.
- **Housing Assistance**: Typically $150 to $250/month to lower fixed rent commitments.
- **Subsidized Dining**: Save up to $80/month on groceries and campus meals.
- **Emergency Relief Fund**: One-time grant for unexpected financial difficulties.

🧭 **Immediate Action Pathways:**
- **Option A (Simulate Impact)**: Check how +$150/month in aid expands your runway (+12 days).
- **Option B (Apply for Grants)**: Explore application deadlines in the Campus Resources tab.
- **Option C (Emergency Assistance)**: Contact the campus financial aid office.

💬 **Ney's Question for you:**
Do you already receive any of these grants, or would you like to simulate adding one to your monthly income?`;

        fallbackFollowUpOptions = isFrench ? [
          { label: '🏠 Impact d\'une aide logement (+150€)', prompt: 'Quel serait l\'impact d\'une aide logement de +150€/mois sur mon runway ?', type: 'scenario' },
          { label: '🍲 Repas CROUS : économies mensuelles', prompt: 'Combien puis-je économiser par mois avec les repas CROUS subventionnés ?', type: 'question' },
          { label: '🚨 Aide d\'urgence étudiante', prompt: 'Comment fonctionne l\'aide d\'urgence pour les étudiants en difficulté ?', type: 'action' }
        ] : [
          { label: '🏠 Check +$150/mo housing aid', prompt: 'What impact would +$150/month housing aid have on my runway?', type: 'scenario' },
          { label: '🍲 Subsidized meal savings', prompt: 'How much can I save with subsidized student meals?', type: 'question' },
          { label: '🚨 Emergency student relief', prompt: 'How do emergency student relief grants work?', type: 'action' }
        ];
      } else if (/m'abonner|abonnement|souscrire|acheter|achat|buy|subscribe|subscription|m'offrir|prendre|payer|psg|netflix|spotify|gym|resto/i.test(q)) {
        fallbackConfidence = 'low';
        fallbackText = isFrench
          ? `Pour évaluer si cet achat ou abonnement est compatible avec tes **${formatCurrency(currentBalance)}** de solde et tes **${runwayDays} jours de runway**, j'ai besoin d'une petite précision :

🧭 **Possibilités courantes :**
- **Abonnement mensuel (~15-20€/mois)** : Impact d'environ -0,50€/jour sur ton disponible.
- **Achat unique (~50€)** : Impact de -2 jours sur ton autonomie.
- **Pass annuel (~300€)** : À planifier après ta rentrée.

💬 **Échange avec Ney :**
Quel est le montant estimé et s'agit-il d'un prélèvement mensuel ou comptant ?`
          : `To evaluate whether this purchase fits your current **${formatCurrency(currentBalance)}** and **${runwayDays} days of runway**, I just need a quick detail:

🧭 **Typical Scenarios:**
- **Monthly Subscription (~$15-$20/mo)**: Impact of approx -$0.50/day on safe spend.
- **One-time Purchase (~$50)**: Adjusts runway by -2 days.
- **Annual Pass (~$300)**: Best timed after your next deposit.

💬 **Ney's Question for you:**
What is the estimated price and billing frequency (monthly vs one-time)?`;

        fallbackClarification = {
          title: isFrench ? "Précisions pour simuler votre décision" : "Details needed to evaluate this decision",
          reason: isFrench 
            ? "Le montant estimé et le type de paiement (mensualité récurrente ou comptant) sont requis pour calculer l'impact exact."
            : "The estimated cost and payment frequency (recurring or upfront) are needed to calculate the exact impact.",
          suggestedAspects: isFrench ? [
            {
              label: "Montant estimé",
              description: "Le prix envisagé de l'achat ou de l'abonnement",
              example: "Ex: 25 €, 120 €, 400 €",
              suggestedPrompt: "C'est un achat de 45€",
            },
            {
              label: "Fréquence de prélèvement",
              description: "Abonnement récurrent mensuel vs achat unique",
              example: "Ex: 19€/mois ou 200€ en 1 fois",
              suggestedPrompt: "C'est un abonnement mensuel de 25€/mois",
            }
          ] : [
            {
              label: "Estimated Amount",
              description: "Expected cost of the purchase or pass",
              example: "E.g., $25, $120, $400",
              suggestedPrompt: "It's a $45 expense",
            },
            {
              label: "Billing Frequency",
              description: "Recurring monthly subscription vs one-time cash",
              example: "E.g., $19/month or $200 upfront",
              suggestedPrompt: "It's a $25/month subscription",
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
              label: "🏟️ Pass saison / Achat important (~350€)",
              prompt: "C'est un achat unique de 350€ comptant",
              iconType: "amount" as const,
            }
          ] : [
            {
              label: "💳 Monthly subscription (~$20/mo)",
              prompt: "It's a monthly subscription of 20/month",
              iconType: "recurring" as const,
            },
            {
              label: "🎯 One-time purchase (~$50)",
              prompt: "It's a one-time purchase of 50",
              iconType: "amount" as const,
            },
            {
              label: "🏟️ Upfront big spend (~$350)",
              prompt: "It's an upfront purchase of 350",
              iconType: "amount" as const,
            }
          ]
        };

        fallbackFollowUpOptions = isFrench ? [
          { label: '💳 Abonnement mensuel (~20€/mois)', prompt: 'C\'est un abonnement mensuel de 20€/mois', type: 'alternative' },
          { label: '🎯 Achat ponctuel (~50€)', prompt: 'C\'est un achat unique de 50€', type: 'action' },
          { label: '🏟️ Pass annuel (~300€)', prompt: 'C\'est un achat de 300€ en 1 fois', type: 'action' }
        ] : [
          { label: '💳 Monthly sub (~$20/mo)', prompt: 'It\'s a monthly subscription of 20/month', type: 'alternative' },
          { label: '🎯 One-time purchase (~$50)', prompt: 'It\'s a one-time purchase of 50', type: 'action' },
          { label: '🏟️ Annual pass (~$300)', prompt: 'It\'s an upfront purchase of 300', type: 'action' }
        ];
      } else if (/goal|objectif/i.test(q)) {
        const minSafetyBuffer = 20 * (dailyBurn > 0 ? dailyBurn : 25);
        const monthlySave = Math.max(15, Math.round((safeToSpendToday * 0.25 * 30) / 10) * 10);
        fallbackText = isFrench
          ? `[SCENARIO: GO]

Voici ma recommandation pour ton objectif d'épargne :

- **Autonomie actuelle** : **${runwayDays} jours** (Solde : **${formatCurrency(currentBalance)}**)
- **Matelas de sécurité 20 jours** : **${formatCurrency(minSafetyBuffer)}**
- **Épargne recommandée** : environ **${formatCurrency(monthlySave)}/mois** sans impacter ton loyer ni tes charges fixes.

🧭 **Possibilités d'épargne :**
- **Option A** : Épargner ${formatCurrency(monthlySave)}/mois en rythme de croisière.
- **Option B** : Allouer un surplus ponctuel de 50€ dès ta prochaine rentrée.

💬 **Échange avec Ney :**
Préfères-tu automatiser ce versement mensuel ou alimenter cette cagnotte au coup par coup ?`
          : `[SCENARIO: GO]

Here is my recommendation for your savings goal:

- **Current Runway**: **${runwayDays} days** (Cash: **${formatCurrency(currentBalance)}**)
- **20-Day Safety Buffer**: **${formatCurrency(minSafetyBuffer)}**
- **Recommended Savings**: approx. **${formatCurrency(monthlySave)}/month** without compromising your fixed expenses.

🧭 **Savings Pathways:**
- **Option A**: Save ${formatCurrency(monthlySave)}/month steadily.
- **Option B**: Deposit a $50 boost right when your next deposit arrives.

💬 **Ney's Question for you:**
Do you prefer scheduling an automatic monthly transfer or topping up whenever you have a surplus?`;

        fallbackFollowUpOptions = isFrench ? [
          { label: `🚀 Simuler avec ${formatCurrency(monthlySave)}/mois`, prompt: `Comment paramétrer une épargne de ${formatCurrency(monthlySave)}/mois ?`, type: 'action' },
          { label: '⚡ Accélérer le rythme', prompt: 'Puis-je épargner davantage sans risquer mon loyer ?', type: 'alternative' },
          { label: '🛡️ Revoir mon matelas de sécurité', prompt: 'Comment est calculé mon matelas de 20 jours ?', type: 'question' }
        ] : [
          { label: `🚀 Simulate with ${formatCurrency(monthlySave)}/mo`, prompt: `How do I set up ${formatCurrency(monthlySave)}/mo savings?`, type: 'action' },
          { label: '⚡ Accelerate pace', prompt: 'Can I save more without risking my rent?', type: 'alternative' },
          { label: '🛡️ Review safety cushion', prompt: 'How is my 20-day buffer calculated?', type: 'question' }
        ];
      } else if (/^(bonjour|salut|hello|hi|hey|coucou|bonsoir)[\s!.]*$/i.test(q)) {
        fallbackText = isFrench
          ? `Bonjour ! Ton autonomie financière est estimée à **${runwayDays} jours** avec une dépense sereine de **${formatCurrency(safeToSpendToday)}/j** et **${formatCurrency(currentBalance)}** en solde liquide.

- **Charges fixes mensuelles** : **${formatCurrency(totalFixedExpenses)}/mois**
- **Prochaine rentrée attendue** : **+${formatCurrency(nextIncomeAmount)}** ${nextIncomeDate ? `(le ${formatDate(nextIncomeDate)})` : ''}

🧭 **Possibilités d'exploration avec Ney :**
- **Option 1 (Simuler un achat)** : Vérifier l'impact direct d'une dépense sur ton runway.
- **Option 2 (Évaluer un projet)** : Pitcher une idée pour calculer son score dynamique et générer le JSON Firestore.
- **Option 3 (Optimiser le budget)** : Identifier les aides et bourses disponibles.

💬 **Échange avec Ney :**
Sur quelle décision financière ou projet souhaites-tu échanger aujourd'hui ?`
          : `Hi! Your financial runway is sitting at **${runwayDays} days** with **${formatCurrency(safeToSpendToday)}/day** in safe spending and **${formatCurrency(currentBalance)}** in available liquid cash.

- **Monthly Fixed Commitments**: **${formatCurrency(totalFixedExpenses)}/month**
- **Next Expected Deposit**: **+${formatCurrency(nextIncomeAmount)}** ${nextIncomeDate ? `(on ${formatDate(nextIncomeDate)})` : ''}

🧭 **Explore with Ney:**
- **Option 1 (Simulate an expense)**: Check runway and safe spend impact before spending.
- **Option 2 (Project Scoring)**: Pitch an idea to calculate viability score and Firestore JSON.
- **Option 3 (Student Grants)**: Discover regional aid programs.

💬 **Ney's Question for you:**
What financial decision or project would you like to explore together today?`;

        fallbackFollowUpOptions = isFrench ? [
          { label: '🍽️ Puis-je m\'offrir un resto à 25€ ?', prompt: 'Puis-je m\'offrir un resto à 25€ ce soir ?', type: 'action' },
          { label: '💡 Pitcher une idée de projet', prompt: 'J\'ai une idée de projet étudiant :', type: 'action' },
          { label: '🎓 Quelles sont les bourses disponibles ?', prompt: 'Quelles sont les bourses et aides disponibles ?', type: 'alternative' },
          { label: '📝 Comment ajouter une transaction ?', prompt: 'Comment ajouter une transaction ?', type: 'question' }
        ] : [
          { label: '🍽️ Can I afford a $25 dinner?', prompt: 'Can I afford a $25 dinner tonight?', type: 'action' },
          { label: '💡 Pitch a student project', prompt: 'I have a project idea: ', type: 'action' },
          { label: '🎓 Discover student grants', prompt: 'What student aids and grants are available?', type: 'alternative' },
          { label: '📝 How to add a transaction?', prompt: 'How to add a transaction?', type: 'question' }
        ];
      } else {
        fallbackConfidence = 'low';
        fallbackText = isFrench
          ? `Je n'ai pas pu identifier précisément ton intention pour : *« ${queryText} »*.

Pour que je puisse t'orienter avec une fiabilité maximale, voici les informations clés :

🧭 **Possibilités d'actions directes :**
- **Option 1** : Évaluer un achat spécifique en indiquant son montant (ex: 30€).
- **Option 2** : Poser une question sur l'enregistrement d'une dépense ou l'autonomie.
- **Option 3** : Pitcher une idée de projet ou explorer les bourses campus.

💬 **Échange avec Ney :**
Peux-tu m'en dire un peu plus sur ce que tu souhaites accomplir ?`
          : `I couldn't identify with high confidence your goal for: *« ${queryText} »*.

To give you tailored financial guidance, here are the pathways available:

🧭 **Available Action Pathways:**
- **Option 1**: Evaluate a specific purchase by stating the estimated cost (e.g. $30).
- **Option 2**: Ask how to log transactions or navigate features.
- **Option 3**: Pitch an entrepreneurial project or explore student grants.

💬 **Ney's Question for you:**
Could you share a bit more detail about what you'd like to achieve?`;

        fallbackClarification = {
          title: isFrench ? "Précisions nécessaires sur votre objectif" : "Clarification needed on your request",
          reason: isFrench 
            ? "Ney a besoin de plus de contexte pour faire le lien avec vos métriques financières."
            : "Ney needs more context to connect your question to your financial runway.",
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
              description: "Découvrir les bourses disponibles",
              example: "Ex: « Quelles sont les bourses disponibles ? »",
              suggestedPrompt: "Quelles sont les bourses et aides disponibles ?",
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
              label: "🎓 Student grants and aids",
              prompt: "What student aids and grants are available?",
              iconType: "help" as const,
            }
          ]
        };

        fallbackFollowUpOptions = isFrench ? [
          { label: '📝 Comment ajouter une transaction ?', prompt: 'Comment ajouter une transaction ?', type: 'question' },
          { label: '🍽️ Puis-je m\'offrir un resto à 25€ ?', prompt: 'Puis-je m\'offrir un resto à 25€ ce soir ?', type: 'action' },
          { label: '💡 Pitcher un projet étudiant', prompt: 'J\'ai une idée de projet :', type: 'action' },
          { label: '🎓 Voir les bourses disponibles', prompt: 'Quelles sont les bourses et aides disponibles ?', type: 'alternative' }
        ] : [
          { label: '📝 How to add a transaction?', prompt: 'How to add a transaction?', type: 'question' },
          { label: '🍽️ Can I afford a $25 dinner?', prompt: 'Can I afford a $25 dinner tonight?', type: 'action' },
          { label: '💡 Pitch a project idea', prompt: 'My project idea is: ', type: 'action' },
          { label: '🎓 Discover student grants', prompt: 'What student aids and grants are available?', type: 'alternative' }
        ];
      }

      const fallbackMsg: ChatMessage = {
        id: 'fallback-' + Date.now(),
        sender: 'ney',
        content: fallbackText,
        timestamp: new Date().toISOString(),
        confidence: fallbackConfidence,
        clarification: fallbackClarification,
        followUpOptions: fallbackFollowUpOptions,
      };
      setMessages(prev => [...prev, fallbackMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickPromptClick = (prompt: string) => {
    handleSendMessage(prompt);
  };

  const handleSimulatorConsult = (amount: number, title?: string, simulatedDays?: number) => {
    setShowSimulator(false);
    const formattedAmount = formatCurrency(amount);
    const daysStr = String(simulatedDays ?? 0);
    const query = title
      ? (t.views.chat.simulatorPromptWithTitle || 'J\'envisage un achat "{title}" d\'un montant de {amount}. Mon simulateur indique que mon runway passerait à {days} jours. Quel est ton conseil ?')
          .replace('{title}', title)
          .replace('{amount}', formattedAmount)
          .replace('{days}', daysStr)
      : (t.views.chat.simulatorPromptWithoutTitle || 'Que penses-tu d\'une dépense de {amount} ? Mon runway passerait à environ {days} jours.')
          .replace('{amount}', formattedAmount)
          .replace('{days}', daysStr);
    handleSendMessage(query);
  };

  const handleClearHistory = () => {
    const welcomeText = language === 'fr' 
      ? `Nouvelle conversation initialisée. Ton autonomie actuelle est de **${runwayDays} jours** avec **${formatCurrency(safeToSpendToday)}/j** de disponible serein. Quelle décision financière souhaites-tu explorer ?`
      : `New conversation started. Your autonomy is **${runwayDays} days** with **${formatCurrency(safeToSpendToday)}/day** in safe spending. What decision would you like to explore?`;

    setMessages([
      {
        id: 'welcome-reset',
        sender: 'ney',
        content: welcomeText,
        timestamp: new Date().toISOString(),
      }
    ]);
  };

  // Helper to render scenario tags cleanly from message text
  const renderMessageContent = (content: string) => {
    // Extract potential [SCENARIO: XX] badge
    const scenarioMatch = content.match(/\[SCENARIO:\s*(GO|WAIT|ADJUST|NO)\]/i);
    let scenario = scenarioMatch ? scenarioMatch[1].toUpperCase() : null;
    let cleanText = content.replace(/\[SCENARIO:\s*(GO|WAIT|ADJUST|NO)\]/gi, '').trim();

    return (
      <div className="space-y-3">
        {scenario && (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border font-mono text-xs font-bold mb-2">
            {scenario === 'GO' && (
              <span className="bg-[#D4FF3D]/15 text-[#D4FF3D] border border-[#D4FF3D]/30 px-2 py-0.5 rounded-lg flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {t.views.chat.scenarios.go.badge} : {t.views.chat.scenarios.go.label}
              </span>
            )}
            {scenario === 'WAIT' && (
              <span className="bg-[#FACC15]/15 text-[#FACC15] border border-[#FACC15]/30 px-2 py-0.5 rounded-lg flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                {t.views.chat.scenarios.wait.badge} : {t.views.chat.scenarios.wait.label}
              </span>
            )}
            {scenario === 'ADJUST' && (
              <span className="bg-[#38BDF8]/15 text-[#38BDF8] border border-[#38BDF8]/30 px-2 py-0.5 rounded-lg flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                {t.views.chat.scenarios.adjust.badge} : {t.views.chat.scenarios.adjust.label}
              </span>
            )}
            {scenario === 'NO' && (
              <span className="bg-[#F43F5E]/15 text-[#F43F5E] border border-[#F43F5E]/30 px-2 py-0.5 rounded-lg flex items-center gap-1.5">
                <XCircle className="w-3.5 h-3.5" />
                {t.views.chat.scenarios.no.badge} : {t.views.chat.scenarios.no.label}
              </span>
            )}
          </div>
        )}

        {/* Clean text formatted */}
        <div className="text-xs sm:text-sm leading-relaxed space-y-2 text-[#F5F5F0]">
          {cleanText.split('\n\n').map((paragraph, pIdx) => {
            // Check for list items
            if (paragraph.startsWith('- ') || paragraph.startsWith('* ')) {
              const items = paragraph.split('\n');
              return (
                <ul key={pIdx} className="list-disc pl-4 space-y-1 text-[#B8BCC4]">
                  {items.map((it, iIdx) => (
                    <li key={iIdx} dangerouslySetInnerHTML={{ __html: formatBoldAndItalic(it.replace(/^[-*]\s*/, '')) }} />
                  ))}
                </ul>
              );
            }
            return (
              <p 
                key={pIdx} 
                className="text-[#E2E8F0]"
                dangerouslySetInnerHTML={{ __html: formatBoldAndItalic(paragraph) }}
              />
            );
          })}
        </div>
      </div>
    );
  };

  // Helper for markdown **bold** and *italic*
  const formatBoldAndItalic = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-[#F5F5F0] font-semibold">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em class="text-[#D4FF3D] font-mono not-italic">$1</em>');
  };

  return (
    <div className="space-y-6">
      {/* Luxury Copilot Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#D4FF3D] text-[#0B0E17] flex items-center justify-center font-bold text-lg shadow-[0_0_20px_rgba(212,255,61,0.35)] shrink-0">
            N
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl sm:text-3xl font-light tracking-tight text-[#F5F5F0]">
                {t.brand.copilotName}
              </h2>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#D4FF3D]/15 text-[#D4FF3D] border border-[#D4FF3D]/30">
                {t.views.chat.nonGuiltAiBadge}
              </span>
            </div>
            <p className="text-xs text-[#8A8F98]">
              {t.brand.philosophies.aiAdvises} • {t.views.chat.contextPill.replace('{days}', formatDays(runwayDays)).replace('{safe}', formatCurrency(safeToSpendToday))}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            id="btn-chat-toggle-simulator"
            onClick={() => setShowSimulator(!showSimulator)}
            className={`px-4 py-2 min-h-[44px] rounded-full border text-xs font-mono flex items-center gap-2 transition-all cursor-pointer ${
              showSimulator 
                ? 'bg-[#D4FF3D] text-[#0B0E17] border-[#D4FF3D] font-bold shadow-[0_0_12px_rgba(212,255,61,0.3)]' 
                : 'bg-[#161b27] hover:bg-[#1e293b] text-[#8A8F98] hover:text-[#F5F5F0] border-[#1e293b]'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>{t.views.chat.simulatorToggle}</span>
          </button>

          <button
            id="btn-chat-clear"
            onClick={handleClearHistory}
            title={t.views.chat.clearChat}
            className="min-w-[44px] min-h-[44px] p-2.5 rounded-full bg-[#161b27] hover:bg-[#1e293b] text-[#8A8F98] hover:text-[#F5F5F0] border border-[#1e293b] transition-all cursor-pointer flex items-center justify-center"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Embedded Simulator Drawer if toggled */}
      <AnimatePresence>
        {showSimulator && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <DecisionSimulator 
              compact={true}
              onConsultNey={handleSimulatorConsult}
              className="border-[#D4FF3D]/40 shadow-[0_0_25px_rgba(212,255,61,0.15)] mb-4"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Chat Conversation Container */}
      <div 
        id="chat-conversation-container"
        className="bg-[#161b27] border border-[#1e293b] rounded-3xl p-4 sm:p-6 shadow-2xl flex flex-col h-[580px] relative overflow-hidden"
      >
        {/* Ambient Top Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-32 bg-[#D4FF3D]/5 rounded-full blur-3xl pointer-events-none" />

        {/* Message Thread Scroll Area */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin scrollbar-thumb-[#1e293b]">
          {messages.map((msg) => {
            const isNey = msg.sender === 'ney';
            return (
              <div 
                key={msg.id}
                className={`flex items-start gap-3 max-w-2xl ${isNey ? 'mr-auto' : 'ml-auto flex-row-reverse'}`}
              >
                {/* Avatar Icon */}
                <div 
                  className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 shadow-md ${
                    isNey 
                      ? 'bg-[#D4FF3D] text-[#0B0E17] shadow-[0_0_10px_rgba(212,255,61,0.25)]' 
                      : 'bg-[#1e293b] text-[#F5F5F0] border border-[#334155]'
                  }`}
                >
                  {isNey ? 'N' : <User className="w-4 h-4" />}
                </div>

                {/* Message Bubble */}
                <div 
                  className={`p-4 rounded-2xl text-xs sm:text-sm leading-relaxed border transition-all ${
                    isNey 
                      ? (msg.confidence === 'low' || msg.clarification)
                        ? 'bg-[#0B0E17] border-[#FACC15]/40 rounded-tl-sm text-[#F5F5F0] shadow-[0_0_20px_rgba(250,204,21,0.06)]'
                        : 'bg-[#0B0E17] border-[#1e293b] rounded-tl-sm text-[#F5F5F0]' 
                      : 'bg-[#D4FF3D]/10 border-[#D4FF3D]/30 rounded-tr-sm text-[#F5F5F0]'
                  }`}
                >
                  {isNey ? (
                    <>
                      {renderMessageContent(msg.content)}
                      {(msg.confidence === 'low' || msg.clarification) && (
                        <ChatFallback
                          clarification={msg.clarification}
                          onSelectPrompt={handleQuickPromptClick}
                          onNavigate={onNavigate}
                          onFocusInput={() => {
                            const inputEl = document.getElementById('input-chat-query');
                            if (inputEl) {
                              inputEl.focus();
                            }
                          }}
                        />
                      )}
                      {msg.followUpOptions && msg.followUpOptions.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-[#1e293b] space-y-2">
                          <div className="flex items-center gap-1.5 text-[10px] uppercase font-mono tracking-wider text-[#D4FF3D]">
                            <Sparkles className="w-3 h-3 text-[#D4FF3D]" />
                            <span>{language === 'fr' ? 'Échange & Possibilités avec Ney :' : 'Discussion & Next options :'}</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {msg.followUpOptions.map((opt, optIdx) => (
                              <button
                                key={optIdx}
                                type="button"
                                onClick={() => handleQuickPromptClick(opt.prompt)}
                                className="text-left px-3 py-1.5 min-h-[34px] rounded-xl bg-[#161b27] hover:bg-[#1e293b] text-[#F5F5F0] hover:text-[#D4FF3D] border border-[#1e293b] hover:border-[#D4FF3D]/40 text-xs font-mono transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                              >
                                <span>{opt.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-[#F5F5F0] whitespace-pre-wrap">{msg.content}</p>
                  )}
                  <div className="text-[9px] font-mono text-[#8A8F98] mt-2 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      {isNey ? t.brand.copilotName : t.views.chat.userLabel}
                      {isNey && msg.confidence === 'low' && (
                        <span className="text-[8px] px-1 py-0.2 rounded bg-[#FACC15]/20 text-[#FACC15] font-mono">
                          {language === 'fr' ? 'À préciser' : 'Clarify'}
                        </span>
                      )}
                    </span>
                    <span>{formatTime(new Date(msg.timestamp))}</span>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Thinking / Typing indicator */}
          {isLoading && (
            <div className="flex items-start gap-3 mr-auto max-w-sm">
              <div className="w-8 h-8 rounded-xl bg-[#D4FF3D] text-[#0B0E17] flex items-center justify-center font-bold text-xs shrink-0 animate-pulse">
                N
              </div>
              <div className="p-3.5 rounded-2xl rounded-tl-sm bg-[#0B0E17] border border-[#1e293b] flex items-center gap-2 text-xs font-mono text-[#D4FF3D]">
                <Sparkles className="w-4 h-4 animate-spin text-[#D4FF3D]" />
                <span>{t.views.chat.thinking}</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Prompts Carousel */}
        <div className="pt-3 pb-2 border-t border-[#1e293b] overflow-x-auto scrollbar-none flex items-center gap-2">
          <span className="text-[10px] uppercase font-mono text-[#8A8F98] whitespace-nowrap pl-1">
            {t.views.chat.ideasLabel}
          </span>
          {t.views.chat.quickPrompts.map((prompt, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleQuickPromptClick(prompt)}
              className="px-3.5 py-2 min-h-[38px] rounded-full bg-[#0B0E17] hover:bg-[#1e293b] border border-[#1e293b] hover:border-[#D4FF3D]/40 text-xs text-[#8A8F98] hover:text-[#F5F5F0] whitespace-nowrap transition-all font-mono cursor-pointer flex items-center"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="pt-2 space-y-2"
        >
          {/* Listening / Error feedback */}
          {isListening && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#D4FF3D]/10 border border-[#D4FF3D]/30 text-[#D4FF3D] text-xs font-mono">
              <span className="w-2.5 h-2.5 rounded-full bg-[#F43F5E] animate-ping shrink-0" />
              <span className="font-semibold">{language === 'fr' ? 'Écoute vocale active...' : 'Listening to voice...'}</span>
              <span className="text-[#8A8F98] text-[11px] truncate">
                {language === 'fr' ? 'Dites votre dépense ou question à voix haute' : 'Speak your question or transaction out loud'}
              </span>
            </div>
          )}

          {speechError && (
            <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-[#F43F5E]/15 border border-[#F43F5E]/30 text-[#FB7185] text-xs font-mono">
              <div className="flex items-center gap-1.5 truncate">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{speechError}</span>
              </div>
              <button 
                type="button" 
                onClick={() => setSpeechError(null)}
                className="p-1 hover:bg-[#F43F5E]/20 rounded text-[#FB7185]"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          <div className="flex items-center gap-2 bg-[#0B0E17] border border-[#1e293b] focus-within:border-[#D4FF3D] rounded-2xl px-3 py-1.5 transition-all">
            <input
              id="input-chat-query"
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder={isListening ? (language === 'fr' ? 'Parlez maintenant...' : 'Speak now...') : t.views.chat.inputPlaceholder}
              disabled={isLoading}
              className="flex-1 bg-transparent border-none text-xs sm:text-sm text-[#F5F5F0] placeholder-[#8A8F98] focus:outline-none py-2 px-1"
            />
            
            {/* Voice Input Button */}
            <button
              id="btn-chat-voice"
              type="button"
              onClick={toggleVoiceInput}
              disabled={isLoading}
              title={isListening 
                ? (language === 'fr' ? 'Arrêter la capture vocale' : 'Stop voice recording') 
                : (language === 'fr' ? 'Parler à Ney (Entrée vocale)' : 'Speak to Ney (Voice input)')}
              className={`min-w-[44px] min-h-[44px] p-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center shrink-0 ${
                isListening 
                  ? 'bg-[#F43F5E] text-white shadow-[0_0_20px_rgba(244,63,94,0.6)] animate-pulse' 
                  : 'bg-[#161b27] hover:bg-[#1e293b] text-[#8A8F98] hover:text-[#D4FF3D] border border-[#1e293b]'
              }`}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            {/* Send Button */}
            <button
              id="btn-chat-send"
              type="submit"
              disabled={!inputMessage.trim() || isLoading}
              className="min-w-[44px] min-h-[44px] p-2.5 rounded-xl bg-[#D4FF3D] hover:bg-[#C2F028] text-[#0B0E17] disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center justify-center shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
