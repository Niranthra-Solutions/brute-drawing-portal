import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Bell,
  Boxes,
  ChevronsLeft,
  Database,
  Files,
  FolderOpen,
  Hash,
  Inbox,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  ScrollText,
  Search,
  Settings2,
  Upload,
  Users,
  type LucideIcon,
} from "lucide-react";
import { api } from "@/lib/api";
import type { Notification } from "@/lib/types";
import { ago, initials } from "@/lib/util";
import { cn } from "@/lib/utils";
import { useAuth } from "@/stores/auth";
import { useUi } from "@/stores/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PoweredBy } from "./powered-by";
import { Spinner } from "./common";

type Item = { to: string; icon: LucideIcon; label: string; end?: boolean };
const common = (admin: boolean): { title: string; items: Item[] }[] => [
  {
    title: "Drawings",
    items: [
      { to: "/", icon: LayoutDashboard, label: "Dashboard", end: true },
      { to: "/search", icon: Search, label: "Drawing search" },
      { to: "/search-by-number", icon: Hash, label: "Search by number" },
    ],
  },
  {
    title: "Requests",
    items: [
      {
        to: "/requests",
        icon: Inbox,
        label: admin ? "All requests" : "My requests",
      },
      { to: "/documents", icon: FolderOpen, label: "Documents" },
    ],
  },
  ...(admin
    ? [
        {
          title: "Admin",
          items: [
            {
              to: "/admin/drawings",
              icon: Database,
              label: "Master database",
              end: true,
            },
            {
              to: "/admin/drawings/new",
              icon: Upload,
              label: "Upload drawing",
            },
            { to: "/admin/files", icon: Files, label: "Uploaded files" },
            { to: "/admin/bulk-import", icon: Layers, label: "Bulk import" },
            { to: "/admin/master-data", icon: Boxes, label: "Master data" },
            { to: "/admin/users", icon: Users, label: "Users" },
            {
              to: "/admin/settings",
              icon: Settings2,
              label: "Drawing settings",
            },
            { to: "/admin/audit", icon: ScrollText, label: "Audit log" },
          ],
        },
      ]
    : []),
];

