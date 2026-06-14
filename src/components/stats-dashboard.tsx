"use client";

import { useEffect, useMemo, useState } from "react";
import { Menu } from "lucide-react";
import { useData } from "@/lib/data-context";
import { PRIORITY_CONFIG, PRIORITY_ORDER, STATUS_CONFIG, STATUS_ORDER } from "@/lib/constants";
import { getSupabaseClient } from "@/lib/supabase/client";
import { loadDoneEvents } from "@/lib/supabase/queries";
import { Avatar } from "@/components/ui/pills";

function mondayStart(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const diff = (x.getDay() + 6) % 7; // days since Monday
  x.setDate(x.getDate() - diff);
  return x;
}
const iso = (d: Date) => d.toISOString().slice(0, 10);

export function StatsDashboard({
  onToggleSidebar,
}: {
  onToggleSidebar: () => void;
}) {
  const { tasks, members, currentWorkspace, currentWorkspaceId, isLive } = useData();
  const [doneEvents, setDoneEvents] = useState<string[]>([]);

  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);

  useEffect(() => {
    if (!isLive || !currentWorkspaceId) return;
    const db = getSupabaseClient();
    if (!db) return;
    const since = new Date();
    since.setDate(since.getDate() - 56);
    let active = true;
    loadDoneEvents(db, currentWorkspaceId, since.toISOString())
      .then((ev) => active && setDoneEvents(ev))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [isLive, currentWorkspaceId]);

  const open = tasks.filter((t) => t.status !== "done");
  const done = tasks.filter((t) => t.status === "done");
  const overdue = open.filter((t) => t.dueDate && t.dueDate < todayIso);

  const byStatus = STATUS_ORDER.map((s) => ({
    key: s,
    label: STATUS_CONFIG[s].label,
    color: STATUS_CONFIG[s].color.dot,
    count: tasks.filter((t) => t.status === s).length,
  }));

  const byPriority = PRIORITY_ORDER.filter((p) => p !== "none").map((p) => ({
    label: PRIORITY_CONFIG[p].label,
    color: PRIORITY_CONFIG[p].color.dot,
    count: open.filter((t) => t.priority === p).length,
  }));

  const byMember = [
    ...members.map((m) => ({
      name: m.name,
      avatarUrl: m.avatarUrl,
      count: open.filter((t) => t.assigneeId === m.userId).length,
    })),
    { name: "ไม่ได้มอบหมาย", avatarUrl: undefined, count: open.filter((t) => !t.assigneeId).length },
  ]
    .filter((m) => m.count > 0)
    .sort((a, b) => b.count - a.count);

  // last 8 weeks completed
  const weeks = useMemo(() => {
    const start = mondayStart(new Date());
    const buckets: { key: string; label: string; count: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const d = new Date(start);
      d.setDate(start.getDate() - i * 7);
      buckets.push({
        key: iso(d),
        label: d.toLocaleDateString("th-TH-u-ca-gregory", { day: "numeric", month: "short" }),
        count: 0,
      });
    }
    const idx = new Map(buckets.map((b, i) => [b.key, i]));
    for (const ev of doneEvents) {
      const wk = iso(mondayStart(new Date(ev)));
      const i = idx.get(wk);
      if (i !== undefined) buckets[i].count++;
    }
    return buckets;
  }, [doneEvents]);

  const stats = [
    { label: "งานทั้งหมด", value: tasks.length, color: "var(--color-ink)" },
    { label: "กำลังทำ/ค้าง", value: open.length, color: "#d9730d" },
    { label: "เสร็จแล้ว", value: done.length, color: "#448361" },
    { label: "เลยกำหนด", value: overdue.length, color: "#e03e3e" },
  ];

  const maxWeek = Math.max(1, ...weeks.map((w) => w.count));

  return (
    <div className="h-full overflow-y-auto">
      <div className="flex items-center gap-2 px-4 pt-4 sm:px-8">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="rounded-md p-1.5 text-ink-muted transition-colors hover:bg-fill md:hidden"
        >
          <Menu size={18} />
        </button>
        <span className="text-xs text-ink-faint">{currentWorkspace?.name}</span>
      </div>

      <div className="mx-auto max-w-[920px] px-4 pb-10 pt-3 sm:px-8">
        <h1 className="text-2xl font-bold tracking-tight">สถิติ &amp; ภาพรวม</h1>
        <p className="mt-1 text-sm text-ink-muted">สรุปงานทั้งหมดในพื้นที่ทำงานนี้</p>

        {/* stat cards */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((s, i) => (
            <div key={i} className="rounded-xl border border-line bg-bg p-3">
              <div className="text-xs text-ink-faint">{s.label}</div>
              <div className="mt-1 text-2xl font-bold tabular-nums" style={{ color: s.color }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <ChartCard title="งานตามสถานะ">
            <BarRows rows={byStatus} total={tasks.length} />
          </ChartCard>
          <ChartCard title="งานค้างตามความสำคัญ">
            <BarRows rows={byPriority} total={open.length} />
          </ChartCard>
        </div>

        <div className="mt-4">
          <ChartCard title="ภาระงานค้างต่อสมาชิก">
            {byMember.length === 0 ? (
              <p className="py-4 text-center text-sm text-ink-faint">ไม่มีงานค้าง</p>
            ) : (
              <div className="space-y-2.5">
                {byMember.map((m, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Avatar name={m.name} src={m.avatarUrl} size={22} />
                    <span className="w-24 shrink-0 truncate text-sm text-ink-muted">{m.name}</span>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-fill">
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{
                          width: `${(m.count / Math.max(1, byMember[0].count)) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="w-6 shrink-0 text-right text-sm tabular-nums text-ink">
                      {m.count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </ChartCard>
        </div>

        <div className="mt-4">
          <ChartCard title="งานที่เสร็จ — 8 สัปดาห์ล่าสุด">
            {!isLive ? (
              <p className="py-4 text-center text-sm text-ink-faint">
                สถิติย้อนหลังใช้ได้เมื่อเชื่อม Supabase
              </p>
            ) : (
              <div className="flex h-40 items-end gap-2 pt-2">
                {weeks.map((w) => (
                  <div key={w.key} className="flex flex-1 flex-col items-center gap-1">
                    <span className="text-xs tabular-nums text-ink-faint">{w.count || ""}</span>
                    <div
                      className="w-full rounded-t bg-[#448361] transition-all"
                      style={{ height: `${(w.count / maxWeek) * 110 + (w.count ? 4 : 1)}px` }}
                    />
                    <span className="text-[10px] text-ink-faint">{w.label}</span>
                  </div>
                ))}
              </div>
            )}
          </ChartCard>
        </div>
      </div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-bg p-4">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {children}
    </div>
  );
}

function BarRows({
  rows,
  total,
}: {
  rows: { label: string; color: string; count: number }[];
  total: number;
}) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="space-y-2.5">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="flex w-24 shrink-0 items-center gap-1.5 text-sm text-ink-muted">
            <span className="h-2 w-2 rounded-full" style={{ background: r.color }} />
            <span className="truncate">{r.label}</span>
          </span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-fill">
            <div
              className="h-full rounded-full"
              style={{ width: `${(r.count / max) * 100}%`, background: r.color }}
            />
          </div>
          <span className="w-6 shrink-0 text-right text-sm tabular-nums text-ink">
            {r.count}
          </span>
        </div>
      ))}
      <div className="pt-1 text-xs text-ink-faint">รวม {total} งาน</div>
    </div>
  );
}
