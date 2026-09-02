import { StudentResource, SupportedRegion, SupportedLanguage } from '../types';

export interface LocalizedField {
  fr: string;
  en: string;
}

export interface RawStudentResource {
  id: string;
  region: SupportedRegion;
  title: LocalizedField;
  description: LocalizedField;
  category: StudentResource['category'];
  provider: string;
  estimatedValue?: LocalizedField;
  eligibility?: LocalizedField;
  url?: string;
  tags: (LocalizedField | string)[];
}

export const REGIONAL_RESOURCES_DATA: Record<SupportedRegion, RawStudentResource[]> = {
  FR: [
    {
      id: 'fr-crous-bourses',
      region: 'FR',
      title: {
        fr: 'Bourses sur critères sociaux (DSE)',
        en: 'Higher Education Needs-Based Grants (DSE)'
      },
      description: {
        fr: 'Aide financière mensuelle versée sur 10 mois attribuée selon les revenus du foyer fiscal et l\'éloignement du lieu d\'études.',
        en: 'Monthly financial grant paid over 10 months based on household taxable income and distance to university campus.'
      },
      category: 'grant',
      provider: 'CROUS / Enseignement Supérieur',
      estimatedValue: {
        fr: '1 454 € à 6 335 € / an',
        en: '1,454 € to 6,335 € / year'
      },
      eligibility: {
        fr: 'Étudiants de moins de 28 ans inscrits en formation initiale habilitée.',
        en: 'Students under 28 enrolled in an accredited higher education degree program.'
      },
      url: 'https://www.messervices.etudiant.gouv.fr',
      tags: ['Bourse', 'Mensuel', 'Crous']
    },
    {
      id: 'fr-caf-apl',
      region: 'FR',
      title: {
        fr: 'Aide Personnalisée au Logement (APL)',
        en: 'Personalized Housing Assistance (APL)'
      },
      description: {
        fr: 'Prise en charge partielle de votre loyer (résidence universitaire, colocation ou studio privé).',
        en: 'Partial monthly rent subsidy directly deductible from student residence, shared flat, or private studio rent.'
      },
      category: 'aid',
      provider: 'Caisse d\'Allocations Familiales (CAF)',
      estimatedValue: {
        fr: '100 € à 240 € / mois',
        en: '100 € to 240 € / month'
      },
      eligibility: {
        fr: 'Locataire avec bail à son nom sans condition d\'âge.',
        en: 'Tenant with a lease contract under their name, regardless of nationality or age.'
      },
      url: 'https://www.caf.fr',
      tags: ['Logement', 'Loyer', 'CAF']
    },
    {
      id: 'fr-crous-repas',
      region: 'FR',
      title: {
        fr: 'Repas CROUS à 1 € (Boursiers & Non-boursiers précaires)',
        en: '1 € CROUS Subsidized Meal Plan'
      },
      description: {
        fr: 'Repas complets (entrée + plat chaud + dessert) au Resto U pour 1 € seulement.',
        en: 'Full two-course balanced meal (starter + main dish + dessert) at university cafeterias for only 1 €.'
      },
      category: 'food',
      provider: 'Réseau des Crous',
      estimatedValue: {
        fr: 'Économie de ~150 € / mois',
        en: 'Saves ~150 € / month'
      },
      eligibility: {
        fr: 'Boursiers ou étudiants évalués en situation de précarité par le service social.',
        en: 'Scholarship holders or students assessed in financial hardship by social services.'
      },
      url: 'https://www.etudiant.gouv.fr/fr/le-repas-au-crous-1985',
      tags: ['Alimentation', 'Resto U', '1 Euro']
    },
    {
      id: 'fr-aide-urgence',
      region: 'FR',
      title: {
        fr: 'Aide d\'Urgence Ponctuelle CROUS (FNAU)',
        en: 'CROUS Emergency Hardship Grant (FNAU)'
      },
      description: {
        fr: 'Secours financier exceptionnel et rapide pour faire face à une difficulté imprévue (rupture familiale, perte de ressources).',
        en: 'Rapid one-off emergency relief grant to overcome severe unforeseen difficulties (family breakdown, sudden loss of income).'
      },
      category: 'emergency',
      provider: 'Service Social CROUS',
      estimatedValue: {
        fr: 'Jusqu\'à 3 071 € en cas d\'urgence avérée',
        en: 'Up to 3,071 € one-off relief'
      },
      eligibility: {
        fr: 'Étudiants traversant une situation de précarité grave.',
        en: 'Students experiencing sudden acute financial distress.'
      },
      url: 'https://www.etudiant.gouv.fr',
      tags: ['Urgence', 'Secours', 'Social']
    },
    {
      id: 'fr-transports-jeunes',
      region: 'FR',
      title: {
        fr: 'Tarification solidaire Transports & Forfait Imagine R / Carte Avantage',
        en: 'Student Transit Pass & National Railcard'
      },
      description: {
        fr: 'Réduction de 50% sur le pass annuel de transport urbain et 30% garantis sur les billets TGV INOUI.',
        en: 'Up to 50% discount on metropolitan student transit passes and 30% guaranteed off high-speed train tickets.'
      },
      category: 'transport',
      provider: 'Régions & SNCF Connect',
      estimatedValue: {
        fr: '~350 € d\'économie par an',
        en: '~350 € annual travel savings'
      },
      eligibility: {
        fr: 'Jeunes et étudiants de moins de 26 ans.',
        en: 'Students and youth under 26.'
      },
      url: 'https://www.sncf-connect.com',
      tags: ['Transport', 'Train', 'Métro']
    }
  ],
  BE: [
    {
      id: 'be-fwb-allocations',
      region: 'BE',
      title: {
        fr: 'Allocations d\'études supérieures FWB',
        en: 'FWB Higher Education Study Grants'
      },
      description: {
        fr: 'Aide financière publique non remboursable pour les étudiants de l\'enseignement supérieur de plein exercice.',
        en: 'Non-repayable government financial grant for full-time higher education students in Wallonia-Brussels Federation.'
      },
      category: 'grant',
      provider: 'Fédération Wallonie-Bruxelles',
      estimatedValue: {
        fr: '400 € à 2 800 € / an',
        en: '400 € to 2,800 € / year'
      },
      eligibility: {
        fr: 'Conditions de revenus du ménage et inscription régulière.',
        en: 'Household income thresholds and regular enrollment in a recognized university or college.'
      },
      url: 'https://allocations-etudes.cfwb.be',
      tags: ['Bourse', 'FWB', 'Études']
    },
    {
      id: 'be-logement-kot',
      region: 'BE',
      title: {
        fr: 'Kots étudiants sociaux & Subventions au logement',
        en: 'Subsidized Student Kots & University Housing Assistance'
      },
      description: {
        fr: 'Logements étudiants universitaires (UCLouvain, ULB, ULiège, UMons) à loyers modérés calculés selon les revenus familiaux.',
        en: 'University-managed student housing and subsidized kots with reduced monthly rents based on family income tier.'
      },
      category: 'aid',
      provider: 'Services Logement Universités & Pôles académiques',
      estimatedValue: {
        fr: 'Loyer réduit de 150 € à 300 € / mois',
        en: 'Reduced rent of 150 € to 300 € / month'
      },
      eligibility: {
        fr: 'Étudiants réguliers inscrits dans les universités ou hautes écoles de la FWB.',
        en: 'Regular students enrolled in FWB universities and university colleges.'
      },
      url: 'https://www.poleacademique.be',
      tags: ['Logement', 'Kot', 'Subvention']
    },
    {
      id: 'be-resto-u-alimentation',
      region: 'BE',
      title: {
        fr: 'Restos universitaires subventionnés & Épiceries solidaires',
        en: 'Subsidized Campus Dining & Student Solidarity Grocery Stores'
      },
      description: {
        fr: 'Repas chauds complets équilibrés à tarif préférentiel dans les restaurants universitaires et colis alimentaires d\'urgence.',
        en: 'Nutritious balanced hot meals at discounted student rates across campus cafeterias and emergency food parcel distributions.'
      },
      category: 'food',
      provider: 'Services Sociaux Étudiants / ASEB / Resto U',
      estimatedValue: {
        fr: 'Repas à ~3,50 € (économie de 120 € / mois)',
        en: 'Meals at ~3.50 € (saves ~120 € / month)'
      },
      eligibility: {
        fr: 'Accessible sur présentation de la carte étudiante de l\'établissement.',
        en: 'Accessible with active valid higher education student ID.'
      },
      url: 'https://www.aseb.be',
      tags: ['Alimentation', 'Resto U', 'Épicerie']
    },
    {
      id: 'be-resto-u-stib',
      region: 'BE',
      title: {
        fr: 'Abonnement STIB étudiant 12 € / an & Student Multi SNCB',
        en: '12 € / Year Student STIB Transit Pass & SNCB Student Multi'
      },
      description: {
        fr: 'Accès quasi-gratuit à l\'ensemble du réseau de transports bruxellois pour les 18-24 ans et tarifs préférentiels sur le train.',
        en: 'Virtually free unlimited access to the entire Brussels public transit network (metro, tram, bus) for students aged 18-24 and student train cards.'
      },
      category: 'transport',
      provider: 'STIB / MIVB Bruxelles & SNCB',
      estimatedValue: {
        fr: '12 € / an au lieu de 499 €',
        en: '12 € / year instead of 499 €'
      },
      eligibility: {
        fr: 'Étudiants inscrits dans un établissement d\'enseignement supérieur belge.',
        en: 'Students registered in an accredited Belgian higher education institution.'
      },
      url: 'https://www.stib-mivb.be',
      tags: ['Transport', 'Bruxelles', 'STIB']
    },
    {
      id: 'be-cpas-etudiant',
      region: 'BE',
      title: {
        fr: 'Revenu d\'Intégration Sociale (RIS Étudiant) & Fonds Spécial CPAS',
        en: 'CPAS Student Social Integration Income (RIS) & Emergency Fund'
      },
      description: {
        fr: 'Soutien mensuel du CPAS permettant aux étudiants sans ressources familiales de mener à bien leurs études.',
        en: 'Monthly municipal social living allowance enabling independent students without family support to complete their degrees.'
      },
      category: 'emergency',
      provider: 'CPAS de la commune de résidence',
      estimatedValue: {
        fr: 'Jusqu\'à 1 200 € / mois',
        en: 'Up to 1,200 € / month'
      },
      eligibility: {
        fr: 'Étudiant majeur autonome sous contrat de projet d\'intégration.',
        en: 'Independent adult student with an approved personalized social integration project.'
      },
      url: 'https://www.mi-is.be',
      tags: ['CPAS', 'RIS', 'Urgence']
    }
  ],
  CH: [
    {
      id: 'ch-bourses-cantonales',
      region: 'CH',
      title: {
        fr: 'Bourses et prêts d\'études cantonaux (VD, GE, NE, etc.)',
        en: 'Cantonal Student Grants & Educational Loans'
      },
      description: {
        fr: 'Soutien financier accordé par le canton de domicile pour couvrir les frais de formation et d\'entretien.',
        en: 'Direct financial assistance provided by the student\'s home canton to cover tuition fees and basic living costs.'
      },
      category: 'grant',
      provider: 'Office cantonal des bourses d\'études',
      estimatedValue: {
        fr: '6 000 CHF à 16 000 CHF / an',
        en: '6,000 CHF to 16,000 CHF / year'
      },
      eligibility: {
        fr: 'Domicile fiscal en Suisse et formation reconnue.',
        en: 'Tax residence in Switzerland and recognized tertiary degree program.'
      },
      url: 'https://www.orientation.ch',
      tags: ['Canton', 'Bourse', 'Formation']
    },
    {
      id: 'ch-demi-tarif-cff',
      region: 'CH',
      title: {
        fr: 'Abonnement Demi-Tarif PLUS Jeune & AG Night',
        en: 'SBB Youth Half-Fare Travelcard & GA Night'
      },
      description: {
        fr: 'Voyages illimités sur l\'ensemble du réseau suisse dès 19h pour 99 CHF/an et 50% sur tous les billets de train de jour.',
        en: 'Unlimited nationwide Swiss rail travel from 7 PM for 99 CHF/year plus 50% off all daytime train tickets.'
      },
      category: 'transport',
      provider: 'CFF / SBB',
      estimatedValue: {
        fr: 'Réduction de 50% sur chaque trajet',
        en: '50% discount on every train journey'
      },
      eligibility: {
        fr: 'Jeunes de moins de 25 ans.',
        en: 'Young adults and students under 25.'
      },
      url: 'https://www.sbb.ch',
      tags: ['CFF', 'Train', 'Mobilité']
    },
    {
      id: 'ch-subsides-assurance',
      region: 'CH',
      title: {
        fr: 'Subside à l\'Assurance Maladie (LAMal)',
        en: 'Mandatory Health Insurance Subsidy (LAMal)'
      },
      description: {
        fr: 'Prise en charge intégrale ou partielle de la prime d\'assurance maladie obligatoire pour les étudiants à revenu modeste.',
        en: 'Partial or full coverage of mandatory Swiss health insurance monthly premiums for students with modest income.'
      },
      category: 'aid',
      provider: 'Service de l\'assurance-maladie cantonal',
      estimatedValue: {
        fr: '100 CHF à 300 CHF / mois',
        en: '100 CHF to 300 CHF / month'
      },
      eligibility: {
        fr: 'Revenu déterminant inférieur au barème cantonal.',
        en: 'Taxable income below the official cantonal threshold.'
      },
      url: 'https://www.ch.ch',
      tags: ['Santé', 'LAMal', 'Subside']
    }
  ],
  US: [
    {
      id: 'us-fafsa-pell',
      region: 'US',
      title: {
        fr: 'Federal Pell Grant (FAFSA)',
        en: 'Federal Pell Grant (FAFSA)'
      },
      description: {
        fr: 'Subvention financière fédérale non remboursable pour les étudiants de premier cycle aux ressources modestes.',
        en: 'Direct federal grant money for undergraduate students with exceptional financial need, does not need to be repaid.'
      },
      category: 'grant',
      provider: 'U.S. Department of Education',
      estimatedValue: {
        fr: 'Jusqu\'à 7 395 $ / année académique',
        en: 'Up to $7,395 / academic year'
      },
      eligibility: {
        fr: 'Citoyens américains ou résidents éligibles inscrits dans un cursus habilité.',
        en: 'U.S. citizens or eligible noncitizens enrolled in degree programs.'
      },
      url: 'https://studentaid.gov/fafsa',
      tags: ['FAFSA', 'Pell Grant', 'Federal']
    },
    {
      id: 'us-snap-food',
      region: 'US',
      title: {
        fr: 'Programme d\'aide alimentaire pour étudiants (SNAP / EBT)',
        en: 'Student SNAP Food Assistance (EBT)'
      },
      description: {
        fr: 'Allocation mensuelle pour l\'achat de produits d\'épicerie pour les étudiants répondant aux critères d\'éligibilité.',
        en: 'Monthly grocery allowance assistance for college students meeting work-study or low income criteria.'
      },
      category: 'food',
      provider: 'USDA Food and Nutrition Service',
      estimatedValue: {
        fr: '150 $ à 290 $ / mois pour les courses',
        en: '$150 to $290 / month for groceries'
      },
      eligibility: {
        fr: 'Étudiants éligibles au work-study ou travaillant 20h+/semaine avec revenus modestes.',
        en: 'Students eligible for work-study or working 20+ hrs/week with low income.'
      },
      url: 'https://www.fns.usda.gov/snap',
      tags: ['SNAP', 'Groceries', 'EBT']
    },
    {
      id: 'us-campus-emergency',
      region: 'US',
      title: {
        fr: 'Micro-bourses d\'urgence du Doyen / Campus',
        en: 'Dean of Students Emergency Micro-Grants'
      },
      description: {
        fr: 'Aides d\'urgence non remboursables pour les imprévus majeurs (frais médicaux, loyer, ordinateur en panne).',
        en: 'Quick-turnaround non-repayable grants for sudden emergencies (medical bills, rent gap, laptop breakdown).'
      },
      category: 'emergency',
      provider: 'University Financial Aid / Dean Office',
      estimatedValue: {
        fr: '250 $ à 1 500 $ en secours ponctuel',
        en: '$250 to $1,500 one-time grant'
      },
      eligibility: {
        fr: 'Étudiants inscrits traversant une difficulté financière soudaine.',
        en: 'Enrolled students facing sudden financial hardship.'
      },
      url: 'https://studentaid.gov',
      tags: ['Emergency', 'Campus Aid', 'Relief']
    }
  ],
  GB: [
    {
      id: 'gb-maintenance-loan',
      region: 'GB',
      title: {
        fr: 'Student Maintenance Loan & Hardship Funds',
        en: 'Student Maintenance Loan & Hardship Funds'
      },
      description: {
        fr: 'Financement public couvrant les frais de subsistance, loyer et matériel, versé en 3 versements trimestriels.',
        en: 'Government funding to cover living costs, rent, and study materials paid in 3 term installments.'
      },
      category: 'grant',
      provider: 'Student Finance England / Wales / SAAS',
      estimatedValue: {
        fr: 'Jusqu\'à 9 978 £ / an (13 022 £ à Londres)',
        en: 'Up to £9,978 / year (£13,022 in London)'
      },
      eligibility: {
        fr: 'Étudiants britanniques ou disposant du statut settled / resident au Royaume-Uni.',
        en: 'Eligible UK / Settled status higher education students.'
      },
      url: 'https://www.gov.uk/student-finance',
      tags: ['Maintenance', 'Student Finance', 'Living Costs']
    },
    {
      id: 'gb-tfl-railcard',
      region: 'GB',
      title: {
        fr: 'Carte 18+ Student Oyster & 16-25 Railcard',
        en: '18+ Student Oyster photocard & 16-25 Railcard'
      },
      description: {
        fr: '30% de réduction sur les Travelcards et pass de bus à Londres, et 1/3 de réduction sur l\'ensemble du réseau ferré national.',
        en: '30% off adult-rate Travelcards and bus passes in London, plus 1/3 off all National Rail journeys across Britain.'
      },
      category: 'transport',
      provider: 'Transport for London & National Rail',
      estimatedValue: {
        fr: 'Économie de ~300 £+ / an sur les transports',
        en: 'Saves ~£300+ / year on travel'
      },
      eligibility: {
        fr: 'Étudiants de plus de 18 ans inscrits à temps plein.',
        en: 'Students 18+ studying full-time in London.'
      },
      url: 'https://tfl.gov.uk',
      tags: ['Oyster', 'TfL', 'Railcard']
    }
  ],
  CA: [
    {
      id: 'ca-afe-osap',
      region: 'CA',
      title: {
        fr: 'Aide financière aux études provinciale (AFE / OSAP / StudentAid BC)',
        en: 'Provincial Student Financial Assistance (AFE / OSAP / StudentAid BC)'
      },
      description: {
        fr: 'Combinaison de bourses non remboursables et de prêts à taux avantageux pour les études postsecondaires.',
        en: 'Combined non-repayable grants and low-interest student loans for post-secondary education.'
      },
      category: 'grant',
      provider: 'Ministère de l\'Enseignement Supérieur (AFE/OSAP)',
      estimatedValue: {
        fr: '3 000 $ à 9 000 $ / an',
        en: '$3,000 to $9,000 / year'
      },
      eligibility: {
        fr: 'Citoyens canadiens, résidents permanents inscrits dans un programme admissible.',
        en: 'Canadian citizens, permanent residents in qualifying full-time programs.'
      },
      url: 'https://www.quebec.ca/education/aide-financiere-aux-etudes',
      tags: ['AFE', 'OSAP', 'Bourse']
    },
    {
      id: 'ca-campus-foodbank',
      region: 'CA',
      title: {
        fr: 'Banques alimentaires étudiantes & Paniers campus',
        en: 'Campus Food Bank & Community Pantries'
      },
      description: {
        fr: 'Paniers de denrées alimentaires essentiels et produits frais distribués gratuitement chaque semaine aux étudiants.',
        en: 'Free weekly emergency grocery hampers and fresh produce for university & college students.'
      },
      category: 'food',
      provider: 'Student Unions / Community Food Centres Canada',
      estimatedValue: {
        fr: 'Paniers gratuits (valeur 100 $+ / mois)',
        en: 'Free essential groceries ($100+/month value)'
      },
      eligibility: {
        fr: 'Tout étudiant inscrit sur présentation de sa carte étudiante active.',
        en: 'Any registered student with active student card.'
      },
      url: 'https://foodbankscanada.ca',
      tags: ['Food Bank', 'Groceries', 'Free']
    }
  ],
  ES: [
    {
      id: 'es-becas-mec',
      region: 'ES',
      title: {
        fr: 'Bourses Générales du Ministère (Becas MEC)',
        en: 'Ministry of Education General Scholarships (Becas MEC)'
      },
      description: {
        fr: 'Aide financière d\'État pour les étudiants universitaires (frais d\'inscription, résidence et aide au revenu).',
        en: 'State scholarship covering university tuition fees, living expenses and relocation support.'
      },
      category: 'grant',
      provider: 'Ministerio de Educación y Formación Profesional',
      estimatedValue: {
        fr: '1 700 € à 3 500 € / an',
        en: '1,700 € to 3,500 € / year'
      },
      eligibility: {
        fr: 'Étudiants inscrits en université espagnole respectant les seuils de revenus.',
        en: 'Students enrolled in accredited Spanish universities meeting income thresholds.'
      },
      url: 'https://www.becaseducacion.gob.es',
      tags: ['Beca', 'Universidad', 'Gobierno']
    },
    {
      id: 'es-abono-transporte',
      region: 'ES',
      title: {
        fr: 'Abonnement Transport Jeune (Abono Joven)',
        en: 'Youth Public Transit Pass (Abono Joven)'
      },
      description: {
        fr: 'Tarif réduit mensuel pour les métros, bus et trains régionaux pour les moins de 26 ans.',
        en: 'Heavily subsidized flat rate transit pass for underground, bus and regional trains for under 26.'
      },
      category: 'discount',
      provider: 'Consorcios Regionales de Transportes',
      estimatedValue: {
        fr: '20 € / mois (réduction jusqu\'à 70%)',
        en: '20 € / month (up to 70% savings)'
      },
      eligibility: {
        fr: 'Jeunes jusqu\'à 26 ans résidant en Espagne.',
        en: 'Youth under 26 residing in Spain.'
      },
      url: 'https://www.crtm.es',
      tags: ['Transporte', 'Metro', 'Joven']
    }
  ],
  BR: [
    {
      id: 'br-prouni-fies',
      region: 'BR',
      title: {
        fr: 'Bourses ProUni & Aide Étudiante',
        en: 'ProUni Scholarships & Student Aid'
      },
      description: {
        fr: 'Bourses d\'études universitaires intégrales et partielles basées sur le score ENEM et les revenus.',
        en: 'Full and partial higher education scholarships based on ENEM national exam scores and household income.'
      },
      category: 'grant',
      provider: 'Ministério da Educação (MEC)',
      estimatedValue: {
        fr: 'Bourse 100% ou 50% des frais de scolarité',
        en: '100% or 50% tuition coverage'
      },
      eligibility: {
        fr: 'Étudiants brésiliens ayant passé l\'ENEM avec revenu par habitant admissible.',
        en: 'Brazilian students having taken ENEM with qualifying per capita income.'
      },
      url: 'https://acessounico.mec.gov.br/prouni',
      tags: ['Bolsa', 'Faculdade', 'MEC']
    },
    {
      id: 'br-meia-entrada',
      region: 'BR',
      title: {
        fr: 'Carte Étudiante Demi-Tarif (Meia-Entrada / DNE)',
        en: 'Student Half-Price ID (Meia-Entrada / DNE)'
      },
      description: {
        fr: 'Droit légal à 50% de réduction sur les cinémas, théâtres, concerts et transports interurbains.',
        en: 'Legal 50% discount on cinema, theater, cultural events and intercity transit.'
      },
      category: 'discount',
      provider: 'UNE / UBES',
      estimatedValue: {
        fr: '50% d\'économie sur tous les loisirs et événements',
        en: '50% savings on all cultural and leisure events'
      },
      eligibility: {
        fr: 'Étudiants régulièrement inscrits avec carte DNE officielle.',
        en: 'Enrolled students with official DNE student card.'
      },
      url: 'https://www.documentodoestudante.com.br',
      tags: ['Meia-Entrada', 'Cultura', 'Desconto']
    }
  ],
  IN: [
    {
      id: 'in-nsp-scholarship',
      region: 'IN',
      title: {
        fr: 'Portail National des Bourses (NSP Scheme)',
        en: 'National Scholarship Portal (NSP Central Scheme)'
      },
      description: {
        fr: 'Bourses centrales du gouvernement indien pour l\'enseignement supérieur et professionnel.',
        en: 'Government of India central sector scholarship scheme for college and university students.'
      },
      category: 'grant',
      provider: 'Ministry of Education / Government of India',
      estimatedValue: {
        fr: '₹12,000 à ₹20,000 / an',
        en: '₹12,000 to ₹20,000 / year'
      },
      eligibility: {
        fr: 'Étudiants de l\'enseignement supérieur régulier avec seuil de revenus et mérite académique.',
        en: 'Higher education students with family income under ₹4.5 lakh/year and top 80th percentile.'
      },
      url: 'https://scholarships.gov.in',
      tags: ['Scholarship', 'NSP', 'Government']
    },
    {
      id: 'in-railway-concession',
      region: 'IN',
      title: {
        fr: 'Concession Transport Étudiant (Indian Railways & Metro)',
        en: 'Student Rail & Metro Concession Pass'
      },
      description: {
        fr: 'Pass mensuel subventionné pour les trains de banlieue et cartes de métro étudiant.',
        en: 'Subsidized monthly season tickets (MST) for suburban rail networks and student metro passes.'
      },
      category: 'discount',
      provider: 'Indian Railways & City Metro Authorities',
      estimatedValue: {
        fr: 'Jusqu\'à 75% de réduction sur les trajets quotidiens',
        en: 'Up to 75% discount on daily university transit'
      },
      eligibility: {
        fr: 'Étudiants avec certificat officiel de leur institution académique.',
        en: 'Recognized educational institution students with bonafide certificate.'
      },
      url: 'https://indianrailways.gov.in',
      tags: ['Travel', 'Railways', 'Metro']
    }
  ]
};

