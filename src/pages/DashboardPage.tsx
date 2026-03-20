import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../AppContext";
import { JobCard } from "../components/JobCard";
import { STATUSES, STATUS_COLORS, TODAY } from "../data";

export function DashboardPage() {
	const { isMaster, myJobs, jobs, business, currentUser, users } = useApp();
	const userAccent = currentUser?.color ?? business.accentColor;
	const navigate = useNavigate();
	const [search, setSearch] = useState("");
	const [statusFilter, setStatusFilter] = useState("All");
	const [engFilter, setEngFilter] = useState("all");
	const [page, setPage] = useState(1);
	const [recurringFilter, setRecurringFilter] = useState(false);
	const PAGE_SIZE = 25;

	type StatsPeriod = "today" | "week" | "month" | "year" | "all";
	const [statsPeriod, setStatsPeriod] = useState<StatsPeriod>("month");

	function periodStart(period: StatsPeriod): string {
		const d = new Date(TODAY + "T00:00:00");
		if (period === "today") {
			return TODAY;
		} else if (period === "week") {
			const day = d.getDay();
			const diff = day === 0 ? -6 : 1 - day;
			d.setDate(d.getDate() + diff);
		} else if (period === "month") {
			d.setDate(1);
		} else if (period === "year") {
			d.setMonth(0, 1);
		} else {
			return "0000-00-00";
		}
		return d.toISOString().slice(0, 10);
	}

	const statsFrom = periodStart(statsPeriod);

	const baseJobs = isMaster
		? engFilter === "all"
			? jobs
			: jobs.filter((j) => j.assignedTo === engFilter)
		: myJobs;

	const displayJobs = baseJobs.filter((j) => {
		const matchSearch =
			!search ||
			j.customer.toLowerCase().includes(search.toLowerCase()) ||
			j.address.toLowerCase().includes(search.toLowerCase()) ||
			j.ref.toLowerCase().includes(search.toLowerCase());
		const matchStatus = statusFilter === "All" || j.status === statusFilter;
		const matchRecurring = !recurringFilter || !!j.repeatFrequency;
		const matchPeriod =
			statsPeriod === "all" ||
			(statsPeriod === "today" ? j.date === TODAY : j.date >= statsFrom);
		return matchSearch && matchStatus && matchPeriod && matchRecurring;
	});

	const totalPages = Math.max(1, Math.ceil(displayJobs.length / PAGE_SIZE));
	const safePage = Math.min(page, totalPages);
	const pagedJobs = displayJobs.slice(
		(safePage - 1) * PAGE_SIZE,
		safePage * PAGE_SIZE,
	);

	const todayJobs = myJobs.filter((j) => j.date === TODAY);
	const hasEmergency = todayJobs.some((j) => j.priority === "Emergency");

	return (
		<div className="p-5 md:p-7 max-w-5xl">
			{/* Header */}
			<div className="flex items-start justify-between mb-5 gap-4 flex-wrap">
				<div>
					<h1 className="text-2xl font-normal text-neutral-100 tracking-tight">
						{isMaster ? "All Jobs" : "My Jobs"}
					</h1>
					<p className="mt-1 text-sm text-neutral-600">
						{new Date(TODAY).toLocaleDateString("en-GB", {
							weekday: "long",
							day: "numeric",
							month: "long",
						})}
					</p>
				</div>
				<div className="flex items-center gap-3">
					{isMaster && (
						<button
							onClick={() => navigate("/new-job")}
							className="rounded-lg px-4 py-2 text-sm font-medium text-white"
							style={{ backgroundColor: business.accentColor }}
						>
							+ New Job
						</button>
					)}
				</div>
			</div>

			{/* Today banner (engineers) */}
			{!isMaster && todayJobs.length > 0 && (
				<div
					onClick={() => navigate("/my-day")}
					className={`mb-5 flex cursor-pointer items-center gap-4 rounded-xl border px-4 py-3 transition-colors ${
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

			{/* Stats row (master) */}
			{isMaster && (
				<>
					<div className="mb-3 flex items-center justify-between gap-3 flex-wrap">
						<p className="text-xs text-neutral-500">
							{statsPeriod === "today"
								? "Today"
								: statsPeriod === "week"
									? "This Week"
									: statsPeriod === "month"
										? "This Month"
										: statsPeriod === "year"
											? "This Year"
											: "All Time"}
						</p>
						<div className="flex rounded-lg border border-neutral-700 overflow-hidden text-xs">
							{(
								[
									"today",
									"week",
									"month",
									"year",
									"all",
								] as const
							).map((p) => (
								<button
									key={p}
									onClick={() => {
										setStatsPeriod(p);
										setPage(1);
									}}
									className={`px-2.5 py-1.5 transition-colors cursor-pointer ${
										statsPeriod === p
											? "bg-neutral-700 text-neutral-100"
											: "bg-neutral-800 text-neutral-500 hover:text-neutral-300"
									}`}
								>
									{p === "today"
										? "Today"
										: p === "week"
											? "Week"
											: p === "month"
												? "Month"
												: p === "year"
													? "Year"
													: "All"}
								</button>
							))}
						</div>
					</div>
					<div className="mb-5 flex gap-2.5 flex-wrap">
						{STATUSES.map((s) => {
							const count = baseJobs.filter(
								(j) =>
									j.status === s &&
									(statsPeriod === "today"
										? j.date === TODAY
										: j.date >= statsFrom),
							).length;
							const sc = STATUS_COLORS[s];
							return (
								<div
									key={s}
									onClick={() =>
										setStatusFilter(
											statusFilter === s ? "All" : s,
										)
									}
									className={`flex-1 min-w-[80px] rounded-xl border px-3 py-2 cursor-pointer transition-opacity ${sc.bg} ${sc.border} ${statusFilter === s ? "opacity-100 ring-1 ring-white/20" : "opacity-80 hover:opacity-100"}`}
								>
									<p
										className={`text-2xl font-bold ${sc.text}`}
									>
										{count}
									</p>
									<p className="text-[11px] text-neutral-500">
										{s}
									</p>
								</div>
							);
						})}
					</div>
				</>
			)}

			{/* Search + filter */}
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
					onChange={(e) => {
						setSearch(e.target.value);
						setPage(1);
					}}
					className="flex-1 min-w-48 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-neutral-500 placeholder:text-neutral-600"
				/>
				{isMaster && (
					<select
						value={engFilter}
						onChange={(e) => {
							setEngFilter(e.target.value);
							setPage(1);
						}}
						className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-300 outline-none"
					>
						<option value="all">All Engineers</option>
						{users
							.filter((u) => u.role === "engineer")
							.map((u) => (
								<option key={u.id} value={u.id}>
									{u.name}
								</option>
							))}
					</select>
				)}
				{!isMaster && (
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
				)}
			</div>

			{/* Job grid */}
			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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

			{/* Pagination */}
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
