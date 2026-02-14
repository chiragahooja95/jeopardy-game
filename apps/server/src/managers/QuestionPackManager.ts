// Question Pack Manager
// Loads question packs from JSON and generates game boards

import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { Question, RoomConfig } from '@jeopardy/shared';
import { GAME_CONFIG } from '@jeopardy/shared';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface QuestionPackData {
  name: string;
  description: string;
  categories: {
    name: string;
    questions: Array<{
      value: number;
      question: string;
      answer: string;
      options?: string[];
      choices?: string[];
    }>;
  }[];
}

type RawCategory = QuestionPackData["categories"][number];
const DEFAULT_RANDOM_CATEGORY_NAMES = ["Bollywood", "Tiny Human Survival Guide"] as const;

export class QuestionPackManager {
  private packCache: Map<string, QuestionPackData> = new Map();

  /**
   * Load a question pack from JSON file
   * Results are cached in memory for performance
   */
  loadPack(packName: string): QuestionPackData {
    // Check cache first
    if (this.packCache.has(packName)) {
      return this.packCache.get(packName)!;
    }

    // Load from file
    const packedPath = join(__dirname, `../data/questions-${packName}.json`);
    const sourcePath = join(__dirname, `../../src/data/questions-${packName}.json`);
    const packPath = existsSync(packedPath) ? packedPath : sourcePath;

    try {
      const data = readFileSync(packPath, 'utf-8');
      const pack: QuestionPackData = JSON.parse(data);

      // Cache it
      this.packCache.set(packName, pack);

      return pack;
    } catch (error) {
      throw new Error(`Failed to load question pack '${packName}': ${(error as Error).message}`);
    }
  }

  /**
   * Get all available question pack names
   */
  getAvailablePacks(): string[] {
    return Array.from(GAME_CONFIG.AVAILABLE_PACKS);
  }

  /**
   * Get all categories from a pack
   */
  getCategoriesFromPack(packName: string): string[] {
    const pack = this.loadPack(packName);
    return pack.categories.map((cat) => cat.name);
  }

  /**
   * Generate a game board based on room configuration
   * Returns a 2D array of questions (categories × question values)
   */
  generateBoard(config: RoomConfig): Question[][] {
    let selectedCategories: RawCategory[];
    const count = config.questionCount === 25 ? 5 : 3;

    // Step 1: Select categories based on config
    if (config.categorySelection === 'pack') {
      // Use entire pack
      const pack = this.loadPack(config.questionPack!);
      selectedCategories = this.shuffleArray(pack.categories).slice(0, count);
    } else if (config.categorySelection === 'manual') {
      // Use manually selected categories
      // Load all packs and find matching categories
      const allCategories = this.getAllCategories();
      selectedCategories = config.selectedCategories!
        .map((catName) => allCategories.find((c) => c.name === catName))
        .filter((c) => c !== undefined) as any[];
    } else if (config.categorySelection === "random") {
      const allCategories = this.getAllCategories();
      const defaultCategories = DEFAULT_RANDOM_CATEGORY_NAMES.map((name) =>
        allCategories.find((category) => category.name === name)
      ).filter((category): category is RawCategory => Boolean(category));

      const defaultCategoryNames = new Set(defaultCategories.map((category) => category.name));
      const remainingPool = allCategories.filter(
        (category) => !defaultCategoryNames.has(category.name)
      );
      const remainingNeeded = Math.max(0, count - defaultCategories.length);
      const randomRemainder = this.shuffleArray(remainingPool).slice(0, remainingNeeded);

      selectedCategories = [...defaultCategories, ...randomRemainder];
      selectedCategories = this.shuffleArray(selectedCategories).slice(0, count);
    } else {
      // Random mix from all packs
      const allCategories = this.getAllCategories();
      selectedCategories = this.shuffleArray(allCategories).slice(0, count);
    }

    // Step 2: Build the board (categories × 5 values)
    const board: Question[][] = selectedCategories.map((category, catIndex) => {
      const picked = this.pickFiveQuestions(category);
      return picked.map((q, qIndex) => ({
        id: `q_${catIndex}_${qIndex}_${Date.now()}`,
        category: category.name,
        value: q.value,
        question: q.question,
        answer: q.answer,
        options: q.options ?? q.choices,
        dailyDouble: false, // Will be set later
      }));
    });

    // Step 3: Randomly place Daily Doubles
    this.placeDailyDoubles(board, config.dailyDoubleCount);

    return board;
  }

