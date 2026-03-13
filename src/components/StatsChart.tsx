import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { DailyStat } from "../lib/types";
import { DSP_COLORS, DSP_NAMES } from "../lib/constants";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface StatsChartProps {
  stats: DailyStat[];
  title: string;
  statType: string;
}

export function TrendChart({ stats, title, statType }: StatsChartProps) {
  // Group by source, then by date
  const sources = [...new Set(stats.map((s) => s.source))];
  const dates = [
    ...new Set(
      stats
        .filter((s) => s.stat_type === statType)
        .map((s) => s.date)
        .sort()
    ),
  ];

  const datasets = sources
    .map((source) => {
      const sourceStats = stats.filter((s) => s.source === source && s.stat_type === statType);
      if (sourceStats.length === 0) return null;

      return {
        label: DSP_NAMES[source] ?? source,
        data: dates.map((date) => sourceStats.find((s) => s.date === date)?.value ?? null),
        borderColor: DSP_COLORS[source] ?? "#888",
        backgroundColor: (DSP_COLORS[source] ?? "#888") + "20",
        tension: 0.3,
        fill: false,
        pointRadius: 2,
      };
    })
    .filter(Boolean);

  return (
    <div className="chart-container">
      <h3>{title}</h3>
      <Line
        data={{
          labels: dates.map((d) => d.slice(5)), // MM-DD format
          datasets: datasets as never[],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: "index", intersect: false },
          plugins: {
            legend: {
              position: "bottom",
              labels: { color: "#aaa", boxWidth: 12 },
            },
          },
          scales: {
            x: {
              ticks: { color: "#888" },
              grid: { color: "#333" },
            },
            y: {
              ticks: { color: "#888" },
              grid: { color: "#333" },
            },
          },
        }}
      />
    </div>
  );
}
