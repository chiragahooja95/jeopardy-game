import type { GamePhase, PublicQuestion } from "@jeopardy/shared";
import { useEffect, useMemo, useState } from "react";
import { BuzzerButton } from "../game/BuzzerButton";
import { Timer } from "../game/Timer";

interface AnswerFeedback {
  playerName: string;
  correct: boolean;
  pointsAwarded: number;
}

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
  answerFeedback: AnswerFeedback | null;
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
  answerFeedback,
  onBuzz,
  onSubmitAnswer,
  onSubmitWager
}: QuestionModalProps) => {
  const [answerDraft, setAnswerDraft] = useState("");
  const [wagerDraft, setWagerDraft] = useState(dailyDoubleMinWager);
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
  const canSubmitChoice =
    canAnswer || (gamePhase === "daily_double" && isDailyDoublePlayer && !isDailyDoubleWagerPending);
  const showChoices = hasOptions && !isDailyDoubleWagerPending;

  useEffect(() => {
    setWagerDraft((previous) => {
      if (Number.isNaN(previous)) {
        return dailyDoubleMinWager;
      }
      return Math.min(dailyDoubleMaxWager, Math.max(dailyDoubleMinWager, previous));
    });
  }, [dailyDoubleMinWager, dailyDoubleMaxWager]);

  useEffect(() => {
    if (isDailyDoubleWagerPending) {
      setWagerDraft(dailyDoubleMinWager);
    }
  }, [isDailyDoubleWagerPending, dailyDoubleMinWager]);

  if (!question || gamePhase === "selection") {
    return null;
  }

  return (
    <div className="question-modal-overlay">
      <section
        className={`panel question-modal ${
          answerFeedback ? (answerFeedback.correct ? "question-modal-correct" : "question-modal-wrong") : ""
        }`}
      >
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
        {answerFeedback && (
          <div className={`answer-feedback ${answerFeedback.correct ? "correct" : "wrong"}`}>
            <strong>{answerFeedback.playerName}</strong>{" "}
            {answerFeedback.correct ? "answered correctly" : "answered incorrectly"} (
            {answerFeedback.pointsAwarded > 0 ? `+${answerFeedback.pointsAwarded}` : answerFeedback.pointsAwarded})
          </div>
        )}
        <div className="question-modal-interact">
          {gamePhase === "buzzer_active" && (
            <div className="question-modal-actions">
              <BuzzerButton disabled={!canBuzz} onBuzz={onBuzz} />
            </div>
          )}

          {gamePhase === "daily_double" && isDailyDoublePlayer && (
            <div className="question-modal-actions wager-panel">
              <p className="meta">
                Wager Range: {dailyDoubleMinWager} - {dailyDoubleMaxWager}
              </p>
              <div className="wager-stepper">
                <button
                  type="button"
                  onClick={() => setWagerDraft((value) => Math.max(dailyDoubleMinWager, value - 100))}
                  disabled={wagerDraft <= dailyDoubleMinWager}
                >
                  -
                </button>
                <div className="wager-value">{wagerDraft}</div>
                <button
                  type="button"
                  onClick={() => setWagerDraft((value) => Math.min(dailyDoubleMaxWager, value + 100))}
                  disabled={wagerDraft >= dailyDoubleMaxWager}
                >
                  +
                </button>
              </div>
              <button
                onClick={() => {
                  onSubmitWager(wagerDraft);
                }}
                disabled={dailyDoubleWager !== null}
              >
                Submit Wager
              </button>
            </div>
          )}

          {showChoices && (
            <div className="choice-grid question-modal-actions">
              {question?.options?.map((option) => (
                <button
                  className={`choice-btn ${canSubmitChoice ? "" : "choice-btn-disabled"}`}
                  key={option}
                  disabled={!canSubmitChoice}
                  onClick={() => {
                    if (canSubmitChoice) {
                      onSubmitAnswer(option);
                    }
                  }}
                >
                  {option}
                </button>
              ))}
            </div>
          )}

          {(canAnswer || (gamePhase === "daily_double" && isDailyDoublePlayer && !isDailyDoubleWagerPending)) &&
            !hasOptions && (
            <>
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
            </>
          )}
        </div>
      </section>
    </div>
  );
};
