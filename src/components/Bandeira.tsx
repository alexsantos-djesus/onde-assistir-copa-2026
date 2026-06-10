import "flag-icons/css/flag-icons.min.css";

type Props = {
  code: string | null | undefined;
  size?: number;
  rounded?: boolean;
  className?: string;
};

// Mapeamento de nomes/códigos comuns para ISO 3166-1 alpha-2
const MAP: Record<string, string> = {
  BRA: "br", BRASIL: "br", BRAZIL: "br",
  ARG: "ar", ARGENTINA: "ar",
  USA: "us", EUA: "us", "ESTADOS UNIDOS": "us",
  MEX: "mx", MÉXICO: "mx", MEXICO: "mx",
  CAN: "ca", CANADÁ: "ca", CANADA: "ca",
  FRA: "fr", FRANÇA: "fr", FRANCA: "fr",
  ESP: "es", ESPANHA: "es",
  POR: "pt", PORTUGAL: "pt",
  ENG: "gb-eng", INGLATERRA: "gb-eng",
  GER: "de", ALEMANHA: "de",
  ITA: "it", ITÁLIA: "it", ITALIA: "it",
  NED: "nl", HOLANDA: "nl",
  BEL: "be", BÉLGICA: "be", BELGICA: "be",
  CRO: "hr", CROÁCIA: "hr", CROACIA: "hr",
  URU: "uy", URUGUAI: "uy",
  COL: "co", COLÔMBIA: "co", COLOMBIA: "co",
  CHI: "cl", CHILE: "cl",
  PAR: "py", PARAGUAI: "py",
  EQU: "ec", EQUADOR: "ec",
  PER: "pe", PERU: "pe",
  VEN: "ve", VENEZUELA: "ve",
  BOL: "bo", BOLÍVIA: "bo", BOLIVIA: "bo",
  JPN: "jp", JAPÃO: "jp", JAPAO: "jp",
  KOR: "kr", "COREIA DO SUL": "kr",
  AUS: "au", AUSTRÁLIA: "au", AUSTRALIA: "au",
  SUI: "ch", SUÍÇA: "ch", SUICA: "ch",
  POL: "pl", POLÔNIA: "pl", POLONIA: "pl",
  SEN: "sn", SENEGAL: "sn",
  MAR: "ma", MARROCOS: "ma",
  TUN: "tn", TUNÍSIA: "tn", TUNISIA: "tn",
  EGI: "eg", EGITO: "eg",
  GAN: "gh", GANA: "gh",
  CMR: "cm", CAMARÕES: "cm", CAMAROES: "cm",
  CIV: "ci", "COSTA DO MARFIM": "ci",
  RSA: "za", "ÁFRICA DO SUL": "za", "AFRICA DO SUL": "za",
  ARG_AR: "ar",
  IRN: "ir", IRÃ: "ir", IRA: "ir",
  KSA: "sa", "ARÁBIA SAUDITA": "sa", "ARABIA SAUDITA": "sa",
  QAT: "qa", CATAR: "qa",
  CRC: "cr", "COSTA RICA": "cr",
  PAN: "pa", PANAMÁ: "pa", PANAMA: "pa",
  JAM: "jm", JAMAICA: "jm",
  HON: "hn", HONDURAS: "hn",
  DEN: "dk", DINAMARCA: "dk",
  SWE: "se", SUÉCIA: "se", SUECIA: "se",
  NOR: "no", NORUEGA: "no",
  WAL: "gb-wls", "PAÍS DE GALES": "gb-wls", "PAIS DE GALES": "gb-wls",
  SCO: "gb-sct", ESCÓCIA: "gb-sct", ESCOCIA: "gb-sct",
  IRL: "ie", IRLANDA: "ie",
  TUR: "tr", TURQUIA: "tr",
  SRB: "rs", SÉRVIA: "rs", SERVIA: "rs",
  UKR: "ua", UCRÂNIA: "ua", UCRANIA: "ua",
  AUT: "at", ÁUSTRIA: "at", AUSTRIA: "at",
  CZE: "cz", "REPÚBLICA TCHECA": "cz",
  GRE: "gr", GRÉCIA: "gr", GRECIA: "gr",
  RUS: "ru", RÚSSIA: "ru", RUSSIA: "ru",
  NZL: "nz", "NOVA ZELÂNDIA": "nz", "NOVA ZELANDIA": "nz",
  HAI: "ht", HAITI: "ht",
  CUR: "cw", CURAÇAO: "cw", CURACAO: "cw",
  UZB: "uz", UZBEQUISTÃO: "uz", UZBEQUISTAO: "uz",
  JOR: "jo", JORDÂNIA: "jo", JORDANIA: "jo",
};

function resolveCode(input: string): string | null {
  const t = input.trim();
  if (!t) return null;
  // URL → não é código
  if (/^https?:\/\//i.test(t)) return null;
  const up = t.toUpperCase();
  if (MAP[up]) return MAP[up];
  // já é alpha-2
  if (/^[A-Za-z]{2}$/.test(t)) return t.toLowerCase();
  // fi suporta gb-eng, gb-wls, etc
  if (/^[a-z]{2}-[a-z]{2,3}$/i.test(t)) return t.toLowerCase();
  return null;
}

export function Bandeira({ code, size = 24, rounded = true, className = "" }: Props) {
  if (code && /^https?:\/\//i.test(code)) {
    return (
      <img
        src={code}
        alt=""
        style={{ width: size, height: size }}
        className={`object-cover ${rounded ? "rounded-full" : ""} ${className}`}
        loading="lazy"
      />
    );
  }
  const iso = code ? resolveCode(code) : null;
  if (!iso) {
    return (
      <span
        style={{ width: size, height: size * 0.75 }}
        className={`inline-block bg-muted ${rounded ? "rounded" : ""} ${className}`}
      />
    );
  }
  const w = size;
  const h = size * 0.75;
  return (
    <span
      className={`fi fi-${iso} inline-block shadow-sm ${rounded ? "rounded-[3px]" : ""} ${className}`}
      style={{
        width: w,
        height: h,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
      aria-hidden
    />
  );
}
