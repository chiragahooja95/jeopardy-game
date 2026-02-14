import type { GamePhase, PublicQuestion } from "@jeopardy/shared";
import { useMemo, useState } from "react";
import { BuzzerButton } from "../game/BuzzerButton";
import { Timer } from "../game/Timer";

interface QuestionModalProps {
  question: PublicQuestion | null;
  gamePhase: GamePhase;
  phaseEndsAt: number | null;
  dailyDoubleWager: number | null;
  dailyDoubleMinWager: number;
  dailyDoubleMaxWager: number;
  canBuzz: boolean;
  canAnswer: boolean;
  isDailyDoublePlayer: boolean;
  onBuzz: () => void;
  onSubmitAnswer: (answer: string) => void;
  onSubmitWager: (wager: number) => void;
}

export const QuestionModal = ({
  question,
  gamePhase,
  phaseEndsAt,
  dailyDoubleWager,
  dailyDoubleMinWager,
  dailyDoubleMaxWager,
  canBuzz,
  canAnswer,
  isDailyDoublePlayer,
  onBuzz,
  onSubmitAnswer,
  onSubmitWager
}: QuestionModalProps) => {
  const [answerDraft, setAnswerDraft] = useState("");
  const [wagerDraft, setWagerDraft] = useState("200");
  const hasOptions = Boolean(question?.options && question.options.length > 0);

  const title = useMemo(() => {
    switch (gamePhase) {
      case "reading":
        return "Reading";
      case "buzzer_active":
        return "Buzz In";
      case "answering":
        return "Answer";
      case "daily_double":
        return "Daily Double";
      default:
        return "Question";
    }
  }, [gamePhase]);

  const isDailyDoubleWagerPending = gamePhase === "daily_double" && dailyDoubleWager === null;

  if (!question || gamePhase === "selection") {
    return null;
  }

  return (
    <div className="question-modal-overlay">
      <section className="panel question-modal">
        <header className="question-modal-header">
          <div>
            <p className="question-kicker">{title}</p>
            <h2>
              {question.category} for {question.value}
            </h2>
          </div>
          <Timer phaseEndsAt={phaseEndsAt} />
        </header>
        <p className="clue">
          {isDailyDoubleWagerPending
            ? isDailyDoublePlayer
              ? "Set your wager to reveal the Daily Double clue."
              : "Waiting for Daily Double wager..."
            : question.question}
        </p>
        <div className="question-modal-interact">
          {gamePhase === "buzzer_active" && (
            <div className="question-modal-actions">
              <BuzzerButton disabled={!canBuzz} onBuzz={onBuzz} />
            </div>
          )}

          {gamePhase === "daily_double" && isDailyDoublePlayer && (
            <div className="row question-modal-actions">
              <input
                type="number"
                value={wagerDraft}
                onChange={(event) => setWagerDraft(event.target.value)}
                min={dailyDoubleMinWager}
                max={dailyDoubleMaxWager}
                step={100}
              />
              <button
                onClick={() => {
                  const parsed = Number(wagerDraft);
                  if (
                    Number.isInteger(parsed) &&
                    parsed >= dailyDoubleMinWager &&
                    parsed <= dailyDoubleMaxWager
                  ) {
                    onSubmitWager(parsed);
                  }
                }}
              >
                Submit Wager
              </button>
            </div>
          )}

          {(canAnswer || (gamePhase === "daily_double" && isDailyDoublePlayer && !isDailyDoubleWagerPending)) && (
            <>
              {hasOptions ? (
                <div className="choice-grid question-modal-actions">
                  {question?.options?.map((option) => (
                    <button
                      className="choice-btn"
                      key={option}
                      onClick={() => onSubmitAnswer(option)}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="row question-modal-actions">
                  <input
                    value={answerDraft}
                    onChange={(event) => setAnswerDraft(event.target.value)}
                    placeholder="Type answer"
                  />
                  <button
                    onClick={() => {
                      onSubmitAnswer(answerDraft);
                      setAnswerDraft("");
                    }}
                  >
                    Submit Answer
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
};
