import type { GameOverPayload } from "@jeopardy/shared";
import { useEffect, useMemo } from "react";
import { useUserContext } from "../../contexts/UserContext";

interface ResultsScreenProps {
  gameOver: GameOverPayload;
  myPlayerId: string | null;
  onLeave: () => void;
}

export const ResultsScreen = ({ gameOver, myPlayerId, onLeave }: ResultsScreenProps) => {
  const { refreshStats } = useUserContext();

  useEffect(() => {
    if (gameOver.statsUpdated) {
      refreshStats();
    }
  }, [gameOver.statsUpdated, refreshStats]);

  const sortedPlayers = useMemo(
    () => [...gameOver.allPlayers].sort((a, b) => b.score - a.score),
    [gameOver.allPlayers]
  );

  return (
    <section className="panel results-panel">
      <header className="row">
        <div>
          <h2>Game Results</h2>
          <p className="subtitle">
            Winner: <strong>{gameOver.winner.name}</strong>
          </p>
        </div>
        <div className="results-pill">
          <span>{gameOver.statsUpdated ? "Stats Synced" : "Stats Pending"}</span>
        </div>
      </header>

      <div className="results-grid">
        {sortedPlayers.map((player, index) => (
          <article className="results-card" key={player.id}>
            <h3>
              <span>#{index + 1}</span> {player.name}
              {player.id === myPlayerId ? " (You)" : ""}
            </h3>
            <p className="results-score">{player.score}</p>
            <p className="results-meta">
              Correct: {player.correctAnswers} | Wrong: {player.wrongAnswers}
            </p>
          </article>
        ))}
      </div>

      <p className="status results-status">
        {gameOver.statsUpdated
          ? "Stats were saved and refreshed."
          : "Game ended, but stats could not be saved."}
      </p>

      <div className="row results-actions">
        <button className="btn-sunset" onClick={onLeave}>Return Home</button>
      </div>
    </section>
  );
};
