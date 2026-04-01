import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../AppContext";
import { JobCard } from "../components/JobCard";
import { HOLIDAY_TYPE_CONFIG, STATUSES, STATUS_COLORS, TODAY, bankHolidayMap, getWeekStart } from "../data";

export function DashboardPage() {
	const { isMaster, myJobs, jobs, business, currentUser, users, holidays, categories } = useApp();
	const navigate = useNavigate();

	if (isMaster) return <MasterDashboard />;
	return <EngineerDashboard />;
}

// ── Engineer Dashboard (kept mostly as-is) ───────────────────────────────────

function EngineerDashboard() {
	const { myJobs, business, currentUser } = useApp();
	const userAccent = currentUser?.color ?? business.accentColor;
	const navigate = useNavigate();
	const [search, setSearch] = useState("");
	const [statusFilter, setStatusFilter] = useState("All");
	const [page, setPage] = useState(1);
	const PAGE_SIZE = 25;

	const todayJobs = myJobs.filter((j) => j.date === TODAY);
	const hasEmergency = todayJobs.some((j) => j.priority === "Emergency");

	const displayJobs = myJobs.filter((j) => {
		const matchSearch =
			!search ||
			j.customer.toLowerCase().includes(search.toLowerCase()) ||
			j.address.toLowerCase().includes(search.toLowerCase()) ||
			j.ref.toLowerCase().includes(search.toLowerCase());
		const matchStatus = statusFilter === "All" || j.status === statusFilter;
		return matchSearch && matchStatus;
	});

	const totalPages = Math.max(1, Math.ceil(displayJobs.length / PAGE_SIZE));
	const safePage = Math.min(page, totalPages);
	const pagedJobs = displayJobs.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

	return (
		<div className="p-5 md:p-7 max-w-5xl">
			<div className="flex items-start justify-between mb-5 gap-4 flex-wrap">
				<div>
					<h1 className="text-2xl font-normal text-neutral-100 tracking-tight">My Jobs</h1>
					<p className="mt-1 text-sm text-neutral-600">
						{new Date(TODAY).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
					</p>
				</div>
			</div>

			{todayJobs.length > 0 && (
				<div
					onClick={() => navigate("/my-day")}
					className={`mb-5 flex cursor-pointer items-center gap-4 rounded-xl border px-4 py-3 transition-colors ${
						hasEmergency ? "border-red-800/50 bg-red-950/40" : "border-orange-800/30 bg-orange-950/20"
					}`}
				>
					<span className="text-2xl">{hasEmergency ? "🚨" : "☀️"}</span>
					<div className="flex-1">
						<p className="text-sm text-neutral-200">
							You have{" "}
							<strong style={{ color: hasEmergency ? "#f87171" : business.accentColor }}>
								{todayJobs.length} job{todayJobs.length > 1 ? "s" : ""}
							</strong>{" "}
							today
							{hasEmergency && <span className="text-red-400"> — Emergency job!</span>}
						</p>
						<p className="mt-0.5 text-xs text-neutral-600">Tap to view your day's route</p>
					</div>
					<span className="text-xl" style={{ color: userAccent }}>›</span>
				</div>
			)}

			<div className="mb-4 flex gap-3 flex-wrap items-center">
				<input
					type="text"
					placeholder="Search jobs, customers, addresses…"
					value={search}
					onChange={(e) => { setSearch(e.target.value); setPage(1); }}
					className="flex-1 min-w-48 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-neutral-500 placeholder:text-neutral-600"
				/>
				<select
					value={statusFilter}
					onChange={(e) => setStatusFilter(e.target.value)}
					className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-300 outline-none"
				>
					<option value="All">All statuses</option>
					{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
				</select>
			</div>

			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
				{displayJobs.length === 0 && (
					<p className="col-span-full py-12 text-center text-neutral-600">
						{search || statusFilter !== "All" ? "No jobs match your filters." : "No jobs assigned."}
					</p>
				)}
				{pagedJobs.map((job) => <JobCard key={job.id} job={job} />)}
			</div>

			{totalPages > 1 && (
				<div className="mt-5 flex items-center justify-between gap-3">
					<p className="text-xs text-neutral-600">
						Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, displayJobs.length)} of {displayJobs.length}
					</p>
					<div className="flex gap-1">
						<button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage === 1} className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm text-neutral-400 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed hover:text-neutral-200 transition-colors">‹ Prev</button>
						<span className="flex items-center px-3 text-xs text-neutral-600">{safePage} / {totalPages}</span>
						<button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage === totalPages} className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm text-neutral-400 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed hover:text-neutral-200 transition-colors">Next ›</button>
					</div>
				</div>
			)}
		</div>
	);
}

// ── Master Dashboard ─────────────────────────────────────────────────────────