  /**
   * Get all categories from all loaded packs
   */
  private getAllCategories(): RawCategory[] {
    const allCategories: RawCategory[] = [];

    for (const packName of GAME_CONFIG.AVAILABLE_PACKS) {
      const pack = this.loadPack(packName);
      allCategories.push(...pack.categories);
    }

    return allCategories;
  }

  private pickFiveQuestions(category: RawCategory): RawCategory["questions"] {
    const questionsByValue = new Map<number, RawCategory["questions"]>();

    for (const question of category.questions) {
      const bucket = questionsByValue.get(question.value) ?? [];
      bucket.push(question);
      questionsByValue.set(question.value, bucket);
    }

    return GAME_CONFIG.QUESTION_VALUES.map((value) => {
      const bucket = questionsByValue.get(value);
      if (!bucket || bucket.length === 0) {
        throw new Error(`Category '${category.name}' is missing question value ${value}`);
      }

      const pickedIndex = Math.floor(Math.random() * bucket.length);
      return bucket[pickedIndex];
    });
  }

  /**
   * Randomly place Daily Doubles on the board
   * Daily Doubles are placed on higher-value questions (not $200)
   */
  private placeDailyDoubles(board: Question[][], count: number): void {
    // Get all question positions except $200 questions
    const eligiblePositions: { catIndex: number; qIndex: number }[] = [];

    board.forEach((category, catIndex) => {
      category.forEach((question, qIndex) => {
        if (question.value !== 200) {
          // Don't place DD on $200 questions
          eligiblePositions.push({ catIndex, qIndex });
        }
      });
    });

    // Shuffle and select positions for Daily Doubles
    const shuffled = this.shuffleArray(eligiblePositions);
    const ddPositions = shuffled.slice(0, Math.min(count, shuffled.length));

    // Mark questions as Daily Doubles
    ddPositions.forEach(({ catIndex, qIndex }) => {
      board[catIndex][qIndex].dailyDouble = true;
    });
  }

  /**
   * Get a Final Jeopardy question
   * Returns a random high-value question from a random category
   */
  getFinalJeopardyQuestion(): Question {
    const allCategories = this.getAllCategories();
    const randomCategory = allCategories[Math.floor(Math.random() * allCategories.length)];

    // Get highest value questions ($800 or $1000)
    const highValueQuestions = randomCategory.questions.filter(
      (q) => q.value === 800 || q.value === 1000
    );

    const randomQuestion =
      highValueQuestions[Math.floor(Math.random() * highValueQuestions.length)];

    return {
      id: `final_jeopardy_${Date.now()}`,
      category: randomCategory.name,
      value: 0, // Final Jeopardy has no fixed value
      question: randomQuestion.question,
      answer: randomQuestion.answer,
      options: randomQuestion.options ?? randomQuestion.choices,
      dailyDouble: false,
    };
  }

  /**
   * Validate that a room configuration can generate a valid board
   */
  validateConfig(config: RoomConfig): { valid: boolean; error?: string } {
    try {
      const categoriesNeeded = config.questionCount === 25 ? 5 : 3;

      if (config.categorySelection === 'pack') {
        if (!config.questionPack) {
          return { valid: false, error: 'Question pack not specified' };
        }

        if (!GAME_CONFIG.AVAILABLE_PACKS.includes(config.questionPack as any)) {
          return { valid: false, error: `Invalid question pack: ${config.questionPack}` };
        }

        const pack = this.loadPack(config.questionPack);
        if (pack.categories.length < categoriesNeeded) {
          return {
            valid: false,
            error: `Pack '${config.questionPack}' has insufficient categories`,
          };
        }
      } else if (config.categorySelection === 'manual') {
        if (!config.selectedCategories || config.selectedCategories.length < categoriesNeeded) {
          return {
            valid: false,
            error: `Need ${categoriesNeeded} categories but only ${config.selectedCategories?.length || 0} provided`,
          };
        }

        // Verify all selected categories exist
        const allCategories = this.getAllCategories();
        const allCategoryNames = allCategories.map((c) => c.name);

        for (const catName of config.selectedCategories) {
          if (!allCategoryNames.includes(catName)) {
            return { valid: false, error: `Category '${catName}' not found` };
          }
        }
      }

      return { valid: true };
    } catch (error) {
      return { valid: false, error: (error as Error).message };
    }
  }

  /**
   * Shuffle an array using Fisher-Yates algorithm
   */
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}
