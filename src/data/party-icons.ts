const PARTY_ICON_URLS: Record<string, string> = {
  ADMK: "https://commons.wikimedia.org/wiki/Special:FilePath/Indian_Election_Symbol_Two_Leaves.svg",
  AIADMK: "https://commons.wikimedia.org/wiki/Special:FilePath/Indian_Election_Symbol_Two_Leaves.svg",
  AITC: "https://commons.wikimedia.org/wiki/Special:FilePath/All_India_Trinamool_Congress_symbol_2021.svg",
  BJP: "https://commons.wikimedia.org/wiki/Special:FilePath/Logo_of_the_Bharatiya_Janata_Party.svg",
  CPI: "https://commons.wikimedia.org/wiki/Special:FilePath/Hammer_and_sickle_red_on_transparent.svg",
  "CPI(M)": "https://commons.wikimedia.org/wiki/Special:FilePath/Cpm_election_symbol.svg",
  DMK: "https://commons.wikimedia.org/wiki/Special:FilePath/Flag_DMK.svg",
  INC: "https://commons.wikimedia.org/wiki/Special:FilePath/Indian_National_Congress_hand_logo.svg",
  IUML: "https://commons.wikimedia.org/wiki/Special:FilePath/Flag_of_the_Indian_Union_Muslim_League.svg",
  PMK: "https://commons.wikimedia.org/wiki/Special:FilePath/PMK.svg",
  TMC: "https://commons.wikimedia.org/wiki/Special:FilePath/All_India_Trinamool_Congress_symbol_2021.svg"
};

const PARTY_CODE_ALIASES: Record<string, string> = {
  "All India N.R. Congress": "AINRC",
  "All India Anna Dravida Munnetra Kazhagam": "ADMK",
  "All India Trinamool Congress": "AITC",
  "Bharatiya Janata Party": "BJP",
  "Communist Party of India": "CPI",
  "Communist Party of India (Marxist)": "CPI(M)",
  "Dravida Munnetra Kazhagam": "DMK",
  "Indian National Congress": "INC",
  "Indian Union Muslim League": "IUML",
  "Pattali Makkal Katchi": "PMK"
};

function normalizePartyKey(value?: string) {
  return value?.replace(/\s+/g, " ").trim();
}

export function getPartyCodeFromName(name?: string) {
  const normalized = normalizePartyKey(name);
  return normalized ? PARTY_CODE_ALIASES[normalized] : undefined;
}

export function getPartyIconUrl(codeOrName?: string, fallbackName?: string) {
  const normalizedCode = normalizePartyKey(codeOrName);
  const directCode = normalizedCode ? PARTY_ICON_URLS[normalizedCode.toUpperCase()] : undefined;
  if (directCode) return directCode;

  const aliasCode = normalizedCode ? PARTY_CODE_ALIASES[normalizedCode] : undefined;
  if (aliasCode) return PARTY_ICON_URLS[aliasCode];

  const fallbackAlias = getPartyCodeFromName(fallbackName);
  return fallbackAlias ? PARTY_ICON_URLS[fallbackAlias] : undefined;
}
