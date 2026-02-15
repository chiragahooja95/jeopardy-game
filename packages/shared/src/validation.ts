// Answer Validation Utilities

export interface AnswerMatchOptions {
  aliases?: string[];
  lenient?: boolean;
}

const normalizeBase = (input: string): string =>
  input
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalizeLenient = (input: string): string => {
  let normalized = normalizeBase(input);
  const phraseAliases: Array<[string, string]> = [
    ["u s a", "united states"],
    ["usa", "united states"],
    ["u s", "united states"],
    ["us", "united states"],
    ["u k", "united kingdom"],
    ["uk", "united kingdom"],
    ["st", "saint"],
    ["mt", "mount"]
  ];

  for (const [from, to] of phraseAliases) {
    normalized = normalized.replace(new RegExp(`\\b${from}\\b`, "g"), to);
  }

  return normalized
    .replace(/\b(the|a|an)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const compact = (input: string): string => input.replace(/\s+/g, "");

const acronym = (input: string): string =>
  input
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0] ?? "")
    .join("");

const levenshteinDistance = (a: string, b: string): number => {
  if (a === b) {
    return 0;
  }
  if (a.length === 0) {
    return b.length;
  }
  if (b.length === 0) {
    return a.length;
  }

  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix = Array.from({ length: rows }, (_, row) =>
    Array.from({ length: cols }, (_, col) => (row === 0 ? col : col === 0 ? row : 0))
  );

  for (let row = 1; row < rows; row += 1) {
    for (let col = 1; col < cols; col += 1) {
      const substitutionCost = a[row - 1] === b[col - 1] ? 0 : 1;
      matrix[row][col] = Math.min(
        matrix[row - 1][col] + 1,
        matrix[row][col - 1] + 1,
        matrix[row - 1][col - 1] + substitutionCost
      );
    }
  }

  return matrix[rows - 1][cols - 1];
};

const editDistanceAllowance = (longerLength: number): number => {
  if (longerLength <= 4) {
    return 0;
  }
  if (longerLength <= 9) {
    return 1;
  }
  if (longerLength <= 15) {
    return 2;
  }
  return 3;
};

const matchesLenient = (playerAnswer: string, acceptedAnswer: string): boolean => {
  const normalizedPlayer = normalizeLenient(playerAnswer);
  const normalizedAccepted = normalizeLenient(acceptedAnswer);

  if (!normalizedPlayer || !normalizedAccepted) {
    return false;
  }

  if (normalizedPlayer === normalizedAccepted) {
    return true;
  }

  const playerCompact = compact(normalizedPlayer);
  const acceptedCompact = compact(normalizedAccepted);

  if (playerCompact === acceptedCompact) {
    return true;
  }

  const playerAcronym = acronym(normalizedPlayer);
  const acceptedAcronym = acronym(normalizedAccepted);

  if (
    (playerCompact.length >= 2 && playerCompact === acceptedAcronym) ||
    (acceptedCompact.length >= 2 && acceptedCompact === playerAcronym) ||
    (playerAcronym.length >= 2 && acceptedAcronym.length >= 2 && playerAcronym === acceptedAcronym)
  ) {
    return true;
  }

  if (
    (playerCompact.length >= 4 && acceptedCompact.startsWith(playerCompact)) ||
    (acceptedCompact.length >= 4 && playerCompact.startsWith(acceptedCompact))
  ) {
    return true;
  }

  const longerLength = Math.max(playerCompact.length, acceptedCompact.length);
  const allowance = editDistanceAllowance(longerLength);
  if (allowance === 0 || Math.abs(playerCompact.length - acceptedCompact.length) > allowance) {
    return false;
  }

  return levenshteinDistance(playerCompact, acceptedCompact) <= allowance;
};

/**
 * Fuzzy answer matching for Jeopardy questions.
 *
 * Strict mode (default):
 * - lowercase
 * - remove punctuation
 * - normalize whitespace
 * - exact normalized match
 *
 * Lenient mode:
 * - strict checks + article removal
 * - common shortform canonicalization
 * - acronym/initialism matching
 * - small typo tolerance via edit distance
 */
export function fuzzyAnswerMatch(
  playerAnswer: string,
  correctAnswer: string,
  options: AnswerMatchOptions = {}
): boolean {
  const acceptedAnswers = [correctAnswer, ...(options.aliases ?? [])];
  const normalizedPlayer = normalizeBase(playerAnswer);
  if (!normalizedPlayer) {
    return false;
  }

  if (!options.lenient) {
    return acceptedAnswers.some((candidate) => normalizeBase(candidate) === normalizedPlayer);
  }

  return acceptedAnswers.some((candidate) => matchesLenient(playerAnswer, candidate));
}

/**
 * Validate wager amount for Daily Double
 *
 * @param wager - The wager amount
 * @param playerScore - Current player score
 * @param minWager - Minimum allowed wager (default 200)
 * @returns true if wager is valid
 */
export function validateDailyDoubleWager(
  wager: number,
  playerScore: number,
  questionValue: number = 1000,
  minWager: number = 200
): boolean {
  if (!Number.isInteger(wager) || wager < 0) {
    return false;
  }

  const min = minWager;
  const max = Math.max(playerScore, questionValue, 200);

  return wager >= min && wager <= max;
}

/**
 * Validate wager amount for Final Jeopardy
 *
 * @param wager - The wager amount
 * @param playerScore - Current player score
 * @returns true if wager is valid
 */
export function validateFinalJeopardyWager(wager: number, playerScore: number): boolean {
  if (!Number.isInteger(wager) || wager < 0) {
    return false;
  }

  const min = 0;
  const max = playerScore > 0 ? playerScore : 1000;

  return wager >= min && wager <= max;
}

/**
 * Validate room code format
 * Must be exactly 4 uppercase letters
 *
 * @param code - Room code to validate
 * @returns true if code is valid format
 */
export function validateRoomCode(code: string): boolean {
  return /^[A-Z]{4}$/.test(code);
}

/**
 * Generate a random 4-letter room code
 *
 * @returns A random 4-letter uppercase room code
 */
export function generateRoomCode(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // Exclude I and O to avoid confusion
  let code = '';

  for (let i = 0; i < 4; i++) {
    code += letters.charAt(Math.floor(Math.random() * letters.length));
  }

  return code;
}

/**
 * Validate user name
 * Must be 1-20 characters, alphanumeric and spaces
 *
 * @param name - User name to validate
 * @returns true if name is valid
 */
export function validateUserName(name: string): boolean {
  if (typeof name !== 'string') return false;
  if (name.trim().length === 0 || name.trim().length > 20) return false;
  return /^[a-zA-Z0-9\s]+$/.test(name);
}
