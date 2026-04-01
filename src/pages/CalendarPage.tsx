import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../AppContext";
import { CategoryIcon } from "./AccountPage";
import { HOLIDAY_TYPE_CONFIG, PRIORITIES, STATUS_COLORS, TODAY, bankHolidayMap, userColor } from "../data";
import type {
	Holiday,
	HolidayType,
	Job,
	NewJobForm,
	RepeatFrequency,
} from "../types";
import { UnscheduledPanel } from "../components/UnscheduledPanel";
import { useCalendarShortcuts } from "../hooks/useCalendarShortcuts";

// ── Time helpers ─────────────────────────────────────────────────────────────

const HOUR_START = 5;
const HOUR_END = 22;
const HOUR_HEIGHT = 64; // px per hour
const HOURS = Array.from(
	{ length: HOUR_END - HOUR_START },
	(_, i) => HOUR_START + i,
);
const TOTAL_HEIGHT = HOURS.length * HOUR_HEIGHT;

function timeToMinutes(t: string): number {
	const [h, m] = t.split(":").map(Number);
	return h * 60 + m;
}

function minutesToTime(mins: number): string {
	const clamped = Math.max(HOUR_START * 60, Math.min(HOUR_END * 60, mins));
	return `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`;
}

function timeToY(t: string): number {
	return ((timeToMinutes(t) - HOUR_START * 60) / 60) * HOUR_HEIGHT;
}

function yToTime(y: number): string {
	const rawMins = (y / HOUR_HEIGHT) * 60 + HOUR_START * 60;
	const snapped = Math.round(rawMins / 15) * 15;
	return minutesToTime(snapped);
}

function formatTime(t: string): string {
	const [h, m] = t.split(":").map(Number);
	const ampm = h < 12 ? "am" : "pm";
	const dh = h > 12 ? h - 12 : h === 0 ? 12 : h;
	return m === 0
		? `${dh}${ampm}`
		: `${dh}:${String(m).padStart(2, "0")}${ampm}`;
}

function formatHour(h: number): string {
	if (h === 12) return "12pm";
	if (h > 12) return `${h - 12}pm`;
	return `${h}am`;
}

// ── Layout overlap detection ──────────────────────────────────────────────────

interface LayoutJob {
	job: Job;
	col: number;
	cols: number;
	top: number;
	height: number;
	conflict?: boolean;
}

function layoutTimedJobs(jobs: Job[]): LayoutJob[] {
	const timed = jobs.filter((j) => j.startTime);
	if (!timed.length) return [];

	const sorted = [...timed].sort((a, b) =>
		(a.startTime ?? "").localeCompare(b.startTime ?? ""),
	);

	const placed: LayoutJob[] = [];
	const colEnds: number[] = [];

	for (const job of sorted) {
		const startMins = timeToMinutes(job.startTime!);
		const endMins = job.endTime
			? timeToMinutes(job.endTime)
			: startMins + 60;
		const top = timeToY(job.startTime!);
		const height = Math.max(
			HOUR_HEIGHT,
			((endMins - startMins) / 60) * HOUR_HEIGHT,
		);

		let col = colEnds.findIndex((end) => end <= startMins);
		if (col === -1) col = colEnds.length;
		colEnds[col] = endMins;

		placed.push({ job, col, cols: 0, top, height });
	}

	for (const item of placed) {
		const start = timeToMinutes(item.job.startTime!);
		const end = item.job.endTime
			? timeToMinutes(item.job.endTime)
			: start + 60;
		const maxCol = placed
			.filter((r) => {
				if (r === item) return false;
				const rs = timeToMinutes(r.job.startTime!);
				const re = r.job.endTime
					? timeToMinutes(r.job.endTime)
					: rs + 60;
				return start < re && end > rs;
			})
			.reduce((mx, r) => Math.max(mx, r.col), -1);
		item.cols = Math.max(item.col + 1, maxCol + 1);
	}

	// Detect same-engineer time conflicts
	for (let i = 0; i < placed.length; i++) {
		for (let j = i + 1; j < placed.length; j++) {
			const a = placed[i].job,
				b = placed[j].job;
			if (a.assignedTo !== b.assignedTo) continue;
			const aS = timeToMinutes(a.startTime!);
			const aE = a.endTime ? timeToMinutes(a.endTime) : aS + 60;
			const bS = timeToMinutes(b.startTime!);
			const bE = b.endTime ? timeToMinutes(b.endTime) : bS + 60;
			if (aS < bE && bS < aE) {
				placed[i].conflict = true;
				placed[j].conflict = true;
			}
		}
	}

	return placed;
}

// ── Week helpers ──────────────────────────────────────────────────────────────

function getWeekStart(d: Date): Date {
	const day = d.getDay();
	const diff = day === 0 ? -6 : 1 - day;
	const mon = new Date(d);
	mon.setDate(d.getDate() + diff);
	return mon;
}

function weekDaysFrom(start: Date, count = 7) {
	return Array.from({ length: count }, (_, i) => {
		const d = new Date(start);
		d.setDate(start.getDate() + i);
		return { date: d, ds: d.toISOString().slice(0, 10) };
	});
}

// ── Time slot options ─────────────────────────────────────────────────────────

const TIME_OPTS = (() => {
	const opts: { value: string; label: string }[] = [];
	for (let h = 7; h <= 20; h++) {
		for (const m of [0, 30]) {
			const value = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
			const ampm = h < 12 ? "am" : "pm";
			const dh = h > 12 ? h - 12 : h;
			opts.push({
				value,
				label: `${dh}:${String(m).padStart(2, "0")} ${ampm}`,
			});
		}
	}
	return opts;
})();

type CalView = "month" | "week" | "day";

// ── Floating Add Job Panel ────────────────────────────────────────────────────

const EMPTY_FORM: NewJobForm = {
	customer: "",
	phone: "",
	address: "",
	description: "",
	assignedTo: "",
	date: "",
	priority: "Normal",
	startTime: "",
	endTime: "",
	repeatFrequency: undefined,
};

