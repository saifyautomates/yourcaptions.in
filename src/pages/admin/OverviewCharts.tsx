import {
  LineChart, Line, BarChart, Bar, ResponsiveContainer,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";

const AXIS = "hsl(var(--muted-foreground))";
const GRID = "hsl(var(--border))";
const PRIMARY = "hsl(var(--primary))";

const shortDay = (d: string) =>
  new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });

export default function OverviewCharts({
  signups,
  projects,
}: {
  signups: { day: string; count: number }[];
  projects: { day: string; count: number }[];
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="border-border/60">
        <CardContent className="p-4 sm:p-5">
          <p className="mb-3 text-sm font-medium">New signups — last 30 days</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={signups.map(d => ({ ...d, day: shortDay(d.day) }))}>
                <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" stroke={AXIS} tick={{ fontSize: 10 }} />
                <YAxis stroke={AXIS} tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: `1px solid ${GRID}`, borderRadius: 6, fontSize: 12 }} />
                <Line type="monotone" dataKey="count" stroke={PRIMARY} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardContent className="p-4 sm:p-5">
          <p className="mb-3 text-sm font-medium">Projects per day — last 30 days</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={projects.map(d => ({ ...d, day: shortDay(d.day) }))}>
                <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" stroke={AXIS} tick={{ fontSize: 10 }} />
                <YAxis stroke={AXIS} tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: `1px solid ${GRID}`, borderRadius: 6, fontSize: 12 }} />
                <Bar dataKey="count" fill={PRIMARY} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
