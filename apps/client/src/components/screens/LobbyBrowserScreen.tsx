import { CLIENT_EVENTS, SERVER_EVENTS, type RoomListPayload, type RoomSummaryPayload } from "@jeopardy/shared";
import { useEffect, useMemo, useState } from "react";
import { useSocket } from "../../hooks/useSocket";

interface LobbyBrowserScreenProps {
  onBack: () => void;
  onJoinLobby: (roomCode: string) => void;
}

const formatTime = (value: number | null): string => {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

export const LobbyBrowserScreen = ({ onBack, onJoinLobby }: LobbyBrowserScreenProps) => {
  const { socket } = useSocket();
  const [rooms, setRooms] = useState<RoomSummaryPayload[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleRoomList = (payload: RoomListPayload) => {
      setRooms(payload.rooms);
      setLoading(false);
    };

    socket.on(SERVER_EVENTS.ROOM_LIST, handleRoomList);
    socket.emit(CLIENT_EVENTS.LIST_ROOMS, {});

    return () => {
      socket.off(SERVER_EVENTS.ROOM_LIST, handleRoomList);
    };
  }, [socket]);

  const ongoingRooms = useMemo(
    () => rooms.filter((room) => room.status === "lobby" || room.status === "playing" || room.status === "final_jeopardy"),
    [rooms]
  );

  return (
    <main className="screen menu-screen">
      <header className="row">
        <div>
          <h1>Room Safari</h1>
          <p className="subtitle">Sniff out live rooms and jump in.</p>
        </div>
        <div className="row">
          <button className="btn-violet" onClick={onBack}>
            Back
          </button>
          <button
            className="btn-ocean"
            onClick={() => {
              setLoading(true);
              socket.emit(CLIENT_EVENTS.LIST_ROOMS, {});
            }}
          >
            Refresh
          </button>
        </div>
      </header>

      <section className="panel panel-indigo">
        {loading ? (
          <p className="status loader-line">
            <span className="loader-dot" /> Loading lobbies...
          </p>
        ) : ongoingRooms.length === 0 ? (
          <p className="status">No active lobbies right now.</p>
        ) : (
          <div className="stats-grid">
            {ongoingRooms.map((room) => (
              <article className="panel" key={room.code}>
                <h3>Room {room.code}</h3>
                <p className="meta">Status: {room.status}</p>
                <p className="meta">
                  Players: {room.connectedPlayerCount}/{room.playerCount}
                </p>
                <p className="meta">Started: {formatTime(room.startedAt)}</p>
                <button className="btn-sunset" onClick={() => onJoinLobby(room.code)}>
                  Open
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
};
