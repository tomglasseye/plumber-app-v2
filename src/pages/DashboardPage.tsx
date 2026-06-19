import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useJobs } from "../hooks/useJobs";
import { useTeam } from "../hooks/useTeam";
import { useBusiness } from "../hooks/useBusiness";
import { useCustomers } from "../hooks/useCustomers";
import { useCategories } from "../hooks/useCategories";
import { useSchedule } from "../hooks/useSchedule";
import { JobCard } from "../components/JobCard";
import {
	HOLIDAY_TYPE_CONFIG,
	STATUSES,
	TODAY,
	bankHolidayMap,
	fmtDate,
	getWeekStart,
} from "../data";

export function DashboardPage() {
	const { isMaster } = useAuth();

	if (isMaster) return <MasterDashboard />;
	return <EngineerDashboard />;
}

// ── Engineer Dashboard (kept mostly as-is) ───────────────────────────────────

function EngineerDashboard() {
	const { myJobs } = useJobs();
	const { business } = useBusiness();
	const { currentUser } = useAuth();
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
	const pagedJobs = displayJobs.slice(
		(safePage - 1) * PAGE_SIZE,
		safePage * PAGE_SIZE,
	);

	return (
		<div className="p-6 md:p-8 max-w-5xl">
			<div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
				<div>
					<h1 className="text-2xl font-normal text-neutral-100 tracking-tight">
						My Jobs
					</h1>
					<p className="mt-1 text-sm text-neutral-600">
						{new Date(TODAY).toLocaleDateString("en-GB", {
							weekday: "long",
							day: "numeric",
							month: "long",
						})}
					</p>
				</div>
			</div>

			{todayJobs.length > 0 && (
				<div
					onClick={() => navigate("/my-day")}
					className={`mb-6 flex cursor-pointer items-center gap-4 rounded-xl border px-4 py-3 transition-colors ${
						hasEmergency
							? "border-red-800/50 bg-red-950/40"
							: "border-orange-800/30 bg-orange-950/20"
					}`}
				>
					<span className="text-2xl">
						{hasEmergency ? "🚨" : "☀️"}
					</span>
					<div className="flex-1">
						<p className="text-sm text-neutral-200">
							You have{" "}
							<strong
								style={{
									color: hasEmergency
										? "#f87171"
										: business.accentColor,
								}}
							>
								{todayJobs.length} job
								{todayJobs.length > 1 ? "s" : ""}
							</strong>{" "}
							today
							{hasEmergency && (
								<span className="text-red-400">
									{" "}
									— Emergency job!
								</span>
							)}
						</p>
						<p className="mt-0.5 text-xs text-neutral-600">
							Tap to view your day's route
						</p>
					</div>
					<span className="text-xl" style={{ color: userAccent }}>
						›
					</span>
				</div>
			)}

			<div className="mb-4 flex gap-3 flex-wrap items-center">
				<input
					type="text"
					placeholder="Search jobs, customers, addresses…"
					value={search}
					onChange={(e) => {
						setSearch(e.target.value);
						setPage(1);
					}}
					className="flex-1 min-w-48 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-neutral-500 placeholder:text-neutral-600"
				/>
				<select
					value={statusFilter}
					onChange={(e) => setStatusFilter(e.target.value)}
					className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-300 outline-none"
				>
					<option value="All">All statuses</option>
					{STATUSES.map((s) => (
						<option key={s} value={s}>
							{s}
						</option>
					))}
				</select>
			</div>

			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
				{displayJobs.length === 0 && (
					<p className="col-span-full py-12 text-center text-neutral-600">
						{search || statusFilter !== "All"
							? "No jobs match your filters."
							: "No jobs assigned."}
					</p>
				)}
				{pagedJobs.map((job) => (
					<JobCard key={job.id} job={job} />
				))}
			</div>

			{totalPages > 1 && (
				<div className="mt-5 flex items-center justify-between gap-3">
					<p className="text-xs text-neutral-600">
						Showing {(safePage - 1) * PAGE_SIZE + 1}–
						{Math.min(safePage * PAGE_SIZE, displayJobs.length)} of{" "}
						{displayJobs.length}
					</p>
					<div className="flex gap-1">
						<button
							onClick={() => setPage((p) => Math.max(1, p - 1))}
							disabled={safePage === 1}
							className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm text-neutral-400 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed hover:text-neutral-200 transition-colors"
						>
							‹ Prev
						</button>
						<span className="flex items-center px-3 text-xs text-neutral-600">
							{safePage} / {totalPages}
						</span>
						<button
							onClick={() =>
								setPage((p) => Math.min(totalPages, p + 1))
							}
							disabled={safePage === totalPages}
							className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm text-neutral-400 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed hover:text-neutral-200 transition-colors"
						>
							Next ›
						</button>
					</div>
				</div>
			)}
		</div>
	);
}

