export interface DialCode {
  code: string;
  country: string;
  flag: string;
}

// Mali en tête (cœur du réseau Suguba), puis pays voisins d'Afrique de
// l'Ouest, puis principaux pays de la diaspora malienne.
export const DIAL_CODES: DialCode[] = [
  { code: '+223', country: 'Mali', flag: '🇲🇱' },
  { code: '+221', country: 'Sénégal', flag: '🇸🇳' },
  { code: '+225', country: "Côte d'Ivoire", flag: '🇨🇮' },
  { code: '+226', country: 'Burkina Faso', flag: '🇧🇫' },
  { code: '+224', country: 'Guinée', flag: '🇬🇳' },
  { code: '+227', country: 'Niger', flag: '🇳🇪' },
  { code: '+222', country: 'Mauritanie', flag: '🇲🇷' },
  { code: '+233', country: 'Ghana', flag: '🇬🇭' },
  { code: '+234', country: 'Nigéria', flag: '🇳🇬' },
  { code: '+228', country: 'Togo', flag: '🇹🇬' },
  { code: '+229', country: 'Bénin', flag: '🇧🇯' },
  { code: '+220', country: 'Gambie', flag: '🇬🇲' },
  { code: '+245', country: 'Guinée-Bissau', flag: '🇬🇼' },
  { code: '+33', country: 'France', flag: '🇫🇷' },
  { code: '+1', country: 'États-Unis / Canada', flag: '🇺🇸' },
  { code: '+32', country: 'Belgique', flag: '🇧🇪' },
  { code: '+49', country: 'Allemagne', flag: '🇩🇪' },
  { code: '+34', country: 'Espagne', flag: '🇪🇸' },
  { code: '+39', country: 'Italie', flag: '🇮🇹' },
  { code: '+44', country: 'Royaume-Uni', flag: '🇬🇧' },
  { code: '+212', country: 'Maroc', flag: '🇲🇦' },
  { code: '+213', country: 'Algérie', flag: '🇩🇿' },
  { code: '+216', country: 'Tunisie', flag: '🇹🇳' },
  { code: '+971', country: 'Émirats Arabes Unis', flag: '🇦🇪' },
  { code: '+966', country: 'Arabie Saoudite', flag: '🇸🇦' },
  { code: '+86', country: 'Chine', flag: '🇨🇳' },
];

export const DEFAULT_DIAL_CODE = '+223';
