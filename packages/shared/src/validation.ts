// Answer Validation Utilities

/**
 * Fuzzy answer matching for Jeopardy questions
 * Normalizes both answers and compares them case-insensitively
 *
 * Normalization:
 * - Converts to lowercase
 * - Removes punctuation and special characters
 * - Trims whitespace
 *
 * @param playerAnswer - The answer submitted by the player
 * @param correctAnswer - The correct answer from the database
 * @returns true if answers match after normalization
 */
export function fuzzyAnswerMatch(playerAnswer: string, correctAnswer: string): boolean {
  const normalize = (str: string): string => {
    return str
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  };

  const normalizedPlayer = normalize(playerAnswer);
  const normalizedCorrect = normalize(correctAnswer);

  return normalizedPlayer === normalizedCorrect;
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
