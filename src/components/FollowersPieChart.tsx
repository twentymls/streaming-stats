import { useMemo } from "react";
import { Pie } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { DSP_CHART_COLORS, DSP_NAMES, CHART_THEME } from "../lib/constants";
import { formatNumber } from "../lib/utils";

ChartJS.register(ArcElement, Tooltip, Legend);

interface FollowersPieChartProps {
  platformStats: Map<string, Record<string, number>>;
}

export function FollowersPieChart({ platformStats }: FollowersPieChartProps) {
  const followerData = useMemo(() => {
    const entries: Array<{ source: string; count: number }> = [];
    for (const [source, stats] of platformStats) {
      const count = stats.followers ?? stats.subscribers;
      if (count != null && count > 0) {
        entries.push({ source, count });
      }
    }
    return entries.sort((a, b) => b.count - a.count);
  }, [platformStats]);

  const totalFollowers = useMemo(
    () => followerData.reduce((sum, e) => sum + e.count, 0),
    [followerData]
  );

  const data = useMemo(
    () => ({
      labels: followerData.map((e) => DSP_NAMES[e.source] ?? e.source),
      datasets: [
        {
          data: followerData.map((e) => e.count),
          backgroundColor: followerData.map((e) => (DSP_CHART_COLORS[e.source] ?? "#888") + "CC"),
          borderColor: followerData.map((e) => DSP_CHART_COLORS[e.source] ?? "#888"),
          borderWidth: 2,
        },
      ],
    }),
    [followerData]
  );

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
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
            label: (ctx: { label?: string; parsed: number }) => {
              const pct =
                totalFollowers > 0 ? ((ctx.parsed / totalFollowers) * 100).toFixed(1) : "0";
              return `${ctx.label}: ${ctx.parsed.toLocaleString()} (${pct}%)`;
            },
          },
        },
      },
    }),
    [totalFollowers]
  );

  if (followerData.length === 0) return null;

  return (
    <section className="followers-pie-section">
      <div className="followers-pie-total">{formatNumber(totalFollowers)}</div>
      <div className="followers-pie-label">Total Followers</div>
      <div className="followers-pie-chart">
        <Pie data={data} options={options} />
      </div>
    </section>
  );
}