function MasterDashboard() {
	const { jobs, business, users, holidays, categories } = useApp();
	const navigate = useNavigate();
	const [allJobsOpen, setAllJobsOpen] = useState(false);
	const [search, setSearch] = useState("");
	const [statusFilter, setStatusFilter] = useState("All");
	const [engFilter, setEngFilter] = useState("all");
	const [page, setPage] = useState(1);
	const [recurringFilter, setRecurringFilter] = useState(false);
	const PAGE_SIZE = 25;

	const engineers = users.filter((u) => u.role === "engineer");

	// ── Dismissed reminders (localStorage) ──
	const [dismissed, setDismissed] = useState<Set<string>>(() => {
		try {
			const stored = localStorage.getItem("dashboard_dismissed_reminders");
			if (stored) {
				const parsed = JSON.parse(stored);
				if (parsed.ts && Date.now() - parsed.ts > 30 * 24 * 60 * 60 * 1000) return new Set();
				return new Set(parsed.ids ?? []);
			}
		} catch { /* ignore */ }
		return new Set();
	});

	function dismiss(id: string) {
		setDismissed((prev) => {
			const next = new Set(prev);
			next.add(id);
			localStorage.setItem("dashboard_dismissed_reminders", JSON.stringify({ ids: [...next], ts: Date.now() }));
			return next;
		});
	}

	// ── Computed data ──
	const todayJobs = jobs.filter((j) => j.date === TODAY);
	const activeJobs = todayJobs.filter((j) => j.status === "En Route" || j.status === "On Site");
	const completedToday = todayJobs.filter((j) => j.status === "Completed" || j.status === "Invoiced");
	const engOnSite = new Set(todayJobs.filter((j) => j.status === "On Site").map((j) => j.assignedTo)).size;
	const pendingHolidays = holidays.filter((h) => h.status === "pending");

	// Recurring jobs due within 30 days
	const thirtyOut = new Date();
	thirtyOut.setDate(thirtyOut.getDate() + 30);
	const cutoff30 = thirtyOut.toISOString().slice(0, 10);
	const upcomingRecurring = jobs
		.filter((j) => j.repeatFrequency && j.status === "Scheduled" && j.date >= TODAY && j.date <= cutoff30 && !dismissed.has(j.id))
		.sort((a, b) => a.date.localeCompare(b.date));

	// Upcoming holidays (next 14 days)
	const fourteenOut = new Date();
	fourteenOut.setDate(fourteenOut.getDate() + 14);
	const cutoff14 = fourteenOut.toISOString().slice(0, 10);
	const upcomingHolidays = holidays
		.filter((h) => h.status === "approved" && h.date >= TODAY && h.date <= cutoff14)
		.sort((a, b) => a.date.localeCompare(b.date));

	// This week
	const weekStart = getWeekStart(new Date(TODAY + "T00:00:00"));
	const weekDays = Array.from({ length: 7 }, (_, i) => {
		const d = new Date(weekStart);
		d.setDate(d.getDate() + i);
		return d.toISOString().slice(0, 10);
	});
	const thisYear = new Date(TODAY).getFullYear();
	const bankHols = bankHolidayMap([thisYear - 1, thisYear, thisYear + 1]);

	// All Jobs section
	const baseJobs = engFilter === "all" ? jobs : jobs.filter((j) => j.assignedTo === engFilter);
	const displayJobs = baseJobs.filter((j) => {
		const matchSearch =
			!search ||
			j.customer.toLowerCase().includes(search.toLowerCase()) ||
			j.address.toLowerCase().includes(search.toLowerCase()) ||
			j.ref.toLowerCase().includes(search.toLowerCase());
		const matchStatus = statusFilter === "All" || j.status === statusFilter;
		const matchRecurring = !recurringFilter || !!j.repeatFrequency;
		return matchSearch && matchStatus && matchRecurring;
	});
	const totalPages = Math.max(1, Math.ceil(displayJobs.length / PAGE_SIZE));
	const safePage = Math.min(page, totalPages);
	const pagedJobs = displayJobs.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

	function formatDate(ds: string) {
		return new Date(ds + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
	}

	return (
		<div className="p-5 md:p-7 max-w-5xl">
			{/* Header */}
			<div className="flex items-start justify-between mb-5 gap-4 flex-wrap">
				<div>
					<h1 className="text-2xl font-normal text-neutral-100 tracking-tight">Dashboard</h1>
					<p className="mt-1 text-sm text-neutral-600">
						{new Date(TODAY).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
					</p>
				</div>
				<button
					onClick={() => navigate("/new-job")}
					className="rounded-lg px-4 py-2 text-sm font-medium text-white"
					style={{ backgroundColor: business.accentColor }}
				>
					+ New Job
				</button>
			</div>

			{/* Pending Holiday Requests Banner */}
			{pendingHolidays.length > 0 && (
				<div
					onClick={() => navigate("/holidays")}
					className="mb-5 flex cursor-pointer items-center gap-4 rounded-xl border border-amber-800/30 bg-amber-950/20 px-4 py-3 transition-colors hover:bg-amber-950/30"
				>
					<span className="text-2xl">🏖️</span>
					<div className="flex-1">
						<p className="text-sm text-neutral-200">
							<strong style={{ color: business.accentColor }}>
								{pendingHolidays.length}
							</strong>{" "}
							pending holiday request{pendingHolidays.length > 1 ? "s" : ""}
						</p>
					</div>
					<span className="text-xl" style={{ color: business.accentColor }}>›</span>
				</div>
			)}

			{/* Today at a Glance */}
			<section className="mb-6">
				<h2 className="text-sm text-neutral-400 uppercase tracking-wider mb-3">Today at a Glance</h2>
				<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
					{[
						{ label: "Today's Jobs", value: todayJobs.length, emoji: "📋" },
						{ label: "Active Now", value: activeJobs.length, emoji: "🔧", accent: true },
						{ label: "Completed", value: completedToday.length, emoji: "✅" },
						{ label: "Engineers on Site", value: engOnSite, emoji: "👷" },
					].map((card) => (
						<div
							key={card.label}
							className={`rounded-xl border px-4 py-3 ${card.accent ? "border-orange-800/30 bg-orange-950/10" : "border-neutral-800 bg-neutral-900"}`}
						>
							<div className="flex items-center gap-2 mb-1">
								<span className="text-base">{card.emoji}</span>
								<p className="text-[11px] text-neutral-500">{card.label}</p>
							</div>
							<p className={`text-2xl font-bold ${card.accent ? "text-orange-400" : "text-neutral-200"}`}>{card.value}</p>
						</div>
					))}
				</div>
			</section>

			{/* Upcoming Recurring Jobs */}
			{upcomingRecurring.length > 0 && (
				<section className="mb-6">
					<h2 className="text-sm text-neutral-400 uppercase tracking-wider mb-3">
						Recurring Jobs Due Soon
					</h2>
					<div className="space-y-2">
						{upcomingRecurring.map((j) => {
							const eng = users.find((u) => u.id === j.assignedTo);
							const cat = categories.find((c) => c.id === j.categoryId);
							const freq = j.repeatFrequency === "annually" ? "Annual" : j.repeatFrequency === "biannually" ? "Biannual" : "Quarterly";
							return (
								<div key={j.id} className="flex items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3 flex-wrap">
									<span className="text-lg">🔁</span>
									<div className="flex-1 min-w-0">
										<p className="text-sm text-neutral-200">{j.customer}</p>
										<p className="text-xs text-neutral-500">
											{freq} · {formatDate(j.date)}
											{cat ? ` · ${cat.name}` : ""}
											{eng ? ` · ${eng.name}` : ""}
										</p>
									</div>
									<button
										onClick={() => navigate(`/job/${j.id}`)}
										className="text-xs px-2.5 py-1 rounded-lg border border-neutral-700 bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
									>
										View
									</button>
									<button
										onClick={() => dismiss(j.id)}
										className="text-xs text-neutral-600 hover:text-neutral-300 transition-colors cursor-pointer"
									>
										Dismiss
									</button>
								</div>
							);
						})}
					</div>
				</section>
			)}

			{/* Upcoming Team Holidays */}
			{upcomingHolidays.length > 0 && (
				<section className="mb-6">
					<h2 className="text-sm text-neutral-400 uppercase tracking-wider mb-3">
						Team Holidays — Next 2 Weeks
					</h2>
					<div className="space-y-1.5">
						{upcomingHolidays.map((h) => {
							const eng = users.find((u) => u.id === h.profileId);
							const cfg = HOLIDAY_TYPE_CONFIG[h.type];
							return (
								<div key={h.id} className="flex items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-2">
									<span className="text-base">{cfg.emoji}</span>
									<div className="flex-1 min-w-0">
										<p className="text-sm text-neutral-200">{eng?.name ?? "Unknown"}</p>
										<p className="text-xs text-neutral-500">
											{formatDate(h.date)}
											{h.endDate ? ` – ${formatDate(h.endDate)}` : ""}
											{h.halfDay ? " (½ day)" : ""}
										</p>
									</div>
									<span className={`text-[10px] ${cfg.text}`}>{cfg.label}</span>
								</div>
							);
						})}
					</div>
				</section>
			)}

			{/* This Week Overview */}
			<section className="mb-6">
				<h2 className="text-sm text-neutral-400 uppercase tracking-wider mb-3">This Week</h2>
				<div className="grid grid-cols-7 gap-2">
					{weekDays.map((ds) => {
						const dayJobs = jobs.filter((j) => j.date === ds);
						const engCount = new Set(dayJobs.map((j) => j.assignedTo)).size;
						const isToday = ds === TODAY;
						const bankHol = bankHols[ds];
						return (
							<div
								key={ds}
								onClick={() => navigate("/calendar")}
								className={`rounded-lg border p-2 text-center cursor-pointer transition-colors ${
									isToday ? "border-orange-700/50 bg-orange-950/20" : bankHol ? "border-emerald-800/40 bg-emerald-950/20 hover:border-emerald-700/50" : "border-neutral-800 bg-neutral-900 hover:border-neutral-700"
								}`}
							>
								<p className={`text-[10px] uppercase ${isToday ? "text-orange-400" : "text-neutral-600"}`}>
									{new Date(ds + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short" })}
								</p>
								<p className={`text-lg font-medium ${isToday ? "text-orange-400" : "text-neutral-300"}`}>
									{dayJobs.length}
								</p>
								<p className="text-[9px] text-neutral-600">{engCount} eng</p>
								{bankHol && (
									<p className="text-[8px] text-emerald-400/80 truncate mt-0.5" title={bankHol}>🏦</p>
								)}
							</div>
						);
					})}
				</div>
			</section>

			{/* All Jobs — collapsible */}
			<section>
				<button
					onClick={() => setAllJobsOpen((v) => !v)}
					className="flex items-center gap-2 text-sm text-neutral-400 uppercase tracking-wider mb-3 cursor-pointer bg-transparent border-0 p-0 hover:text-neutral-200 transition-colors"
				>
					<span className={`text-xs transition-transform ${allJobsOpen ? "rotate-90" : ""}`}>›</span>
					All Jobs ({jobs.length})
				</button>

				{allJobsOpen && (
					<>
						{/* Filters */}
						<div className="mb-4 flex gap-3 flex-wrap items-center">
							<button
								type="button"
								onClick={() => { setRecurringFilter((v) => !v); setPage(1); }}
								className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors cursor-pointer ${recurringFilter ? "border-neutral-500 bg-neutral-700 text-neutral-200" : "border-neutral-700 bg-neutral-800 text-neutral-500 hover:border-neutral-600"}`}
							>
								🔁 Recurring
							</button>
							<input
								type="text"
								placeholder="Search jobs, customers, addresses…"
								value={search}
								onChange={(e) => { setSearch(e.target.value); setPage(1); }}
								className="flex-1 min-w-48 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-neutral-500 placeholder:text-neutral-600"
							/>
							<select
								value={engFilter}
								onChange={(e) => { setEngFilter(e.target.value); setPage(1); }}
								className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-300 outline-none"
							>
								<option value="all">All Engineers</option>
								{engineers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
							</select>
							<select
								value={statusFilter}
								onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
								className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-300 outline-none"
							>
								<option value="All">All statuses</option>
								{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
							</select>
						</div>

						{/* Stats row */}
						<div className="mb-4 flex gap-2.5 flex-wrap">
							{STATUSES.map((s) => {
								const count = displayJobs.filter((j) => j.status === s).length;
								const sc = STATUS_COLORS[s];
								return (
									<div
										key={s}
										onClick={() => setStatusFilter(statusFilter === s ? "All" : s)}
										className={`flex-1 min-w-[80px] rounded-xl border px-3 py-2 cursor-pointer transition-opacity ${sc.bg} ${sc.border} ${statusFilter === s ? "opacity-100 ring-1 ring-white/20" : "opacity-80 hover:opacity-100"}`}
									>
										<p className={`text-2xl font-bold ${sc.text}`}>{count}</p>
										<p className="text-[11px] text-neutral-500">{s}</p>
									</div>
								);
							})}
						</div>

						{/* Job grid */}
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
							{displayJobs.length === 0 && (
								<p className="col-span-full py-12 text-center text-neutral-600">
									{search || statusFilter !== "All" ? "No jobs match your filters." : "No jobs yet."}
								</p>
							)}
							{pagedJobs.map((job) => <JobCard key={job.id} job={job} />)}
						</div>

						{totalPages > 1 && (
							<div className="mt-5 flex items-center justify-between gap-3">
								<p className="text-xs text-neutral-600">
									Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, displayJobs.length)} of {displayJobs.length}
								</p>
								<div className="flex gap-1">
									<button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage === 1} className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm text-neutral-400 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed hover:text-neutral-200 transition-colors">‹ Prev</button>
									<span className="flex items-center px-3 text-xs text-neutral-600">{safePage} / {totalPages}</span>
									<button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage === totalPages} className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm text-neutral-400 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed hover:text-neutral-200 transition-colors">Next ›</button>
								</div>
							</div>
						)}
					</>
				)}
			</section>
		</div>
	);
}
