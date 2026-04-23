// ─── Quick Replies — Swedish & English ────────────────────────────────────────
// Pre-translated common support responses. Click to insert into Chat input.

export const LANGUAGES = [
  { id: 'en', label: 'English', flag: '🇬🇧' },
  { id: 'se', label: 'Svenska', flag: '🇸🇪' },
];

export const QUICK_REPLIES = [
  {
    category: 'Greeting',
    icon: '👋',
    replies: {
      en: 'Hello! Thank you for contacting Bybit support. How can I help you today?',
      se: 'Hej! Tack for att du kontaktar Bybit support. Hur kan jag hjalpa dig idag?',
    },
  },
  {
    category: 'Greeting (VIP)',
    icon: '⭐',
    replies: {
      en: 'Hello! Welcome to Bybit VIP support. I\'m here to assist you with priority handling. How can I help?',
      se: 'Hej! Valkommen till Bybit VIP-support. Jag ar har for att hjalpa dig med prioriterad hantering. Hur kan jag hjalpa till?',
    },
  },
  {
    category: 'Verification',
    icon: '🔐',
    replies: {
      en: 'For security purposes, could you please verify your account by providing your registered email address and UID?',
      se: 'Av sakerhetskal, kan du verifiera ditt konto genom att ange din registrerade e-postadress och UID?',
    },
  },
  {
    category: 'Please wait',
    icon: '⏳',
    replies: {
      en: 'Thank you for your patience. I\'m looking into this for you now. Please allow me a moment.',
      se: 'Tack for ditt talamad. Jag undersoker detta at dig nu. Var vanlig ge mig en stund.',
    },
  },
  {
    category: 'Escalation',
    icon: '📤',
    replies: {
      en: 'I understand this needs further review. I\'m escalating your case to our specialist team. You\'ll receive an update within 24 hours.',
      se: 'Jag forstar att detta behover ytterligare granskning. Jag eskalerar ditt arende till vart specialistteam. Du far en uppdatering inom 24 timmar.',
    },
  },
  {
    category: 'KYC pending',
    icon: '📋',
    replies: {
      en: 'Your KYC verification is currently being processed. This typically takes 1-3 business days. We\'ll notify you once it\'s complete.',
      se: 'Din KYC-verifiering behandlas for narvarande. Det tar vanligtvis 1-3 arbetsdagar. Vi meddelar dig nar den ar klar.',
    },
  },
  {
    category: 'Deposit check',
    icon: '💰',
    replies: {
      en: 'I can see your deposit is being processed. Could you please confirm the transaction hash (TxID) and the network you used?',
      se: 'Jag kan se att din insattning behandlas. Kan du bekrafta transaktions-hash (TxID) och natverket du anvande?',
    },
  },
  {
    category: 'Withdrawal delay',
    icon: '⏱',
    replies: {
      en: 'Your withdrawal is currently in the processing queue. Withdrawals may take up to 30 minutes depending on network congestion. I\'ll check the status for you.',
      se: 'Ditt uttag ar for narvarande i behandlingskon. Uttag kan ta upp till 30 minuter beroende pa natverksbelastning. Jag kontrollerar statusen at dig.',
    },
  },
  {
    category: 'SEPA info',
    icon: '💶',
    replies: {
      en: 'SEPA transfers typically take 1-3 business days to process. If it\'s been longer, I\'ll investigate this further for you.',
      se: 'SEPA-overforingar tar vanligtvis 1-3 arbetsdagar att behandla. Om det har tagit langre tid ska jag undersoka detta vidare at dig.',
    },
  },
  {
    category: 'Apology',
    icon: '🙏',
    replies: {
      en: 'I sincerely apologize for the inconvenience. I understand how frustrating this must be, and I\'m doing my best to resolve this for you.',
      se: 'Jag ber uppriktig om ursakt for besvaeret. Jag forstar hur frustrerande detta maste vara, och jag gor mitt basta for att losa detta at dig.',
    },
  },
  {
    category: 'Follow-up',
    icon: '📬',
    replies: {
      en: 'I\'ve created a follow-up on your case. Our team will review it and get back to you. Is there anything else I can help with?',
      se: 'Jag har skapat en uppfoljning pa ditt arende. Vart team kommer att granska det och aterkomma till dig. Finns det nagot annat jag kan hjalpa till med?',
    },
  },
  {
    category: 'Closing',
    icon: '✅',
    replies: {
      en: 'Is there anything else I can assist you with today? If not, I hope I was able to help. Have a great day!',
      se: 'Finns det nagot mer jag kan hjalpa dig med idag? Om inte, hoppas jag att jag kunde vara till hjalp. Ha en bra dag!',
    },
  },
  {
    category: 'Closing (positive)',
    icon: '🌟',
    replies: {
      en: 'Glad I could help! If you have any other questions in the future, don\'t hesitate to reach out. Have a wonderful day!',
      se: 'Glad att jag kunde hjalpa! Om du har nagra andra fragor i framtiden, tveka inte att hora av dig. Ha en underbar dag!',
    },
  },
  {
    category: 'Travel Rule',
    icon: '✈️',
    replies: {
      en: 'This verification is part of the EU Travel Rule requirement. Bybit EU must verify sender and recipient information for crypto transfers. Please complete the requested information in the flow provided.',
      se: 'Denna verifiering ar en del av EU:s Travel Rule-krav. Bybit EU maste verifiera avsandar- och mottagarinformation for kryptooverforingar. Var vanlig fyll i den begarda informationen i det tillhandahallna flodet.',
    },
  },
  {
    category: 'EU complaint',
    icon: '📝',
    replies: {
      en: 'For a formal complaint regarding Bybit EU services, please submit your complaint through our official EU support and complaint webform. This ensures proper handling under EU regulations.',
      se: 'For ett formellt klagomal angaende Bybit EU-tjanster, var vanlig skicka in ditt klagomal via vart officiella EU-support- och klagomalformular. Detta sakerstaeller korrekt hantering enligt EU-regler.',
    },
  },
];
