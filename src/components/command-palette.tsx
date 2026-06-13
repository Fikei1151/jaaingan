"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CornerDownLeft, FilePlus2, Home, Plus, Search } from "lucide-react";
import { useData } from "@/lib/data-context";
import { STATUS_CONFIG } from "@/lib/constants";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Item {
  key: string;
  group: string;
  icon: React.ReactNode;
  label: string;
  hint?: string;
  run: () => void;
}

export function CommandPalette({
  onClose,
  onOpenTask,
  onShowProject,
  onHome,
}: {
  onClose: () => void;
  onOpenTask: (task: Task) => void;
  onShowProject: () => void;
  onHome: () => void;
}) {
  const {
    tasks,
    projects,
    selectedProject,
    createTask,
    createProject,
    selectProject,
  } = useData();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const q = query.trim().toLowerCase();

  const items = useMemo<Item[]>(() => {
    const result: Item[] = [];

    // Actions
    if (q) {
      const targetProject = selectedProject ?? projects[0];
      if (targetProject) {
        result.push({
          key: "create-task",
          group: "การกระทำ",
          icon: <Plus size={16} />,
          label: `สร้างงาน: “${query.trim()}”`,
          hint: targetProject.name,
          run: () => {
            const t = createTask({
              projectId: targetProject.id,
              status: "todo",
              title: query.trim(),
            });
            selectProject(targetProject.id);
            onShowProject();
            onOpenTask(t);
            onClose();
          },
        });
      }
    } else {
      result.push({
        key: "home",
        group: "การกระทำ",
        icon: <Home size={16} />,
        label: "ไปหน้าแรก",
        run: () => {
          onHome();
          onClose();
        },
      });
      if (selectedProject) {
        result.push({
          key: "new-task",
          group: "การกระทำ",
          icon: <Plus size={16} />,
          label: "สร้างงานใหม่",
          hint: selectedProject.name,
          run: () => {
            const t = createTask({
              projectId: selectedProject.id,
              status: "todo",
              title: "",
            });
            onShowProject();
            onOpenTask(t);
            onClose();
          },
        });
      }
      result.push({
        key: "new-page",
        group: "การกระทำ",
        icon: <FilePlus2 size={16} />,
        label: "สร้างหน้างานใหม่",
        run: () => {
          createProject("หน้าใหม่", "📄");
          onShowProject();
          onClose();
        },
      });
    }

    // Pages
    projects
      .filter((p) => !q || p.name.toLowerCase().includes(q))
      .slice(0, 6)
      .forEach((p) =>
        result.push({
          key: `proj-${p.id}`,
          group: "หน้างาน",
          icon: <span className="text-base leading-none">{p.icon}</span>,
          label: p.name,
          run: () => {
            selectProject(p.id);
            onShowProject();
            onClose();
          },
        }),
      );

    // Tasks
    if (q) {
      const byId = new Map(projects.map((p) => [p.id, p]));
      tasks
        .filter(
          (t) =>
            t.title.toLowerCase().includes(q) ||
            t.tags.some((tag) => tag.toLowerCase().includes(q)),
        )
        .slice(0, 8)
        .forEach((t) =>
          result.push({
            key: `task-${t.id}`,
            group: "งาน",
            icon: (
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: STATUS_CONFIG[t.status].color.dot }}
              />
            ),
            label: t.title || "ไม่มีชื่องาน",
            hint: byId.get(t.projectId)?.name,
            run: () => {
              onOpenTask(t);
              onClose();
            },
          }),
        );
    }

    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, query, tasks, projects, selectedProject]);

  useEffect(() => {
    setActive(0);
  }, [q]);

  // Close on Escape even if focus leaves the input.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Keep the active item in view.
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (items.length ? (a + 1) % items.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (items.length ? (a - 1 + items.length) % items.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      items[active]?.run();
    } else if (e.key === "Escape") {
      onClose();
    }
  }

  // Group items while keeping a flat index for keyboard nav.
  let flatIndex = -1;
  const groups: { name: string; items: { item: Item; idx: number }[] }[] = [];
  for (const item of items) {
    flatIndex++;
    const g = groups.find((x) => x.name === item.group);
    const entry = { item, idx: flatIndex };
    if (g) g.items.push(entry);
    else groups.push({ name: item.group, items: [entry] });
  }

  return (
    <div
      className="jn-fade-in fixed inset-0 z-[55] flex items-start justify-center bg-overlay px-4 pt-[12vh]"
      onMouseDown={onClose}
    >
      <div
        className="jn-pop-in w-full max-w-[560px] overflow-hidden rounded-xl border border-line bg-bg shadow-[0_24px_60px_rgba(15,15,15,0.28)]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-line px-3.5 py-3">
          <Search size={18} className="text-ink-faint" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="ค้นหางาน หน้างาน หรือพิมพ์เพื่อสร้าง…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-ink-faint"
          />
          <kbd className="rounded border border-line px-1.5 py-0.5 text-[10px] text-ink-faint">
            ESC
          </kbd>
        </div>

        <div ref={listRef} className="max-h-[56vh] overflow-y-auto p-1.5">
          {items.length === 0 && (
            <p className="px-2 py-6 text-center text-sm text-ink-faint">
              ไม่พบผลลัพธ์
            </p>
          )}
          {groups.map((g) => (
            <div key={g.name} className="mb-1">
              <div className="px-2 py-1 text-xs font-medium text-ink-faint">
                {g.name}
              </div>
              {g.items.map(({ item, idx }) => (
                <button
                  key={item.key}
                  data-idx={idx}
                  type="button"
                  onMouseEnter={() => setActive(idx)}
                  onClick={() => item.run()}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm transition-colors",
                    active === idx ? "bg-fill" : "hover:bg-fill",
                  )}
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center text-ink-muted">
                    {item.icon}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-ink">
                    {item.label}
                  </span>
                  {item.hint && (
                    <span className="shrink-0 truncate text-xs text-ink-faint">
                      {item.hint}
                    </span>
                  )}
                  {active === idx && (
                    <CornerDownLeft size={13} className="shrink-0 text-ink-faint" />
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