function AddJobPanel({
	prefill,
	onClose,
	onSubmit,
}: {
	prefill: Partial<NewJobForm>;
	onClose: () => void;
	onSubmit: (form: NewJobForm) => void;
}) {
	const { users, customers, categories, business } = useApp();
	const [form, setForm] = useState<NewJobForm>({ ...EMPTY_FORM, ...prefill });
	const [custSearch, setCustSearch] = useState(prefill.customer ?? "");
	const [showSugg, setShowSugg] = useState(false);

	const suggestions =
		custSearch.length > 0
			? customers.filter((c) =>
					c.name.toLowerCase().includes(custSearch.toLowerCase()),
				)
			: [];

	function f(key: keyof NewJobForm, value: string) {
		setForm((prev) => ({ ...prev, [key]: value }));
	}

	function handleStartTime(val: string) {
		setForm((prev) => {
			const next: NewJobForm = { ...prev, startTime: val };
			if (val) {
				const [h, m] = val.split(":").map(Number);
				const endH = h + 1;
				if (endH <= 20)
					next.endTime = `${String(endH).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
			}
			return next;
		});
	}

	function selectCustomer(c: {
		id: string;
		name: string;
		phone: string;
		address: string;
	}) {
		setCustSearch(c.name);
		setForm((prev) => ({
			...prev,
			customer: c.name,
			phone: c.phone || prev.phone,
			address: c.address || prev.address,
			customerId: c.id,
		}));
		setShowSugg(false);
	}

	useEffect(() => {
		setForm((prev) => ({ ...prev, ...prefill }));
	}, [prefill.date, prefill.startTime]); // eslint-disable-line react-hooks/exhaustive-deps

	const canSubmit =
		form.customer &&
		form.phone &&
		form.address &&
		form.date &&
		form.assignedTo;

	const engineers = users.filter((u) => u.role === "engineer");
	const inputCls =
		"w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-neutral-500 placeholder:text-neutral-600";

	return (
		<div className="flex flex-col h-full">
			{/* Header */}
			<div className="flex items-center justify-between px-4 py-3.5 border-b border-neutral-800 flex-shrink-0">
				<span className="text-sm font-medium text-neutral-100">
					New Job
				</span>
				<button
					onClick={onClose}
					className="text-neutral-500 hover:text-neutral-300 cursor-pointer border-0 bg-transparent text-xl leading-none p-1"
				>
					×
				</button>
			</div>

			{/* Form */}
			<div className="flex-1 overflow-y-auto p-4 space-y-3">
				{/* Customer */}
				<div className="relative">
					<label className="mb-1 block text-[10px] uppercase tracking-wider text-neutral-600">
						Customer *
					</label>
					<input
						type="text"
						placeholder="e.g. Mr & Mrs Smith"
						value={custSearch || form.customer}
						onChange={(e) => {
							setCustSearch(e.target.value);
							f("customer", e.target.value);
							setForm((p) => ({ ...p, customerId: undefined }));
							setShowSugg(e.target.value.length > 0);
						}}
						onFocus={() =>
							custSearch.length > 0 && setShowSugg(true)
						}
						onBlur={() => setTimeout(() => setShowSugg(false), 150)}
						className={inputCls}
					/>
					{showSugg && suggestions.length > 0 && (
						<div className="absolute top-full left-0 right-0 z-10 mt-1 max-h-36 overflow-y-auto rounded-lg border border-neutral-700 bg-neutral-800 shadow-xl">
							{suggestions.map((c) => (
								<button
									key={c.id}
									type="button"
									onMouseDown={() => selectCustomer(c)}
									className="w-full text-left px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-700 cursor-pointer border-0 bg-transparent"
								>
									{c.name}
								</button>
							))}
						</div>
					)}
				</div>

				<div>
					<label className="mb-1 block text-[10px] uppercase tracking-wider text-neutral-600">
						Phone *
					</label>
					<input
						type="tel"
						placeholder="07700…"
						value={form.phone}
						onChange={(e) => f("phone", e.target.value)}
						className={inputCls}
					/>
				</div>

				<div>
					<label className="mb-1 block text-[10px] uppercase tracking-wider text-neutral-600">
						Address *
					</label>
					<input
						type="text"
						placeholder="Full property address"
						value={form.address}
						onChange={(e) => f("address", e.target.value)}
						className={inputCls}
					/>
				</div>

				{categories.length > 0 && (
					<div>
						<label className="mb-1.5 block text-[10px] uppercase tracking-wider text-neutral-600">
							Category
						</label>
						<div className="flex flex-wrap gap-1.5">
							<button
								type="button"
								onClick={() =>
									setForm((p) => ({
										...p,
										categoryId: undefined,
									}))
								}
								className={`rounded-lg border px-2 py-1 text-[11px] cursor-pointer transition-colors ${!form.categoryId ? "border-neutral-500 bg-neutral-700 text-neutral-200" : "border-neutral-700 text-neutral-500"}`}
							>
								None
							</button>
							{categories.map((cat) => (
								<button
									key={cat.id}
									type="button"
									onClick={() =>
										setForm((p) => ({
											...p,
											categoryId: cat.id,
										}))
									}
									className="flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] cursor-pointer transition-colors"
									style={
										form.categoryId === cat.id
											? {
													background:
														cat.color + "22",
													color: cat.color,
													borderColor: cat.color,
												}
											: {
													borderColor: "#404040",
													color: "#6b7280",
												}
									}
								>
									<CategoryIcon
										name={cat.icon}
										size={11}
										color={
											form.categoryId === cat.id
												? cat.color
												: "#6b7280"
										}
									/>
									{cat.name}
								</button>
							))}
						</div>
					</div>
				)}

				<div className="grid grid-cols-2 gap-2">
					<div>
						<label className="mb-1 block text-[10px] uppercase tracking-wider text-neutral-600">
							Start Date *
						</label>
						<input
							type="date"
							value={form.date}
							onChange={(e) => {
								f("date", e.target.value);
								if (
									form.endDate &&
									form.endDate < e.target.value
								)
									f("endDate", e.target.value);
							}}
							className={inputCls}
						/>
					</div>
					<div>
						<label className="mb-1 block text-[10px] uppercase tracking-wider text-neutral-600">
							End Date
						</label>
						<input
							type="date"
							value={form.endDate ?? ""}
							min={form.date || undefined}
							onChange={(e) => f("endDate", e.target.value)}
							className={inputCls}
						/>
					</div>
				</div>
				{/* Time slots */}
				<div>
					<label className="mb-1 block text-[10px] uppercase tracking-wider text-neutral-600">
						Time Slot
					</label>
					<div className="flex items-center gap-2">
						<select
							value={form.startTime ?? ""}
							onChange={(e) => handleStartTime(e.target.value)}
							className={`flex-1 ${inputCls}`}
						>
							<option value="">Start</option>
							{TIME_OPTS.map((o) => (
								<option key={o.value} value={o.value}>
									{o.label}
								</option>
							))}
						</select>
						<span className="text-neutral-600 text-xs">→</span>
						<select
							value={form.endTime ?? ""}
							onChange={(e) => f("endTime", e.target.value)}
							disabled={!form.startTime}
							className={`flex-1 ${inputCls} disabled:opacity-40`}
						>
							<option value="">End</option>
							{TIME_OPTS.filter(
								(o) =>
									!form.startTime || o.value > form.startTime,
							).map((o) => (
								<option key={o.value} value={o.value}>
									{o.label}
								</option>
							))}
						</select>
					</div>
				</div>

				<div className="grid grid-cols-2 gap-2">
					<div>
						<label className="mb-1 block text-[10px] uppercase tracking-wider text-neutral-600">
							Assign To *
						</label>
						<select
							value={form.assignedTo}
							onChange={(e) => f("assignedTo", e.target.value)}
							className={inputCls}
						>
							<option value="">Engineer…</option>
							{engineers.map((u) => (
								<option key={u.id} value={u.id}>
									{u.name}
								</option>
							))}
						</select>
					</div>
					<div>
						<label className="mb-1 block text-[10px] uppercase tracking-wider text-neutral-600">
							Priority
						</label>
						<select
							value={form.priority}
							onChange={(e) => f("priority", e.target.value)}
							className={inputCls}
						>
							{PRIORITIES.map((p) => (
								<option key={p} value={p}>
									{p}
								</option>
							))}
						</select>
					</div>
				</div>

				{/* Recurring */}
				<div>
					<label className="mb-1.5 block text-[10px] uppercase tracking-wider text-neutral-600">
						Recurring
					</label>
					<div className="flex flex-wrap gap-1.5">
						{(
							[
								undefined,
								"annually",
								"biannually",
								"quarterly",
							] as (RepeatFrequency | undefined)[]
						).map((freq) => (
							<button
								key={freq ?? "none"}
								type="button"
								onClick={() =>
									setForm((p) => ({
										...p,
										repeatFrequency: freq,
									}))
								}
								className={`rounded-lg border px-2.5 py-1 text-xs transition-colors cursor-pointer ${form.repeatFrequency === freq ? "border-neutral-500 bg-neutral-700 text-neutral-200" : "border-neutral-700 bg-neutral-800 text-neutral-500 hover:border-neutral-600"}`}
							>
								{freq === undefined
									? "One-off"
									: freq === "annually"
										? "🔁 Annually"
										: freq === "biannually"
											? "🔁 6 months"
											: "🔁 Quarterly"}
							</button>
						))}
					</div>
				</div>

				<button
					onClick={() => {
						if (!canSubmit) return;
						onSubmit({
							...form,
							startTime: form.startTime || undefined,
							endTime: form.endTime || undefined,
							endDate:
								form.endDate && form.endDate > form.date
									? form.endDate
									: undefined,
							categoryId: form.categoryId || undefined,
							repeatFrequency: form.repeatFrequency,
						});
					}}
					disabled={!canSubmit}
					className="w-full rounded-lg py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
					style={{ background: business.accentColor }}
				>
					Create Job Sheet
				</button>
			</div>
		</div>
	);
}

// ── Day Column ────────────────────────────────────────────────────────────────

interface DayColumnProps {
	ds: string;
	jobs: Job[];
	onSlotClick: (time: string) => void;
	onJobClick: (jobId: string, rect: DOMRect) => void;
	onResizeJob: (jobId: string, startTime: string, endTime: string) => void;
	onJobPtrDown: (
		jobId: string,
		offsetY: number,
		clientX: number,
		clientY: number,
	) => void;
	dragOverSlot: { ds: string; time: string } | null;
	ptrDragJobId: string | null;
	isToday?: boolean;
	nowTime?: string;
	holidays?: Holiday[];
	workDayStart?: number;
	workDayEnd?: number;
	onEditHoliday?: (h: Holiday) => void;
	dragGhostJob?: Job | null;
	weekMode?: boolean;
	onNavigateToDay?: () => void;
}

function DayColumn({
	ds,
	jobs,
	onSlotClick,
	onJobClick,
	onResizeJob,
	onJobPtrDown,
	dragOverSlot,
	ptrDragJobId,
	isToday,
	nowTime,
	holidays = [],
	workDayStart = 7,
	workDayEnd = 17,
	onEditHoliday,
	dragGhostJob,
	weekMode,
	onNavigateToDay,
}: DayColumnProps) {
	const { users, categories, isMaster } = useApp();
	const colRef = useRef<HTMLDivElement>(null);
	const allTimedJobs = layoutTimedJobs(jobs);

	// Week-mode overflow: group overlapping jobs into clusters
	const WEEK_MAX_COLS = 3;
	const overflowCount = weekMode
		? Math.max(0, Math.max(...allTimedJobs.map((j) => j.cols), 0) - WEEK_MAX_COLS)
		: 0;
	const hasOverflow = weekMode && overflowCount > 0;

	// In week mode with overflow: cap cols at 3 and hide jobs in col >= 3
	const timedJobs = hasOverflow
		? allTimedJobs
				.filter((j) => j.col < WEEK_MAX_COLS)
				.map((j) => ({ ...j, cols: Math.min(j.cols, WEEK_MAX_COLS) }))
		: allTimedJobs;
	const hiddenJobCount = hasOverflow ? allTimedJobs.length - timedJobs.length : 0;
	const hiddenEngCount = hasOverflow
		? new Set(allTimedJobs.filter((j) => j.col >= WEEK_MAX_COLS).map((j) => j.job.assignedTo)).size
		: 0;

	// Find the vertical range of the overflow for badge positioning
	const overflowTop = hasOverflow
		? Math.min(...allTimedJobs.filter((j) => j.col >= WEEK_MAX_COLS).map((j) => j.top))
		: 0;
	const isDragOver = dragOverSlot?.ds === ds;

	// Resize state — ref so pointer handlers stay stable without re-render lag
	const resizeRef = useRef<{
		jobId: string;
		edge: "start" | "end";
		startY: number;
		origStartMins: number;
		origEndMins: number;
	} | null>(null);

	// Live overrides for smooth visual feedback during resize
	const [liveOverrides, setLiveOverrides] = useState<
		Record<string, { startTime?: string; endTime?: string }>
	>({});

	function getRelY(e: React.MouseEvent): number {
		const rect = colRef.current!.getBoundingClientRect();
		return e.clientY - rect.top;
	}

	function handleColumnClick(e: React.MouseEvent) {
		if ((e.target as HTMLElement).closest("[data-job]")) return;
		if (resizeRef.current) return;
		onSlotClick(yToTime(getRelY(e)));
	}

	return (
		<div
			ref={colRef}
			data-ds={ds}
			className="flex-1 border-r border-neutral-800 relative"
			style={{ height: TOTAL_HEIGHT, minWidth: 0, cursor: "crosshair" }}
			onClick={handleColumnClick}
		>
			{/* Hour lines */}
			{HOURS.map((_, i) => (
				<div
					key={i}
					style={{ top: i * HOUR_HEIGHT }}
					className="absolute left-0 right-0 border-t border-neutral-800/50 pointer-events-none"
				/>
			))}
			{/* Half-hour dashes */}
			{HOURS.map((_, i) => (
				<div
					key={`h${i}`}
					style={{ top: i * HOUR_HEIGHT + HOUR_HEIGHT / 2 }}
					className="absolute left-0 right-0 border-t border-dashed border-neutral-800/25 pointer-events-none"
				/>
			))}

			{/* Current time indicator */}
			{isToday &&
				nowTime &&
				nowTime >= String(HOUR_START).padStart(2, "0") + ":00" &&
				nowTime < String(HOUR_END).padStart(2, "0") + ":00" && (
					<div
						style={{
							top: timeToY(nowTime),
							position: "absolute",
							left: 0,
							right: 0,
							height: 2,
							zIndex: 10,
						}}
						className="bg-red-500 pointer-events-none"
					>
						<div className="absolute -left-1 -top-1.5 w-3 h-3 rounded-full bg-red-500" />
					</div>
				)}

			{/* Drag-over ghost */}
			{isDragOver && dragOverSlot && (() => {
				const dur = dragGhostJob?.startTime && dragGhostJob?.endTime
					? timeToMinutes(dragGhostJob.endTime) - timeToMinutes(dragGhostJob.startTime)
					: 60;
				const h = Math.max(32, (dur / 60) * HOUR_HEIGHT);
				const sc = dragGhostJob ? STATUS_COLORS[dragGhostJob.status] : null;
				return (
					<div
						style={{ top: timeToY(dragOverSlot.time), height: h }}
						className={`absolute left-1 right-1 rounded border border-dashed pointer-events-none overflow-hidden ${sc ? `${sc.bg} border-orange-500/40` : "bg-orange-500/10 border-orange-500/40"}`}
					>
						{dragGhostJob && (
							<p className={`text-[10px] font-medium px-2 pt-1 truncate opacity-60 ${sc?.text ?? "text-neutral-400"}`}>
								{dragGhostJob.customer}
							</p>
						)}
						<p className="text-[9px] font-medium text-neutral-400 px-2 pt-0.5">
							{formatTime(dragOverSlot.time)} - {formatTime(minutesToTime(timeToMinutes(dragOverSlot.time) + dur))}
						</p>
					</div>
				);
			})()}

			{/* Working hours shading */}
			{workDayStart > HOUR_START && (
				<div
					style={{ position: "absolute", top: 0, left: 0, right: 0, height: timeToY(`${String(workDayStart).padStart(2,"0")}:00`), zIndex: 0, pointerEvents: "none" }}
					className="bg-neutral-950/50"
				/>
			)}
			{workDayEnd < HOUR_END && (
				<div
					style={{ position: "absolute", top: timeToY(`${String(workDayEnd).padStart(2,"0")}:00`), left: 0, right: 0, bottom: 0, height: TOTAL_HEIGHT - timeToY(`${String(workDayEnd).padStart(2,"0")}:00`), zIndex: 0, pointerEvents: "none" }}
					className="bg-neutral-950/50"
				/>
			)}
			{/* Holiday blocks — positioned within working hours */}
			{holidays.map((h, hi) => {
				const cfg = HOLIDAY_TYPE_CONFIG[h.type];
				const u = users.find((u) => u.id === h.profileId);
				const totalHols = holidays.length;
				const w = 100 / totalHols;
				const l = (hi / totalHols) * 100;
				const wdStartStr =
					String(workDayStart).padStart(2, "0") + ":00";
				const blockTop = timeToY(wdStartStr);
				const fullHeight = (workDayEnd - workDayStart) * HOUR_HEIGHT;
				const blockHeight = h.halfDay ? fullHeight / 2 : fullHeight;
				return (
					<div
						key={h.id}
						onClick={(e) => { e.stopPropagation(); if (isMaster && onEditHoliday) onEditHoliday(h); }}
						style={{
							position: "absolute",
							top: blockTop,
							height: blockHeight,
							left: l + "%",
							width: w + "%",
							zIndex: 0,
						}}
						className={cfg.bg + " opacity-25" + (isMaster ? " cursor-pointer hover:opacity-40 transition-opacity" : " pointer-events-none")}
					>
						<div className="px-1 pt-1 flex items-center gap-0.5">
							<span className="text-[9px] opacity-70">
								{cfg.emoji} {u?.avatar}
								{h.halfDay ? " ½" : ""}
							</span>
						</div>
					</div>
				);
			})}

			{/* Timed jobs */}
			{timedJobs.map(({ job, col, cols, conflict }) => {
				const override = liveOverrides[job.id] ?? {};
				const effStart = override.startTime ?? job.startTime!;
				const effEnd =
					override.endTime ??
					job.endTime ??
					minutesToTime(timeToMinutes(job.startTime!) + 60);
				const effTop = timeToY(effStart);
				const effHeight = Math.max(
					32,
					((timeToMinutes(effEnd) - timeToMinutes(effStart)) / 60) *
						HOUR_HEIGHT,
				);
				const w = cols > 0 ? 100 / cols : 100;
				const l = cols > 0 ? (col / cols) * 100 : 0;
				const sc = STATUS_COLORS[job.status];
				const uc = userColor(job.assignedTo, users);
				const cat = categories.find((c) => c.id === job.categoryId);
				const isResizing = resizeRef.current?.jobId === job.id;

				const isDraggingThis = ptrDragJobId === job.id;
				return (
					<div
						key={job.id}
						data-job="1"
						onPointerDown={(e) => {
							if (isResizing) return;
							const rect =
								e.currentTarget.getBoundingClientRect();
							onJobPtrDown(
								job.id,
								e.clientY - rect.top,
								e.clientX,
								e.clientY,
							);
						}}
						onClick={(e) => {
							// Only handle click if NOT a drag (ptrDragJobId would be set during drag)
							if (ptrDragJobId) return;
							e.stopPropagation();
							onJobClick(
								job.id,
								e.currentTarget.getBoundingClientRect(),
							);
						}}
						style={{
							position: "absolute",
							top: effTop + 1,
							height: effHeight - 2,
							left: `calc(${l}% + 2px)`,
							width: `calc(${w}% - 4px)`,
							borderLeft: `3px solid ${uc}`,
							zIndex: isResizing ? 20 : isDraggingThis ? 20 : 1,
						}}
						className={`rounded overflow-hidden select-none ${sc.bg} ${conflict ? "ring-2 ring-red-500" : ""} ${isDraggingThis ? "opacity-40 scale-[0.97] shadow-xl ring-1 ring-white/20 transition-all duration-150" : isResizing ? "opacity-60 shadow-xl ring-1 ring-white/20" : "hover:opacity-90 transition-opacity cursor-grab"}`}
					>
						{/* ── Top resize handle (start time) ── */}
						<div
							className="resize-handle absolute top-0 left-0 right-0 h-2.5 cursor-n-resize hover:bg-white/20 transition-colors flex items-center justify-center"
							style={{ zIndex: 10 }}
							onPointerDown={(e) => {
								e.stopPropagation();
								e.currentTarget.setPointerCapture(e.pointerId);
								resizeRef.current = {
									jobId: job.id,
									edge: "start",
									startY: e.clientY,
									origStartMins: timeToMinutes(
										job.startTime!,
									),
									origEndMins: job.endTime
										? timeToMinutes(job.endTime)
										: timeToMinutes(job.startTime!) + 60,
								};
							}}
							onPointerMove={(e) => {
								const rs = resizeRef.current;
								if (
									!rs ||
									rs.jobId !== job.id ||
									rs.edge !== "start"
								)
									return;
								const dy = e.clientY - rs.startY;
								const delta =
									Math.round(((dy / HOUR_HEIGHT) * 60) / 15) *
									15;
								const newMins = Math.max(
									HOUR_START * 60,
									Math.min(
										rs.origEndMins - 30,
										rs.origStartMins + delta,
									),
								);
								setLiveOverrides((prev) => ({
									...prev,
									[job.id]: {
										...prev[job.id],
										startTime: minutesToTime(newMins),
									},
								}));
							}}
							onPointerUp={(e) => {
								const rs = resizeRef.current;
								if (!rs || rs.jobId !== job.id) return;
								const dy = e.clientY - rs.startY;
								const delta =
									Math.round(((dy / HOUR_HEIGHT) * 60) / 15) *
									15;
								const newMins = Math.max(
									HOUR_START * 60,
									Math.min(
										rs.origEndMins - 30,
										rs.origStartMins + delta,
									),
								);
								onResizeJob(
									job.id,
									minutesToTime(newMins),
									minutesToTime(rs.origEndMins),
								);
								setLiveOverrides((prev) => {
									const n = { ...prev };
									delete n[job.id];
									return n;
								});
								resizeRef.current = null;
							}}
						>
							<div className="flex gap-0.5 opacity-0 hover:opacity-40 transition-opacity pointer-events-none">
								<div className="w-0.5 h-0.5 rounded-full bg-white" />
								<div className="w-0.5 h-0.5 rounded-full bg-white" />
								<div className="w-0.5 h-0.5 rounded-full bg-white" />
							</div>
						</div>

						{/* ── Job content ── */}
						{conflict && (
							<div className="absolute top-0.5 right-0.5 text-[10px] z-10 pointer-events-none text-red-400">
								⚠
							</div>
						)}
						<div className="px-1.5 pt-2 pb-3 h-full flex flex-col overflow-hidden">
							{cat && (
								<div className="flex items-center gap-0.5 mb-0.5">
									<CategoryIcon
										name={cat.icon}
										size={9}
										color={cat.color}
									/>
								</div>
							)}
							<p
								className={`text-[10px] font-medium truncate leading-tight ${sc.text}`}
							>
								{job.repeatFrequency && (
									<span className="mr-0.5 opacity-60">
										🔁
									</span>
								)}
								{job.customer}
							</p>
							{effHeight > 40 && (
								<p className="text-[9px] text-neutral-500 truncate leading-tight mt-0.5">
									{formatTime(effStart)}
									{effEnd ? ` – ${formatTime(effEnd)}` : ""}
								</p>
							)}
							{effHeight > 60 && cat && (
								<p
									className="text-[9px] truncate leading-tight mt-0.5 opacity-80"
									style={{ color: cat.color }}
								>
									{cat.name}
								</p>
							)}
						</div>

						{/* ── Resize time tooltip ── */}
						{isResizing && liveOverrides[job.id] && (
							<div
								className="absolute left-1/2 -translate-x-1/2 bg-neutral-900 border border-neutral-600 text-[10px] text-white font-medium px-2 py-0.5 rounded shadow-lg whitespace-nowrap pointer-events-none"
								style={{
									zIndex: 25,
									...(resizeRef.current?.edge === "start"
										? { top: -24 }
										: { bottom: -24 }),
								}}
							>
								{formatTime(liveOverrides[job.id].startTime ?? effStart)}
								{" - "}
								{formatTime(liveOverrides[job.id].endTime ?? effEnd)}
							</div>
						)}

						{/* ── Bottom resize handle (end time) ── */}
						<div
							className="resize-handle absolute bottom-0 left-0 right-0 h-3.5 cursor-s-resize flex items-end justify-center pb-0.5 hover:bg-white/20 transition-colors"
							style={{ zIndex: 10 }}
							onPointerDown={(e) => {
								e.stopPropagation();
								e.currentTarget.setPointerCapture(e.pointerId);
								resizeRef.current = {
									jobId: job.id,
									edge: "end",
									startY: e.clientY,
									origStartMins: timeToMinutes(
										job.startTime!,
									),
									origEndMins: job.endTime
										? timeToMinutes(job.endTime)
										: timeToMinutes(job.startTime!) + 60,
								};
							}}
							onPointerMove={(e) => {
								const rs = resizeRef.current;
								if (
									!rs ||
									rs.jobId !== job.id ||
									rs.edge !== "end"
								)
									return;
								const dy = e.clientY - rs.startY;
								const delta =
									Math.round(((dy / HOUR_HEIGHT) * 60) / 15) *
									15;
								const newMins = Math.max(
									rs.origStartMins + 30,
									Math.min(
										HOUR_END * 60,
										rs.origEndMins + delta,
									),
								);
								setLiveOverrides((prev) => ({
									...prev,
									[job.id]: {
										...prev[job.id],
										endTime: minutesToTime(newMins),
									},
								}));
							}}
							onPointerUp={(e) => {
								const rs = resizeRef.current;
								if (!rs || rs.jobId !== job.id) return;
								const dy = e.clientY - rs.startY;
								const delta =
									Math.round(((dy / HOUR_HEIGHT) * 60) / 15) *
									15;
								const newMins = Math.max(
									rs.origStartMins + 30,
									Math.min(
										HOUR_END * 60,
										rs.origEndMins + delta,
									),
								);
								onResizeJob(
									job.id,
									minutesToTime(rs.origStartMins),
									minutesToTime(newMins),
								);
								setLiveOverrides((prev) => {
									const n = { ...prev };
									delete n[job.id];
									return n;
								});
								resizeRef.current = null;
							}}
						>
							{/* Grip dots */}
							<div className="flex gap-0.5">
								{[0, 1, 2].map((i) => (
									<div
										key={i}
										className="w-1 h-1 rounded-full bg-current opacity-25"
									/>
								))}
							</div>
						</div>
					</div>
				);
			})}

			{/* Week-mode overflow badge */}
			{hasOverflow && hiddenJobCount > 0 && (
				<div
					style={{
						position: "absolute",
						top: overflowTop,
						right: 2,
						zIndex: 15,
					}}
					onClick={(e) => {
						e.stopPropagation();
						onNavigateToDay?.();
					}}
					className="rounded-lg bg-neutral-800/95 border border-neutral-600 px-2 py-1.5 cursor-pointer hover:bg-neutral-700 transition-colors shadow-lg"
				>
					<p className="text-[10px] font-medium text-neutral-200 whitespace-nowrap">
						+{hiddenJobCount} more
					</p>
					<p className="text-[8px] text-neutral-500 whitespace-nowrap">
						{hiddenEngCount} eng · tap for day view
					</p>
				</div>
			)}
		</div>
	);
}

// ── Main CalendarPage ─────────────────────────────────────────────────────────

export function CalendarPage() {
	const {
		isMaster,
		jobs,
		myJobs,
		users,
		categories,
		holidays,
		createJob,
		rescheduleJob,
		resizeJobTime,
		createHoliday,
		deleteHoliday,
		updateHoliday,
		business,
	} = useApp();
	const navigate = useNavigate();

	const [calDate, setCalDate] = useState(new Date());
	const [view, setView] = useState<CalView>(
		() => (localStorage.getItem("calView") as CalView) ?? "week",
	);

	// Filters
	const [filterEngineers, setFilterEngineers] = useState<string[]>([]);
	const [filterCategories, setFilterCategories] = useState<string[]>([]);
	const [showHolidays, setShowHolidays] = useState(true);
	const [showAllDay, setShowAllDay] = useState(true);
	const [showFilters, setShowFilters] = useState(false);

	// Tips
	const [showTips, setShowTips] = useState(
		() => localStorage.getItem("calTipsDismissed") !== "1",
	);
	function dismissTips() {
		localStorage.setItem("calTipsDismissed", "1");
		setShowTips(false);
	}

	// Add job panel
	const [panelOpen, setPanelOpen] = useState(false);
	const [panelPrefill, setPanelPrefill] = useState<Partial<NewJobForm>>({});

	// Undo toast state
	const [undoAction, setUndoAction] = useState<{
		jobId: string;
		description: string;
		prevDate: string;
		prevStartTime?: string;
		prevEndTime?: string;
		prevAssignedTo?: string;
	} | null>(null);
	const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	function showUndoToast(action: NonNullable<typeof undoAction>) {
		if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
		setUndoAction(action);
		undoTimerRef.current = setTimeout(() => setUndoAction(null), 5000);
	}
	function handleUndo() {
		if (!undoAction) return;
		rescheduleJob(
			undoAction.jobId,
			undoAction.prevDate,
			undoAction.prevStartTime,
			undoAction.prevEndTime,
			undoAction.prevAssignedTo,
		);
		if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
		setUndoAction(null);
	}

	// Drag state — lives in CalendarPage so it survives TimeGridView re-mounts
	const [dragOverSlot, setDragOverSlot] = useState<{
		ds: string;
		time: string;
	} | null>(null);
	const [ptrGhost, setPtrGhost] = useState<{
		job: Job;
		x: number;
		y: number;
	} | null>(null);
	const ptrDragRef = useRef<{
		jobId: string;
		offsetY: number;
		startX: number;
		startY: number;
		hasDragged: boolean;
		startTime: number;
		colRects: Array<{
			ds: string;
			engineerId?: string;
			left: number;
			right: number;
			top: number;
		}>;
	} | null>(null);
	const gridBodyRef = useRef<HTMLDivElement>(null);
	const dragAutoScrollRef = useRef<{ rafId: number; cursorY: number } | null>(null);
	// Current time for the time indicator
	const [nowTime, setNowTime] = useState<string>(() => {
		const n = new Date();
		return (
			String(n.getHours()).padStart(2, "0") +
			":" +
			String(n.getMinutes()).padStart(2, "0")
		);
	});
	useEffect(() => {
		const interval = setInterval(() => {
			const n = new Date();
			setNowTime(
				String(n.getHours()).padStart(2, "0") +
					":" +
					String(n.getMinutes()).padStart(2, "0"),
			);
		}, 60000);
		return () => clearInterval(interval);
	}, []);

	// Job popover
	const [jobPopover, setJobPopover] = useState<{
		jobId: string;
		rect: DOMRect;
	} | null>(null);

	// Keep a ref to jobs so document listeners never close over stale state
	const jobsRef = useRef(jobs);
	useEffect(() => {
		jobsRef.current = jobs;
	}, [jobs]);

	/** Read column rects fresh from the DOM each time — avoids stale positions after scroll. */
	function readColRects() {
		const cols = Array.from(
			gridBodyRef.current?.querySelectorAll("[data-ds]") ?? [],
		);
		return cols.map((col) => {
			const r = col.getBoundingClientRect();
			return {
				ds: col.getAttribute("data-ds")!,
				engineerId: col.getAttribute("data-engineer-id") ?? undefined,
				left: r.left,
				right: r.right,
				top: r.top,
			};
		});
	}

	function startPtrDrag(
		jobId: string,
		offsetY: number,
		clientX: number,
		clientY: number,
	) {
		ptrDragRef.current = {
			jobId,
			offsetY,
			startX: clientX,
			startY: clientY,
			hasDragged: false,
			colRects: readColRects(),
			startTime: Date.now(),
		};

		function onMove(e: MouseEvent) {
			const pd = ptrDragRef.current;
			if (!pd) {
				cleanup();
				return;
			}
			const dx = Math.abs(e.clientX - pd.startX);
			const dy = Math.abs(e.clientY - pd.startY);
			if (dx < 8 && dy < 8) return;
			if (!pd.hasDragged) {
				pd.hasDragged = true;
				const job = jobsRef.current.find((j) => j.id === pd.jobId);
				if (job) setPtrGhost({ job, x: e.clientX, y: e.clientY });
			} else {
				setPtrGhost((prev) =>
					prev ? { ...prev, x: e.clientX, y: e.clientY } : null,
				);
			}

			// Re-read column rects each move so they stay accurate after scroll
			const colRects = readColRects();
			pd.colRects = colRects;

			const targetCol = colRects.find(
				(c) => e.clientX >= c.left && e.clientX <= c.right,
			);
			if (targetCol) {
				const scrollTop = gridScrollRef.current?.scrollTop ?? 0;
				setDragOverSlot({
					ds: targetCol.ds,
					time: yToTime(
						e.clientY - targetCol.top + scrollTop - pd.offsetY,
					),
				});
			} else {
				setDragOverSlot(null);
			}

			// Auto-scroll when dragging near edges of the grid scroll container
			if (pd.hasDragged && gridScrollRef.current) {
				const rect = gridScrollRef.current.getBoundingClientRect();
				const EDGE = 60;
				const distTop = e.clientY - rect.top;
				const distBottom = rect.bottom - e.clientY;
				if (distTop < EDGE || distBottom < EDGE) {
					dragAutoScrollRef.current = { rafId: 0, cursorY: e.clientY };
					const scrollLoop = () => {
						const el = gridScrollRef.current;
						const das = dragAutoScrollRef.current;
						if (!el || !das) return;
						const r = el.getBoundingClientRect();
						const dTop = das.cursorY - r.top;
						const dBot = r.bottom - das.cursorY;
						if (dTop < EDGE) {
							el.scrollTop -= Math.max(1, ((EDGE - dTop) / EDGE) * 8);
						} else if (dBot < EDGE) {
							el.scrollTop += Math.max(1, ((EDGE - dBot) / EDGE) * 8);
						} else {
							dragAutoScrollRef.current = null;
							return;
						}
						das.rafId = requestAnimationFrame(scrollLoop);
					};
					dragAutoScrollRef.current.rafId = requestAnimationFrame(scrollLoop);
				} else if (dragAutoScrollRef.current) {
					cancelAnimationFrame(dragAutoScrollRef.current.rafId);
					dragAutoScrollRef.current = null;
				}
			}
		}

		function onUp(e: MouseEvent) {
			cleanup();
			const pd = ptrDragRef.current;
			if (!pd) return;
			if (pd.hasDragged) {
				const colRects = readColRects();
				const targetCol = colRects.find(
					(c) => e.clientX >= c.left && e.clientX <= c.right,
				);
				if (targetCol) {
					const scrollTop = gridScrollRef.current?.scrollTop ?? 0;
					const time = yToTime(
						e.clientY - targetCol.top + scrollTop - pd.offsetY,
					);
					const job = jobsRef.current.find((j) => j.id === pd.jobId);
					const dur =
						job?.startTime && job?.endTime
							? timeToMinutes(job.endTime) -
								timeToMinutes(job.startTime)
							: 60;
					const newEngineer =
						targetCol.engineerId &&
						targetCol.engineerId !== job?.assignedTo
							? targetCol.engineerId
							: undefined;
					if (job) {
						showUndoToast({
							jobId: pd.jobId,
							description: `Job moved to ${formatTime(time)}`,
							prevDate: job.date,
							prevStartTime: job.startTime,
							prevEndTime: job.endTime,
							prevAssignedTo: job.assignedTo,
						});
					}
					rescheduleJob(
						pd.jobId,
						targetCol.ds,
						time,
						minutesToTime(timeToMinutes(time) + dur),
						newEngineer,
					);
				}
			}
			ptrDragRef.current = null;
			setPtrGhost(null);
			setDragOverSlot(null);
		}

		function cleanup() {
			document.removeEventListener("mousemove", onMove);
			document.removeEventListener("mouseup", onUp);
			if (dragAutoScrollRef.current) {
				cancelAnimationFrame(dragAutoScrollRef.current.rafId);
				dragAutoScrollRef.current = null;
			}
		}

		document.addEventListener("mousemove", onMove);
		document.addEventListener("mouseup", onUp);
	}

	function onJobPtrDown(
		jobId: string,
		offsetY: number,
		clientX: number,
		clientY: number,
	) {
		startPtrDrag(jobId, offsetY, clientX, clientY);
	}

	/** Called from UnscheduledPanel — offsetY is 0 since the card isn't in the time grid. */
	function onUnscheduledPtrDown(
		jobId: string,
		clientX: number,
		clientY: number,
	) {
		startPtrDrag(jobId, 0, clientX, clientY);
	}

	// Holiday modal
	const [holidayModal, setHolidayModal] = useState<{
		date: string;
		profileId: string;
		editId?: string;
	} | null>(null);
	const [holidayLabel, setHolidayLabel] = useState("Holiday");
	const [holidayHalf, setHolidayHalf] = useState(false);
	const [holidayType, setHolidayType] = useState<HolidayType>("holiday");
	const [holidayEndDate, setHolidayEndDate] = useState("");

	const year = calDate.getFullYear();
	const month = calDate.getMonth();

	function setViewPersisted(v: CalView) {
		localStorage.setItem("calView", v);
		setView(v);
	}

	const allVisible = isMaster ? jobs : myJobs;
	const visible = useMemo(() => {
		return allVisible.filter((j) => {
			if (
				filterEngineers.length > 0 &&
				!filterEngineers.includes(j.assignedTo)
			)
				return false;
			if (
				filterCategories.length > 0 &&
				(!j.categoryId || !filterCategories.includes(j.categoryId))
			)
				return false;
			return true;
		});
	}, [allVisible, filterEngineers, filterCategories]);

	const byDate = useMemo(() => {
		const m: Record<string, Job[]> = {};
		visible.forEach((j) => {
			const start = new Date(j.date + "T00:00:00");
			const end = j.endDate ? new Date(j.endDate + "T00:00:00") : start;
			for (
				let d = new Date(start);
				d <= end;
				d.setDate(d.getDate() + 1)
			) {
				const ds = d.toISOString().slice(0, 10);
				if (!m[ds]) m[ds] = [];
				m[ds].push(j);
			}
		});
		return m;
	}, [visible]);

	const holidaysByDate = useMemo(() => {
		const m: Record<string, typeof holidays> = {};
		holidays.filter((h) => h.status === "approved").forEach((h) => {
			// Expand multi-day holidays across all dates in the range
			const start = new Date(h.date);
			const end = h.endDate ? new Date(h.endDate) : start;
			for (
				let d = new Date(start);
				d <= end;
				d.setDate(d.getDate() + 1)
			) {
				const ds = d.toISOString().slice(0, 10);
				if (!m[ds]) m[ds] = [];
				m[ds].push(h);
			}
		});
		return m;
	}, [holidays]);

	function visibleHolidaysForDate(ds: string) {
		if (!showHolidays) return [];
		const hols = holidaysByDate[ds] ?? [];
		if (filterEngineers.length === 0) return hols;
		return hols.filter((h) => filterEngineers.includes(h.profileId));
	}

	function prevPeriod() {
		const d = new Date(calDate);
		if (view === "month") setCalDate(new Date(year, month - 1, 1));
		else if (view === "week") {
			d.setDate(d.getDate() - 7);
			setCalDate(d);
		} else {
			d.setDate(d.getDate() - 1);
			setCalDate(d);
		}
	}
	function nextPeriod() {
		const d = new Date(calDate);
		if (view === "month") setCalDate(new Date(year, month + 1, 1));
		else if (view === "week") {
			d.setDate(d.getDate() + 7);
			setCalDate(d);
		} else {
			d.setDate(d.getDate() + 1);
			setCalDate(d);
		}
	}

	// UK Bank Holidays lookup (covers current year ± 1)
	const bankHols = useMemo(
		() => bankHolidayMap([year - 1, year, year + 1]),
		[year],
	);

	const weekStart = getWeekStart(calDate);
	const weekDays = weekDaysFrom(weekStart, 7);

	const viewLabel =
		view === "month"
			? calDate.toLocaleString("en-GB", {
					month: "long",
					year: "numeric",
				})
			: view === "week"
				? `${weekStart.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${weekDays[6].date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`
				: calDate.toLocaleDateString("en-GB", {
						weekday: "long",
						day: "numeric",
						month: "long",
						year: "numeric",
					});

	const gridScrollRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		if (gridScrollRef.current && (view === "week" || view === "day")) {
			const now = new Date();
			const currentMins = now.getHours() * 60 + now.getMinutes();
			const scrollTarget = ((currentMins - HOUR_START * 60) / 60) * HOUR_HEIGHT;
			const viewH = gridScrollRef.current.clientHeight;
			gridScrollRef.current.scrollTop = Math.max(0, scrollTarget - viewH / 3);
		}
	}, [view]);

	const shortcutHandlers = useMemo(() => ({
		goToday: () => setCalDate(new Date()),
		setView: setViewPersisted,
		prevPeriod,
		nextPeriod,
		openNewJob: () => openAddPanel({ date: TODAY }),
		closeOverlay: () => {
			if (jobPopover) setJobPopover(null);
			else if (panelOpen) closePanel();
		},
	}), [jobPopover, panelOpen]);
	useCalendarShortcuts(shortcutHandlers);

	function preserveScroll(fn: () => void) {
		const saved = gridScrollRef.current?.scrollTop ?? 0;
		fn();
		requestAnimationFrame(() => {
			if (gridScrollRef.current) gridScrollRef.current.scrollTop = saved;
		});
	}

	function openAddPanel(prefill: Partial<NewJobForm>) {
		preserveScroll(() => {
			setPanelPrefill(prefill);
			setPanelOpen(true);
		});
	}

	function closePanel() {
		preserveScroll(() => setPanelOpen(false));
	}

	function handleAddHoliday() {
		if (!holidayModal) return;
		const payload = {
			profileId: holidayModal.profileId,
			date: holidayModal.date,
			endDate:
				holidayEndDate && holidayEndDate > holidayModal.date
					? holidayEndDate
					: undefined,
			halfDay: holidayHalf,
			label: holidayLabel,
			type: holidayType,
		};
		if (holidayModal.editId) {
			updateHoliday(holidayModal.editId, payload);
		} else {
			createHoliday(payload);
		}
		setHolidayModal(null);
		setHolidayLabel("Holiday");
		setHolidayHalf(false);
		setHolidayType("holiday");
		setHolidayEndDate("");
	}

	function openEditHoliday(h: Holiday) {
		setHolidayModal({ date: h.date, profileId: h.profileId, editId: h.id });
		setHolidayLabel(h.label);
		setHolidayHalf(h.halfDay);
		setHolidayType(h.type);
		setHolidayEndDate(h.endDate ?? "");
	}

	const engineers = users.filter((u) => u.role === "engineer");

	// ── Month view ────────────────────────────────────────────────────────────

	// ── Job Popover ─────────────────────────────────────────────────────

	function JobPopover({
		jobId,
		rect,
		onClose,
	}: {
		jobId: string;
		rect: DOMRect;
		onClose: () => void;
	}) {
		const { changeStatus } = useApp();
		const job = jobs.find((j) => j.id === jobId);
		if (!job) return null;
		const engineer = users.find((u) => u.id === job.assignedTo);
		const cat = categories.find((c) => c.id === job.categoryId);
		const sc = STATUS_COLORS[job.status];
		const POPOVER_W = 280;
		const isMobile = window.innerWidth < 640;
		let left: number, top: number;
		if (isMobile) {
			left = Math.max(8, (window.innerWidth - POPOVER_W) / 2);
			top = Math.max(60, Math.min(rect.top, window.innerHeight - 440));
		} else {
			const spaceRight = window.innerWidth - rect.right;
			left = spaceRight >= POPOVER_W + 16 ? rect.right + 8 : Math.max(8, rect.left - POPOVER_W - 8);
			top = Math.min(rect.top, window.innerHeight - 400);
		}
		return (
			<>
				{/* Backdrop */}
				<div className="fixed inset-0 z-[998]" onClick={onClose} />
				{/* Popover */}
				<div
					className="fixed z-[999] w-[280px] rounded-xl border border-neutral-700 bg-neutral-900 shadow-2xl overflow-hidden"
					style={{ left, top }}
				>
					<div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-neutral-800">
						<span className="text-xs font-mono text-neutral-400">
							{job.ref}
						</span>
						<button
							onClick={onClose}
							className="text-neutral-500 hover:text-neutral-300 cursor-pointer border-0 bg-transparent text-lg leading-none"
						>
							×
						</button>
					</div>
					<div className="px-4 py-3 space-y-2">
						<p className="text-sm font-semibold text-neutral-100">
							{job.customer}
						</p>
						{job.phone && (
							<p className="text-xs text-neutral-400">
								{job.phone}
							</p>
						)}
						{job.address && (
							<p className="text-xs text-neutral-500 truncate">
								{job.address}
							</p>
						)}
						<div className="flex items-center gap-2 flex-wrap">
							<span
								className={`inline-block rounded px-2 py-0.5 text-[10px] font-medium ${sc.bg} ${sc.text}`}
							>
								{job.status}
							</span>
							<span className="text-[10px] text-neutral-500">
								{job.priority}
							</span>
						</div>
						{(job.startTime || job.endTime) && (
							<p className="text-xs text-neutral-400">
								{job.startTime && formatTime(job.startTime)}
								{job.endTime && ` – ${formatTime(job.endTime)}`}
							</p>
						)}
						{engineer && (
							<p className="text-xs text-neutral-400">
								Engineer: {engineer.name}
							</p>
						)}
						{cat && (
							<div className="flex items-center gap-1">
								<CategoryIcon
									name={cat.icon}
									size={10}
									color={cat.color}
								/>
								<span
									className="text-[10px]"
									style={{ color: cat.color }}
								>
									{cat.name}
								</span>
							</div>
						)}
					</div>
					<div className="px-4 pb-2">
						<p className="text-[9px] uppercase tracking-wider text-neutral-600 mb-1.5">Status</p>
						<div className="flex flex-wrap gap-1">
							{(["Scheduled","En Route","On Site","Completed","Invoiced"] as const).map((s) => {
								const isCurrent = job.status === s;
								const sc = STATUS_COLORS[s];
								return (
									<button
										key={s}
										onClick={() => { changeStatus(job.id, s); }}
										className={`rounded px-2 py-1 text-[10px] font-medium cursor-pointer transition-opacity hover:opacity-80 ${sc.bg} ${sc.text} ${isCurrent ? "ring-1 ring-white/40" : "opacity-60"}`}
									>
										{s}
									</button>
								);
							})}
						</div>
					</div>
					<div className="px-4 pb-3">
						<button
							onClick={() => {
								onClose();
								navigate(`/job/${jobId}`);
							}}
							className="w-full rounded-lg py-2 text-xs font-medium text-white cursor-pointer hover:opacity-90 transition-opacity"
							style={{ background: business.accentColor }}
						>
							View Full Details →
						</button>
					</div>
				</div>
			</>
		);
	}

	function MonthView() {
		const rawFirst = new Date(year, month, 1).getDay();
		const offset = rawFirst === 0 ? 6 : rawFirst - 1;
		const daysInMonth = new Date(year, month + 1, 0).getDate();
		const total = Math.ceil((offset + daysInMonth) / 7) * 7;
		const cells = Array.from({ length: total }, (_, i) => {
			const d = i - offset + 1;
			if (d < 1 || d > daysInMonth) return null;
			const ds = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
			return { d, ds, dayJobs: byDate[ds] ?? [] };
		});

		return (
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
					const hols = visibleHolidaysForDate(cell.ds);
					const bankHol = bankHols[cell.ds];

					return (
						<div
							key={i}
							onClick={() => {
								setCalDate(new Date(cell.ds + "T00:00:00"));
								setViewPersisted("day");
							}}
							className={`min-h-[88px] rounded-lg border p-1.5 cursor-pointer transition-colors ${
								isToday
									? "border-orange-700/50 bg-orange-950/30 hover:border-orange-600/60"
									: bankHol
										? "border-emerald-800/40 bg-emerald-950/20 hover:border-emerald-700/50"
										: "border-neutral-800 bg-neutral-900 hover:border-neutral-700"
							}`}
						>
							<div className="flex items-center justify-between mb-1">
								<span
									className={`text-xs ${isToday ? "font-bold text-orange-400" : "text-neutral-600"}`}
								>
									{cell.d}
								</span>
								{hols.length > 0 && (
									<div className="flex gap-0.5">
										{hols.slice(0, 3).map((h) => {
											const cfg =
												HOLIDAY_TYPE_CONFIG[h.type];
											return (
												<span
													key={h.id}
													title={`${users.find((u) => u.id === h.profileId)?.name} – ${cfg.label}`}
												>
													{cfg.emoji}
												</span>
											);
										})}
									</div>
								)}
							</div>
							{bankHol && (
								<p className="text-[9px] text-emerald-400/80 truncate mb-0.5" title={bankHol}>
									🏦 {bankHol}
								</p>
							)}
							<div className="flex flex-col gap-0.5">
								{cell.dayJobs.slice(0, 3).map((j) => {
									const sc = STATUS_COLORS[j.status];
									const uc = userColor(j.assignedTo, users);
									const cat = categories.find(
										(c) => c.id === j.categoryId,
									);
									return (
										<div
											key={j.id}
											onClick={(e) => {
												e.stopPropagation();
												setJobPopover({
													jobId: j.id,
													rect: e.currentTarget.getBoundingClientRect(),
												});
											}}
											className={`rounded px-1 py-0.5 text-[10px] ${sc.bg} overflow-hidden`}
											style={{
												borderLeft: `3px solid ${uc}`,
											}}
										>
											<div className="flex items-center gap-1">
												{cat && (
													<CategoryIcon
														name={cat.icon}
														size={8}
														color={cat.color}
													/>
												)}
												<span
													className={`${sc.text} block truncate`}
												>
													{j.startTime
														? `${formatTime(j.startTime)} `
														: ""}
													{j.customer}
												</span>
											</div>
										</div>
									);
								})}
								{cell.dayJobs.length > 3 && (
									<div className="pl-1 text-[10px] text-neutral-500">
										+{cell.dayJobs.length - 3} more
									</div>
								)}
								{cell.dayJobs.length > 0 && (
									<div className="mt-0.5 text-[9px] text-neutral-600">
										{cell.dayJobs.length} job{cell.dayJobs.length !== 1 ? "s" : ""}·{new Set(cell.dayJobs.map((j) => j.assignedTo)).size} eng
									</div>
								)}
							</div>
						</div>
					);
				})}
			</div>
		);
	}


	// ── Day view (per-engineer columns) ────────────────────────────────

	function DayView() {
		const ds = calDate.toISOString().slice(0, 10);
		const dayJobs = byDate[ds] ?? [];
		const dayHols = visibleHolidaysForDate(ds);

		const shownIds =
			filterEngineers.length > 0
				? filterEngineers
				: [
						...new Set([
							...dayJobs.map((j) => j.assignedTo),
							...dayHols.map((h) => h.profileId),
						]),
				  ];
		const showList =
			shownIds.length > 0
				? engineers.filter((e) => shownIds.includes(e.id))
				: engineers;

		const COL_W = 220;
		const GUTTER_W = 56;
		const wds = `${String(business.workDayStart).padStart(2, "0")}:00`;
		const totalW = showList.length * COL_W + GUTTER_W;

		const dayBankHol = bankHols[ds];

		return (
			<>
			{dayBankHol && (
				<div className="flex items-center gap-2 rounded-lg border border-emerald-800/40 bg-emerald-950/20 px-3 py-2 mb-3">
					<span className="text-base">🏦</span>
					<span className="text-sm text-emerald-400">{dayBankHol}</span>
					<span className="text-xs text-emerald-600">— UK Bank Holiday</span>
				</div>
			)}
			{/* Single scroll container handles both axes — no nested overflow-hidden */}
			<div
				ref={gridScrollRef}
				className="w-full border border-neutral-800 rounded-xl overflow-auto"
				style={{ maxHeight: "calc(100svh - 220px)", minHeight: 300 }}
			>
				{/* Min-width wrapper forces horizontal scroll when needed */}
				<div style={{ minWidth: totalW }}>
					{/* Engineer name headers — sticky top */}
					<div
						className="flex sticky top-0 z-10 border-b border-neutral-800"
						style={{ backdropFilter: "blur(8px)", background: "rgba(10,10,10,0.92)" }}
					>
						{/* Top-left corner — sticky left so it stays over time gutter */}
						<div
							style={{ width: GUTTER_W, flexShrink: 0, position: "sticky", left: 0, zIndex: 6, background: "#0a0a0a" }}
							className="border-r border-neutral-800"
						/>
						{showList.map((eng) => {
							const uc = userColor(eng.id, users);
							const engHols = dayHols.filter((h) => h.profileId === eng.id);
							const engJobCount = dayJobs.filter((j) => j.assignedTo === eng.id).length;
							const workMins = (business.workDayEnd - business.workDayStart) * 60;
							const bookedMins = dayJobs
								.filter((j) => j.assignedTo === eng.id && j.startTime && j.endTime)
								.reduce((s, j) => s + timeToMinutes(j.endTime!) - timeToMinutes(j.startTime!), 0);
							const pct = workMins > 0 ? Math.min(100, Math.round((bookedMins / workMins) * 100)) : 0;
							const barColor = pct >= 90 ? "bg-red-500" : pct >= 60 ? "bg-amber-500" : "bg-green-500";
							return (
								<div
									key={eng.id}
									style={{ width: COL_W, flexShrink: 0, borderTop: `3px solid ${uc}` }}
									className="border-l border-neutral-800 px-3 py-2"
								>
									<div className="flex items-center gap-2">
										<div
											className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white"
											style={{ background: uc }}
										>
											{eng.name.charAt(0)}
										</div>
										<span className="text-sm font-medium text-neutral-200 truncate">{eng.name}</span>
									</div>
									<div className="mt-1 flex items-center gap-2 flex-wrap">
										{engJobCount > 0 && (
											<span className="text-[10px] text-neutral-500">
												{engJobCount} job{engJobCount !== 1 ? "s" : ""}
											</span>
										)}
										{pct > 0 && (
											<div className="flex items-center gap-1">
												<div className="w-12 h-1 rounded-full bg-neutral-700">
													<div className={`h-1 rounded-full ${barColor}`} style={{ width: pct + "%" }} />
												</div>
												<span className="text-[9px] text-neutral-600">{Math.round((bookedMins / 60) * 10) / 10}h</span>
											</div>
										)}
										{engHols.map((h) => (
											<span key={h.id} className={`text-[10px] ${HOLIDAY_TYPE_CONFIG[h.type].text}`}>
												{HOLIDAY_TYPE_CONFIG[h.type].emoji} {HOLIDAY_TYPE_CONFIG[h.type].label}{h.halfDay ? " (½day)" : ""}
											</span>
										))}
									</div>
								</div>
							);
						})}
					</div>

					{/* Grid body */}
					<div
						ref={gridBodyRef}
						className="flex"
						style={{ height: TOTAL_HEIGHT }}
					>
						{/* Time gutter — sticky left */}
						<div
							style={{
								width: GUTTER_W,
								flexShrink: 0,
								position: "sticky",
								left: 0,
								zIndex: 5,
								background: "#0a0a0a",
								height: TOTAL_HEIGHT,
							}}
							className="border-r border-neutral-800 relative"
						>
							{HOURS.map((h, i) => (
								<div
									key={h}
									style={{ position: "absolute", top: i * HOUR_HEIGHT - 8, right: 8 }}
									className="text-[10px] text-neutral-600 select-none"
								>
									{formatHour(h)}
								</div>
							))}
							{/* Current time indicator */}
							{ds === TODAY && (
								<div
									style={{ position: "absolute", top: timeToY(nowTime), left: 0, right: 0, zIndex: 10 }}
									className="flex items-center pointer-events-none"
								>
									<div className="w-2 h-2 rounded-full bg-orange-500 -ml-1 flex-shrink-0" />
								</div>
							)}
						</div>

						{/* Per-engineer columns */}
						{showList.map((eng) => {
							const uc = userColor(eng.id, users);
							const engJobs = dayJobs.filter((j) => j.assignedTo === eng.id);
							const engHols = dayHols.filter((h) => h.profileId === eng.id);
							const layout = layoutTimedJobs(engJobs);
							const untimedJobs = engJobs.filter((j) => !j.startTime);
							return (
								<div
									key={eng.id}
									data-ds={ds}
									data-engineer-id={eng.id}
									style={{ width: COL_W, flexShrink: 0, position: "relative", height: TOTAL_HEIGHT, cursor: "crosshair" }}
									className="border-r border-neutral-800"
									onClick={(e) => {
										const rect = e.currentTarget.getBoundingClientRect();
										const scrollTop = gridScrollRef.current?.scrollTop ?? 0;
										const time = yToTime(e.clientY - rect.top + scrollTop);
										openAddPanel({
											date: ds,
											assignedTo: eng.id,
											startTime: time,
											endTime: minutesToTime(timeToMinutes(time) + 60),
										});
									}}
								>
									{HOURS.map((h, i) => (
										<div
											key={h}
											style={{ position: "absolute", top: i * HOUR_HEIGHT, left: 0, right: 0 }}
											className="border-t border-neutral-800/50"
										/>
									))}
									{/* Current time line across column */}
									{ds === TODAY && (
										<div
											style={{ position: "absolute", top: timeToY(nowTime), left: 0, right: 0, height: 1, zIndex: 10 }}
											className="bg-orange-500/60 pointer-events-none"
										/>
									)}
									{/* Working hours shading */}
									{business.workDayStart > HOUR_START && (
										<div style={{ position: "absolute", top: 0, left: 0, right: 0, height: timeToY(wds), zIndex: 0, pointerEvents: "none" }} className="bg-neutral-950/50" />
									)}
									{business.workDayEnd < HOUR_END && (
										<div style={{ position: "absolute", top: timeToY(`${String(business.workDayEnd).padStart(2,"0")}:00`), left: 0, right: 0, height: TOTAL_HEIGHT - timeToY(`${String(business.workDayEnd).padStart(2,"0")}:00`), zIndex: 0, pointerEvents: "none" }} className="bg-neutral-950/50" />
									)}
									{engHols.map((h) => {
										const cfg = HOLIDAY_TYPE_CONFIG[h.type];
										const blockTop = timeToY(wds);
										const fullH = (business.workDayEnd - business.workDayStart) * HOUR_HEIGHT;
										const blockH = h.halfDay ? fullH / 2 : fullH;
										return (
											<div
												key={h.id}
												style={{ position: "absolute", top: blockTop, left: 0, right: 0, height: blockH, zIndex: 1 }}
												className={`${cfg.bg} opacity-70 flex items-center justify-center`}
												onClick={(e) => { e.stopPropagation(); if (isMaster) openEditHoliday(h); }}
											>
												<span className={`text-xs ${cfg.text}`}>
													{cfg.emoji} {cfg.label}{h.halfDay ? " (½day)" : ""}
												</span>
											</div>
										);
									})}
									{untimedJobs.length > 0 && (
										<div style={{ position: "absolute", top: 4, left: 4, right: 4, zIndex: 3 }}>
											{untimedJobs.map((j) => {
												const sc = STATUS_COLORS[j.status];
												const jcat = categories.find((c) => c.id === j.categoryId);
												return (
													<div
														key={j.id}
														className={`rounded px-1.5 py-0.5 text-[10px] mb-0.5 cursor-pointer hover:opacity-90 ${sc.bg} ${sc.text} flex items-center justify-between gap-1`}
														style={{ borderLeft: `2px solid ${uc}` }}
														onClick={(e) => {
															e.stopPropagation();
															setJobPopover({ jobId: j.id, rect: e.currentTarget.getBoundingClientRect() });
														}}
													>
														<span className="truncate">{j.customer}</span>
														{jcat && <CategoryIcon name={jcat.icon} size={8} color={jcat.color} />}
													</div>
												);
											})}
										</div>
									)}
									{layout.map(({ job, col, cols, top, height, conflict }) => {
										const sc = STATUS_COLORS[job.status];
										const cat = categories.find((c) => c.id === job.categoryId);
										const w = cols > 0 ? 100 / cols : 100;
										const l = cols > 0 ? (col / cols) * 100 : 0;
										return (
											<div
												key={job.id}
												style={{
													position: "absolute",
													top,
													left: `${l}%`,
													width: `${w}%`,
													height,
													zIndex: 2,
													borderLeft: `3px solid ${uc}`,
												}}
												className={`rounded overflow-hidden select-none ${sc.bg} ${conflict ? "ring-2 ring-red-500" : ""} hover:opacity-90 transition-opacity cursor-grab`}
												onPointerDown={(e) => { const r = e.currentTarget.getBoundingClientRect(); onJobPtrDown(job.id, e.clientY - r.top, e.clientX, e.clientY); }}
												onClick={(e) => {
													e.stopPropagation();
													setJobPopover({ jobId: job.id, rect: e.currentTarget.getBoundingClientRect() });
												}}
											>
												<p className={`text-[10px] font-medium px-1.5 pt-1 truncate ${sc.text}`}>
													{job.customer}
												</p>
												{(job.startTime || job.endTime) && (
													<p className="text-[9px] text-neutral-400 px-1.5 pb-0.5">
														{job.startTime && formatTime(job.startTime)}
														{job.endTime && ` – ${formatTime(job.endTime)}`}
													</p>
												)}
												{cat && (
													<div className="px-1.5">
														<CategoryIcon name={cat.icon} size={8} color={cat.color} />
													</div>
												)}
											</div>
										);
									})}
								</div>
							);
						})}
					</div>
				</div>
			</div>
		</>
		);
	}

	// ── Time-grid view (week / day) ───────────────────────────────────────────

	function TimeGridView({ days }: { days: { date: Date; ds: string }[] }) {
		return (
			<>
				<div className="w-full flex flex-col border border-neutral-800 rounded-xl overflow-hidden">
					{/* Day headers */}
					<div
						className="flex flex-shrink-0 border-b border-neutral-800 bg-neutral-900/80 sticky top-0 z-10"
						style={{ backdropFilter: "blur(8px)" }}
					>
						<div className="w-14 flex-shrink-0 border-r border-neutral-800" />
						{days.map(({ date, ds }) => {
							const isToday = ds === TODAY;
							return (
								<div
									key={ds}
									className={`flex-1 border-r border-neutral-800 px-2 py-2 text-center cursor-pointer hover:bg-neutral-800/50 transition-colors ${isToday ? "bg-orange-950/20" : ""}`}
									onClick={() => { setCalDate(date); setViewPersisted("day"); }}
								>
									<p
										className={`text-[10px] uppercase tracking-widest ${isToday ? "text-orange-400" : "text-neutral-500"}`}
									>
										{date.toLocaleDateString("en-GB", {
											weekday: "short",
										})}
									</p>
									<div
										className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-medium ${isToday ? "bg-orange-500 text-white" : "text-neutral-300"}`}
									>
										{date.getDate()}
									</div>
									{bankHols[ds] && (
										<p className="text-[8px] text-emerald-400/80 truncate leading-tight mt-0.5" title={bankHols[ds]}>
											🏦 {bankHols[ds]}
										</p>
									)}
									{(() => {
										const workMinutes =
											(business.workDayEnd -
												business.workDayStart) *
											60;
										const bookedMins = (byDate[ds] ?? [])
											.filter(
												(j) => j.startTime && j.endTime,
											)
											.reduce(
												(sum, j) =>
													sum +
													timeToMinutes(j.endTime!) -
													timeToMinutes(j.startTime!),
												0,
											);
										const pct = Math.min(
											100,
											Math.round(
												(bookedMins / workMinutes) *
													100,
											),
										);
										if (pct === 0) return null;
										const barColor =
											pct >= 90
												? "bg-red-500"
												: pct >= 60
													? "bg-amber-500"
													: "bg-green-500";
										return (
											<div className="mt-1 px-1 w-full">
												<div className="h-1 rounded-full bg-neutral-700 w-full">
													<div
														className={`h-1 rounded-full ${barColor}`}
														style={{
															width: pct + "%",
														}}
													/>
												</div>
												<p className="text-[9px] text-neutral-600 mt-0.5">
													{Math.round(
														(bookedMins / 60) * 10,
													) / 10}
													h
												</p>
											</div>
										);
									})()}
									{isMaster && (
										<button
											onClick={(e) => {
												e.stopPropagation();
												setHolidayModal({
													date: ds,
													profileId:
														filterEngineers[0] ??
														engineers[0]?.id ??
														"",
												});
												setHolidayEndDate(ds);
											}}
											className="mt-0.5 text-[9px] text-neutral-700 hover:text-neutral-400 cursor-pointer border-0 bg-transparent block w-full"
										>
											+ leave
										</button>
									)}
								</div>
							);
						})}
					</div>

					{/* All-day strip */}
					{showAllDay && (
						<div className="flex flex-shrink-0 border-b border-neutral-800 min-h-[32px]">
							<div className="w-14 flex-shrink-0 border-r border-neutral-800 flex items-center justify-end pr-2">
								<span className="text-[9px] text-neutral-700 uppercase tracking-wider">
									All day
								</span>
							</div>
							{days.map(({ date, ds }) => {
								const untimedJobs = (byDate[ds] ?? []).filter(
									(j) => !j.startTime,
								);
								const MAX_ALLDAY = 3;
								const alldayOverflow = untimedJobs.length - MAX_ALLDAY;
								return (
									<div
										key={ds}
										className="flex-1 border-r border-neutral-800 p-0.5 flex flex-col gap-0.5 cursor-crosshair"
										onClick={() =>
											openAddPanel({ date: ds })
										}
									>
										{untimedJobs.slice(0, MAX_ALLDAY).map((j) => {
											const sc = STATUS_COLORS[j.status];
											const uc = userColor(
												j.assignedTo,
												users,
											);
											const cat = categories.find(
												(c) => c.id === j.categoryId,
											);
											return (
												<div
													key={j.id}
													onClick={(e) => {
														e.stopPropagation();
														navigate(
															`/job/${j.id}`,
														);
													}}
													className={`rounded px-1.5 py-0.5 text-[10px] cursor-pointer ${sc.bg} truncate`}
													style={{
														borderLeft: `2px solid ${uc}`,
													}}
												>
													{cat && (
														<CategoryIcon
															name={cat.icon}
															size={8}
															color={cat.color}
														/>
													)}{" "}
													<span className={sc.text}>
														{j.customer}
													</span>
												</div>
											);
										})}
										{alldayOverflow > 0 && (
											<div
												className="pl-1 text-[10px] text-neutral-500 cursor-pointer hover:text-neutral-300"
												onClick={(e) => {
													e.stopPropagation();
													setCalDate(date);
													setViewPersisted("day");
												}}
											>
												+{alldayOverflow} more
											</div>
										)}
									</div>
								);
							})}
						</div>
					)}

					{/* Scrollable time grid */}
					<div
						ref={gridScrollRef}
						className="overflow-y-auto"
						style={{
							maxHeight: "calc(100svh - 280px)",
							minHeight: 300,
						}}
					>
						<div
							ref={gridBodyRef}
							className="flex"
							style={{ height: TOTAL_HEIGHT }}
						>
							{/* Time gutter */}
							<div
								className="w-14 flex-shrink-0 border-r border-neutral-800 relative flex-shrink-0"
								style={{ height: TOTAL_HEIGHT }}
							>
								{HOURS.map((h, i) => (
									<div
										key={h}
										style={{
											position: "absolute",
											top: i * HOUR_HEIGHT - 8,
											right: 8,
										}}
										className="text-[10px] text-neutral-600 select-none"
									>
										{formatHour(h)}
									</div>
								))}
							</div>

							{/* Day columns */}
							{days.map(({ ds }) => (
								<DayColumn
									key={ds}
									ds={ds}
									jobs={byDate[ds] ?? []}
									onSlotClick={(time) =>
										openAddPanel({
											date: ds,
											startTime: time,
											endTime: minutesToTime(
												timeToMinutes(time) + 60,
											),
										})
									}
									onJobClick={(id, rect) =>
										setJobPopover({ jobId: id, rect })
									}
									onResizeJob={(jobId, startTime, endTime) => {
										const job = jobs.find((j) => j.id === jobId);
										if (job) {
											showUndoToast({
												jobId,
												description: `Job resized to ${formatTime(startTime)} - ${formatTime(endTime)}`,
												prevDate: job.date,
												prevStartTime: job.startTime,
												prevEndTime: job.endTime,
												prevAssignedTo: job.assignedTo,
											});
										}
										resizeJobTime(jobId, startTime, endTime);
									}}
									onJobPtrDown={onJobPtrDown}
									dragOverSlot={dragOverSlot}
									ptrDragJobId={ptrGhost?.job.id ?? null}
									isToday={ds === TODAY}
									nowTime={nowTime}
									holidays={visibleHolidaysForDate(ds)}
									workDayStart={business.workDayStart}
									workDayEnd={business.workDayEnd}
								onEditHoliday={openEditHoliday}
									dragGhostJob={ptrGhost?.job ?? null}
									weekMode={true}
									onNavigateToDay={() => {
										setCalDate(new Date(ds + "T00:00:00"));
										setViewPersisted("day");
									}}
								/>
							))}
						</div>
					</div>
				</div>

				{/* Drag ghost */}
			</>
		);
	}

	// ── Render ────────────────────────────────────────────────────────────────

	const activeFilterCount =
		filterEngineers.length +
		filterCategories.length +
		(!showHolidays ? 1 : 0);

	return (
		<>
			<div className="p-5 md:p-7 flex flex-col gap-4 max-w-[1400px] w-full overflow-x-hidden">
				{/* Header */}
				<div className="flex items-start justify-between gap-4 flex-wrap">
					<div>
						<h1 className="text-2xl font-normal text-neutral-100 tracking-tight">
							Calendar
						</h1>
						<p className="mt-0.5 text-sm text-neutral-600">
							{viewLabel}
						</p>
					</div>
					<div className="flex items-center gap-2 flex-wrap">
						{isMaster && (
							<button
								onClick={() => setShowFilters((v) => !v)}
								className={`relative rounded-lg border px-3 py-2 text-sm transition-colors cursor-pointer ${showFilters || activeFilterCount > 0 ? "border-orange-600 bg-orange-950/30 text-orange-400" : "border-neutral-700 bg-neutral-800 text-neutral-300 hover:border-neutral-600"}`}
							>
								Filters
								{activeFilterCount > 0 && (
									<span className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-[9px] font-bold text-white">
										{activeFilterCount}
									</span>
								)}
							</button>
						)}

						<button
							onClick={() => openAddPanel({ date: TODAY })}
							className="rounded-lg px-4 py-2 text-sm font-medium text-white cursor-pointer hover:opacity-90 transition-opacity"
							style={{ background: business.accentColor }}
						>
							+ New Job
						</button>

						<div className="flex rounded-lg border border-neutral-700 overflow-hidden text-sm">
							{(
								[
									{ v: "day" as CalView, label: "Day" },
									{ v: "week" as CalView, label: "Week" },
									{ v: "month" as CalView, label: "Month" },
								] as const
							).map(({ v, label }) => (
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
								className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-300 hover:border-neutral-600 cursor-pointer"
							>
								‹
							</button>
							<button
								onClick={() => setCalDate(new Date())}
								className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-300 hover:border-neutral-600 cursor-pointer"
							>
								Today
							</button>
							<button
								onClick={nextPeriod}
								className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-300 hover:border-neutral-600 cursor-pointer"
							>
								›
							</button>
						</div>
					</div>
				</div>

				{/* Filter Panel */}
				{showFilters && isMaster && (
					<div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 flex flex-wrap gap-5">
						<div>
							<p className="mb-2 text-[10px] uppercase tracking-wider text-neutral-600">
								Team Members
							</p>
							<div className="flex flex-wrap gap-2">
								{engineers.map((u) => {
									const uc = userColor(u.id, users);
									const active = filterEngineers.includes(
										u.id,
									);
									return (
										<button
											key={u.id}
											onClick={() =>
												setFilterEngineers((prev) =>
													prev.includes(u.id)
														? prev.filter(
																(x) =>
																	x !== u.id,
															)
														: [...prev, u.id],
												)
											}
											className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors cursor-pointer"
											style={{
												borderColor: active
													? uc
													: "#404040",
												background: active
													? uc + "22"
													: "transparent",
												color: active ? uc : "#6b7280",
											}}
										>
											<div
												className="w-2 h-2 rounded-full"
												style={{ background: uc }}
											/>
											{u.name}
										</button>
									);
								})}
							</div>
						</div>

						{categories.length > 0 && (
							<div>
								<p className="mb-2 text-[10px] uppercase tracking-wider text-neutral-600">
									Categories
								</p>
								<div className="flex flex-wrap gap-2">
									{categories.map((cat) => {
										const active =
											filterCategories.includes(cat.id);
										return (
											<button
												key={cat.id}
												onClick={() =>
													setFilterCategories(
														(prev) =>
															prev.includes(
																cat.id,
															)
																? prev.filter(
																		(x) =>
																			x !==
																			cat.id,
																	)
																: [
																		...prev,
																		cat.id,
																	],
													)
												}
												className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors cursor-pointer"
												style={{
													borderColor: active
														? cat.color
														: "#404040",
													background: active
														? cat.color + "22"
														: "transparent",
													color: active
														? cat.color
														: "#6b7280",
												}}
											>
												<CategoryIcon
													name={cat.icon}
													size={11}
													color={
														active
															? cat.color
															: "#6b7280"
													}
												/>
												{cat.name}
											</button>
										);
									})}
								</div>
							</div>
						)}

						<div>
							<p className="mb-2 text-[10px] uppercase tracking-wider text-neutral-600">
								Show / Hide
							</p>
							<div className="flex flex-wrap gap-2">
								{[
									{
										label: "Leave & Holidays",
										val: showHolidays,
										set: setShowHolidays,
									},
									{
										label: "All-day strip",
										val: showAllDay,
										set: setShowAllDay,
									},
								].map(({ label, val, set }) => (
									<button
										key={label}
										onClick={() => set((v) => !v)}
										className={`rounded-lg border px-2.5 py-1.5 text-xs transition-colors cursor-pointer ${val ? "border-neutral-500 bg-neutral-700 text-neutral-200" : "border-neutral-700 text-neutral-600"}`}
									>
										{val ? "✓ " : ""}
										{label}
									</button>
								))}
							</div>
						</div>

						{activeFilterCount > 0 && (
							<div className="flex items-end">
								<button
									onClick={() => {
										setFilterEngineers([]);
										setFilterCategories([]);
										setShowHolidays(true);
										setShowAllDay(true);
									}}
									className="rounded-lg border border-red-900 bg-red-950/30 px-3 py-1.5 text-xs text-red-400 hover:border-red-800 cursor-pointer transition-colors"
								>
									Clear all
								</button>
							</div>
						)}
					</div>
				)}

				{/* Starter tips */}
				{showTips && (
					<div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
						<div className="flex items-start justify-between gap-3 mb-3">
							<p className="text-xs font-medium uppercase tracking-wider text-neutral-500">
								Quick tips
							</p>
							<button
								onClick={dismissTips}
								className="text-neutral-600 hover:text-neutral-400 transition-colors text-lg leading-none bg-transparent border-0 cursor-pointer flex-shrink-0 -mt-0.5"
								aria-label="Dismiss tips"
							>
								×
							</button>
						</div>
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
							{(isMaster
								? [
										{
											icon: "➕",
											title: "Add a job",
											body: 'Click "+ New Job" or tap any empty slot on the calendar to schedule a job.',
										},
										{
											icon: "↕️",
											title: "Drag to reschedule",
											body: "Hold and drag a job chip to move it to a different time slot or engineer.",
										},
										{
											icon: "⚡",
											title: "Quick status",
											body: "Click a job chip to open a popover with quick status-change buttons.",
										},
										{
											icon: "📋",
											title: "Unscheduled jobs",
											body: "Jobs with no time slot appear in the panel above — drag them onto the grid.",
										},
									]
								: [
										{
											icon: "📅",
											title: "Your schedule",
											body: "This calendar shows all jobs assigned to the team. Your jobs are highlighted.",
										},
										{
											icon: "📍",
											title: "My Day",
											body: 'Use "My Day" in the sidebar for just your jobs today in one place.',
										},
										{
											icon: "⚡",
											title: "Update status",
											body: "Click a job chip to quickly update its status — En Route, On Site, Completed.",
										},
										{
											icon: "🔍",
											title: "Job details",
											body: "Click the job title in the popover to open the full job sheet.",
										},
									]
							).map((tip) => (
								<div
									key={tip.title}
									className="flex gap-2.5 rounded-lg border border-neutral-800 bg-neutral-900 p-3"
								>
									<span className="text-base flex-shrink-0 mt-0.5">{tip.icon}</span>
									<div>
										<p className="text-xs font-medium text-neutral-300 mb-0.5">
											{tip.title}
										</p>
										<p className="text-xs text-neutral-600 leading-relaxed">
											{tip.body}
										</p>
									</div>
								</div>
							))}
						</div>
					</div>
				)}

				{/* Unscheduled jobs panel */}
				<UnscheduledPanel
					jobs={isMaster ? jobs : myJobs}
					categories={categories}
					onSchedule={rescheduleJob}
					accentColor={business.accentColor}
					workDayStart={business.workDayStart}
					workDayEnd={business.workDayEnd}
					onPointerDragStart={onUnscheduledPtrDown}
				/>

				{/* Engineer legend */}
				{(view === "week" || view === "day") &&
					filterEngineers.length === 0 &&
					isMaster && (
						<div className="flex flex-wrap gap-4">
							{engineers.map((u) => (
								<div
									key={u.id}
									className="flex items-center gap-1.5 text-xs text-neutral-400 cursor-pointer hover:text-neutral-200 transition-colors"
									onClick={() =>
										setFilterEngineers((prev) =>
											prev.includes(u.id)
												? prev.filter((x) => x !== u.id)
												: [...prev, u.id],
										)
									}
								>
									<div
										className="h-2.5 w-2.5 rounded-full"
										style={{
											background: userColor(u.id, users),
										}}
									/>
									{u.name}
								</div>
							))}
						</div>
					)}

				{/* Calendar views */}
				<div key={`${view}-${calDate.toISOString().slice(0, 10)}`} className="cal-view-enter">
					{view === "month" && <MonthView />}
					{view === "week" && <TimeGridView days={weekDays} />}
					{view === "day" && <DayView />}
				</div>
				
				{/* Holiday / Leave modal */}
				{holidayModal && isMaster && (
					<div
						className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
						onClick={() => setHolidayModal(null)}
					>
						<div
							className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-sm p-6 shadow-2xl"
							onClick={(e) => e.stopPropagation()}
						>
							<h3 className="text-base font-medium text-neutral-100 mb-4">
								{holidayModal?.editId ? "Edit Leave / Absence" : "Add Leave / Absence"}
							</h3>
							<div className="space-y-3">
								{/* Type selector */}
								<div>
									<label className="mb-2 block text-[10px] uppercase tracking-wider text-neutral-600">
										Type
									</label>
									<div className="grid grid-cols-2 gap-2">
										{(
											Object.entries(
												HOLIDAY_TYPE_CONFIG,
											) as [
												HolidayType,
												(typeof HOLIDAY_TYPE_CONFIG)[HolidayType],
											][]
										).map(([type, cfg]) => (
											<button
												key={type}
												type="button"
												onClick={() =>
													setHolidayType(type)
												}
												className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer transition-colors ${holidayType === type ? `${cfg.bg} ${cfg.text} border-current` : "border-neutral-700 text-neutral-500 hover:border-neutral-600"}`}
											>
												<span>{cfg.emoji}</span>
												<span>{cfg.label}</span>
											</button>
										))}
									</div>
								</div>

								<div>
									<label className="mb-1 block text-[10px] uppercase tracking-wider text-neutral-600">
										Team Member
									</label>
									<select
										value={holidayModal.profileId}
										onChange={(e) =>
											setHolidayModal((m) =>
												m
													? {
															...m,
															profileId:
																e.target.value,
														}
													: null,
											)
										}
										className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 outline-none"
									>
										{engineers.map((u) => (
											<option key={u.id} value={u.id}>
												{u.name}
											</option>
										))}
									</select>
								</div>

								<div>
									<label className="mb-1 block text-[10px] uppercase tracking-wider text-neutral-600">
										Date
									</label>
									<input
										type="date"
										value={holidayModal.date}
										onChange={(e) =>
											setHolidayModal((m) =>
												m
													? {
															...m,
															date: e.target
																.value,
														}
													: null,
											)
										}
										className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 outline-none"
									/>
								</div>

								<div>
									<label className="mb-1 block text-[10px] uppercase tracking-wider text-neutral-600">
										End Date
									</label>
									<input
										type="date"
										value={holidayEndDate}
										min={holidayModal?.date}
										onChange={(e) =>
											setHolidayEndDate(e.target.value)
										}
										className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 outline-none"
									/>
									<p className="mt-1 text-[10px] text-neutral-600">
										Leave same as start for a single day
									</p>
								</div>

								<div>
									<label className="mb-1 block text-[10px] uppercase tracking-wider text-neutral-600">
										Note (optional)
									</label>
									<input
										type="text"
										value={holidayLabel}
										onChange={(e) =>
											setHolidayLabel(e.target.value)
										}
										placeholder="e.g. Annual leave, Dentist…"
										className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 outline-none"
									/>
								</div>

								<label className="flex items-center gap-2 cursor-pointer">
									<input
										type="checkbox"
										checked={holidayHalf}
										onChange={(e) =>
											setHolidayHalf(e.target.checked)
										}
										className="accent-orange-500"
									/>
									<span className="text-sm text-neutral-400">
										Half day
									</span>
								</label>
							</div>

							<div className="flex gap-2 mt-5">
								<button
									onClick={handleAddHoliday}
									className="flex-1 rounded-lg py-2.5 text-sm font-medium text-white cursor-pointer hover:opacity-90 transition-opacity"
									style={{ background: business.accentColor }}
								>
									Save
								</button>
								{holidayModal?.editId && (
									<button
										onClick={() => { deleteHoliday(holidayModal!.editId!); setHolidayModal(null); }}
										className="rounded-lg border border-red-800 bg-red-950 px-4 py-2.5 text-sm text-red-400 cursor-pointer hover:bg-red-900 transition-colors"
									>
										Delete
									</button>
								)}
								<button
									onClick={() => setHolidayModal(null)}
									className="rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2.5 text-sm text-neutral-300 cursor-pointer"
								>
									Cancel
								</button>
							</div>
						</div>
					</div>
				)}
			</div>

			{/* Desktop Add Job Panel - fixed right sidebar */}
			{panelOpen && (
				<div className="hidden md:flex flex-col fixed right-0 top-0 bottom-0 w-[392px] bg-neutral-950 border-l border-neutral-800 z-40">
					<AddJobPanel
						prefill={panelPrefill}
						onClose={closePanel}
						onSubmit={(form) => {
							createJob(form);
							closePanel();
						}}
					/>
				</div>
			)}

			{/* Mobile Add Job Panel - fixed bottom modal */}
			{panelOpen && (
				<div
					className="md:hidden fixed inset-0 z-50 flex items-end bg-black/70"
					onClick={closePanel}
				>
					<div
						className="w-full max-h-[92vh] bg-neutral-950 border-t border-neutral-800 rounded-t-2xl flex flex-col overflow-hidden"
						onClick={(e) => e.stopPropagation()}
					>
						<AddJobPanel
							prefill={panelPrefill}
							onClose={closePanel}
							onSubmit={(form) => {
								createJob(form);
								closePanel();
							}}
						/>
					</div>
				</div>
			)}

			{/* Drag ghost — fixed position, follows cursor globally */}
			{ptrGhost &&
				(() => {
					const sc = STATUS_COLORS[ptrGhost.job.status];
					const uc = userColor(ptrGhost.job.assignedTo, users);
					return (
						<div
							className={`fixed pointer-events-none z-[9999] rounded ${sc.bg}`}
							style={{
								left: ptrGhost.x + 8,
								top: ptrGhost.y + 8,
								width: 140,
								minHeight: 44,
								borderLeft: `3px solid ${uc}`,
								transform: "scale(1.04) rotate(1deg)",
								boxShadow: "0 12px 36px rgba(0,0,0,0.4), 0 4px 12px rgba(0,0,0,0.3)",
								opacity: 0.9,
								transition: "left 60ms ease-out, top 60ms ease-out, transform 150ms ease-out, box-shadow 150ms ease-out",
							}}
						>
							<p
								className={`text-[10px] font-medium px-2 pt-1.5 pb-1 truncate ${sc.text}`}
							>
								{ptrGhost.job.customer}
							</p>
							{dragOverSlot ? (
								<p className="text-[9px] font-medium text-white bg-neutral-800 border border-neutral-600 rounded px-1.5 py-0.5 mx-1.5 mb-1 whitespace-nowrap w-fit">
									{formatTime(dragOverSlot.time)}
									{" - "}
									{formatTime(
										minutesToTime(
											timeToMinutes(dragOverSlot.time) +
												(ptrGhost.job.startTime && ptrGhost.job.endTime
													? timeToMinutes(ptrGhost.job.endTime) - timeToMinutes(ptrGhost.job.startTime)
													: 60),
										),
									)}
								</p>
							) : ptrGhost.job.startTime ? (
								<p className="text-[9px] text-neutral-400 px-2 pb-1">
									{formatTime(ptrGhost.job.startTime)}
								</p>
							) : null}
						</div>
					);
				})()}
			{/* Undo toast */}
			{undoAction && (
				<div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9998] bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 shadow-2xl flex items-center gap-3 text-sm text-neutral-200">
					<span>{undoAction.description}</span>
					<button
						onClick={handleUndo}
						className="text-orange-400 font-medium hover:text-orange-300 transition-colors whitespace-nowrap"
					>
						Undo
					</button>
					<button
						onClick={() => {
							if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
							setUndoAction(null);
						}}
						className="text-neutral-500 hover:text-neutral-300 transition-colors ml-1"
					>
						✕
					</button>
				</div>
			)}

			{/* Job Popover */}
			{jobPopover && (
				<JobPopover
					jobId={jobPopover.jobId}
					rect={jobPopover.rect}
					onClose={() => setJobPopover(null)}
				/>
			)}
		</>
	);
}
