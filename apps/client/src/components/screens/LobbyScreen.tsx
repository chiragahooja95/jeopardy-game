import type { SerializedRoom } from "@jeopardy/shared";

interface LobbyScreenProps {
  room: SerializedRoom;
  playerId: string | null;
  onBackHome: () => void;
  onLeaveRoom: () => void;
  onStartGame: () => void;
}

export const LobbyScreen = ({
  room,
  playerId,
  onBackHome,
  onLeaveRoom,
  onStartGame
}: LobbyScreenProps) => {
  const isHost = room.hostId === playerId;
  const categoryModeLabel =
    room.config.categorySelection === "random"
      ? "Random"
      : room.config.categorySelection === "true_random"
        ? "True Random"
        : room.config.categorySelection;

  return (
    <main className="screen menu-screen">
      <header className="row">
        <div>
          <h1>Chaos Waiting Room: {room.code}</h1>
          <p className="subtitle">
            {room.players.length} player{room.players.length === 1 ? "" : "s"} connected
          </p>
        </div>
        <div className="row">
          <button className="btn-violet" onClick={onBackHome}>
            Home
          </button>
          <button className="btn-coral" onClick={onLeaveRoom}>
            Leave
          </button>
        </div>
      </header>

      <section className="panel panel-sky">
        <h2>Crew Roll Call</h2>
        <div className="score-grid">
          {room.players.map((player) => (
            <article className="score-card" key={player.id}>
              <h3>
                {player.name}
                {player.id === room.hostId ? " (Host)" : ""}
                {player.id === playerId ? " (You)" : ""}
              </h3>
              <p>{player.connected ? "Ready" : "Offline"}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel panel-gold">
        <p className="meta">Category mode: {categoryModeLabel}</p>
        <p className="meta">Questions: {room.config.questionCount}</p>
        <p className="meta">Timer: {room.config.timerSpeed}</p>
        <p className="meta">Daily Doubles: {room.config.dailyDoubleCount}</p>
        <p className="meta">Final Jeopardy: {room.config.finalJeopardyEnabled ? "Enabled" : "Disabled"}</p>
      </section>

      {isHost ? (
        <section className="panel panel-indigo">
          <button className="btn-sunset" onClick={onStartGame}>
            Start Game
          </button>
        </section>
      ) : (
        <section className="panel muted">
          <p>Waiting for host to start the game.</p>
        </section>
      )}
    </main>
  );
};
