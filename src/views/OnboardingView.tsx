import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../i18n';
import { SupportedCurrency, SupportedRegion, Transaction } from '../types';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { computeAndSaveUserRunway } from '../lib/runwayEngine';
import { analytics } from '../lib/analytics';
import { 
  Sparkles, 
  ArrowRight, 
  ArrowLeft, 
  Check, 
  Wallet, 
  Home, 
  ShoppingBag, 
  ShieldCheck, 
  Compass, 
  TrendingDown, 
  Clock, 
  MessageSquare,
  HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface OnboardingViewProps {
  onCompletePreview?: () => void;
}

const ONBOARDING_I18N = {
  fr: {
    badge: 'COPILOTE FINANCIER ÉTUDIANT',
    philosophyTag: 'L’IA conseille. Vous décidez.',
    moment1: {
      title: 'Tu veux savoir ce que tu peux faire avec ton argent aujourd’hui ?',
      subtitle: 'NEYRUNWAY transforme tes décisions en conséquences compréhensibles. Zéro budget rigide, zéro formulaire comptable.',
      highlights: [
        { title: 'Horizon en jours (Runway)', desc: 'Combien de jours ton argent dure réellement, sans formules mathématiques obscures.' },
        { title: 'Disponible immédiat sanctuarisé', desc: 'Ce que tu peux dépenser aujourd’hui en protégeant automatiquement ton loyer.' },
        { title: 'Test instantané "Can I afford this?"', desc: 'Vois ce que chaque dépense change sur ton autonomie avant de décider.' },
      ],
      primaryCta: 'Voir ce que je peux faire',
      secondaryCta: 'Explorer d’abord',
    },
    moment2: {
      stepBadge: '01 • CONTEXTE MINIMAL',
      title: 'Tes 2 repères de départ',
      subtitle: 'Pas de questionnaire fleuve. Deux chiffres suffisent pour projeter immédiatement ton autonomie.',
      balanceLabel: 'Solde disponible sur ton compte',
      fixedLabel: 'Loyer et charges mensuelles prévues',
      fixedHelp: 'Cette somme est isolée dans le calcul pour protéger tes échéances vitales.',
      regionLabel: 'Région & Devise',
      cta: 'Projeter mon disponible',
      back: 'Retour',
    },
    moment3: {
      stepBadge: '02 • PREMIER MOMENT MAGIQUE',
      title: 'Que se passe-t-il si tu achètes quelque chose ?',
      subtitle: 'Tape un achat réel ou clique sur une situation étudiante. Regarde l’effet en direct sur tes jours.',
      omniboxPlaceholder: 'Ex: "Casque 89 €" ou "Sortie 30 €"...',
      before: 'AVANT',
      after: 'APRÈS',
      impact: 'IMPACT',
      beforeSub: 'Runway actuel',
      afterSub: 'Runway projeté',
      impactSub: 'Sur ton autonomie',
      daysUnit: 'jours',
      presetsTitle: 'Situations étudiantes courantes :',
      btnBuy: 'J’achète',
      btnWait: 'J’attends',
      btnAskNey: 'Demander à Ney',
      choiceNotedBuy: 'Achat simulé pris en compte dans ton essai.',
      choiceNotedWait: 'Décision de temporiser notée. Ton horizon reste intact.',
      ctaContinue: 'Comprendre mon espace →',
      back: 'Modifier mes repères',
    },
    moment4: {
      stepBadge: '03 • TON SYSTÈME DE NAVIGATION',
      title: 'Voilà comment tu pilotes ton argent',
      subtitle: 'Tu n’as plus besoin de tenir des comptes compliqués. Voici tes 5 repères essentiels :',
      cards: [
        { num: '01', title: 'DISPONIBLE AUJOURD’HUI', desc: 'Ce que tu peux utiliser sans mettre tes échéances sous tension.' },
        { num: '02', title: 'RUNWAY', desc: 'Combien de jours ton argent peut tenir à ton rythme actuel.' },
        { num: '03', title: 'CAN I AFFORD THIS?', desc: 'Ton réflexe avant un achat pour voir immédiatement ce que ça change.' },
        { num: '04', title: 'NEXT MOVE', desc: 'La prochaine action utile basée sur un fait financier réel.' },
        { num: '05', title: 'NEY', desc: 'Ton copilote qui répond à tes doutes sans jargon ni jugement.' },
      ],
      ctaDashboard: 'Accéder à mon tableau de bord',
      back: 'Refaire une simulation',
    },
  },
  en: {
    badge: 'STUDENT FINANCIAL COPILOT',
    philosophyTag: 'AI advises. You decide.',
    moment1: {
      title: 'Want to know what you can safely do with your money today?',
      subtitle: 'NEYRUNWAY turns financial decisions into understandable consequences. Zero rigid budgeting, zero accounting forms.',
      highlights: [
        { title: 'Runway in days', desc: 'How many days your money actually lasts, without obscure accounting math.' },
        { title: 'Protected Safe-to-Spend', desc: 'What you can spend today while automatically ring-fencing your rent.' },
        { title: 'Instant "Can I afford this?" test', desc: 'See what every purchase changes on your runway before you decide.' },
      ],
      primaryCta: 'See what I can do',
      secondaryCta: 'Explore first',
    },
    moment2: {
      stepBadge: '01 • MINIMUM CONTEXT',
      title: 'Your 2 starting reference points',
      subtitle: 'No long questionnaire. Two numbers are enough to immediately project your runway.',
      balanceLabel: 'Available cash in your bank account',
      fixedLabel: 'Monthly rent and essential commitments',
      fixedHelp: 'This sum is ring-fenced to safeguard vital bills from overdrafts.',
      regionLabel: 'Region & Currency',
      cta: 'Calculate my runway',
      back: 'Back',
    },
    moment3: {
      stepBadge: '02 • FIRST MAGIC MOMENT',
      title: 'What happens if you buy something?',
      subtitle: 'Type a purchase or tap a student shortcut. Watch the direct effect on your days.',
      omniboxPlaceholder: 'e.g. "Headphones 89 €" or "Dinner 30 €"...',
      before: 'BEFORE',
      after: 'AFTER',
      impact: 'IMPACT',
      beforeSub: 'Current runway',
      afterSub: 'Projected runway',
      impactSub: 'On your horizon',
      daysUnit: 'days',
      presetsTitle: 'Common student situations:',
      btnBuy: 'I’ll buy',
      btnWait: 'I’ll wait',
      btnAskNey: 'Ask Ney',
      choiceNotedBuy: 'Simulated purchase recorded in your test.',
      choiceNotedWait: 'Decision to wait noted. Your runway remains intact.',
      ctaContinue: 'Understand my space →',
      back: 'Edit reference points',
    },
    moment4: {
      stepBadge: '03 • YOUR NAVIGATION SYSTEM',
      title: 'How you navigate your money',
      subtitle: 'No need to maintain complex bookkeeping. Here are your 5 essentials:',
      cards: [
        { num: '01', title: 'SAFE TO SPEND TODAY', desc: 'What you can use without putting upcoming commitments at risk.' },
        { num: '02', title: 'RUNWAY', desc: 'How many days your money will last at your current pace.' },
        { num: '03', title: 'CAN I AFFORD THIS?', desc: 'Your reflex before a purchase to see what changes immediately.' },
        { num: '04', title: 'NEXT MOVE', desc: 'The next helpful action based on an identifiable financial signal.' },
        { num: '05', title: 'NEY', desc: 'Your copilot who answers your questions without jargon or judgment.' },
      ],
      ctaDashboard: 'Go to my dashboard',
      back: 'Run another simulation',
    },
  },
  es: {
    badge: 'COPILOTO FINANCIERO ESTUDIANTIL',
    philosophyTag: 'La IA aconseja. Tú decides.',
    moment1: {
      title: '¿Quieres saber qué puedes hacer con tu dinero hoy?',
      subtitle: 'NEYRUNWAY transforma tus decisiones en consecuencias claras. Cero presupuestos rígidos, cero formularios contables.',
      highlights: [
        { title: 'Horizonte en días (Runway)', desc: 'Cuántos días dura realmente tu dinero sin hojas de cálculo aburridas.' },
        { title: 'Disponible inmediato protegido', desc: 'Lo que puedes gastar hoy asegurando tu alquiler con anticipación.' },
        { title: 'Prueba instantánea "¿Me lo puedo permitir?"', desc: 'Descubre qué cambia una compra antes de pagarla.' },
      ],
      primaryCta: 'Ver qué puedo hacer',
      secondaryCta: 'Explorar primero',
    },
    moment2: {
      stepBadge: '01 • CONTEXTO MÍNIMO',
      title: 'Tus 2 puntos de partida',
      subtitle: 'Sin formularios largos. Dos cifras bastan para calcular tu autonomía.',
      balanceLabel: 'Saldo disponible en tu cuenta',
      fixedLabel: 'Alquiler y gastos mensuales fijos',
      fixedHelp: 'Esta suma queda blindada para proteger tus pagos vitales.',
      regionLabel: 'Región y Moneda',
      cta: 'Proyectar mi disponible',
      back: 'Volver',
    },
    moment3: {
      stepBadge: '02 • PRIMER MOMENTO MÁGICO',
      title: '¿Qué pasa si compras algo?',
      subtitle: 'Escribe una compra o toca un acceso rápido. Observa el impacto en días.',
      omniboxPlaceholder: 'Ej: "Auriculares 89 €" o "Cena 30 €"...',
      before: 'ANTES',
      after: 'DESPUÉS',
      impact: 'IMPACTO',
      beforeSub: 'Runway actual',
      afterSub: 'Runway proyectado',
      impactSub: 'En tu autonomía',
      daysUnit: 'días',
      presetsTitle: 'Situaciones habituales:',
      btnBuy: 'Lo compro',
      btnWait: 'Espero',
      btnAskNey: 'Preguntar a Ney',
      choiceNotedBuy: 'Compra simulada tomada en cuenta.',
      choiceNotedWait: 'Decisión de esperar registrada. Tu horizonte se mantiene.',
      ctaContinue: 'Entender mi espacio →',
      back: 'Cambiar mis datos',
    },
    moment4: {
      stepBadge: '03 • TU SISTEMA DE NAVEGACIÓN',
      title: 'Así navegas tu dinero',
      subtitle: 'Ya no tienes que llevar contabilidades pesadas. Estos son tus 5 pilares:',
      cards: [
        { num: '01', title: 'DISPONIBLE HOY', desc: 'Lo que puedes usar sin poner en riesgo tus pagos próximos.' },
        { num: '02', title: 'RUNWAY', desc: 'Los días que tu dinero resiste a tu ritmo actual.' },
        { num: '03', title: 'CAN I AFFORD THIS?', desc: 'Tu reflejo antes de comprar para ver el cambio al instante.' },
        { num: '04', title: 'NEXT MOVE', desc: 'La siguiente acción recomendada con base en un dato real.' },
        { num: '05', title: 'NEY', desc: 'Tu copiloto que te orienta sin juzgarte.' },
      ],
      ctaDashboard: 'Acceder a mi panel',
      back: 'Hacer otra simulación',
    },
  },
  pt: {
    badge: 'COPILOTO FINANCEIRO UNIVERSITÁRIO',
    philosophyTag: 'A IA aconselha. Você decide.',
    moment1: {
      title: 'Quer saber o que você pode fazer com seu dinheiro hoje?',
      subtitle: 'NEYRUNWAY transforma suas decisões em consequências compreensíveis. Sem orçamentos rígidos, sem formulários contábeis.',
      highlights: [
        { title: 'Horizonte em dias (Runway)', desc: 'Quantos dias seu dinheiro dura de verdade, sem planilhas chatas.' },
        { title: 'Disponível diário protegido', desc: 'O que você pode gastar hoje protegendo seu aluguel com segurança.' },
        { title: 'Teste instantâneo "Posso comprar?"', desc: 'Veja o impacto de cada compra antes de tomar a decisão.' },
      ],
      primaryCta: 'Ver o que posso fazer',
      secondaryCta: 'Explorar primeiro',
    },
    moment2: {
      stepBadge: '01 • CONTEXTO MÍNIMO',
      title: 'Seus 2 pontos de partida',
      subtitle: 'Sem questionários longos. Dois números são suficientes para projetar sua autonomia.',
      balanceLabel: 'Saldo disponível na sua conta',
      fixedLabel: 'Aluguel e contas mensais fixas',
      fixedHelp: 'Esse valor fica reservado para evitar qualquer aperto no fim do mês.',
      regionLabel: 'Região e Moeda',
      cta: 'Calcular meu disponível',
      back: 'Voltar',
    },
    moment3: {
      stepBadge: '02 • PRIMEIRO MOMENTO MÁGICO',
      title: 'O que acontece se você comprar algo?',
      subtitle: 'Digite uma compra ou toque num atalho de estudante. Veja o impacto direto em dias.',
      omniboxPlaceholder: 'Ex: "Fones 89 €" ou "Jantar 30 €"...',
      before: 'ANTES',
      after: 'DEPOIS',
      impact: 'IMPACTO',
      beforeSub: 'Runway atual',
      afterSub: 'Runway projetado',
      impactSub: 'Na sua autonomia',
      daysUnit: 'dias',
      presetsTitle: 'Situações comuns de estudante:',
      btnBuy: 'Eu compro',
      btnWait: 'Vou esperar',
      btnAskNey: 'Perguntar ao Ney',
      choiceNotedBuy: 'Compra simulada considerada no teste.',
      choiceNotedWait: 'Decisão de esperar anotada. Sua margem permanece.',
      ctaContinue: 'Entender meu espaço →',
      back: 'Alterar pontos de partida',
    },
    moment4: {
      stepBadge: '03 • SEU SISTEMA DE NAVEGAÇÃO',
      title: 'Como você pilota seu dinheiro',
      subtitle: 'Você não precisa mais fazer contabilidade complexa. Aqui estão seus 5 pilares:',
      cards: [
        { num: '01', title: 'DISPONÍVEL HOJE', desc: 'O que você pode usar sem sufocar suas contas essenciais.' },
        { num: '02', title: 'RUNWAY', desc: 'Quantos dias seu dinheiro dura no ritmo atual.' },
        { num: '03', title: 'CAN I AFFORD THIS?', desc: 'Seu reflexo antes de comprar para ver a mudança imediata.' },
        { num: '04', title: 'NEXT MOVE', desc: 'A próxima ação prática baseada em dados reais.' },
        { num: '05', title: 'NEY', desc: 'Seu copiloto que esclarece dúvidas sem jargões.' },
      ],
      ctaDashboard: 'Acessar meu painel',
      back: 'Simular outra compra',
    },
  },
  hi: {
    badge: 'छात्र वित्तीय नेविगेटर',
    philosophyTag: 'AI सलाह देता है। निर्णय आपका है।',
    moment1: {
      title: 'जानना चाहते हैं कि आज आप अपने पैसों से सुरक्षित रूप से क्या कर सकते हैं?',
      subtitle: 'NEYRUNWAY आपके खर्च के फैसलों को स्पष्ट परिणामों में बदलता है। बिना किसी जटिल बजट के।',
      highlights: [
        { title: 'दिनों में रनवे (Runway)', desc: 'आपके पैसे वास्तव में कितने दिन चलेंगे।' },
        { title: 'सुरक्षित आज का खर्च', desc: 'किराया सुरक्षित रखते हुए आज आप क्या खर्च कर सकते हैं।' },
        { title: 'तत्काल "क्या मैं यह खरीद सकता हूँ?" टेस्ट', desc: 'खरीदने से पहले देखें कि यह आपके रनवे पर क्या असर डालता है।' },
      ],
      primaryCta: 'देखें मैं क्या कर सकता हूँ',
      secondaryCta: 'पहले एक्सप्लोर करें',
    },
    moment2: {
      stepBadge: '01 • न्यूनतम संदर्भ',
      title: 'शुरुआत के 2 मुख्य आंकड़े',
      subtitle: 'कोई लंबा फॉर्म नहीं। केवल 2 आंकड़े काफी हैं।',
      balanceLabel: 'खाते में उपलब्ध राशि',
      fixedLabel: 'मासिक किराया और निश्चित खर्च',
      fixedHelp: 'यह राशि आपके आवश्यक खर्चों के लिए सुरक्षित रखी जाती है।',
      regionLabel: 'क्षेत्र और मुद्रा',
      cta: 'मेरा रनवे कैलकुलेट करें',
      back: 'वापस',
    },
    moment3: {
      stepBadge: '02 • पहला मैजिक मोमेंट',
      title: 'यदि आप कुछ खरीदते हैं तो क्या होगा?',
      subtitle: 'कोई भी खर्च लिखें या विकल्प चुनें। तुरंत दिनों पर प्रभाव देखें।',
      omniboxPlaceholder: 'जैसे: हेडफ़ोन 89 € या भोजन 30 €...',
      before: 'पहले',
      after: 'बाद में',
      impact: 'प्रभाव',
      beforeSub: 'वर्तमान रनवे',
      afterSub: 'नया रनवे',
      impactSub: 'आपके दिनों पर',
      daysUnit: 'दिन',
      presetsTitle: 'सामान्य छात्र स्थितियाँ:',
      btnBuy: 'मैं खरीदूँगा',
      btnWait: 'मैं रुकूँगा',
      btnAskNey: 'Ney से पूछें',
      choiceNotedBuy: 'सिम्युलेटेड खरीद दर्ज की गई।',
      choiceNotedWait: 'रुकने का निर्णय दर्ज। आपका रनवे सुरक्षित है।',
      ctaContinue: 'मेरा डैशबोर्ड समझें →',
      back: 'आंकड़े बदलें',
    },
    moment4: {
      stepBadge: '03 • आपका नेविगेशन सिस्टम',
      title: 'आप अपने पैसों को कैसे नेविगेट करते हैं',
      subtitle: 'आपको जटिल हिसाब-किताब की जरूरत नहीं है। ये हैं 5 मुख्य बिंदु:',
      cards: [
        { num: '01', title: 'आज खर्च करने के लिए सुरक्षित', desc: 'किराये को बिना खतरे में डाले उपलब्ध राशि।' },
        { num: '02', title: 'रनवे', desc: 'वर्तमान गति से आपके पैसे कितने दिन चलेंगे।' },
        { num: '03', title: 'CAN I AFFORD THIS?', desc: 'खरीदने से पहले त्वरित प्रभाव देखने का आपका रिफ्लेक्स।' },
        { num: '04', title: 'NEXT MOVE', desc: 'वास्तविक डेटा पर आधारित अगला उपयोगी कदम।' },
        { num: '05', title: 'NEY', desc: 'आपका AI साथी जो बिना किसी तनाव के समझाता है।' },
      ],
      ctaDashboard: 'मेरे डैशबोर्ड पर जाएं',
      back: 'अन्य खर्च का टेस्ट करें',
    },
  },
};

export const OnboardingView: React.FC<OnboardingViewProps> = ({ onCompletePreview }) => {
  const { currentUser, updateUserProfile } = useAuth();
  const { 
    language, 
    region, 
    setRegion, 
    currency, 
    setCurrency, 
    formatCurrency 
  } = useTranslation();

  const langKey = (language in ONBOARDING_I18N ? language : 'fr') as keyof typeof ONBOARDING_I18N;
  const strings = ONBOARDING_I18N[langKey] || ONBOARDING_I18N.fr;

  // 4 Progressive Moments: 1 = Recognition, 2 = Minimum Context, 3 = First Magic Moment, 4 = Navigation Reveal
  const [moment, setMoment] = useState<1 | 2 | 3 | 4>(1);

  // Moment 2: Minimum Context
  const [selectedRegion, setSelectedRegion] = useState<SupportedRegion>(region || 'FR');
  const [selectedCurrency, setSelectedCurrency] = useState<SupportedCurrency>(currency || 'EUR');
  const [balance, setBalance] = useState<string>('1250');
  const [fixedExpenses, setFixedExpenses] = useState<string>('450');

  // Moment 3: Magic Moment Simulation
  const [omniboxInput, setOmniboxInput] = useState<string>('Casque 89 €');
  const [simulatedTitle, setSimulatedTitle] = useState<string>('Casque');
  const [simulatedAmount, setSimulatedAmount] = useState<number>(89);
  const [userDecision, setUserDecision] = useState<'buy' | 'wait' | 'consult' | null>(null);

  // Baseline Calculated metrics
  const parsedBalance = parseFloat(balance) || 1250;
  const parsedFixed = parseFloat(fixedExpenses) || 450;
  
  // Instant calculations based on core financial logic
  const baselineDailyBurn = useMemo(() => {
    return (parsedFixed / 30) + 16; // Housing + modest variable pace
  }, [parsedFixed]);

  const baselineRunwayDays = useMemo(() => {
    return Math.max(10, Math.floor(parsedBalance / baselineDailyBurn));
  }, [parsedBalance, baselineDailyBurn]);

  const baselineSafeToSpend = useMemo(() => {
    const liquidBuffer = Math.max(0, parsedBalance - parsedFixed);
    return Math.max(0, Math.round((liquidBuffer / 18) * 10) / 10);
  }, [parsedBalance, parsedFixed]);

  // Projected Runway when simulatedAmount is applied
  const projectedRunwayDays = useMemo(() => {
    const postBalance = Math.max(0, parsedBalance - simulatedAmount);
    return Math.max(0, Math.floor(postBalance / baselineDailyBurn));
  }, [parsedBalance, simulatedAmount, baselineDailyBurn]);

  const daysDifference = projectedRunwayDays - baselineRunwayDays; // e.g. -3

  // Parse omnibox whenever it changes
  const handleOmniboxChange = (text: string) => {
    setOmniboxInput(text);
    setUserDecision(null);
    const cleaned = text.replace(/€|\$|£|CHF|₹/gi, '').trim();
    const match = cleaned.match(/(\d+(?:[.,]\d+)?)/);
    if (match) {
      const num = parseFloat(match[1].replace(',', '.'));
      setSimulatedAmount(num || 0);
      const titleOnly = text.replace(match[0], '').replace(/€|\$|£|CHF|₹/gi, '').trim();
      setSimulatedTitle(titleOnly || (langKey === 'fr' ? 'Achat test' : 'Purchase test'));
    } else {
      setSimulatedAmount(0);
      setSimulatedTitle(text.trim());
    }
  };

  // One-tap native student life presets
  const studentPresets = [
    { label: langKey === 'fr' ? 'Casque' : 'Headphones', amount: 89, icon: '🎧' },
    { label: langKey === 'fr' ? 'Courses' : 'Groceries', amount: 35, icon: '🍎' },
    { label: langKey === 'fr' ? 'Sortie' : 'Night out', amount: 30, icon: '🎉' },
    { label: langKey === 'fr' ? 'Transport' : 'Train pass', amount: 25, icon: '🚆' },
    { label: langKey === 'fr' ? 'Voyage' : 'Trip', amount: 120, icon: '✈️' },
  ];

  const handleSelectPreset = (p: { label: string; amount: number }) => {
    setSimulatedTitle(p.label);
    setSimulatedAmount(p.amount);
    setOmniboxInput(`${p.label} ${p.amount} €`);
    setUserDecision(null);
    analytics.track('first_simulation_started', { preset: p.label, amount: p.amount });
  };

  // Track initial onboarding started
  useEffect(() => {
    analytics.track('onboarding_started', { region: selectedRegion, currency: selectedCurrency });
  }, []);

  // Complete onboarding & store profile
  const handleFinishAndEnterApp = async () => {
    analytics.track('onboarding_completed', {
      balance: parsedBalance,
      fixed: parsedFixed,
      testedAmount: simulatedAmount,
      decision: userDecision,
    });
    analytics.track('first_runway_generated', { runwayDays: baselineRunwayDays });
    analytics.track('first_safe_to_spend_viewed', { safeToSpendToday: baselineSafeToSpend });

    try {
      if (currentUser) {
        // Update user profile in Firestore
        await updateUserProfile({
          initialBalance: parsedBalance,
          preferredLanguage: language,
          region: selectedRegion,
          currency: selectedCurrency,
          onboardingCompleted: true,
        });

        // Store rent as ring-fenced fixed transaction
        const userId = currentUser.uid;
        await addDoc(collection(db, 'users', userId, 'transactions'), {
          userId,
          title: langKey === 'fr' ? 'Loyer & charges' : 'Rent & fixed bills',
          amount: parsedFixed,
          category: 'housing',
          type: 'fixed',
          date: new Date().toISOString().split('T')[0],
          status: 'settled',
          isRecurring: true,
          memoryStatus: 'confirmed',
          memorySource: 'user_added',
          isDisabledInRunway: false,
          createdAt: serverTimestamp(),
        });

        // If user chose "J'achète" during simulation, log that purchase
        if (userDecision === 'buy' && simulatedAmount > 0) {
          await addDoc(collection(db, 'users', userId, 'transactions'), {
            userId,
            title: simulatedTitle || (langKey === 'fr' ? 'Achat validé' : 'Purchase'),
            amount: simulatedAmount,
            category: 'shopping',
            type: 'variable',
            date: new Date().toISOString().split('T')[0],
            status: 'settled',
            isRecurring: false,
            memoryStatus: 'confirmed',
            memorySource: 'user_added',
            isDisabledInRunway: false,
            createdAt: serverTimestamp(),
          });
        }

        await computeAndSaveUserRunway(userId, parsedBalance);
      } else {
        // Guest mode fallback persistence in localStorage
        try {
          localStorage.setItem('neyrunway_guest_onboarded', 'true');
          localStorage.setItem('neyrunway_initial_balance', String(parsedBalance));
        } catch {}
      }
    } catch (err) {
      console.warn('Notice saving onboarding payload:', err);
    } finally {
      if (onCompletePreview) {
        onCompletePreview();
      }
    }
  };

  // Direct explore skip
  const handleDirectExplore = () => {
    analytics.track('onboarding_completed', { skippedToDashboard: true });
    if (onCompletePreview) {
      onCompletePreview();
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-4 sm:py-8 space-y-6">
      {/* Top Copilot Bar */}
      <div className="flex items-center justify-between pb-3 border-b border-[#1e293b]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#D4FF3D]/10 border border-[#D4FF3D]/30 flex items-center justify-center text-[#D4FF3D]">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-[#F5F5F0]">
                {strings.badge}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-[#D4FF3D]/10 text-[#D4FF3D] border border-[#D4FF3D]/20 text-[10px] font-mono">
                {strings.philosophyTag}
              </span>
            </div>
            <p className="text-[11px] text-[#8A8F98]">
              {moment === 1 && (langKey === 'fr' ? 'Étape 0/3 • Découverte' : 'Step 0/3 • Discovery')}
              {moment === 2 && strings.moment2.stepBadge}
              {moment === 3 && strings.moment3.stepBadge}
              {moment === 4 && strings.moment4.stepBadge}
            </p>
          </div>
        </div>

        {/* Visual Progress dots */}
        <div className="flex items-center gap-1.5">
          {[1, 2, 3, 4].map((m) => (
            <div
              key={m}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                m === moment
                  ? 'w-7 bg-[#D4FF3D]'
                  : m < moment
                  ? 'w-3.5 bg-[#D4FF3D]/50'
                  : 'w-3.5 bg-[#1e293b]'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Main Moment Container */}
      <div className="bg-[#161b27] border border-[#1e293b] rounded-3xl p-6 sm:p-9 shadow-2xl relative overflow-hidden">
        {/* Subtle luminous accent */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-[#D4FF3D]/5 rounded-full blur-3xl pointer-events-none" />

        <AnimatePresence mode="wait">
          {/* ========================================================
              MOMENT 1 — RECOGNITION: Immediate Student Problem Statement
              ======================================================== */}
          {moment === 1 && (
            <motion.div
              key="moment-1"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D4FF3D]/10 text-[#D4FF3D] border border-[#D4FF3D]/20 text-xs font-mono">
                  <Compass className="w-3.5 h-3.5" />
                  <span>{langKey === 'fr' ? 'NAVIGATION DÉCISIONNELLE' : 'DECISION NAVIGATION'}</span>
                </div>
                <h1 className="text-2xl sm:text-4xl font-light tracking-tight text-[#F5F5F0] leading-snug">
                  {strings.moment1.title}
                </h1>
                <p className="text-sm sm:text-base text-[#8A8F98] max-w-2xl leading-relaxed">
                  {strings.moment1.subtitle}
                </p>
              </div>

              {/* 3 Core Value Pillars */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                {strings.moment1.highlights.map((h, idx) => (
                  <div 
                    key={idx} 
                    className="p-4 rounded-2xl bg-[#0B0E17]/80 border border-[#1e293b] space-y-1.5"
                  >
                    <div className="w-6 h-6 rounded-lg bg-[#D4FF3D]/10 text-[#D4FF3D] flex items-center justify-center text-xs font-mono font-bold">
                      0{idx + 1}
                    </div>
                    <h3 className="text-xs font-semibold text-[#F5F5F0]">{h.title}</h3>
                    <p className="text-[11px] text-[#8A8F98] leading-relaxed">{h.desc}</p>
                  </div>
                ))}
              </div>

              {/* Primary & Secondary Actions */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-[#1e293b]">
                <button
                  id="btn-onboarding-explore-first"
                  type="button"
                  onClick={handleDirectExplore}
                  className="text-xs font-mono text-[#8A8F98] hover:text-[#F5F5F0] transition-colors py-2 cursor-pointer text-center sm:text-left"
                >
                  {strings.moment1.secondaryCta} →
                </button>

                <button
                  id="btn-onboarding-start"
                  type="button"
                  onClick={() => {
                    setMoment(2);
                    analytics.track('first_context_ready', { step: 'initiated' });
                  }}
                  className="px-8 py-3.5 rounded-full bg-[#D4FF3D] hover:bg-[#C2F028] text-[#0B0E17] text-xs font-bold transition-all shadow-[0_0_20px_rgba(212,255,61,0.25)] inline-flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <span>{strings.moment1.primaryCta}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

          {/* ========================================================
              MOMENT 2 — MINIMUM CONTEXT: 2 Reference Points Only
              ======================================================== */}
          {moment === 2 && (
            <motion.div
              key="moment-2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="space-y-1.5">
                <span className="text-xs font-mono text-[#D4FF3D] tracking-wider uppercase">
                  {strings.moment2.stepBadge}
                </span>
                <h2 className="text-xl sm:text-3xl font-light text-[#F5F5F0]">
                  {strings.moment2.title}
                </h2>
                <p className="text-xs sm:text-sm text-[#8A8F98]">
                  {strings.moment2.subtitle}
                </p>
              </div>

              {/* 2 Core Inputs on 1 Clean Card */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 1. Solde disponible */}
                <div className="p-5 rounded-2xl bg-[#0B0E17] border border-[#1e293b] space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-mono uppercase tracking-widest text-[#8A8F98]">
                      {strings.moment2.balanceLabel}
                    </label>
                    <Wallet className="w-4 h-4 text-[#D4FF3D]" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <input
                      id="input-onboarding-balance"
                      type="number"
                      value={balance}
                      onChange={(e) => setBalance(e.target.value)}
                      className="bg-transparent text-3xl font-light text-[#F5F5F0] outline-none w-full font-mono"
                    />
                    <span className="text-sm font-mono text-[#8A8F98]">{selectedCurrency}</span>
                  </div>
                  <div className="flex gap-1.5 pt-1">
                    {['600', '1250', '2500'].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setBalance(amt)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-mono border transition-all cursor-pointer ${
                          balance === amt 
                            ? 'border-[#D4FF3D] text-[#D4FF3D] bg-[#D4FF3D]/10' 
                            : 'border-[#1e293b] text-[#8A8F98] hover:border-[#8A8F98]'
                        }`}
                      >
                        {amt} €
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Loyer & Charges fixes */}
                <div className="p-5 rounded-2xl bg-[#0B0E17] border border-[#1e293b] space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-mono uppercase tracking-widest text-[#8A8F98]">
                      {strings.moment2.fixedLabel}
                    </label>
                    <Home className="w-4 h-4 text-[#38BDF8]" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <input
                      id="input-onboarding-fixed"
                      type="number"
                      value={fixedExpenses}
                      onChange={(e) => setFixedExpenses(e.target.value)}
                      className="bg-transparent text-3xl font-light text-[#F5F5F0] outline-none w-full font-mono"
                    />
                    <span className="text-sm font-mono text-[#8A8F98]">{selectedCurrency}</span>
                  </div>
                  <div className="flex gap-1.5 pt-1">
                    {['300', '450', '650'].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setFixedExpenses(amt)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-mono border transition-all cursor-pointer ${
                          fixedExpenses === amt 
                            ? 'border-[#38BDF8] text-[#38BDF8] bg-[#38BDF8]/10' 
                            : 'border-[#1e293b] text-[#8A8F98] hover:border-[#8A8F98]'
                        }`}
                      >
                        {amt} €
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Discreet Region & Devise */}
              <div className="p-4 rounded-2xl bg-[#0B0E17]/60 border border-[#1e293b] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <span className="text-[#8A8F98] font-mono">{strings.moment2.regionLabel} :</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[
                    { code: 'FR', label: 'France 🇫🇷', curr: 'EUR' },
                    { code: 'BE', label: 'Belgique 🇧🇪', curr: 'EUR' },
                    { code: 'CH', label: 'Suisse 🇨🇭', curr: 'CHF' },
                    { code: 'CA', label: 'Canada 🇨🇦', curr: 'CAD' },
                    { code: 'GB', label: 'UK 🇬🇧', curr: 'GBP' },
                    { code: 'US', label: 'USA 🇺🇸', curr: 'USD' },
                  ].map((r) => (
                    <button
                      key={r.code}
                      type="button"
                      onClick={() => {
                        setSelectedRegion(r.code as SupportedRegion);
                        setRegion(r.code as SupportedRegion);
                        setSelectedCurrency(r.curr as SupportedCurrency);
                        setCurrency(r.curr as SupportedCurrency);
                      }}
                      className={`px-3 py-1 rounded-xl border text-[11px] font-mono transition-all cursor-pointer ${
                        selectedRegion === r.code
                          ? 'border-[#D4FF3D] text-[#D4FF3D] bg-[#D4FF3D]/10'
                          : 'border-[#1e293b] text-[#8A8F98] hover:border-[#8A8F98]'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-[11px] text-[#8A8F98] flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#D4FF3D]" />
                <span>{strings.moment2.fixedHelp}</span>
              </p>

              {/* Navigation */}
              <div className="flex items-center justify-between pt-4 border-t border-[#1e293b]">
                <button
                  id="btn-onboarding-back-m2"
                  type="button"
                  onClick={() => setMoment(1)}
                  className="px-4 py-2.5 rounded-full border border-[#1e293b] text-xs font-mono text-[#8A8F98] hover:text-[#F5F5F0] flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>{strings.moment2.back}</span>
                </button>

                <button
                  id="btn-onboarding-goto-magic"
                  type="button"
                  onClick={() => {
                    setMoment(3);
                    analytics.track('first_context_ready', { 
                      balance: parsedBalance, 
                      fixed: parsedFixed, 
                      runwayDays: baselineRunwayDays 
                    });
                  }}
                  className="px-8 py-3 rounded-full bg-[#D4FF3D] hover:bg-[#C2F028] text-[#0B0E17] text-xs font-bold transition-all shadow-[0_0_15px_rgba(212,255,61,0.2)] flex items-center gap-2 cursor-pointer active:scale-95"
                >
                  <span>{strings.moment2.cta}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

          {/* ========================================================
              MOMENT 3 — FIRST MAGIC MOMENT: Instant "Can I afford this?"
              ======================================================== */}
          {moment === 3 && (
            <motion.div
              key="moment-3"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="space-y-1.5">
                <span className="text-xs font-mono text-[#D4FF3D] tracking-wider uppercase">
                  {strings.moment3.stepBadge}
                </span>
                <h2 className="text-xl sm:text-3xl font-light text-[#F5F5F0]">
                  {strings.moment3.title}
                </h2>
                <p className="text-xs sm:text-sm text-[#8A8F98]">
                  {strings.moment3.subtitle}
                </p>
              </div>

              {/* Natural Language Omnibox */}
              <div className="relative">
                <div className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-[#0B0E17] border border-[#1e293b] focus-within:border-[#D4FF3D] transition-colors">
                  <ShoppingBag className="w-5 h-5 text-[#D4FF3D] shrink-0" />
                  <input
                    id="input-onboarding-omnibox"
                    type="text"
                    value={omniboxInput}
                    onChange={(e) => handleOmniboxChange(e.target.value)}
                    placeholder={strings.moment3.omniboxPlaceholder}
                    className="w-full bg-transparent text-sm sm:text-base text-[#F5F5F0] outline-none font-medium placeholder-[#8A8F98]/40"
                  />
                  {simulatedAmount > 0 && (
                    <span className="text-xs font-mono font-bold text-[#D4FF3D] bg-[#D4FF3D]/10 px-2.5 py-1 rounded-lg shrink-0">
                      {formatCurrency(simulatedAmount)}
                    </span>
                  )}
                </div>
              </div>

              {/* One-tap Native Student Shortcuts */}
              <div className="space-y-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#8A8F98]">
                  {strings.moment3.presetsTitle}
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  {studentPresets.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => handleSelectPreset(p)}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                        simulatedAmount === p.amount && simulatedTitle.toLowerCase().includes(p.label.toLowerCase())
                          ? 'bg-[#D4FF3D]/10 border-[#D4FF3D] text-[#D4FF3D]'
                          : 'bg-[#0B0E17] border-[#1e293b] text-[#8A8F98] hover:border-[#8A8F98]'
                      }`}
                    >
                      <span>{p.icon}</span>
                      <span>{p.label}</span>
                      <span className="font-mono text-[11px] opacity-75">{p.amount} €</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* THE SIGNATURE PROJECTION: AVANT / APRÈS / IMPACT */}
              <div className="grid grid-cols-3 gap-2.5 sm:gap-4 text-center">
                {/* AVANT */}
                <div className="p-4 rounded-2xl bg-[#0B0E17] border border-[#1e293b]">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-[#8A8F98]">
                    {strings.moment3.before}
                  </span>
                  <div className="text-2xl sm:text-3xl font-light text-[#F5F5F0] font-mono my-1">
                    {baselineRunwayDays} <span className="text-xs font-sans text-[#8A8F98]">{strings.moment3.daysUnit}</span>
                  </div>
                  <span className="text-[10px] text-[#8A8F98] font-mono">{strings.moment3.beforeSub}</span>
                </div>

                {/* APRÈS */}
                <div className="p-4 rounded-2xl bg-[#0B0E17] border border-[#D4FF3D]/30 shadow-[0_0_20px_rgba(212,255,61,0.08)]">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-[#D4FF3D]">
                    {strings.moment3.after}
                  </span>
                  <div className="text-2xl sm:text-3xl font-light text-[#D4FF3D] font-mono my-1">
                    {projectedRunwayDays} <span className="text-xs font-sans text-[#F5F5F0]">{strings.moment3.daysUnit}</span>
                  </div>
                  <span className="text-[10px] text-[#8A8F98] font-mono">{strings.moment3.afterSub}</span>
                </div>

                {/* IMPACT */}
                <div className="p-4 rounded-2xl bg-[#0B0E17] border border-[#1e293b]">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-[#FACC15]">
                    {strings.moment3.impact}
                  </span>
                  <div className="text-2xl sm:text-3xl font-light text-[#FACC15] font-mono my-1 flex items-center justify-center gap-1">
                    <TrendingDown className="w-4 h-4 text-[#FACC15]" />
                    <span>{daysDifference} <span className="text-xs font-sans text-[#8A8F98]">{strings.moment3.daysUnit}</span></span>
                  </div>
                  <span className="text-[10px] text-[#8A8F98] font-mono">{strings.moment3.impactSub}</span>
                </div>
              </div>

              {/* Factual Brotherly Verdict */}
              <div className="p-4 rounded-2xl bg-[#0B0E17] border border-[#1e293b] text-xs text-[#F5F5F0] leading-relaxed flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-[#D4FF3D] shrink-0 mt-0.5" />
                <div>
                  <p>
                    {langKey === 'fr' 
                      ? `Si tu achètes cela (${formatCurrency(simulatedAmount)}), ton runway passe de ${baselineRunwayDays} à ${projectedRunwayDays} jours (${daysDifference} jours). Ton loyer sanctuarisé de ${formatCurrency(parsedFixed)} reste protégé. À toi de voir.`
                      : `If you buy this (${formatCurrency(simulatedAmount)}), your runway adjusts from ${baselineRunwayDays} to ${projectedRunwayDays} days (${daysDifference} days). Your protected rent of ${formatCurrency(parsedFixed)} remains secure. Up to you.`}
                  </p>
                </div>
              </div>

              {/* 3 Autonomy Decision Actions */}
              <div className="grid grid-cols-3 gap-2.5">
                <button
                  id="btn-onboarding-decision-buy"
                  type="button"
                  onClick={() => {
                    setUserDecision('buy');
                    analytics.track('first_decision_selected', { decision: 'buy', amount: simulatedAmount });
                    analytics.track('first_simulation_completed', { amount: simulatedAmount, projectedDays: projectedRunwayDays });
                  }}
                  className={`p-3 rounded-2xl border text-xs font-bold transition-all cursor-pointer flex flex-col items-center gap-1 ${
                    userDecision === 'buy'
                      ? 'bg-[#D4FF3D] text-[#0B0E17] border-[#D4FF3D] shadow-[0_0_15px_rgba(212,255,61,0.3)]'
                      : 'bg-[#0B0E17] hover:bg-[#1e293b] border-[#1e293b] text-[#F5F5F0]'
                  }`}
                >
                  <Check className="w-4 h-4" />
                  <span>{strings.moment3.btnBuy}</span>
                </button>

                <button
                  id="btn-onboarding-decision-wait"
                  type="button"
                  onClick={() => {
                    setUserDecision('wait');
                    analytics.track('first_decision_selected', { decision: 'wait', amount: simulatedAmount });
                    analytics.track('first_simulation_completed', { amount: simulatedAmount, projectedDays: projectedRunwayDays });
                  }}
                  className={`p-3 rounded-2xl border text-xs font-bold transition-all cursor-pointer flex flex-col items-center gap-1 ${
                    userDecision === 'wait'
                      ? 'bg-[#38BDF8] text-[#0B0E17] border-[#38BDF8] shadow-[0_0_15px_rgba(56,189,248,0.3)]'
                      : 'bg-[#0B0E17] hover:bg-[#1e293b] border-[#1e293b] text-[#F5F5F0]'
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  <span>{strings.moment3.btnWait}</span>
                </button>

                <button
                  id="btn-onboarding-decision-consult"
                  type="button"
                  onClick={() => {
                    setUserDecision('consult');
                    analytics.track('first_ney_question', { amount: simulatedAmount });
                    analytics.track('first_simulation_completed', { amount: simulatedAmount, projectedDays: projectedRunwayDays });
                  }}
                  className={`p-3 rounded-2xl border text-xs font-bold transition-all cursor-pointer flex flex-col items-center gap-1 ${
                    userDecision === 'consult'
                      ? 'bg-[#F5F5F0] text-[#0B0E17] border-[#F5F5F0]'
                      : 'bg-[#0B0E17] hover:bg-[#1e293b] border-[#1e293b] text-[#F5F5F0]'
                  }`}
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>{strings.moment3.btnAskNey}</span>
                </button>
              </div>

              {/* Navigation to Reveal */}
              <div className="flex items-center justify-between pt-4 border-t border-[#1e293b]">
                <button
                  id="btn-onboarding-back-m3"
                  type="button"
                  onClick={() => setMoment(2)}
                  className="px-4 py-2.5 rounded-full border border-[#1e293b] text-xs font-mono text-[#8A8F98] hover:text-[#F5F5F0] flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>{strings.moment3.back}</span>
                </button>

                <button
                  id="btn-onboarding-goto-reveal"
                  type="button"
                  onClick={() => {
                    analytics.track('first_simulation_completed', { amount: simulatedAmount, projectedDays: projectedRunwayDays });
                    setMoment(4);
                  }}
                  className="px-8 py-3 rounded-full bg-[#D4FF3D] hover:bg-[#C2F028] text-[#0B0E17] text-xs font-bold transition-all shadow-[0_0_15px_rgba(212,255,61,0.2)] flex items-center gap-2 cursor-pointer active:scale-95"
                >
                  <span>{strings.moment3.ctaContinue}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

          {/* ========================================================
              MOMENT 4 — REVEAL & DIRECT ACTIVATION (HANDOFF TO DASHBOARD)
              ======================================================== */}
          {moment === 4 && (
            <motion.div
              key="moment-4"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="space-y-1.5">
                <span className="text-xs font-mono text-[#D4FF3D] tracking-wider uppercase">
                  {strings.moment4.stepBadge}
                </span>
                <h2 className="text-xl sm:text-3xl font-light text-[#F5F5F0]">
                  {strings.moment4.title}
                </h2>
                <p className="text-xs sm:text-sm text-[#8A8F98]">
                  {strings.moment4.subtitle}
                </p>
              </div>

              {/* 5 Clear Navigation Anchors */}
              <div className="space-y-2.5">
                {strings.moment4.cards.map((card) => (
                  <div
                    key={card.num}
                    className="p-3.5 sm:p-4 rounded-2xl bg-[#0B0E17] border border-[#1e293b] flex items-start gap-3.5"
                  >
                    <span className="text-xs font-mono font-bold text-[#D4FF3D] bg-[#D4FF3D]/10 px-2 py-0.5 rounded-md shrink-0">
                      {card.num}
                    </span>
                    <div>
                      <h4 className="text-xs font-bold text-[#F5F5F0] font-mono tracking-wide">
                        {card.title}
                      </h4>
                      <p className="text-[11px] text-[#8A8F98] mt-0.5 leading-relaxed">
                        {card.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Live Preview Summary of User's Initial Baseline */}
              <div className="p-4 rounded-2xl bg-[#0B0E17]/80 border border-[#D4FF3D]/30 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono uppercase text-[#8A8F98] block">
                    {langKey === 'fr' ? 'Ton horizon de départ' : 'Your starting runway'}
                  </span>
                  <div className="text-2xl font-mono text-[#D4FF3D] font-light">
                    {baselineRunwayDays} <span className="text-xs font-sans text-[#F5F5F0]">{strings.moment3.daysUnit}</span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-mono uppercase text-[#8A8F98] block">
                    {langKey === 'fr' ? 'Disponible aujourd\'hui' : 'Safe to spend today'}
                  </span>
                  <div className="text-2xl font-mono text-[#F5F5F0] font-light">
                    {formatCurrency(baselineSafeToSpend)}
                  </div>
                </div>
              </div>

              {/* Final Activation Handoff */}
              <div className="flex items-center justify-between pt-4 border-t border-[#1e293b]">
                <button
                  id="btn-onboarding-back-m4"
                  type="button"
                  onClick={() => setMoment(3)}
                  className="px-4 py-2.5 rounded-full border border-[#1e293b] text-xs font-mono text-[#8A8F98] hover:text-[#F5F5F0] flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>{strings.moment4.back}</span>
                </button>

                <button
                  id="btn-onboarding-finish-goto-dashboard"
                  type="button"
                  onClick={handleFinishAndEnterApp}
                  className="px-8 py-3.5 rounded-full bg-[#D4FF3D] hover:bg-[#C2F028] text-[#0B0E17] text-xs font-bold transition-all shadow-[0_0_25px_rgba(212,255,61,0.3)] flex items-center gap-2 cursor-pointer active:scale-95"
                >
                  <span>{strings.moment4.ctaDashboard}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
