import type {
  FinalJeopardyAnswerPhasePayload,
  FinalJeopardyRevealPayload,
  FinalJeopardyWagerPhasePayload
} from "@jeopardy/shared";
import { useEffect, useMemo, useState } from "react";
import { Timer } from "../game/Timer";

interface FinalJeopardyScreenProps {
  phase: "final_jeopardy_wager" | "final_jeopardy_answer" | "final_jeopardy_reveal";
  myPlayerId: string | null;
  wagerPhase: FinalJeopardyWagerPhasePayload | null;
  answerPhase: FinalJeopardyAnswerPhasePayload | null;
  reveal: FinalJeopardyRevealPayload | null;
  onSubmitWager: (wager: number) => void;
  onSubmitAnswer: (answer: string) => void;
}

export const FinalJeopardyScreen = ({
  phase,
  myPlayerId,
  wagerPhase,
  answerPhase,
  reveal,
  onSubmitWager,
  onSubmitAnswer
}: FinalJeopardyScreenProps) => {
  const [wagerDraft, setWagerDraft] = useState<number | null>(null);
  const [answerDraft, setAnswerDraft] = useState("");

  const myWagerLimit = useMemo(() => {
    if (!myPlayerId || !wagerPhase) {
      return null;
    }

    return wagerPhase.limits.find((limit) => limit.playerId === myPlayerId) ?? null;
  }, [myPlayerId, wagerPhase]);

  useEffect(() => {
    if (!myWagerLimit) {
      setWagerDraft(null);
      return;
    }

    setWagerDraft((previous) => {
      if (previous === null || Number.isNaN(previous)) {
        return myWagerLimit.maxWager;
      }
      return Math.min(myWagerLimit.maxWager, Math.max(myWagerLimit.minWager, previous));
    });
  }, [myWagerLimit?.minWager, myWagerLimit?.maxWager]);

  const selectedWager = myWagerLimit ? (wagerDraft ?? myWagerLimit.maxWager) : 0;

  return (
    <section className="panel">
      <header className="row">
        <h2>Final Jeopardy</h2>
        <Timer
          phaseEndsAt={
            phase === "final_jeopardy_wager"
              ? wagerPhase?.phaseEndsAt ?? null
              : phase === "final_jeopardy_answer"
                ? answerPhase?.phaseEndsAt ?? null
                : null
          }
        />
      </header>

      {phase === "final_jeopardy_wager" && (
        <>
          <p className="subtitle">Category: {wagerPhase?.category ?? "-"}</p>
          {myWagerLimit ? (
            <div className="wager-panel">
              <p className="meta">
                Allowed wager: {myWagerLimit.minWager} to {myWagerLimit.maxWager} (score: {myWagerLimit.currentScore})
              </p>
              <div className="wager-stepper">
                <button
                  type="button"
                  onClick={() => setWagerDraft((value) => Math.max(myWagerLimit.minWager, (value ?? selectedWager) - 100))}
                  disabled={selectedWager <= myWagerLimit.minWager}
                >
                  -
                </button>
                <div className="wager-value">{selectedWager}</div>
                <button
                  type="button"
                  onClick={() => setWagerDraft((value) => Math.min(myWagerLimit.maxWager, (value ?? selectedWager) + 100))}
                  disabled={selectedWager >= myWagerLimit.maxWager}
                >
                  +
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  onSubmitWager(selectedWager);
                }}
              >
                Submit Wager
              </button>
            </div>
          ) : (
            <p>Waiting for wager limits...</p>
          )}
        </>
      )}

      {phase === "final_jeopardy_answer" && (
        <>
          <p className="subtitle">Category: {answerPhase?.category ?? "-"}</p>
          <p className="clue">{answerPhase?.question ?? "Waiting for question..."}</p>
          <div className="row">
            <input
              value={answerDraft}
              onChange={(event) => setAnswerDraft(event.target.value)}
              placeholder="Type your final answer"
            />
            <button
              type="button"
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

      {phase === "final_jeopardy_reveal" && (
        <>
          <p className="subtitle">Correct answer: {reveal?.correctAnswer ?? "-"}</p>
          <div className="stats-grid cards-5">
            {(reveal?.reveals ?? []).map((entry) => (
              <article key={entry.playerId} className="panel">
                <h3>
                  {entry.playerName}
                  {reveal?.winnerId === entry.playerId ? " (Winner)" : ""}
                </h3>
                <p>Wager: {entry.wager}</p>
                <p>Answer: {entry.answer || "(no answer)"}</p>
                <p>{entry.correct ? "Correct" : "Incorrect"}</p>
                <p>Score: {entry.scoreAfter}</p>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
};