/**
 * Returns localized student resources for a specific region and language.
 */
export function getRegionalResources(region: SupportedRegion, lang: SupportedLanguage = 'fr'): StudentResource[] {
  const rawList = REGIONAL_RESOURCES_DATA[region] || REGIONAL_RESOURCES_DATA.FR || [];
  return rawList.map((raw) => ({
    id: raw.id,
    region: raw.region,
    title: typeof raw.title === 'string' ? raw.title : (raw.title[lang] || raw.title.fr),
    description: typeof raw.description === 'string' ? raw.description : (raw.description[lang] || raw.description.fr),
    category: raw.category,
    provider: raw.provider,
    estimatedValue: raw.estimatedValue ? (typeof raw.estimatedValue === 'string' ? raw.estimatedValue : (raw.estimatedValue[lang] || raw.estimatedValue.fr)) : undefined,
    eligibility: raw.eligibility ? (typeof raw.eligibility === 'string' ? raw.eligibility : (raw.eligibility[lang] || raw.eligibility.fr)) : undefined,
    url: raw.url,
    tags: raw.tags.map((tag) => (typeof tag === 'string' ? tag : (tag[lang] || tag.fr)))
  }));
}

/**
 * Default backwards-compatible dictionary (French fallback).
 */
export const REGIONAL_RESOURCES: Record<SupportedRegion, StudentResource[]> = {
  FR: getRegionalResources('FR', 'fr'),
  BE: getRegionalResources('BE', 'fr'),
  CH: getRegionalResources('CH', 'fr'),
  US: getRegionalResources('US', 'en'),
  GB: getRegionalResources('GB', 'en'),
  CA: getRegionalResources('CA', 'fr'),
  ES: getRegionalResources('ES', 'fr'),
  BR: getRegionalResources('BR', 'fr'),
  IN: getRegionalResources('IN', 'en'),
};
