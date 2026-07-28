import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import { useI18n } from "@/lib/i18n";
import { LineChart as LineChartIcon } from "lucide-react";

interface ProgressChartProps {
  data: {
    date: string;
    wpm: number;
  }[];
}

export function ProgressChart({ data }: ProgressChartProps) {
  const { t } = useI18n();

  if (!data.length) {
    return (
      <div
        className="flex h-[clamp(200px,40vw,320px)] w-full flex-col items-center justify-center gap-2 text-muted-foreground"
        data-testid="progress-chart"
      >
        <LineChartIcon className="h-8 w-8 opacity-30" aria-hidden="true" />
        <p className="text-sm">{t.profile.noTests}</p>
      </div>
    );
  }

  const min = Math.min(...data.map((d) => d.wpm));
  const max = Math.max(...data.map((d) => d.wpm));

  return (
    <div
      className="h-[clamp(200px,40vw,320px)] w-full mt-8"
      data-testid="progress-chart"
      role="img"
      aria-label={`${t.profile.performanceHistory}: ${data.length} tests, ${min}–${max} WPM`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
          <XAxis
            dataKey="date"
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              borderColor: "hsl(var(--border))",
              borderRadius: "var(--radius)",
              color: "hsl(var(--foreground))",
            }}
          />
          <Line
            type="monotone"
            dataKey="wpm"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={{ fill: "hsl(var(--primary))" }}
            activeDot={{ r: 6, fill: "hsl(var(--primary))" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
