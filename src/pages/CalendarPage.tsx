import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../AppContext";
import { engColor, PRIORITY_COLORS, STATUS_COLORS, TODAY } from "../data";

export function CalendarPage() {
	const { isMaster, jobs, myJobs, users } = useApp();
	const navigate = useNavigate();
	const [calDate, setCalDate] = useState(new Date(2026, 2, 1));
	const [filter, setFilter] = useState("all");

	const year = calDate.getFullYear();
	const month = calDate.getMonth();
	const monthName = calDate.toLocaleString("en-GB", {
		month: "long",
		year: "numeric",
	});

	const visible = isMaster
		? filter === "all"
			? jobs
			: jobs.filter((j) => j.assignedTo === filter)
		: myJobs;

	const byDate = useMemo(() => {
		const m: Record<string, typeof jobs> = {};
		visible.forEach((j) => {
			if (!m[j.date]) m[j.date] = [];
			m[j.date].push(j);
		});
		return m;
	}, [visible]);

	const rawFirst = new Date(year, month, 1).getDay();
	const offset = rawFirst === 0 ? 6 : rawFirst - 1;
	const daysInMonth = new Date(year, month + 1, 0).getDate();
	const total = Math.ceil((offset + daysInMonth) / 7) * 7;

	const cells = Array.from({ length: total }, (_, i) => {
		const d = i - offset + 1;
		if (d < 1 || d > daysInMonth) return null;
		const ds = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
		return { d, ds, jobs: byDate[ds] ?? [] };
	});

	return (
		<div className="p-5 md:p-7 max-w-[1100px]">
			{/* Header */}
			<div className="flex items-start justify-between mb-5 gap-4 flex-wrap">
				<div>
					<h1 className="text-2xl font-normal text-neutral-100 tracking-tight">
						Calendar
					</h1>
					<p className="mt-1 text-sm text-neutral-600">{monthName}</p>
				</div>
				<div className="flex items-center gap-2 flex-wrap">
					{isMaster && (
						<select
							value={filter}
							onChange={(e) => setFilter(e.target.value)}
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
					<div className="flex gap-1">
						<button
							onClick={() =>
								setCalDate(new Date(year, month - 1, 1))
							}
							className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-300 hover:border-neutral-600 cursor-pointer transition-colors"
						>
							‹
						</button>
						<button
							onClick={() => setCalDate(new Date(2026, 2, 1))}
							className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-300 hover:border-neutral-600 cursor-pointer transition-colors"
						>
							Today
						</button>
						<button
							onClick={() =>
								setCalDate(new Date(year, month + 1, 1))
							}
							className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-300 hover:border-neutral-600 cursor-pointer transition-colors"
						>
							›
						</button>
					</div>
				</div>
			</div>

			{/* Engineer legend */}
			{isMaster && filter === "all" && (
				<div className="mb-4 flex flex-wrap gap-4">
					{users
						.filter((u) => u.role === "engineer")
						.map((u) => (
							<div
								key={u.id}
								className="flex items-center gap-1.5 text-xs text-neutral-500"
							>
								<div
									className="h-2 w-2 rounded-full"
									style={{ background: engColor(u.id) }}
								/>
								{u.name}
							</div>
						))}
				</div>
			)}

			{/* Grid */}
			<div className="grid grid-cols-7 gap-1">
				{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
					<div
						key={d}
						className="pb-2 text-center text-[10px] uppercase tracking-widest text-neutral-600"
					>
						{d}
					</div>
				))}

				{cells.map((cell, i) => {
					if (!cell) return <div key={i} className="min-h-[88px]" />;
					const isToday = cell.ds === TODAY;
					return (
						<div
							key={i}
							className={`min-h-[88px] rounded-lg border p-1.5 ${
								isToday
									? "border-orange-700/50 bg-orange-950/30"
									: "border-neutral-800 bg-neutral-900"
							}`}
						>
							<span
								className={`block mb-1 text-xs ${isToday ? "font-bold text-orange-400" : "text-neutral-600"}`}
							>
								{cell.d}
							</span>
							<div className="flex flex-col gap-0.5">
								{cell.jobs.slice(0, 3).map((j) => {
									const sc = STATUS_COLORS[j.status];
									const pc = PRIORITY_COLORS[j.priority];
									return (
										<div
											key={j.id}
											onClick={() =>
												navigate(`/job/${j.id}`)
											}
											className={`cursor-pointer rounded px-1 py-0.5 text-[10px] ${sc.bg} overflow-hidden`}
											style={{
												borderLeft: `3px solid ${engColor(j.assignedTo)}`,
											}}
										>
											<div className="flex items-center gap-1">
												<div
													className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${pc.dot}`}
												/>
												<span
													className={`${sc.text} block truncate`}
												>
													{j.customer}
												</span>
											</div>
										</div>
									);
								})}
								{cell.jobs.length > 3 && (
									<div className="pl-1 text-[10px] text-neutral-600">
										+{cell.jobs.length - 3} more
									</div>
								)}
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}