function Nav({
  collapsed,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const admin = useAuth((s) => s.user?.role === "Admin");
  return (
    <nav className="flex flex-col" aria-label="Main navigation">
      {common(!!admin).map((g) => (
        <div key={g.title}>
          {!collapsed && (
            <div className="px-3 pt-3.5 pb-1.5 text-[10.5px] font-bold tracking-widest text-[#a9a398] uppercase">
              {g.title}
            </div>
          )}
          {collapsed && <div className="my-2 border-t" />}
          <div className="flex flex-col gap-0.5">
            {g.items.map((i) => {
              const link = (
                <NavLink
                  key={i.to}
                  to={i.to}
                  end={i.end}
                  onClick={onNavigate}
                  aria-label={i.label}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2 text-[13.5px] font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                      collapsed && "justify-center px-0",
                      isActive &&
                        "bg-foreground text-white hover:bg-foreground hover:text-white",
                    )
                  }
                >
                  <i.icon className="size-[17px] shrink-0" />
                  {!collapsed && i.label}
                </NavLink>
              );
              return collapsed ? (
                <Tooltip key={i.to}>
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent side="right">{i.label}</TooltipContent>
                </Tooltip>
              ) : (
                link
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

function SidebarBody({
  collapsed,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const toggle = useUi((s) => s.toggleCollapsed);
  const admin = user?.role === "Admin";
  return (
    <div className="flex h-full flex-col">
      <div
        className={cn(
          "flex items-center gap-2.5 px-2 pb-4",
          collapsed && "justify-center px-0",
        )}
      >
        {!collapsed && (
          <div className="font-heading text-[15px] leading-tight font-bold uppercase tracking-wide text-foreground">
            Amaron Brute Drawing Portal
          </div>
        )}
      </div>
      {!collapsed && (
        <div
          className={cn(
            "mx-2 mb-3 inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold",
            admin
              ? "bg-brand-soft text-brand-dark"
              : "bg-success-soft text-[#2f6b25]",
          )}
        >
          <span className="size-1.5 rounded-full bg-current" />
          {admin ? "Admin · Application Engineering" : "User · Marketing"}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <Nav collapsed={collapsed} onNavigate={onNavigate} />
      </div>
      <Button
        asChild
        size="lg"
        className="mt-3 h-10 w-full rounded-xl font-bold"
      >
        {admin ? (
          <Link
            to="/admin/drawings/new"
            onClick={onNavigate}
            aria-label="Upload drawing"
          >
            <Upload />
            {!collapsed && "Upload drawing"}
          </Link>
        ) : (
          <Link
            to="/requests/new"
            onClick={onNavigate}
            aria-label="New drawing request"
          >
            <Plus />
            {!collapsed && "New drawing request"}
          </Link>
        )}
      </Button>
      <div
        className={cn(
          "mt-3 flex items-center gap-2.5 border-t px-2 pt-3",
          collapsed && "flex-col px-0",
        )}
      >
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white",
            admin ? "bg-brand" : "bg-success",
          )}
        >
          {initials(user?.fullName ?? "")}
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-bold">
              {user?.fullName}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {user?.email}
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Sign out"
          title="Sign out"
          onClick={() => logout().then(() => nav("/login"))}
        >
          <LogOut />
        </Button>
      </div>
      <button
        type="button"
        onClick={toggle}
        className="mt-2 hidden items-center justify-center gap-1 self-center text-[11px] text-muted-foreground hover:text-foreground lg:flex"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        <ChevronsLeft
          className={cn(
            "size-3.5 transition-transform",
            collapsed && "rotate-180",
          )}
        />
        {!collapsed && "Collapse"}
      </button>
    </div>
  );
}

function Bell_() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const count = useQuery({
    queryKey: ["notif-count"],
    queryFn: () =>
      api.get<{ unread: number }>("/api/notifications/unread-count"),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  const list = useQuery({
    queryKey: ["notifications"],
    queryFn: () =>
      api.get<{ items: Notification[]; unread: number }>("/api/notifications"),
    enabled: open,
  });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["notif-count"] });
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };
  const readAll = useMutation({
    mutationFn: () => api.post("/api/notifications/read-all"),
    onSuccess: refresh,
  });
  const unread = count.data?.unread ?? 0;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative size-9 rounded-xl"
          aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        >
          <Bell />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-panel bg-destructive px-1 text-[10.5px] font-bold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="max-h-[440px] w-[min(360px,calc(100vw-32px))] overflow-auto p-0"
      >
        <div className="flex items-center justify-between border-b px-4 py-3 font-extrabold">
          Notifications
          {unread > 0 && (
            <button
              className="text-xs font-bold text-brand-dark"
              onClick={() => readAll.mutate()}
            >
              Mark all read
            </button>
          )}
        </div>
        {list.isLoading && (
          <div className="flex justify-center p-6">
            <Spinner />
          </div>
        )}
        {list.data?.items.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            You're all caught up.
          </div>
        )}
        {list.data?.items.map((n) => (
          <button
            key={n.id}
            className={cn(
              "block w-full border-b px-4 py-3 text-left hover:bg-muted/50",
              !n.isRead && "bg-brand-soft/40",
            )}
            onClick={async () => {
              setOpen(false);
              if (!n.isRead) {
                await api.post(`/api/notifications/${n.id}/read`);
                refresh();
              }
              if (n.linkPath) nav(n.linkPath);
            }}
          >
            <div className="text-[13px] font-bold">{n.title}</div>
            <div className="text-xs text-muted-foreground">{n.message}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              {ago(n.createdAtUtc)}
            </div>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

export function Shell() {
  const user = useAuth((s) => s.user);
  const nav = useNavigate();
  const loc = useLocation();
  const { mobileNav, setMobileNav, collapsed } = useUi();
  const [quick, setQuick] = useState("");
  const first = useRef(true);
  const admin = user?.role === "Admin";
  useEffect(() => {
    setMobileNav(false);
    if (first.current) first.current = false;
    else window.scrollTo(0, 0);
  }, [loc.pathname, setMobileNav]);
  const go = (e: FormEvent) => {
    e.preventDefault();
    if (quick.trim()) {
      nav(`/search-by-number?number=${encodeURIComponent(quick.trim())}`);
      setQuick("");
    }
  };
  return (
    <div
      className={cn(
        "min-h-screen gap-4 p-3 lg:grid lg:p-4.5",
        admin ? "" : "role-user",
        collapsed ? "lg:grid-cols-[76px_1fr]" : "lg:grid-cols-[250px_1fr]",
      )}
    >
      <aside className="sticky top-4.5 hidden h-[calc(100vh-36px)] rounded-[22px] border bg-panel p-3.5 shadow-[0_10px_26px_-22px_rgba(23,26,30,.14)] lg:block">
        <SidebarBody collapsed={collapsed} />
      </aside>
      <Sheet open={mobileNav} onOpenChange={setMobileNav}>
        <SheetContent side="left" className="w-[280px] bg-panel p-3.5">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <SheetDescription className="sr-only">
            Main navigation
          </SheetDescription>
          <SidebarBody onNavigate={() => setMobileNav(false)} />
        </SheetContent>
      </Sheet>
      <div
        className={cn("flex min-w-0 flex-col gap-4", admin ? "" : "role-user")}
      >
        <header
          className="flex items-center gap-3 rounded-2xl border bg-panel px-4 py-2"
          role="banner"
        >
          <Button
            variant="outline"
            size="icon"
            className="size-9 shrink-0 rounded-xl lg:hidden"
            onClick={() => setMobileNav(true)}
            aria-label="Open menu"
          >
            <Menu />
          </Button>
          <Link
            to="/"
            className="shrink-0"
            aria-label="Amaron Brute Drawing Portal — home"
          >
            <img
              src="/brand/amaron-brute.png"
              alt="Amaron Brute"
              className="h-9 w-auto"
            />
          </Link>
          <form
            onSubmit={go}
            role="search"
            className="relative mx-auto hidden w-full max-w-[420px] flex-1 sm:block"
          >
            <Hash className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
            <Input
              value={quick}
              onChange={(e) => setQuick(e.target.value)}
              placeholder="Jump to drawing number…"
              aria-label="Quick jump to a drawing"
              className="h-9 rounded-xl bg-background pl-9"
            />
          </form>
          <div className="ml-auto flex shrink-0 items-center gap-3">
            <Bell_ />
            <div className="hidden h-8 w-px bg-border sm:block" />
            <img
              src="/brand/amara-raja.png"
              alt="Amara Raja — Gotta be a better way"
              className="hidden h-10 w-auto sm:block"
            />
          </div>
        </header>
        <main id="content" className="relative min-w-0 flex-1">
          <div className="blueprint pointer-events-none absolute inset-0 -z-10" />
          <motion.div
            key={loc.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <Outlet />
          </motion.div>
        </main>
        <footer className="flex justify-end px-2 pb-1">
          <PoweredBy />
        </footer>
      </div>
    </div>
  );
}
