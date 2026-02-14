import type { BoardQuestionCell, GamePhase } from "@jeopardy/shared";

interface GameBoardProps {
  board: BoardQuestionCell[][];
  gamePhase: GamePhase;
  myPlayerId: string | null;
  currentTurnPlayerId: string;
  onSelectQuestion: (questionId: string) => void;
}

export const GameBoard = ({
  board,
  gamePhase,
  myPlayerId,
  currentTurnPlayerId,
  onSelectQuestion
}: GameBoardProps) => {
  const canSelect = gamePhase === "selection" && myPlayerId === currentTurnPlayerId;

  return (
    <section className="panel gameplay-board-panel">
      <h2>Arena Board</h2>
      <div className="board-scroll">
        <div
          className="board-grid"
          style={{
            gridTemplateColumns: `repeat(${board.length || 1}, minmax(0, 1fr))`
          }}
        >
          {board.map((column, columnIndex) => (
            <div className="board-column" key={column[0]?.category ?? `col-${columnIndex}`}>
              <div className="board-category">
                <span className="board-category-label">{column[0]?.category ?? "Category"}</span>
              </div>
              {column.map((cell) => (
                <button
                  className="board-cell"
                  disabled={!canSelect || cell.answered}
                  key={cell.id}
                  onClick={() => onSelectQuestion(cell.id)}
                >
                  {cell.answered ? "-" : cell.value}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
