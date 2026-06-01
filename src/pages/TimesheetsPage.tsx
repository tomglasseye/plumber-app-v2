import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../AppContext";
import { TODAY, fmtDate, userColor } from "../data";
import { geocodeAddress, haversine } from "../utils/geo";
import type { Job } from "../types";

const KM_TO_MILES = 0.621371;

type View = "day" | "week" | "month";

function timeToMinutes(t: string): number {
	const [h, m] = t.split(":").map(Number);
	return h * 60 + m;
}

// Hours worked for a job: prefer the engineer's logged time, else fall back to
// the scheduled start→end duration. (WIP definition — surfaced in the UI.)
function jobHours(j: Job): number {
	if (j.timeSpent && j.timeSpent > 0) return j.timeSpent;
	if (j.startTime && j.endTime) {
		const d = timeToMinutes(j.endTime) - timeToMinutes(j.startTime);
		return d > 0 ? d / 60 : 0;
	}
	return 0;
}

const byStartTime = (a: Job, b: Job) =>
	(a.startTime ?? "99:99").localeCompare(b.startTime ?? "99:99");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// The list of ISO days the selected view covers, plus a human label.
function computeRange(view: View, anchor: string): { days: string[]; label: string } {
	const [y, m, d] = anchor.split("-").map(Number);
	const base = new Date(y, m - 1, d);

	if (view === "day") {
		return {
			days: [anchor],
			label: base.toLocaleDateString("en-GB", {
				weekday: "long",
				day: "numeric",
				month: "long",
			}),
		};
	}

	if (view === "week") {
		const dow = (base.getDay() + 6) % 7; // 0 = Monday
		const start = new Date(base);
		start.setDate(base.getDate() - dow);
		const days: string[] = [];
		for (let i = 0; i < 7; i++) {
			const x = new Date(start);
			x.setDate(start.getDate() + i);
			days.push(fmtDate(x));
		}
		const end = new Date(start);
		end.setDate(start.getDate() + 6);
		const label = `${start.toLocaleDateString("en-GB", {
			day: "numeric",
			month: "short",
		})} – ${end.toLocaleDateString("en-GB", {
			day: "numeric",
			month: "short",
			year: "numeric",
		})}`;
		return { days, label };
	}

	// month
	const last = new Date(y, m, 0).getDate();
	const days: string[] = [];
	for (let i = 1; i <= last; i++) days.push(fmtDate(new Date(y, m - 1, i)));
	const label = base.toLocaleDateString("en-GB", {
		month: "long",
		year: "numeric",
	});
	return { days, label };
}

type EngMiles = { miles: number; located: number; total: number };

