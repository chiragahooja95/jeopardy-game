import type { Player } from "@jeopardy/shared";

interface ScoreboardProps {
  players: Player[];
  turnPlayerId: string;
  myPlayerId: string | null;
}

export const Scoreboard = ({ players, turnPlayerId, myPlayerId }: ScoreboardProps) => {
  const sorted = [...players].sort((a, b) => b.score - a.score);

  return (
    <section className="panel gameplay-score-panel">
      <h2>Leaderboard</h2>
      <div className="score-grid">
        {sorted.map((player) => {
          const classes = ["score-card"];
          if (player.id === turnPlayerId) {
            classes.push("turn");
          }
          if (player.id === myPlayerId) {
            classes.push("me");
          }

          return (
            <article className={classes.join(" ")} key={player.id}>
              <h3>{player.name}{player.connected ? "" : " (offline)"}</h3>
              <p>{player.score}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
};
