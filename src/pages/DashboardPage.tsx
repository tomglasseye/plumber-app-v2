import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../AppContext";
import { NotificationBell } from "../components/NotificationBell";
import { JobCard } from "../components/JobCard";
import { STATUSES, STATUS_COLORS, TODAY } from "../data";

export function DashboardPage() {
	const {
		isMaster,
		myJobs,
		jobs,
		myNotifs,
		clearNotifs,
		business,
		currentUser,
	} = useApp();
	const userAccent = currentUser?.color ?? business.accentColor;
	const navigate = useNavigate();
	const [search, setSearch] = useState("");
	const [statusFilter, setStatusFilter] = useState("All");

	const displayJobs = myJobs.filter((j) => {
		const matchSearch =
			!search ||
			j.customer.toLowerCase().includes(search.toLowerCase()) ||
			j.address.toLowerCase().includes(search.toLowerCase()) ||
			j.type.toLowerCase().includes(search.toLowerCase()) ||
			j.ref.toLowerCase().includes(search.toLowerCase());
		const matchStatus = statusFilter === "All" || j.status === statusFilter;
		return matchSearch && matchStatus;
	});

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
					<NotificationBell
						notifications={myNotifs}
						onClear={clearNotifs}
						onNavigate={(jobId) => navigate(`/jobs/${jobId}`)}
					/>
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
				<div className="mb-5 flex gap-2.5 flex-wrap">
					{STATUSES.map((s) => {
						const count = jobs.filter((j) => j.status === s).length;
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
								<p className={`text-2xl font-bold ${sc.text}`}>
									{count}
								</p>
								<p className="text-[11px] text-neutral-500">
									{s}
								</p>
							</div>
						);
					})}
				</div>
			)}

			{/* Search + filter */}
			<div className="mb-4 flex gap-3 flex-wrap">
				<input
					type="text"
					placeholder="Search jobs, customers, addresses…"
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					className="flex-1 min-w-48 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-neutral-500 placeholder:text-neutral-600"
				/>
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
				{displayJobs.map((job) => (
					<JobCard key={job.id} job={job} />
				))}
			</div>
		</div>
	);
}
