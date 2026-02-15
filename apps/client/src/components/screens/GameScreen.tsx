import {
  SERVER_EVENTS,
  type GamePhase,
  type AnswerResultPayload,
  type PlayerDisconnectedPayload,
  type PlayerReconnectedPayload,
  type PlayerBuzzedPayload,
  type QuestionCompletePayload
} from "@jeopardy/shared";
import { useEffect, useMemo, useRef, useState } from "react";
import { useGameContext } from "../../contexts/GameContext";
import { useSocket } from "../../hooks/useSocket";
import { GameBoard } from "../layout/GameBoard";
import { QuestionModal } from "../layout/QuestionModal";
import { Scoreboard } from "../layout/Scoreboard";
import { FinalJeopardyScreen } from "./FinalJeopardyScreen";
import { ResultsScreen } from "./ResultsScreen";

interface GameScreenProps {
  onLeave: () => void;
}

interface AnswerFeedback {
  playerName: string;
  correct: boolean;
  pointsAwarded: number;
}

export const GameScreen = ({ onLeave }: GameScreenProps) => {
  const {
    room,
    playerId,
    leaveRoom,
    startGame,
    selectQuestion,
    buzzIn,
    submitAnswer,
    submitWager,
    submitFinalWager,
    submitFinalAnswer,
    finalJeopardyWagerPhase,
    finalJeopardyAnswerPhase,
    finalJeopardyReveal,
    gameOver
  } = useGameContext();
  const { socket } = useSocket();

  const [musicEnabled, setMusicEnabled] = useState(false);
  const [sfxEnabled, setSfxEnabled] = useState(true);
  const [nowMs, setNowMs] = useState(Date.now());
  const audioRef = useRef<{
    context: AudioContext;
    lead: OscillatorNode;
    bass: OscillatorNode;
    shimmer: OscillatorNode;
    gain: GainNode;
    timer: number;
  } | null>(null);
  const sfxContextRef = useRef<AudioContext | null>(null);
  const previousPhaseRef = useRef<GamePhase | null>(null);
  const lastTickSecondRef = useRef<number | null>(null);
  const feedbackTimeoutRef = useRef<number | null>(null);
  const [answerFeedback, setAnswerFeedback] = useState<AnswerFeedback | null>(null);

  const getSfxContext = () => {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) {
      return null;
    }

    if (!sfxContextRef.current) {
      sfxContextRef.current = new Ctx();
    }

    if (sfxContextRef.current.state === "suspended") {
      sfxContextRef.current.resume().catch(() => undefined);
    }

    return sfxContextRef.current;
  };

  const playTone = (
    frequency: number,
    duration: number,
    type: OscillatorType = "sine",
    gainValue = 0.06,
    attack = 0.01
  ) => {
    if (!sfxEnabled) {
      return;
    }
    const ctx = getSfxContext();
    if (!ctx) {
      return;
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.value = gainValue;
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(gainValue, now + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.start(now);
    osc.stop(now + duration);
  };

  const playSfx = (kind: "buzz" | "correct" | "wrong" | "tick" | "phase" | "join" | "leave") => {
    switch (kind) {
      case "buzz":
        playTone(1320, 0.06, "square", 0.09, 0.002);
        setTimeout(() => playTone(980, 0.08, "square", 0.07, 0.002), 45);
        break;
      case "correct":
        playTone(523, 0.08, "triangle", 0.05, 0.004);
        setTimeout(() => playTone(659, 0.09, "triangle", 0.055, 0.004), 70);
        setTimeout(() => playTone(784, 0.12, "triangle", 0.06, 0.004), 140);
        break;
      case "wrong":
        playTone(240, 0.12, "sawtooth", 0.06, 0.003);
        setTimeout(() => playTone(180, 0.14, "sawtooth", 0.06, 0.003), 70);
        setTimeout(() => playTone(140, 0.18, "sawtooth", 0.055, 0.003), 130);
        break;
      case "tick":
        playTone(1680, 0.03, "square", 0.028, 0.0015);
        break;
      case "phase":
        playTone(390, 0.055, "sine", 0.04, 0.003);
        setTimeout(() => playTone(520, 0.045, "triangle", 0.03, 0.002), 55);
        break;
      case "join":
        playTone(620, 0.06, "triangle", 0.04, 0.003);
        setTimeout(() => playTone(820, 0.08, "triangle", 0.04, 0.003), 55);
        break;
      case "leave":
        playTone(320, 0.08, "triangle", 0.035, 0.003);
        setTimeout(() => playTone(220, 0.11, "triangle", 0.038, 0.003), 65);
        break;
      default:
        break;
    }
  };

  useEffect(() => {
    const onPlayerBuzzed = ({ playerName }: PlayerBuzzedPayload) => {
      playSfx("buzz");
    };

    const onAnswer = ({ playerId: answeringPlayerId, result }: AnswerResultPayload) => {
      playSfx(result.correct ? "correct" : "wrong");
      const answeringPlayerName =
        room?.players.find((player) => player.id === answeringPlayerId)?.name ?? "Player";
      setAnswerFeedback({
        playerName: answeringPlayerName,
        correct: result.correct,
        pointsAwarded: result.pointsAwarded
      });
      if (feedbackTimeoutRef.current) {
        window.clearTimeout(feedbackTimeoutRef.current);
      }
      feedbackTimeoutRef.current = window.setTimeout(() => {
        setAnswerFeedback(null);
      }, 1800);
    };

    const onQuestionComplete = ({ questionId }: QuestionCompletePayload) => {
      void questionId;
    };

    const onPlayerDisconnected = ({ playerId, reconnectDeadline }: PlayerDisconnectedPayload) => {
      void playerId;
      void reconnectDeadline;
      playSfx("leave");
    };

    const onPlayerReconnected = ({ player }: PlayerReconnectedPayload) => {
      void player;
      playSfx("join");
    };

    socket.on(SERVER_EVENTS.PLAYER_BUZZED, onPlayerBuzzed);
    socket.on(SERVER_EVENTS.ANSWER_RESULT, onAnswer);
    socket.on(SERVER_EVENTS.QUESTION_COMPLETE, onQuestionComplete);
    socket.on(SERVER_EVENTS.PLAYER_DISCONNECTED, onPlayerDisconnected);
    socket.on(SERVER_EVENTS.PLAYER_RECONNECTED, onPlayerReconnected);

    return () => {
      socket.off(SERVER_EVENTS.PLAYER_BUZZED, onPlayerBuzzed);
      socket.off(SERVER_EVENTS.ANSWER_RESULT, onAnswer);
      socket.off(SERVER_EVENTS.QUESTION_COMPLETE, onQuestionComplete);
      socket.off(SERVER_EVENTS.PLAYER_DISCONNECTED, onPlayerDisconnected);
      socket.off(SERVER_EVENTS.PLAYER_RECONNECTED, onPlayerReconnected);
    };
  }, [socket, sfxEnabled, room?.players]);

  const me = useMemo(() => room?.players.find((player) => player.id === playerId) ?? null, [room, playerId]);

  useEffect(() => {
    document.body.classList.add("gameplay-lock");
    return () => {
      document.body.classList.remove("gameplay-lock");
    };
  }, []);

  useEffect(() => {
    if (!musicEnabled) {
      if (audioRef.current) {
        window.clearInterval(audioRef.current.timer);
        audioRef.current.lead.stop();
        audioRef.current.bass.stop();
        audioRef.current.shimmer.stop();
        audioRef.current.context.close().catch(() => undefined);
        audioRef.current = null;
      }
      return;
    }

    if (audioRef.current) {
      return;
    }

    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) {
      return;
    }

    const context = new Ctx();
    const gain = context.createGain();
    gain.gain.value = 0.02;
    gain.connect(context.destination);

    const lead = context.createOscillator();
    lead.type = "square";
    lead.frequency.value = 329.63;
    lead.connect(gain);
    lead.start();

    const bass = context.createOscillator();
    bass.type = "triangle";
    bass.frequency.value = 82.41;
    bass.connect(gain);
    bass.start();

    const shimmer = context.createOscillator();
    shimmer.type = "sine";
    shimmer.frequency.value = 659.25;
    shimmer.connect(gain);
    shimmer.start();

    const progression = [
      { lead: 329.63, bass: 82.41, shimmer: 659.25 },
      { lead: 392.0, bass: 98.0, shimmer: 784.0 },
      { lead: 440.0, bass: 110.0, shimmer: 880.0 },
      { lead: 392.0, bass: 98.0, shimmer: 784.0 },
      { lead: 349.23, bass: 87.31, shimmer: 698.46 },
      { lead: 293.66, bass: 73.42, shimmer: 587.33 }
    ];
    let idx = 0;
    const timer = window.setInterval(() => {
      const step = progression[idx % progression.length];
      lead.frequency.setTargetAtTime(step.lead, context.currentTime, 0.08);
      bass.frequency.setTargetAtTime(step.bass, context.currentTime, 0.16);
      shimmer.frequency.setTargetAtTime(step.shimmer, context.currentTime, 0.12);
      idx += 1;
    }, 560);

    audioRef.current = { context, lead, bass, shimmer, gain, timer };

    return () => {
      window.clearInterval(timer);
      lead.stop();
      bass.stop();
      shimmer.stop();
      context.close().catch(() => undefined);
      audioRef.current = null;
    };
  }, [musicEnabled]);

  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current) {
        window.clearTimeout(feedbackTimeoutRef.current);
      }
      if (sfxContextRef.current) {
        sfxContextRef.current.close().catch(() => undefined);
        sfxContextRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!room) {
      return;
    }
    const previous = previousPhaseRef.current;
    if (previous && previous !== room.gameState.phase) {
      playSfx("phase");
    }
    previousPhaseRef.current = room.gameState.phase;
  }, [room?.gameState.phase, sfxEnabled]);

  useEffect(() => {
    if (!room) {
      return;
    }
    const phaseEndsAt = room.gameState.phaseEndsAt;
    if (!phaseEndsAt) {
      lastTickSecondRef.current = null;
      return;
    }

    const interval = window.setInterval(() => {
      const remainingMs = phaseEndsAt - Date.now();
      if (remainingMs <= 0) {
        lastTickSecondRef.current = null;
        return;
      }

      const remainingSecond = Math.ceil(remainingMs / 1000);
      if (remainingSecond <= 3 && remainingSecond !== lastTickSecondRef.current) {
        lastTickSecondRef.current = remainingSecond;
        playSfx("tick");
      }
    }, 120);

    return () => window.clearInterval(interval);
  }, [room?.gameState.phaseEndsAt, room?.gameState.phase, sfxEnabled]);

  useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, []);

  if (!room) {
    return null;
  }

  const isHost = room.hostId === playerId;
  const lockoutEndsAt = me?.buzzerLockedUntil ?? 0;
  const isBuzzerLockoutActive = room.gameState.phase === "buzzer_active" && lockoutEndsAt > nowMs;
  const lockoutSecondsLeft = Math.max(0, Math.ceil((lockoutEndsAt - nowMs) / 1000));
  const canBuzz = room.gameState.phase === "buzzer_active" && !isBuzzerLockoutActive && !me?.buzzerLocked;
  const canAnswer = room.gameState.phase === "answering" && room.gameState.buzzedPlayerId === playerId;
  const isDailyDoublePlayer =
    room.gameState.phase === "daily_double" && room.gameState.dailyDoublePlayerId === playerId;
  const isMyTurn = room.gameState.currentTurnPlayerId === playerId;
  const selectedValue = room.gameState.selectedQuestion?.value ?? 200;
  const dailyDoubleMinWager = 200;
  const dailyDoubleMaxWager = Math.max(me?.score ?? 0, selectedValue, 200);

  const phaseLabel: Record<GamePhase, string> = {
    selection: "Select a clue",
    reading: "Read the clue",
    buzzer_active: "Buzz race is live",
    answering: "Answer now",
    daily_double: "Daily Double",
    final_jeopardy_wager: "Final Jeopardy wager",
    final_jeopardy_answer: "Final Jeopardy answer",
    final_jeopardy_reveal: "Final Jeopardy reveal"
  };

  const actionHint = (() => {
    if (room.status === "lobby") {
      return isHost ? "Start the game when everyone is ready." : "Wait for the host to start.";
    }
    if (room.status === "playing") {
      switch (room.gameState.phase) {
        case "selection":
          return isMyTurn ? "Your turn: pick a tile from the board." : "Waiting for current selector.";
        case "reading":
          return "Read the clue. Buzzers are locked.";
        case "buzzer_active":
          if (me?.buzzerLocked) {
            return "You already attempted this clue. Waiting for other players.";
          }
          if (isBuzzerLockoutActive) {
            return `You are locked out for ${lockoutSecondsLeft}s after a wrong answer.`;
          }
          return canBuzz ? "Buzz now to claim answer rights." : "Wait for another player or lockout to end.";
        case "answering":
          return canAnswer ? "You won the buzzer. Submit your answer." : "Waiting for buzz winner's answer.";
        case "daily_double":
          return isDailyDoublePlayer
            ? "Set wager, then submit your answer."
            : "Daily Double: waiting for selecting player.";
        default:
          return "Follow current phase prompts.";
      }
    }
    return "Follow on-screen prompts.";
  })();

  return (
    <main className="screen gameplay-screen">
      <header className="row gameplay-header">
        <div>
          <h1>Quiz Arena · {room.code}</h1>
          <p className="subtitle">
            Phase: <strong>{phaseLabel[room.gameState.phase]}</strong>
          </p>
        </div>
        <div className="row gameplay-actions">
          <button className={musicEnabled ? "btn-mint" : "btn-violet"} onClick={() => setMusicEnabled((prev) => !prev)}>
            {musicEnabled ? "Music: On" : "Music: Off"}
          </button>
          <button className={sfxEnabled ? "btn-ocean" : "btn-violet"} onClick={() => setSfxEnabled((prev) => !prev)}>
            {sfxEnabled ? "SFX: On" : "SFX: Off"}
          </button>
          {room.status === "lobby" && isHost ? <button onClick={startGame}>Start Game</button> : null}
          <button
            className="btn-coral"
            onClick={() => {
              leaveRoom();
              onLeave();
            }}
          >
            Leave Room
          </button>
        </div>
      </header>

      <section className="panel panel-indigo turn-banner">
        <div className="row">
          <p className="meta">
            Turn:{" "}
            <strong>
              {room.players.find((player) => player.id === room.gameState.currentTurnPlayerId)?.name ?? "Unknown"}
            </strong>
          </p>
          <p className="meta">
            {isMyTurn ? "You are up." : "Stand by."}
          </p>
        </div>
        <p className="phase-hint">{actionHint}</p>
      </section>

      <div className="gameplay-grid">
        <Scoreboard
          players={room.players}
          turnPlayerId={room.gameState.currentTurnPlayerId}
          myPlayerId={playerId}
        />

        {room.status === "playing" && (
          <GameBoard
            board={room.gameState.board}
            gamePhase={room.gameState.phase}
            myPlayerId={playerId}
            currentTurnPlayerId={room.gameState.currentTurnPlayerId}
            onSelectQuestion={selectQuestion}
          />
        )}
      </div>

      <QuestionModal
        question={room.status === "playing" ? room.gameState.selectedQuestion : null}
        gamePhase={room.gameState.phase}
        phaseEndsAt={room.gameState.phaseEndsAt}
        dailyDoubleWager={room.gameState.dailyDoubleWager}
        dailyDoubleMinWager={dailyDoubleMinWager}
        dailyDoubleMaxWager={dailyDoubleMaxWager}
        canBuzz={canBuzz}
        canAnswer={canAnswer}
        isDailyDoublePlayer={isDailyDoublePlayer}
        answerFeedback={answerFeedback}
        onBuzz={buzzIn}
        onSubmitAnswer={submitAnswer}
        onSubmitWager={submitWager}
      />

      {room.status === "final_jeopardy" && (
        <FinalJeopardyScreen
          phase={room.gameState.phase as "final_jeopardy_wager" | "final_jeopardy_answer" | "final_jeopardy_reveal"}
          myPlayerId={playerId}
          wagerPhase={finalJeopardyWagerPhase}
          answerPhase={finalJeopardyAnswerPhase}
          reveal={finalJeopardyReveal}
          onSubmitWager={submitFinalWager}
          onSubmitAnswer={submitFinalAnswer}
        />
      )}

      {room.status === "lobby" && (
        <section className="panel muted">
          <h2>Lobby</h2>
          <p>Waiting for host to start. Need at least 2 players.</p>
        </section>
      )}

      {room.status === "finished" && gameOver && (
        <ResultsScreen
          gameOver={gameOver}
          myPlayerId={playerId}
          onLeave={() => {
            leaveRoom();
            onLeave();
          }}
        />
      )}

      {room.status === "finished" && !gameOver && (
        <section className="panel">
          <h2>Game Finished</h2>
          <p>Final results are syncing...</p>
        </section>
      )}

    </main>
  );
};
