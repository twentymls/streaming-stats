import { useMemo } from "react";
import { Bar } from "react-chartjs-2";
import type { TooltipItem } from "chart.js";
import { DSP_CHART_COLORS, DSP_NAMES, CHART_THEME } from "../lib/constants";

interface DailyPoint {
  date: string;
  deltas: Record<string, number>;
  total: number;
}

interface DailyGrowthChartProps {
  dailyPoints: DailyPoint[];
}

export function DailyGrowthChart({ dailyPoints }: DailyGrowthChartProps) {
  // Collect all platforms that appear in the data
  const platforms = useMemo(() => {
    const set = new Set<string>();
    for (const dp of dailyPoints) {
      for (const source of Object.keys(dp.deltas)) {
        if (dp.deltas[source] > 0) set.add(source);
      }
    }
    return [...set];
  }, [dailyPoints]);

  const data = useMemo(
    () => ({
      labels: dailyPoints.map((dp) => dp.date.slice(5)),
      datasets: platforms.map((source) => ({
        label: DSP_NAMES[source] ?? source,
        data: dailyPoints.map((dp) => dp.deltas[source] ?? 0),
        backgroundColor: (DSP_CHART_COLORS[source] ?? "#888") + "CC",
        borderWidth: 0,
      })),
    }),
    [dailyPoints, platforms]
  );

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index" as const, intersect: false },
      plugins: {
        legend: {
          position: "bottom" as const,
          labels: { color: CHART_THEME.legendColor, boxWidth: 12 },
        },
        tooltip: {
          backgroundColor: CHART_THEME.tooltipBg,
          borderColor: CHART_THEME.tooltipBorder,
          borderWidth: 1,
          titleColor: CHART_THEME.tooltipText,
          bodyColor: CHART_THEME.tooltipText,
          cornerRadius: 8,
          callbacks: {
            footer: (items: TooltipItem<"bar">[]) => {
              const total = items.reduce((sum, item) => sum + (item.parsed.y ?? 0), 0);
              return `Total: ${total.toLocaleString()}`;
            },
          },
        },
      },
      scales: {
        x: {
          stacked: true,
          ticks: { color: CHART_THEME.tickColor },
          grid: { color: CHART_THEME.gridColor },
        },
        y: {
          stacked: true,
          ticks: { color: CHART_THEME.tickColor },
          grid: { color: CHART_THEME.gridColor },
        },
      },
    }),
    []
  );

  if (dailyPoints.length === 0) {
    return (
      <div className="chart-container">
        <h3>Daily Growth</h3>
        <p className="chart-empty">No growth data available</p>
      </div>
    );
  }

  return (
    <div className="chart-container">
      <h3>Daily Growth by Platform</h3>
      <Bar data={data} options={options} />
    </div>
  );
}
