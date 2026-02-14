import type {
  FinalJeopardyAnswerPhasePayload,
  FinalJeopardyRevealPayload,
  FinalJeopardyWagerPhasePayload
} from "@jeopardy/shared";
import { useMemo, useState } from "react";
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
  const [wagerDraft, setWagerDraft] = useState("");
  const [answerDraft, setAnswerDraft] = useState("");

  const myWagerLimit = useMemo(() => {
    if (!myPlayerId || !wagerPhase) {
      return null;
    }

    return wagerPhase.limits.find((limit) => limit.playerId === myPlayerId) ?? null;
  }, [myPlayerId, wagerPhase]);

  const initialWager = myWagerLimit ? String(myWagerLimit.maxWager) : "";

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
            <div className="row">
              <input
                type="number"
                min={myWagerLimit.minWager}
                max={myWagerLimit.maxWager}
                step={100}
                value={wagerDraft || initialWager}
                onChange={(event) => setWagerDraft(event.target.value)}
              />
              <button
                onClick={() => {
                  const parsed = Number(wagerDraft || initialWager);
                  if (Number.isInteger(parsed)) {
                    onSubmitWager(parsed);
                  }
                }}
              >
                Submit Wager
              </button>
            </div>
          ) : (
            <p>Waiting for wager limits...</p>
          )}
          {myWagerLimit ? (
            <p className="status">
              Allowed wager: {myWagerLimit.minWager} to {myWagerLimit.maxWager} (score: {myWagerLimit.currentScore})
            </p>
          ) : null}
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
