"use client";

import { useEffect, useMemo, useState } from "react";
import { FilePlus2 } from "lucide-react";
import { useData } from "@/lib/data-context";
import { PAGE_EMOJIS } from "@/lib/constants";
import { sortTasks, type SortKey } from "@/lib/sort";
import type { PriorityKey, ViewKey } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CommandPalette } from "@/components/command-palette";
import { Sidebar } from "@/components/sidebar";
import { TopBar, type AssigneeFilter } from "@/components/top-bar";
import type { DateRange } from "@/components/ui/date-range-picker";
import { TaskModal } from "@/components/task-modal";
import { MembersModal } from "@/components/members-modal";
import { CreateWorkspaceModal } from "@/components/create-workspace-modal";
import { LineSettingsModal } from "@/components/line-settings-modal";
import { ProfileModal } from "@/components/profile-modal";
import { BoardView } from "@/components/views/board-view";
import { TableView } from "@/components/views/table-view";
import { ListView } from "@/components/views/list-view";
import { CalendarView } from "@/components/views/calendar-view";
import { HomeDashboard } from "@/components/home-dashboard";
import { StatsDashboard } from "@/components/stats-dashboard";

export function Workspace() {
  const {
    selectedProject,
    tasksFor,
    tasks: workspaceTasks,
    createTask,
    createProject,
    projects,
    currentWorkspaceId,
  } = useData();

  const [screen, setScreen] = useState<"home" | "project" | "stats">("home");
  const [view, setView] = useState<ViewKey>("board");
  const [search, setSearch] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState<AssigneeFilter>(null);
  const [priorityFilter, setPriorityFilter] = useState<PriorityKey | null>(null);
  const [dueRange, setDueRange] = useState<DateRange>({});
  const [sortKey, setSortKey] = useState<SortKey>("manual");
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [createWsOpen, setCreateWsOpen] = useState(false);
  const [lineOpen, setLineOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // Cmd/Ctrl + K → command palette.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const allTasks = selectedProject ? tasksFor(selectedProject.id) : [];
  const query = search.trim().toLowerCase();
  const filtered = allTasks.filter((t) => {
    if (query) {
      const hit =
        t.title.toLowerCase().includes(query) ||
        t.tags.some((tag) => tag.toLowerCase().includes(query));
      if (!hit) return false;
    }
    if (assigneeFilter === "unassigned" && t.assigneeId) return false;
    if (assigneeFilter && assigneeFilter !== "unassigned" && t.assigneeId !== assigneeFilter)
      return false;
    if (priorityFilter && t.priority !== priorityFilter) return false;
    if (dueRange.start || dueRange.end) {
      if (!t.dueDate) return false;
      if (dueRange.start && t.dueDate < dueRange.start) return false;
      if (dueRange.end && t.dueDate > dueRange.end) return false;
    }
    return true;
  });
  const tasks = sortTasks(filtered, sortKey);

  // Resolve from the full workspace task list so tasks opened from Home (which
  // span projects) work too.
  const openTask = openTaskId
    ? workspaceTasks.find((t) => t.id === openTaskId) ?? null
    : null;

  function handleNewTask() {
    if (!selectedProject) return;
    const task = createTask({ projectId: selectedProject.id, status: "todo", title: "" });
    setOpenTaskId(task.id);
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 transform border-r border-line transition-transform md:static md:z-auto md:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
      >
        <Sidebar
          onNavigate={() => setSidebarOpen(false)}
          onOpenMembers={() => setMembersOpen(true)}
          onCreateWorkspace={() => setCreateWsOpen(true)}
          onOpenLine={() => setLineOpen(true)}
          screenIsHome={screen === "home"}
          screenIsStats={screen === "stats"}
          onHome={() => setScreen("home")}
          onStats={() => setScreen("stats")}
          onSelectProject={() => setScreen("project")}
          onOpenPalette={() => setPaletteOpen(true)}
          onOpenProfile={() => setProfileOpen(true)}
        />
      </div>
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <main className="flex min-w-0 flex-1 flex-col">
        {screen === "home" ? (
          <HomeDashboard
            onOpenTask={(t) => setOpenTaskId(t.id)}
            onToggleSidebar={() => setSidebarOpen(true)}
          />
        ) : screen === "stats" ? (
          <StatsDashboard onToggleSidebar={() => setSidebarOpen(true)} />
        ) : selectedProject ? (
          <>
            <TopBar
              project={selectedProject}
              view={view}
              onViewChange={setView}
              search={search}
              onSearchChange={setSearch}
              onNewTask={handleNewTask}
              onToggleSidebar={() => setSidebarOpen(true)}
              taskCount={allTasks.length}
              assigneeFilter={assigneeFilter}
              onAssigneeFilter={setAssigneeFilter}
              priorityFilter={priorityFilter}
              onPriorityFilter={setPriorityFilter}
              dueRange={dueRange}
              onDueRange={setDueRange}
              sortKey={sortKey}
              onSortKey={setSortKey}
            />
            <div className="min-h-0 flex-1">
              {view === "board" && (
                <BoardView
                  key={`${currentWorkspaceId}-${selectedProject.id}`}
                  projectId={selectedProject.id}
                  tasks={tasks}
                  todayIso={todayIso}
                  onOpenTask={(t) => setOpenTaskId(t.id)}
                />
              )}
              {view === "table" && (
                <TableView
                  projectId={selectedProject.id}
                  tasks={tasks}
                  todayIso={todayIso}
                  onOpenTask={(t) => setOpenTaskId(t.id)}
                />
              )}
              {view === "list" && (
                <ListView
                  projectId={selectedProject.id}
                  tasks={tasks}
                  todayIso={todayIso}
                  onOpenTask={(t) => setOpenTaskId(t.id)}
                />
              )}
              {view === "calendar" && (
                <CalendarView
                  projectId={selectedProject.id}
                  tasks={tasks}
                  todayIso={todayIso}
                  onOpenTask={(t) => setOpenTaskId(t.id)}
                />
              )}
            </div>
          </>
        ) : (
          <EmptyWorkspace
            hasProjects={projects.length > 0}
            onToggleSidebar={() => setSidebarOpen(true)}
            onCreate={() => createProject("หน้างานแรกของฉัน", PAGE_EMOJIS[1])}
          />
        )}
      </main>

      {openTask && <TaskModal task={openTask} onClose={() => setOpenTaskId(null)} />}
      {membersOpen && <MembersModal onClose={() => setMembersOpen(false)} />}
      {createWsOpen && <CreateWorkspaceModal onClose={() => setCreateWsOpen(false)} />}
      {lineOpen && <LineSettingsModal onClose={() => setLineOpen(false)} />}
      {profileOpen && <ProfileModal onClose={() => setProfileOpen(false)} />}
      {paletteOpen && (
        <CommandPalette
          onClose={() => setPaletteOpen(false)}
          onOpenTask={(t) => setOpenTaskId(t.id)}
          onShowProject={() => setScreen("project")}
          onHome={() => setScreen("home")}
        />
      )}
    </div>
  );
}

function EmptyWorkspace({
  hasProjects,
  onCreate,
  onToggleSidebar,
}: {
  hasProjects: boolean;
  onCreate: () => void;
  onToggleSidebar: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center px-4 py-2.5 md:hidden">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="rounded-md p-1.5 text-ink-muted hover:bg-fill"
        >
          ☰
        </button>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-fill text-3xl">
          🗂️
        </div>
        <h2 className="text-lg font-semibold">
          {hasProjects ? "เลือกหน้างานทางซ้าย" : "ยังไม่มีหน้างาน"}
        </h2>
        <p className="mt-1 max-w-sm text-sm text-ink-muted">
          {hasProjects
            ? "เลือกหน้างานจากแถบด้านข้างเพื่อเริ่มจัดการงานของคุณ"
            : "สร้างหน้างานแรกเพื่อเริ่มเพิ่มและจัดการงานสไตล์ Notion"}
        </p>
        {!hasProjects && (
          <button
            type="button"
            onClick={onCreate}
            className="mt-5 flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:brightness-95"
          >
            <FilePlus2 size={16} />
            สร้างหน้างานแรก
          </button>
        )}
      </div>
    </div>
  );
}
