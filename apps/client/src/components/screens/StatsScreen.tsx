import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { useUserContext } from "../../contexts/UserContext";

interface StatsScreenProps {
  onBack: () => void;
}

const format = (value: number) => value.toLocaleString();

export const StatsScreen = ({ onBack }: StatsScreenProps) => {
  const { stats } = useUserContext();

  const rateData = [
    { name: "Win", value: Number((stats?.winRate ?? 0).toFixed(1)) },
    { name: "Accuracy", value: Number((stats?.accuracyRate ?? 0).toFixed(1)) },
    { name: "Buzzer", value: Number((stats?.buzzerWinRate ?? 0).toFixed(1)) }
  ];

  const scoreData = [
    { name: "High", value: stats?.highestScore ?? 0 },
    { name: "Average", value: Number((stats?.averageScore ?? 0).toFixed(1)) },
    { name: "Low", value: stats?.lowestScore ?? 0 }
  ];

  const statCards = [
    ["Games Played", format(stats?.gamesPlayed ?? 0)],
    ["Games Won", format(stats?.gamesWon ?? 0)],
    ["Win Rate", `${(stats?.winRate ?? 0).toFixed(1)}%`],
    ["Total Points", format(stats?.totalPoints ?? 0)],
    ["Average Score", (stats?.averageScore ?? 0).toFixed(1)],
    ["Highest Score", format(stats?.highestScore ?? 0)],
    ["Lowest Score", format(stats?.lowestScore ?? 0)],
    ["Correct Answers", format(stats?.correctAnswers ?? 0)],
    ["Wrong Answers", format(stats?.wrongAnswers ?? 0)],
    ["Accuracy Rate", `${(stats?.accuracyRate ?? 0).toFixed(1)}%`],
    ["Buzzer Attempts", format(stats?.totalBuzzerAttempts ?? 0)],
    ["Buzzer Win Rate", `${(stats?.buzzerWinRate ?? 0).toFixed(1)}%`],
    ["Daily Doubles Hit", format(stats?.dailyDoublesCorrect ?? 0)],
    ["Final Jeopardy Wins", format(stats?.finalJeopardyCorrect ?? 0)],
    ["Current / Best Streak", `${stats?.currentStreak ?? 0} / ${stats?.bestStreak ?? 0}`]
  ] as const;

  return (
    <main className="screen">
      <header className="row">
        <h1>Number Goblin Report</h1>
        <button onClick={onBack}>Back</button>
      </header>

      <section className="panel">
        <h2>Percent Wizardry</h2>
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={rateData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Bar dataKey="value" fill="#2f66ff" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="panel">
        <h2>Point Vibes</h2>
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={scoreData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#00a971" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="stats-grid cards-5">
        {statCards.map(([label, value]) => (
          <article className="panel" key={label}>
            <h3>{label}</h3>
            <p>{value}</p>
          </article>
        ))}
      </section>
    </main>
  );
};
