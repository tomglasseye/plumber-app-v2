import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../AppContext";
import { PRIORITY_COLORS, STATUS_COLORS, TODAY, userColor } from "../data";

type CalView = "month" | "week" | "today";

function getWeekStart(d: Date): Date {
	const day = d.getDay();
	const diff = day === 0 ? -6 : 1 - day;
	const mon = new Date(d);
	mon.setDate(d.getDate() + diff);
	return mon;
}

export function CalendarPage() {
	const { isMaster, jobs, myJobs, users } = useApp();
	const navigate = useNavigate();
	const [calDate, setCalDate] = useState(new Date());
	const [filter, setFilter] = useState("all");
	const [view, setView] = useState<CalView>(
		() => (localStorage.getItem("calView") as CalView) ?? "month",
	);

	function setViewPersisted(v: CalView) {
		localStorage.setItem("calView", v);
		setView(v);
	}

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

	// ── Month view grid ──
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

	// ── Week view (Mon–Fri) ──
	const weekStart = getWeekStart(calDate);
	const weekDays = Array.from({ length: 5 }, (_, i) => {
		const d = new Date(weekStart);
		d.setDate(weekStart.getDate() + i);
		const ds = d.toISOString().slice(0, 10);
		return { date: d, ds, jobs: byDate[ds] ?? [] };
	});
	const weekLabel = `${weekStart.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${weekDays[4].date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;

	const todayDateLabel = calDate.toLocaleDateString("en-GB", {
		weekday: "long",
		day: "numeric",
		month: "long",
		year: "numeric",
	});
	const viewLabel =
		view === "month"
			? monthName
			: view === "week"
				? weekLabel
				: todayDateLabel;

	function prevPeriod() {
		const d = new Date(calDate);
		if (view === "month") return setCalDate(new Date(year, month - 1, 1));
		if (view === "week") d.setDate(d.getDate() - 7);
		else d.setDate(d.getDate() - 1);
		setCalDate(d);
	}
	function nextPeriod() {
		const d = new Date(calDate);
		if (view === "month") return setCalDate(new Date(year, month + 1, 1));
		if (view === "week") d.setDate(d.getDate() + 7);
		else d.setDate(d.getDate() + 1);
		setCalDate(d);
	}
	function goToday() {
		setCalDate(new Date());
	}

	return (
		<div className="p-5 md:p-7 max-w-[1100px]">
			{/* Header */}
			<div className="flex items-start justify-between mb-5 gap-4 flex-wrap">
				<div>
					<h1 className="text-2xl font-normal text-neutral-100 tracking-tight">
						Calendar
					</h1>
					<p className="mt-1 text-sm text-neutral-600">{viewLabel}</p>
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
					{/* View toggle */}
					<div className="flex rounded-lg border border-neutral-700 overflow-hidden text-sm">
						{[
							{ v: "today" as CalView, label: "Today" },
							{ v: "week" as CalView, label: "Working Week" },
							{ v: "month" as CalView, label: "Month" },
						].map(({ v, label }) => (
							<button
								key={v}
								onClick={() => setViewPersisted(v)}
								className={`px-3 py-2 transition-colors cursor-pointer ${
									view === v
										? "bg-neutral-700 text-neutral-100"
										: "bg-neutral-800 text-neutral-500 hover:text-neutral-300"
								}`}
							>
								{label}
							</button>
						))}
					</div>
					<div className="flex gap-1">
						<button
							onClick={prevPeriod}
							className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-300 hover:border-neutral-600 cursor-pointer transition-colors"
						>
							‹
						</button>
						<button
							onClick={goToday}
							className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-300 hover:border-neutral-600 cursor-pointer transition-colors"
						>
							Today
						</button>
						<button
							onClick={nextPeriod}
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
								className="flex items-center gap-1.5 text-xs text-neutral-400"
							>
								<div
									className="h-2.5 w-2.5 rounded-full flex-shrink-0"
									style={{
										background: userColor(u.id, users),
									}}
								/>
								{u.name}
							</div>
						))}
				</div>
			)}

			{/* ── MONTH VIEW ── */}
			{view === "month" && (
				<div className="grid grid-cols-7 gap-1">
					{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
						(d) => (
							<div
								key={d}
								className="pb-2 text-center text-[10px] uppercase tracking-widest text-neutral-600"
							>
								{d}
							</div>
						),
					)}

					{cells.map((cell, i) => {
						if (!cell)
							return <div key={i} className="min-h-[88px]" />;
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
										const uc = userColor(
											j.assignedTo,
											users,
										);
										return (
											<div
												key={j.id}
												onClick={() =>
													navigate(`/job/${j.id}`)
												}
												className={`cursor-pointer rounded px-1 py-0.5 text-[10px] ${sc.bg} overflow-hidden`}
												style={{
													borderLeft: `3px solid ${uc}`,
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
			)}

			{/* ── WEEK VIEW ── */}
			{view === "week" && (
				<div className="grid grid-cols-5 gap-2">
					{weekDays.map(({ date, ds, jobs: dayJobs }) => {
						const isToday = ds === TODAY;
						const dayName = date.toLocaleDateString("en-GB", {
							weekday: "short",
						});
						const dayNum = date.toLocaleDateString("en-GB", {
							day: "numeric",
							month: "short",
						});
						return (
							<div
								key={ds}
								className={`rounded-xl border p-3 min-h-[400px] ${
									isToday
										? "border-orange-700/50 bg-orange-950/20"
										: "border-neutral-800 bg-neutral-900"
								}`}
							>
								<div className="mb-3 text-center">
									<p
										className={`text-[10px] uppercase tracking-widest ${isToday ? "text-orange-400" : "text-neutral-500"}`}
									>
										{dayName}
									</p>
									<p
										className={`text-sm font-medium ${isToday ? "text-orange-300" : "text-neutral-300"}`}
									>
										{dayNum}
									</p>
								</div>
								<div className="flex flex-col gap-1.5">
									{dayJobs.length === 0 && (
										<p className="text-center text-[10px] text-neutral-700 pt-4">
											No jobs
										</p>
									)}
									{dayJobs.map((j) => {
										const sc = STATUS_COLORS[j.status];
										const pc = PRIORITY_COLORS[j.priority];
										const uc = userColor(
											j.assignedTo,
											users,
										);
										const eng = users.find(
											(u) => u.id === j.assignedTo,
										);
										return (
											<div
												key={j.id}
												onClick={() =>
													navigate(`/job/${j.id}`)
												}
												className={`cursor-pointer rounded-lg p-2 ${sc.bg} hover:opacity-90 transition-opacity`}
												style={{
													borderLeft: `3px solid ${uc}`,
												}}
											>
												<div className="flex items-center gap-1.5 mb-1">
													<div
														className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${pc.dot}`}
													/>
													<span
														className={`text-[10px] font-mono flex-shrink-0 ${sc.text}`}
													>
														{j.ref}
													</span>
												</div>
												<p
													className={`text-xs font-medium leading-tight truncate ${sc.text}`}
												>
													{j.customer}
												</p>
												<p className="text-[10px] text-neutral-500 truncate mt-0.5">
													{j.type}
												</p>
												{isMaster && eng && (
													<div className="mt-1.5 flex items-center gap-1">
														<div
															className="h-4 w-4 rounded-full flex items-center justify-center text-[9px] font-medium flex-shrink-0"
															style={{
																background:
																	uc + "33",
																color: uc,
															}}
														>
															{eng.avatar.slice(
																0,
																2,
															)}
														</div>
														<span className="text-[10px] text-neutral-500 truncate">
															{
																eng.name.split(
																	" ",
																)[0]
															}
														</span>
													</div>
												)}
											</div>
										);
									})}
								</div>
							</div>
						);
					})}
				</div>
			)}

			{/* ── TODAY VIEW ── */}
			{view === "today" && (
				<div className="max-w-xl">
					{(byDate[calDate.toISOString().slice(0, 10)] ?? [])
						.length === 0 ? (
						<div className="flex flex-col items-center justify-center py-20 text-center rounded-xl border border-neutral-800 bg-neutral-900">
							<span className="text-4xl mb-3">📭</span>
							<p className="text-neutral-600 text-sm">
								No jobs scheduled for this day.
							</p>
						</div>
					) : (
						<div className="space-y-3">
							{(
								byDate[calDate.toISOString().slice(0, 10)] ?? []
							).map((j) => {
								const sc = STATUS_COLORS[j.status];
								const pc = PRIORITY_COLORS[j.priority];
								const uc = userColor(j.assignedTo, users);
								const eng = users.find(
									(u) => u.id === j.assignedTo,
								);
								return (
									<div
										key={j.id}
										onClick={() => navigate(`/job/${j.id}`)}
										className="cursor-pointer rounded-xl border border-neutral-800 bg-neutral-900 p-4 hover:border-neutral-700 transition-colors"
										style={{
											borderLeft: `4px solid ${uc}`,
										}}
									>
										<div className="flex items-center justify-between gap-2 mb-2">
											<div className="flex items-center gap-2 min-w-0">
												<span className="text-[10px] text-neutral-600 font-mono flex-shrink-0">
													{j.ref}
												</span>
												<span
													className={`text-[10px] px-2 py-0.5 rounded-full ${pc.bg} ${pc.text}`}
												>
													{j.priority}
												</span>
											</div>
											<span
												className={`text-[10px] px-2.5 py-1 rounded-full font-mono flex-shrink-0 ${sc.bg} ${sc.text}`}
											>
												{j.status}
											</span>
										</div>
										<p className="text-base text-neutral-100 font-normal mb-0.5">
											{j.customer}
										</p>
										<p className="text-sm text-neutral-500 mb-3">
											{j.type}
										</p>
										<div className="flex items-center gap-3 flex-wrap">
											<span className="text-xs text-neutral-600">
												📍{" "}
												{j.address
													.split(",")
													.slice(-2)
													.join(",")
													.trim()}
											</span>
											{isMaster && eng && (
												<div className="ml-auto flex items-center gap-1.5">
													<div
														className="h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium"
														style={{
															background:
																uc + "22",
															color: uc,
														}}
													>
														{eng.avatar.slice(0, 2)}
													</div>
													<span className="text-xs text-neutral-500">
														{eng.name}
													</span>
												</div>
											)}
										</div>
									</div>
								);
							})}
						</div>
					)}
				</div>
			)}
		</div>
	);
}