// ── Master Dashboard ─────────────────────────────────────────────────────────

function MasterDashboard() {
	const { jobs } = useJobs();
	const { business } = useBusiness();
	const { users } = useTeam();
	const { categories } = useCategories();
	const { customers } = useCustomers();
	const { holidays, reminders, createReminder, setReminderStatus } = useSchedule();
	const navigate = useNavigate();

	// Add-reminder form + a transient info notice (used by the SMS scaffold)
	const [showAdd, setShowAdd] = useState(false);
	const [draftTitle, setDraftTitle] = useState("");
	const [draftBody, setDraftBody] = useState("");
	const [draftDate, setDraftDate] = useState("");
	const [draftCustomer, setDraftCustomer] = useState("");
	const [info, setInfo] = useState<string | null>(null);

	// Pro (Tier 2) gate for the SMS "Send reminder" action. Every client is
	// Starter (Tier 1) for now, so this is false everywhere → the button never
	// renders. When a business is flipped to Pro it lights up automatically.
	const canSendSms = business.plan === "pro";

	// ── Dismissed reminders (localStorage) ──
	const [dismissed, setDismissed] = useState<Set<string>>(() => {
		try {
			const stored = localStorage.getItem(
				"dashboard_dismissed_reminders",
			);
			if (stored) {
				const parsed = JSON.parse(stored);
				if (
					parsed.ts &&
					Date.now() - parsed.ts > 30 * 24 * 60 * 60 * 1000
				)
					return new Set();
				return new Set(parsed.ids ?? []);
			}
		} catch {
			/* ignore */
		}
		return new Set();
	});

	function dismiss(key: string) {
		setDismissed((prev) => {
			const next = new Set(prev);
			next.add(key);
			localStorage.setItem(
				"dashboard_dismissed_reminders",
				JSON.stringify({ ids: [...next], ts: Date.now() }),
			);
			return next;
		});
	}

	// ── Computed data ──
	const todayJobs = jobs.filter((j) => j.date === TODAY);
	const activeJobs = todayJobs.filter(
		(j) => j.status === "En Route" || j.status === "On Site",
	);
	const completedToday = todayJobs.filter(
		(j) => j.status === "Completed" || j.status === "Invoiced",
	);
	const engOnSite = new Set(
		todayJobs
			.filter((j) => j.status === "On Site")
			.map((j) => j.assignedTo),
	).size;
	const pendingHolidays = holidays.filter((h) => h.status === "pending");

	function formatDate(ds: string) {
		return new Date(ds + "T00:00:00").toLocaleDateString("en-GB", {
			weekday: "short",
			day: "numeric",
			month: "short",
		});
	}

	// ── Upcoming Events — auto-surfaced from holidays + recurring jobs.
	// Each item stays on the dashboard until HQ dismisses it (persisted above).
	const thirtyOut = new Date();
	thirtyOut.setDate(thirtyOut.getDate() + 30);
	const cutoff30 = fmtDate(thirtyOut);
	const fourteenOut = new Date();
	fourteenOut.setDate(fourteenOut.getDate() + 14);
	const cutoff14 = fmtDate(fourteenOut);

	type RadarEvent = {
		key: string; // dismiss key — prefixed so holiday/job/reminder ids never collide
		kind: "holiday" | "recurring" | "reminder";
		date: string; // YYYY-MM-DD ("" = undated), for sorting
		emoji: string;
		title: string;
		subtitle: string;
		isToday: boolean;
		tag?: { label: string; className: string };
		onView?: () => void;
		reminderId?: string; // set when kind === "reminder"
		canRemind?: boolean; // event has a customer recipient (for the SMS scaffold)
	};

	const radarEvents: RadarEvent[] = [];

	// Engineers off — currently off, or booked off within the next 14 days
	for (const h of holidays) {
		if (h.status !== "approved") continue;
		const end = h.endDate ?? h.date;
		if (end < TODAY || h.date > cutoff14) continue;
		const key = `hol:${h.id}`;
		if (dismissed.has(key)) continue;
		const eng = users.find((u) => u.id === h.profileId);
		const cfg = HOLIDAY_TYPE_CONFIG[h.type];
		const coversToday = h.date <= TODAY && end >= TODAY;
		radarEvents.push({
			key,
			kind: "holiday",
			date: h.date,
			emoji: cfg.emoji,
			title: `${eng?.name ?? "Someone"} is off${coversToday ? " today" : ""}`,
			subtitle:
				formatDate(h.date) +
				(h.endDate ? ` – ${formatDate(h.endDate)}` : "") +
				(h.halfDay ? " (½ day)" : ""),
			isToday: coversToday,
			tag: { label: cfg.label, className: cfg.text },
		});
	}

	// Recurring services (annual/biannual/quarterly) due within 30 days
	for (const j of jobs) {
		if (
			!j.repeatFrequency ||
			j.status !== "Scheduled" ||
			!j.date ||
			j.date < TODAY ||
			j.date > cutoff30
		)
			continue;
		const key = `job:${j.id}`;
		if (dismissed.has(key)) continue;
		const eng = users.find((u) => u.id === j.assignedTo);
		const cat = categories.find((c) => c.id === j.categoryId);
		const freq =
			j.repeatFrequency === "annually"
				? "Annual"
				: j.repeatFrequency === "biannually"
					? "Biannual"
					: "Quarterly";
		radarEvents.push({
			key,
			kind: "recurring",
			date: j.date,
			emoji: "🔁",
			title: `${j.customer} — ${cat?.name ?? "Recurring service"}`,
			subtitle:
				`${freq} · due ${formatDate(j.date)}` +
				(eng ? ` · ${eng.name}` : ""),
			isToday: j.date === TODAY,
			tag: { label: "Recurring", className: "text-sky-400" },
			onView: () => navigate(`/job/${j.id}`),
			canRemind: true, // recurring jobs carry a customer to text
		});
	}

	// Manual reminders (free-form, recorded in the reminders table) — open only
	for (const r of reminders) {
		if (r.status !== "open") continue;
		const cust = r.customerId
			? customers.find((c) => c.id === r.customerId)
			: undefined;
		radarEvents.push({
			key: `rem:${r.id}`,
			kind: "reminder",
			date: r.dueDate ?? "",
			emoji: "📌",
			title: r.title,
			subtitle:
				[
					r.body || null,
					r.dueDate ? `due ${formatDate(r.dueDate)}` : null,
					cust ? cust.name : null,
				]
					.filter(Boolean)
					.join(" · ") || "Reminder",
			isToday: !!r.dueDate && r.dueDate === TODAY,
			tag: { label: "Reminder", className: "text-amber-400" },
			reminderId: r.id,
			canRemind: !!cust,
		});
	}

	// Today's items first, then soonest upcoming; undated reminders last
	radarEvents.sort((a, b) => {
		if (a.isToday !== b.isToday) return a.isToday ? -1 : 1;
		return (a.date || "9999-12-31").localeCompare(b.date || "9999-12-31");
	});

	// This week
	const weekStart = getWeekStart(new Date(TODAY + "T00:00:00"));
	const weekDays = Array.from({ length: 7 }, (_, i) => {
		const d = new Date(weekStart);
		d.setDate(d.getDate() + i);
		return fmtDate(d);
	});
	const thisYear = new Date(TODAY).getFullYear();
	const bankHols = bankHolidayMap([thisYear - 1, thisYear, thisYear + 1]);

	function handleAddReminder() {
		const title = draftTitle.trim();
		if (!title) return;
		createReminder({
			title,
			body: draftBody.trim(),
			dueDate: draftDate || undefined,
			customerId: draftCustomer || undefined,
		});
		setDraftTitle("");
		setDraftBody("");
		setDraftDate("");
		setDraftCustomer("");
		setShowAdd(false);
	}

	// Pro-only SMS scaffold. SMS itself isn't built yet (see docs/SMS.md); when
	// the send-sms Netlify Function lands, POST the customer's number + message
	// here instead of the placeholder notice. Only reachable when canSendSms.
	function handleSendReminder() {
		setInfo(
			"SMS reminders aren't switched on yet — they arrive with the Pro SMS feature.",
		);
	}

	return (
		<div className="p-6 md:p-8 max-w-5xl">
			{/* Header */}
			<div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
				<div>
					<h1 className="text-2xl font-normal text-neutral-100 tracking-tight">
						Dashboard
					</h1>
					<p className="mt-1 text-sm text-neutral-600">
						{new Date(TODAY).toLocaleDateString("en-GB", {
							weekday: "long",
							day: "numeric",
							month: "long",
						})}
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
					className="mb-6 flex cursor-pointer items-center gap-4 rounded-xl border border-amber-800/30 bg-amber-950/20 px-4 py-3 transition-colors hover:bg-amber-950/30"
				>
					<span className="text-2xl">🏖️</span>
					<div className="flex-1">
						<p className="text-sm text-neutral-200">
							<strong style={{ color: business.accentColor }}>
								{pendingHolidays.length}
							</strong>{" "}
							pending holiday request
							{pendingHolidays.length > 1 ? "s" : ""}
						</p>
					</div>
					<span
						className="text-xl"
						style={{ color: business.accentColor }}
					>
						›
					</span>
				</div>
			)}

			{/* Today at a Glance */}
			<section className="mb-8">
				<h2 className="text-sm text-neutral-400 uppercase tracking-wider mb-4">
					Today at a Glance
				</h2>
				<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
					{[
						{
							label: "Today's Jobs",
							value: todayJobs.length,
							emoji: "📋",
						},
						{
							label: "Active Now",
							value: activeJobs.length,
							emoji: "🔧",
							accent: true,
						},
						{
							label: "Completed",
							value: completedToday.length,
							emoji: "✅",
						},
						{
							label: "Engineers on Site",
							value: engOnSite,
							emoji: "👷",
						},
					].map((card) => (
						<div
							key={card.label}
							className={`rounded-xl border px-5 py-4 ${card.accent ? "border-orange-800/30 bg-orange-950/10" : "border-neutral-800 bg-neutral-900"}`}
						>
							<div className="flex items-center gap-2 mb-1">
								<span className="text-base">{card.emoji}</span>
								<p className="text-[11px] text-neutral-500">
									{card.label}
								</p>
							</div>
							<p
								className={`text-2xl font-bold ${card.accent ? "text-orange-400" : "text-neutral-200"}`}
							>
								{card.value}
							</p>
						</div>
					))}
				</div>
			</section>

			{/* Upcoming Events — engineers off + recurring services + free-form reminders */}
			<section className="mb-8">
				<div className="mb-4 flex items-center justify-between gap-3">
					<h2 className="text-sm text-neutral-400 uppercase tracking-wider">
						Upcoming Events
					</h2>
					<button
						onClick={() => setShowAdd((v) => !v)}
						className="text-xs px-2.5 py-1 rounded-lg border border-neutral-700 bg-neutral-800 text-neutral-300 hover:text-neutral-100 hover:border-neutral-600 transition-colors cursor-pointer"
					>
						{showAdd ? "Cancel" : "+ Add reminder"}
					</button>
				</div>

				{info && (
					<div className="mb-3 flex items-center gap-3 rounded-lg border border-sky-800/40 bg-sky-950/20 px-4 py-2.5">
						<p className="flex-1 text-xs text-sky-200">{info}</p>
						<button
							onClick={() => setInfo(null)}
							className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors cursor-pointer"
						>
							✕
						</button>
					</div>
				)}

				{showAdd && (
					<div className="mb-4 space-y-2.5 rounded-xl border border-neutral-800 bg-neutral-900 p-4">
						<input
							type="text"
							autoFocus
							placeholder="Reminder — e.g. Chase supplier invoice"
							value={draftTitle}
							onChange={(e) => setDraftTitle(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") handleAddReminder();
							}}
							className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-neutral-500 placeholder:text-neutral-600"
						/>
						<input
							type="text"
							placeholder="Note (optional)"
							value={draftBody}
							onChange={(e) => setDraftBody(e.target.value)}
							className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-neutral-500 placeholder:text-neutral-600"
						/>
						<div className="flex flex-wrap gap-2.5">
							<input
								type="date"
								value={draftDate}
								onChange={(e) => setDraftDate(e.target.value)}
								className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-300 outline-none focus:border-neutral-500"
							/>
							<select
								value={draftCustomer}
								onChange={(e) => setDraftCustomer(e.target.value)}
								className="flex-1 min-w-48 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-300 outline-none"
							>
								<option value="">
									— Link a customer (optional) —
								</option>
								{customers.map((c) => (
									<option key={c.id} value={c.id}>
										{c.name}
									</option>
								))}
							</select>
							<button
								onClick={handleAddReminder}
								disabled={!draftTitle.trim()}
								className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
								style={{ backgroundColor: business.accentColor }}
							>
								Add
							</button>
						</div>
					</div>
				)}

				{radarEvents.length === 0 ? (
					<div className="rounded-xl border border-neutral-800 bg-neutral-900 px-5 py-6 text-center">
						<p className="text-sm text-neutral-500">
							Nothing on the radar — you're all clear. 🎉
						</p>
					</div>
				) : (
					<div className="space-y-2.5">
						{radarEvents.map((ev) => {
							const rid = ev.reminderId;
							return (
								<div
									key={ev.key}
									className={`flex items-center gap-3 rounded-xl border px-5 py-3.5 flex-wrap transition-colors ${
										ev.isToday
											? "border-orange-800/40 bg-orange-950/15"
											: "border-neutral-800 bg-neutral-900"
									}`}
								>
									<span className="text-lg">{ev.emoji}</span>
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-2 flex-wrap">
											<p className="text-sm text-neutral-200">
												{ev.title}
											</p>
											{ev.isToday && (
												<span className="rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide bg-orange-500/15 text-orange-400">
													Today
												</span>
											)}
										</div>
										<p className="text-xs text-neutral-500">
											{ev.subtitle}
										</p>
									</div>
									{ev.tag && (
										<span
											className={`text-[10px] ${ev.tag.className}`}
										>
											{ev.tag.label}
										</span>
									)}
									{/* Pro-only (Tier 2) SMS action — hidden while every client is Starter */}
									{canSendSms && ev.canRemind && (
										<button
											onClick={handleSendReminder}
											className="text-xs px-2.5 py-1 rounded-lg border border-sky-700/60 bg-sky-900/30 text-sky-300 hover:text-sky-100 transition-colors cursor-pointer"
										>
											Send reminder
										</button>
									)}
									{ev.onView && (
										<button
											onClick={ev.onView}
											className="text-xs px-2.5 py-1 rounded-lg border border-neutral-700 bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
										>
											View
										</button>
									)}
									{ev.kind === "reminder" && rid ? (
										<>
											<button
												onClick={() =>
													setReminderStatus(rid, "done")
												}
												className="text-xs px-2.5 py-1 rounded-lg border border-emerald-800/50 bg-emerald-950/20 text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
											>
												Done
											</button>
											<button
												onClick={() =>
													setReminderStatus(
														rid,
														"dismissed",
													)
												}
												className="text-xs text-neutral-600 hover:text-neutral-300 transition-colors cursor-pointer"
											>
												Dismiss
											</button>
										</>
									) : (
										<button
											onClick={() => dismiss(ev.key)}
											className="text-xs text-neutral-600 hover:text-neutral-300 transition-colors cursor-pointer"
										>
											Dismiss
										</button>
									)}
								</div>
							);
						})}
					</div>
				)}
			</section>

			{/* This Week Overview */}
			<section className="mb-8">
				<h2 className="text-sm text-neutral-400 uppercase tracking-wider mb-4">
					This Week
				</h2>
				<div className="grid grid-cols-7 gap-3">
					{weekDays.map((ds) => {
						const dayJobs = jobs.filter((j) => j.date === ds);
						const engCount = new Set(
							dayJobs.map((j) => j.assignedTo),
						).size;
						const isToday = ds === TODAY;
						const bankHol = bankHols[ds];
						return (
							<div
								key={ds}
								onClick={() => navigate("/calendar")}
								className={`rounded-lg border p-3 text-center cursor-pointer transition-colors ${
									isToday
										? ""
										: bankHol
											? "border-emerald-800/40 bg-emerald-950/20 hover:border-emerald-700/50"
											: "border-neutral-800 bg-neutral-900 hover:border-neutral-700"
								}`}
								style={isToday ? { borderColor: business.accentColor + "80", backgroundColor: business.accentColor + "1A" } : undefined}
							>
								<p
									className={`text-[10px] uppercase ${isToday ? "" : "text-neutral-600"}`}
									style={isToday ? { color: business.accentColor } : undefined}
								>
									{new Date(
										ds + "T00:00:00",
									).toLocaleDateString("en-GB", {
										weekday: "short",
									})}
								</p>
								<p
									className={`text-lg font-medium ${isToday ? "" : "text-neutral-300"}`}
									style={isToday ? { color: business.accentColor } : undefined}
								>
									{dayJobs.length}
								</p>
								<p className="text-[10px] text-neutral-500">
									{engCount} eng
								</p>
								{bankHol && (
									<p
										className="text-[8px] text-emerald-400/80 truncate mt-0.5"
										title={bankHol}
									>
										🏦
									</p>
								)}
							</div>
						);
					})}
				</div>
			</section>
		</div>
	);
}