export function TimesheetsPage() {
	const { jobs, users, business } = useApp();
	const [view, setView] = useState<View>("day");
	const [anchor, setAnchor] = useState(TODAY);

	const engineers = useMemo(
		() => users.filter((u) => u.role === "engineer"),
		[users],
	);

	const { days, label } = useMemo(
		() => computeRange(view, anchor),
		[view, anchor],
	);
	const daysKey = days.join(",");
	const daySet = useMemo(() => new Set(days), [daysKey]); // eslint-disable-line react-hooks/exhaustive-deps

	// Per engineer: all in-range jobs (for hours) + grouped by date (for miles,
	// which must reset each day — engineers go home, no overnight leg).
	const engData = useMemo(() => {
		const out: Record<string, { all: Job[]; byDate: Record<string, Job[]> }> =
			{};
		for (const eng of engineers) {
			const all = jobs.filter(
				(j) => j.assignedTo === eng.id && j.date && daySet.has(j.date),
			);
			const byDate: Record<string, Job[]> = {};
			for (const j of all) (byDate[j.date as string] ??= []).push(j);
			for (const k in byDate) byDate[k].sort(byStartTime);
			out[eng.id] = { all, byDate };
		}
		return out;
	}, [engineers, jobs, daySet]);

	// ── Miles (async, straight-line, summed per day across the range) ──
	const cacheRef = useRef(new Map<string, [number, number]>());
	const [milesResult, setMilesResult] = useState<{
		key: string;
		byEng: Record<string, EngMiles>;
	}>({ key: "", byEng: {} });

	useEffect(() => {
		let cancelled = false;
		(async () => {
			await Promise.resolve();
			const byEng: Record<string, EngMiles> = {};
			for (const eng of engineers) {
				const { byDate } = engData[eng.id];
				let km = 0;
				let located = 0;
				let total = 0;
				for (const dateKey of days) {
					const stops = (byDate[dateKey] ?? []).filter((j) => j.address);
					total += stops.length;
					let prev: [number, number] | null = null;
					for (const j of stops) {
						const hit = cacheRef.current.has(j.address);
						const c = await geocodeAddress(j.address, cacheRef.current);
						if (cancelled) return;
						// Respect Nominatim's ~1 req/s policy on cache misses only.
						if (!hit) {
							await sleep(1100);
							if (cancelled) return;
						}
						if (c) {
							located++;
							if (prev)
								km += haversine(prev[0], prev[1], c[0], c[1]);
							prev = c;
						}
					}
				}
				byEng[eng.id] = { miles: km * KM_TO_MILES, located, total };
			}
			if (!cancelled) setMilesResult({ key: daysKey, byEng });
		})();
		return () => {
			cancelled = true;
		};
	}, [daysKey, days, engineers, engData]);

	const milesReady = milesResult.key === daysKey;

	// ── Navigation ──
	function shift(delta: number) {
		const [y, m, d] = anchor.split("-").map(Number);
		const dt = new Date(y, m - 1, d);
		if (view === "day") dt.setDate(dt.getDate() + delta);
		else if (view === "week") dt.setDate(dt.getDate() + delta * 7);
		else dt.setMonth(dt.getMonth() + delta);
		setAnchor(fmtDate(dt));
	}

	// ── Totals ──
	const totalHours = engineers.reduce(
		(sum, eng) =>
			sum + engData[eng.id].all.reduce((s, j) => s + jobHours(j), 0),
		0,
	);
	const totalMiles = milesReady
		? engineers.reduce(
				(sum, eng) => sum + (milesResult.byEng[eng.id]?.miles ?? 0),
				0,
			)
		: 0;
	const activeEngineers = engineers.filter(
		(eng) => engData[eng.id].all.length > 0,
	).length;

	const unit = view === "day" ? "day" : view === "week" ? "week" : "month";

	return (
		<div className="p-6 md:p-8 max-w-5xl">
			{/* Header */}
			<div className="mb-4 flex items-start justify-between gap-4 flex-wrap">
				<div>
					<div className="flex items-center gap-2">
						<h1 className="text-2xl font-normal text-neutral-100 tracking-tight">
							Timesheets
						</h1>
						<span className="rounded-full border border-amber-700/40 bg-amber-950/30 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-400">
							WIP
						</span>
					</div>
					<p className="mt-1 text-sm text-neutral-600">
						Hours worked and miles travelled per engineer, per {unit}
					</p>
				</div>

				{/* View toggle */}
				<div className="inline-flex rounded-lg border border-neutral-800 bg-neutral-900 p-0.5">
					{(["day", "week", "month"] as const).map((v) => (
						<button
							key={v}
							onClick={() => setView(v)}
							className={`rounded-md px-3 py-1.5 text-sm capitalize transition-colors ${
								view === v
									? "text-white"
									: "text-neutral-400 hover:text-neutral-200"
							}`}
							style={
								view === v
									? { backgroundColor: business.accentColor }
									: undefined
							}
						>
							{v}
						</button>
					))}
				</div>
			</div>

			{/* Period picker */}
			<div className="mb-6 flex items-center gap-2">
				<button
					onClick={() => shift(-1)}
					className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800"
				>
					‹
				</button>
				<span className="min-w-[14rem] text-center text-sm text-neutral-200">
					{label}
				</span>
				<button
					onClick={() => shift(1)}
					className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800"
				>
					›
				</button>
				{!daySet.has(TODAY) && (
					<button
						onClick={() => setAnchor(TODAY)}
						className="ml-1 rounded-lg px-3 py-1.5 text-sm font-medium text-white"
						style={{ backgroundColor: business.accentColor }}
					>
						Today
					</button>
				)}
			</div>

			{/* Totals */}
			<div className="mb-6 grid grid-cols-3 gap-4">
				{[
					{ label: "Total Hours", value: totalHours.toFixed(1), emoji: "⏱️" },
					{
						label: "Total Miles (est.)",
						value: milesReady ? totalMiles.toFixed(1) : "…",
						emoji: "🚐",
					},
					{ label: "Engineers Working", value: activeEngineers, emoji: "👷" },
				].map((card) => (
					<div
						key={card.label}
						className="rounded-xl border border-neutral-800 bg-neutral-900 px-5 py-4"
					>
						<div className="mb-1 flex items-center gap-2">
							<span className="text-base">{card.emoji}</span>
							<p className="text-[11px] text-neutral-500">{card.label}</p>
						</div>
						<p className="text-2xl font-bold text-neutral-200">
							{card.value}
						</p>
					</div>
				))}
			</div>

			{/* Per-engineer rows */}
			<section>
				<h2 className="mb-3 text-sm uppercase tracking-wider text-neutral-400">
					By Engineer
				</h2>
				{engineers.length === 0 ? (
					<p className="text-sm text-neutral-600">No engineers yet.</p>
				) : (
					<div className="space-y-2">
						{engineers.map((eng) => {
							const all = engData[eng.id].all;
							const hours = all.reduce((s, j) => s + jobHours(j), 0);
							const mi = milesReady
								? milesResult.byEng[eng.id]
								: undefined;
							const accent = userColor(eng.id, users);
							return (
								<div
									key={eng.id}
									className="flex items-center gap-4 rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3"
								>
									<div
										className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-medium"
										style={{
											background: accent + "22",
											border: `1px solid ${accent}44`,
											color: accent,
										}}
									>
										{eng.avatar}
									</div>
									<div className="min-w-0 flex-1">
										<p className="truncate text-sm font-medium text-neutral-100">
											{eng.name}
										</p>
										<p className="text-xs text-neutral-600">
											{all.length} job
											{all.length === 1 ? "" : "s"}
										</p>
									</div>
									<div className="text-right">
										<p className="text-lg font-bold text-neutral-200">
											{hours.toFixed(1)}h
										</p>
										<p className="text-[10px] text-neutral-600">
											hours
										</p>
									</div>
									<div className="w-24 text-right">
										{all.length === 0 ? (
											<p className="text-lg font-bold text-neutral-700">
												—
											</p>
										) : !milesReady ? (
											<p className="text-sm text-neutral-600">
												calculating…
											</p>
										) : (
											<>
												<p
													className="text-lg font-bold"
													style={{ color: accent }}
												>
													{mi?.miles.toFixed(1) ?? "0.0"}
												</p>
												<p className="text-[10px] text-neutral-600">
													mi est.
													{mi && mi.located < mi.total
														? ` · ${mi.located}/${mi.total} located`
														: ""}
												</p>
											</>
										)}
									</div>
								</div>
							);
						})}
					</div>
				)}
			</section>

			{/* Method note */}
			<p className="mt-6 text-xs leading-relaxed text-neutral-600">
				<strong className="text-neutral-500">How this is worked out (WIP):</strong>{" "}
				Hours use each job's logged time, falling back to the scheduled
				start→end duration. Miles are a <em>straight-line</em> estimate
				between consecutive jobs (geocoded from the job address), summed per
				day across the period — not road distance, and no home↔job legs.
				Addresses that can't be located are skipped. Driving miles and stored
				coordinates can come later.
			</p>
		</div>
	);
}
