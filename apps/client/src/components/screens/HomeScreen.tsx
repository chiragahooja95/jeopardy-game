import { useState } from "react";
import { useUserContext } from "../../contexts/UserContext";

interface HomeScreenProps {
  onOpenStats: () => void;
  onOpenCreateRoom: () => void;
  onJoinRoom: (roomCode: string) => void;
  onOpenLobby: () => void;
  isRoomActionPending: boolean;
  roomActionLabel: string | null;
}

export const HomeScreen = ({
  onOpenStats,
  onOpenCreateRoom,
  onJoinRoom,
  onOpenLobby,
  isRoomActionPending,
  roomActionLabel
}: HomeScreenProps) => {
  const { userName, stats, saveUserName, isConnected, isLoadingStats, refreshStats } = useUserContext();
  const [nameDraft, setNameDraft] = useState(userName ?? "");
  const [roomCode, setRoomCode] = useState("");

  return (
    <main className="screen menu-screen">
      <section className="hero-banner">
        <h1 className="hero-title">Chaos Quiz Party</h1>
      </section>

      <section className="panel panel-sky">
        <label htmlFor="name">Display Name</label>
        <div className="row">
          <input
            id="name"
            value={nameDraft}
            onChange={(event) => setNameDraft(event.target.value)}
            placeholder="Enter your name"
          />
          <button className="btn-mint" onClick={() => saveUserName(nameDraft)}>
            Save
          </button>
        </div>
        <p className="status">
          {isConnected ? "Connected to server" : "Offline"}
          {isLoadingStats ? " - Loading stats..." : ""}
        </p>
      </section>

      <section className="panel panel-gold">
        <h2>Brag-o-Meter</h2>
        <div className="stats-grid">
          <article>
            <h3>Games</h3>
            <p>{stats?.gamesPlayed ?? 0}</p>
          </article>
          <article>
            <h3>Win Rate</h3>
            <p>{(stats?.winRate ?? 0).toFixed(1)}%</p>
          </article>
          <article>
            <h3>Avg Score</h3>
            <p>{Math.round(stats?.averageScore ?? 0)}</p>
          </article>
        </div>
        <div className="row">
          <button className="btn-coral" onClick={refreshStats}>
            Refresh Stats
          </button>
          <button className="btn-violet" onClick={onOpenStats}>
            View Full Stats
          </button>
        </div>
      </section>

      <section className="panel panel-indigo">
        <h2>Big Red Buttons</h2>
        <div className="row play-actions">
          <button className="btn-sunset" disabled={isRoomActionPending} onClick={onOpenCreateRoom}>
            Create Room
          </button>
          <input
            value={roomCode}
            onChange={(event) => setRoomCode(event.target.value.toUpperCase())}
            maxLength={4}
            placeholder="Room code"
          />
          <button
            className="btn-ocean"
            disabled={isRoomActionPending || roomCode.trim().length !== 4}
            onClick={() => onJoinRoom(roomCode)}
          >
            Join Room
          </button>
          <button className="btn-violet" disabled={isRoomActionPending} onClick={onOpenLobby}>
            Browse Lobbies
          </button>
        </div>
        {isRoomActionPending ? (
          <p className="status loader-line">
            <span className="loader-dot" /> {roomActionLabel ?? "Working..."}
          </p>
        ) : null}
      </section>
    </main>
  );
};
