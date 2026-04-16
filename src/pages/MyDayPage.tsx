import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../AppContext";
import {
	mapsRouteUrl,
	PRIORITIES,
	PRIORITY_COLORS,
	PRIORITY_ORDER,
	STATUS_COLORS,
	TODAY,
} from "../data";
import { haversine, geocodeAddress } from "../utils/geo";
import type { Job, Status } from "../types";

/* ── Status flow (engineer stops at Completed, never Invoiced) ──────── */
const NEXT_STATUS: Partial<Record<Status, Status>> = {
	Scheduled: "En Route",
	"En Route": "On Site",
	"On Site": "Completed",
};

function fmtTime12(t: string): string {
	const [h, m] = t.split(":").map(Number);
	const ampm = h < 12 ? "am" : "pm";
	const dh = h === 0 ? 12 : h > 12 ? h - 12 : h;
	return `${dh}:${String(m).padStart(2, "0")}${ampm}`;
}

const DONE_STATUSES = ["Completed", "Invoiced"];

export function MyDayPage() {
	const {
		currentUser,
		jobs,
		categories,
		changeStatus,
		updateJob,
		addNotification,
	} = useApp();
	const navigate = useNavigate();

	const [activeStop, setActiveStop] = useState<string | null>(null);
	const [gpsStart, setGpsStart] = useState<string | null>(null);
	const [gpsLoading, setGpsLoading] = useState(false);
	const [gpsError, setGpsError] = useState<string | null>(null);

	// Phase 2: local notes state for auto-save on blur
	const [draftNotes, setDraftNotes] = useState<Record<string, string>>({});

	// Phase 4: available jobs
	const [availExpanded, setAvailExpanded] = useState(false);
	const [locating, setLocating] = useState(false);
	const [distances, setDistances] = useState<Record<string, number>>({});
	const geocodeCache = useRef<Map<string, [number, number]>>(new Map());
	const [flaggedJobs, setFlaggedJobs] = useState<Set<string>>(() => {
		try {
			const saved = localStorage.getItem("myday-flagged");
			return saved ? new Set(JSON.parse(saved)) : new Set();
		} catch {
			return new Set();
		}
	});

	function requestLocation() {
		if (!navigator.geolocation) {
			setGpsError("Geolocation not supported");
			return;
		}
		setGpsLoading(true);
		setGpsError(null);
		navigator.geolocation.getCurrentPosition(
			(pos) => {
				setGpsStart(`${pos.coords.latitude},${pos.coords.longitude}`);
				setGpsLoading(false);
			},
			() => {
				setGpsError(
					"Could not get location — check browser permissions",
				);
				setGpsLoading(false);
			},
			{ timeout: 10000 },
		);
	}

	if (!currentUser) return null;

	const routeStart = gpsStart ?? currentUser.home;

	const todayJobs = jobs
		.filter((j) => j.assignedTo === currentUser.id && j.date === TODAY)
		.sort((a, b) => {
			const aOrder = a.sortOrder ?? 0;
			const bOrder = b.sortOrder ?? 0;
			if (aOrder !== 0 || bOrder !== 0)
				return (aOrder || 999) - (bOrder || 999);
			return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
		});

	const routeJobs = todayJobs.filter(
		(j) => !DONE_STATUSES.includes(j.status),
	);

	const routeUrl =
		routeJobs.length > 0
			? mapsRouteUrl([routeStart, ...routeJobs.map((j) => j.address)])
			: null;

	// Phase 3: progress
	const completedCount = todayJobs.filter((j) =>
		DONE_STATUSES.includes(j.status),
	).length;
	const totalCount = todayJobs.length;
	const progressPct = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

	// Phase 4: available (unscheduled) jobs
	const todayJobIds = new Set(todayJobs.map((j) => j.id));
	const availableJobs = jobs.filter(
		(j) =>
			!j.startTime &&
			j.status !== "Completed" &&
			j.status !== "Invoiced" &&
			(!j.assignedTo || j.assignedTo === currentUser.id) &&
			!todayJobIds.has(j.id),
	);
	const sortedAvailable = [...availableJobs].sort((a, b) => {
		if (distances[a.id] !== undefined && distances[b.id] !== undefined)
			return distances[a.id] - distances[b.id];
		return (a.date ?? "").localeCompare(b.date ?? "");
	});

	async function handleNearMe() {
		setLocating(true);
		try {
			const pos = await new Promise<GeolocationPosition>(
				(resolve, reject) =>
					navigator.geolocation.getCurrentPosition(resolve, reject),
			);
			const { latitude, longitude } = pos.coords;
			const newDist: Record<string, number> = {};
			for (let i = 0; i < availableJobs.length; i++) {
				const job = availableJobs[i];
				if (!job.address) continue;
				if (i > 0) await new Promise((r) => setTimeout(r, 1000));
				const coords = await geocodeAddress(
					job.address,
					geocodeCache.current,
				);
				if (coords)
					newDist[job.id] = haversine(
						latitude,
						longitude,
						coords[0],
						coords[1],
					);
			}
			setDistances(newDist);
		} catch {
			// geolocation denied or failed
		} finally {
			setLocating(false);
		}
	}

	function flagJob(job: Job) {
		const next = new Set(flaggedJobs);
		next.add(job.id);
		setFlaggedJobs(next);
		localStorage.setItem("myday-flagged", JSON.stringify([...next]));
		addNotification({
			icon: "🙋",
			message: `${currentUser!.name} is near ${job.customer} (${job.ref}) and available to take it on`,
			for: "master",
			jobId: job.id,
		});
	}

	return (
		<div className="p-5 md:p-8 md:max-w-xl">
			{/* Header */}
			<div className="flex items-start justify-between mb-5 gap-3 flex-wrap">
				<div>
					<h1 className="text-2xl font-normal text-neutral-100 tracking-tight">
						My Day
					</h1>
					<p className="mt-1 text-sm text-neutral-600">
						{new Date(TODAY + "T00:00:00").toLocaleDateString("en-GB", {
							weekday: "long",
							day: "numeric",
							month: "long",
							year: "numeric",
						})}
					</p>
				</div>
				{routeUrl && (
					<a
						href={routeUrl}
						target="_blank"
						rel="noreferrer"
						className="flex items-center gap-1.5 rounded-lg border border-green-900 bg-green-950 px-3 py-2.5 text-sm text-green-300 no-underline min-h-[44px]"
					>
						🗺 Open Route
					</a>
				)}
			</div>

			{/* Phase 3: Progress bar */}
			{totalCount > 0 && (
				<div className="mb-5">
					<div className="flex items-center justify-between text-xs text-neutral-500 mb-1.5">
						<span>
							{completedCount} of {totalCount} jobs completed
						</span>
						<span>{Math.round(progressPct)}%</span>
					</div>
					<div className="h-1.5 rounded-full bg-neutral-800 overflow-hidden">
						<div
							className="h-full rounded-full bg-orange-500 transition-all duration-500"
							style={{ width: `${progressPct}%` }}
						/>
					</div>
				</div>
			)}

			{todayJobs.length === 0 ? (
				<div className="flex flex-col items-center justify-center py-20 text-center">
					<span className="text-4xl mb-3">☀️</span>
					<p className="text-neutral-600">
						No jobs scheduled for today.
					</p>
				</div>
			) : (
				<>
					{/* Priority legend */}
					<div className="mb-5 flex flex-wrap gap-4 rounded-xl border border-neutral-800 bg-neutral-900 px-5 py-3">
						{PRIORITIES.map((p) => (
							<div
								key={p}
								className="flex items-center gap-1.5 text-xs text-neutral-500"
							>
								<div
									className={`h-2 w-2 rounded-full ${PRIORITY_COLORS[p].dot}`}
								/>
								{p}
							</div>
						))}
					</div>

					{/* Route strip */}
					<div className="relative">
						{/* Start */}
						<div className="flex gap-3 items-start mb-1">
							<div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border-2 border-orange-500 bg-neutral-900 text-orange-500 text-sm">
								{gpsStart ? "📍" : "🏠"}
							</div>
							<div className="mt-1 flex-1">
								<p className="text-[10px] uppercase tracking-wider text-neutral-600">
									{gpsStart
										? "Start — Current Location"
										: "Start — Home"}
								</p>
								<p className="text-xs text-neutral-500 mt-0.5">
									{gpsStart
										? "Using GPS coordinates"
										: currentUser.home}
								</p>
								{gpsError && (
									<p className="text-[10px] text-red-400 mt-1">
										{gpsError}
									</p>
								)}
								<div className="mt-1.5 flex items-center gap-2">
									{gpsStart ? (
										<button
											onClick={() => setGpsStart(null)}
											className="text-[10px] text-neutral-500 hover:text-neutral-300 underline cursor-pointer transition-colors min-h-[44px]"
										>
											Use home address instead
										</button>
									) : (
										<button
											onClick={requestLocation}
											disabled={gpsLoading}
											className="flex items-center gap-1 rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-xs text-neutral-300 hover:border-neutral-500 disabled:opacity-50 cursor-pointer transition-colors min-h-[44px]"
										>
											{gpsLoading ? (
												<>
													<span className="inline-block h-3 w-3 border border-neutral-500 border-t-transparent rounded-full animate-spin" />
													Locating…
												</>
											) : (
												<>📍 Use my current location</>
											)}
										</button>
									)}
								</div>
							</div>
						</div>

						{/* Job cards */}
						{todayJobs.map((job, idx) => {
							const pc = PRIORITY_COLORS[job.priority];
							const sc = STATUS_COLORS[job.status];
							const isOpen = activeStop === job.id;
							const isDone = DONE_STATUSES.includes(job.status);
							const isActive =
								job.status === "En Route" ||
								job.status === "On Site";
							const routeIdx = routeJobs.indexOf(job);
							const nextStatus = NEXT_STATUS[job.status];
							const cat = categories.find(
								(c) => c.id === job.categoryId,
							);

							// Phase 3: connector color
							const prevJob = idx > 0 ? todayJobs[idx - 1] : null;
							const prevDone = prevJob
								? DONE_STATUSES.includes(prevJob.status)
								: false;
							const connectorColor = isActive
								? "bg-orange-500"
								: prevDone && isDone
									? "bg-green-900"
									: "bg-neutral-800";

							return (
								<div key={job.id}>
									{/* Connector line */}
									<div
										className={`ml-[17px] h-4 w-0.5 ${connectorColor} transition-colors`}
									/>

									<div
										onClick={() =>
											setActiveStop(
												isOpen ? null : job.id,
											)
										}
										className={`rounded-xl border bg-neutral-900 p-5 cursor-pointer transition-all ${
											isDone
												? "border-neutral-800 opacity-50"
												: isActive
													? "border-l-4 border-l-orange-500 border-t border-r border-b border-t-orange-500/30 border-r-orange-500/30 border-b-orange-500/30 shadow-[0_0_12px_rgba(249,115,22,0.15)]"
													: isOpen
														? "border-orange-500/50"
														: "border-neutral-800 hover:border-neutral-700"
										}`}
									>
										{/* Top row: order badge + customer + status */}
										<div className="flex gap-3">
											<div
												className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${
													isDone
														? "bg-neutral-700"
														: pc.dot
												}`}
											>
												{isDone
													? "✓"
													: routeIdx + 1}
											</div>
											<div className="flex-1 min-w-0">
												<div className="flex items-start justify-between gap-2 flex-wrap">
													<div className="min-w-0">
														<div className="flex items-center gap-2 mb-1 flex-wrap">
															<span className="text-[10px] text-neutral-600 uppercase tracking-widest">
																{job.ref}
															</span>
															<span
																className={`text-[10px] px-2 py-0.5 rounded-full ${pc.bg} ${pc.text}`}
															>
																{job.priority}
															</span>
															{isActive && (
																<span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-950 text-orange-300 font-semibold">
																	ACTIVE
																</span>
															)}
														</div>
														<p
															className={`text-base ${isDone ? "line-through text-neutral-500" : "text-neutral-100"}`}
														>
															{job.customer}
														</p>
														{cat && (
															<p
																className="text-xs mt-0.5"
																style={{
																	color: cat.color,
																}}
															>
																{cat.name}
															</p>
														)}
													</div>
													<span
														className={`text-[11px] px-2.5 py-1 rounded-full font-mono flex-shrink-0 ${sc.bg} ${sc.text}`}
													>
														{job.status}
													</span>
												</div>

												{/* Time + address + description (always visible) */}
												{job.startTime && (
													<p className="mt-1.5 text-sm text-orange-300/80 font-medium">
														🕐{" "}
														{fmtTime12(
															job.startTime,
														)}
														{job.endTime &&
															` – ${fmtTime12(job.endTime)}`}
													</p>
												)}
												<p className="mt-1.5 text-xs text-neutral-500">
													📍 {job.address}
												</p>
												{job.description && (
													<p className="mt-1 text-xs text-neutral-600 line-clamp-2">
														{job.description}
													</p>
												)}
												{job.materials && (
													<p className="mt-1 text-[10px] text-neutral-500">
														🔧 {job.materials}
													</p>
												)}

												{/* Expanded section */}
												{isOpen && (
													<div className="mt-3 space-y-3">
														{/* Action buttons */}
														<div className="flex gap-2 flex-wrap">
															{!isDone && (
																<a
																	href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(job.address)}&travelmode=driving`}
																	target="_blank"
																	rel="noreferrer"
																	className="rounded-lg border border-blue-800 bg-blue-950 px-4 py-2.5 text-xs text-blue-300 no-underline min-h-[44px] flex items-center"
																	onClick={(
																		e,
																	) =>
																		e.stopPropagation()
																	}
																>
																	▲ Navigate
																</a>
															)}
															{job.phone && (
																<a
																	href={`tel:${job.phone}`}
																	className="rounded-lg border border-green-800 bg-green-950 px-4 py-2.5 text-xs text-green-300 no-underline min-h-[44px] flex items-center"
																	onClick={(
																		e,
																	) =>
																		e.stopPropagation()
																	}
																>
																	📞{" "}
																	{job.phone}
																</a>
															)}
															<button
																onClick={(
																	e,
																) => {
																	e.stopPropagation();
																	navigate(
																		`/job/${job.id}`,
																	);
																}}
																className="rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2.5 text-xs text-neutral-300 hover:border-neutral-600 cursor-pointer transition-colors min-h-[44px]"
															>
																View Job Sheet
															</button>
														</div>

														{/* Status button (secondary) */}
														{nextStatus && (
															<button
																onClick={(
																	e,
																) => {
																	e.stopPropagation();
																	changeStatus(
																		job.id,
																		nextStatus,
																	);
																}}
																className={`w-full rounded-lg border px-4 py-2.5 text-sm font-medium cursor-pointer transition-colors min-h-[44px] ${STATUS_COLORS[nextStatus].bg} ${STATUS_COLORS[nextStatus].text} ${STATUS_COLORS[nextStatus].border}`}
															>
																Mark{" "}
																{nextStatus}
															</button>
														)}

														{/* Notes (Phase 2) */}
														{!isDone && (
															<div
																onClick={(e) =>
																	e.stopPropagation()
																}
															>
																<label className="text-[10px] uppercase tracking-wider text-neutral-600 mb-1 block">
																	✏️ Notes
																</label>
																<textarea
																	value={
																		draftNotes[
																			job
																				.id
																		] ??
																		job.notes ??
																		""
																	}
																	onChange={(
																		e,
																	) =>
																		setDraftNotes(
																			(
																				p,
																			) => ({
																				...p,
																				[job.id]:
																					e
																						.target
																						.value,
																			}),
																		)
																	}
																	onBlur={() => {
																		const v =
																			draftNotes[
																				job
																					.id
																			];
																		if (
																			v !==
																				undefined &&
																			v !==
																				job.notes
																		)
																			updateJob(
																				job.id,
																				"notes",
																				v,
																			);
																	}}
																	placeholder="Add notes…"
																	className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2.5 text-xs text-neutral-200 placeholder:text-neutral-600 resize-y min-h-[80px]"
																	rows={3}
																/>
															</div>
														)}

														{/* Time spent (Phase 2) */}
														{!isDone && (
															<div
																className="flex items-center gap-3"
																onClick={(e) =>
																	e.stopPropagation()
																}
															>
																<label className="text-[10px] uppercase tracking-wider text-neutral-600">
																	⏱ Time
																</label>
																<span className="text-sm text-neutral-300 font-mono min-w-[3ch] text-center">
																	{job.timeSpent ??
																		0}
																	h
																</span>
																<button
																	onClick={() =>
																		updateJob(
																			job.id,
																			"timeSpent",
																			(job.timeSpent ??
																				0) +
																				0.5,
																		)
																	}
																	className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-xs text-neutral-300 cursor-pointer min-h-[44px] hover:border-neutral-600 transition-colors"
																>
																	+0.5h
																</button>
																<button
																	onClick={() =>
																		updateJob(
																			job.id,
																			"timeSpent",
																			(job.timeSpent ??
																				0) +
																				1,
																		)
																	}
																	className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-xs text-neutral-300 cursor-pointer min-h-[44px] hover:border-neutral-600 transition-colors"
																>
																	+1h
																</button>
															</div>
														)}
													</div>
												)}
											</div>
										</div>
									</div>
								</div>
							);
						})}

						{/* End of day */}
						<div className="ml-[17px] h-4 w-0.5 bg-neutral-800" />
						<div className="flex gap-3 items-start opacity-40">
							<div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-neutral-700 text-neutral-600 text-xs">
								◉
							</div>
							<p className="mt-2 text-xs text-neutral-600">
								End of day
							</p>
						</div>
					</div>

					{routeUrl && (
						<a
							href={routeUrl}
							target="_blank"
							rel="noreferrer"
							className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-green-900 bg-green-950 py-3.5 text-sm text-green-300 no-underline min-h-[44px]"
						>
							🗺 Open full route in Google Maps
						</a>
					)}
				</>
			)}

			{/* ── Phase 4: Available Jobs ─────────────────────────── */}
			{availableJobs.length > 0 && (
				<div className="mt-8 rounded-xl border border-neutral-800 bg-neutral-900 overflow-hidden">
					<button
						onClick={() => setAvailExpanded((v) => !v)}
						className="w-full flex items-center justify-between px-4 py-3 text-sm cursor-pointer hover:bg-neutral-800/50 transition-colors border-0 bg-transparent text-left min-h-[44px]"
					>
						<span className="flex items-center gap-2 text-neutral-300 font-medium">
							📋 Available Jobs
							<span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1 rounded-full bg-neutral-700 text-neutral-300 text-[10px] font-bold">
								{availableJobs.length}
							</span>
						</span>
						<span
							className={`text-neutral-500 transition-transform ${availExpanded ? "rotate-180" : ""}`}
						>
							&#8963;
						</span>
					</button>

					{availExpanded && (
						<div className="border-t border-neutral-800 px-5 py-4 space-y-4">
							{/* Near me button */}
							<button
								onClick={handleNearMe}
								disabled={locating}
								className="w-full flex items-center justify-center gap-2 rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-3 text-sm text-neutral-300 hover:border-neutral-600 cursor-pointer transition-colors disabled:opacity-50 min-h-[44px]"
							>
								{locating ? (
									<>
										<span className="inline-block w-3.5 h-3.5 border-2 border-neutral-500 border-t-transparent rounded-full animate-spin" />
										Locating…
									</>
								) : (
									<>📍 Sort by distance from me</>
								)}
							</button>
							{Object.keys(distances).length > 0 && (
								<p className="text-[10px] text-neutral-600 text-center">
									Sorted by distance from your location
								</p>
							)}

							{/* Job cards */}
							{sortedAvailable.map((job) => {
								const priColor =
									PRIORITY_COLORS[job.priority] ??
									PRIORITY_COLORS.Normal;
								const dist = distances[job.id];
								const isFlagged = flaggedJobs.has(job.id);
								const cat = categories.find(
									(c) => c.id === job.categoryId,
								);

								return (
									<div
										key={job.id}
										className={`rounded-lg border p-4 ${isFlagged ? "border-amber-800/50 bg-amber-950/20" : "border-neutral-700 bg-neutral-800/50"}`}
									>
										<div className="flex items-start justify-between gap-2">
											<div className="min-w-0 flex-1">
												<div className="flex items-center gap-2 mb-1 flex-wrap">
													<span className="text-[10px] text-neutral-600 uppercase tracking-widest">
														{job.ref}
													</span>
													<span
														className={`text-[10px] px-2 py-0.5 rounded-full ${priColor.bg} ${priColor.text}`}
													>
														{job.priority}
													</span>
													{cat && (
														<span
															className="text-[10px]"
															style={{
																color: cat.color,
															}}
														>
															{cat.name}
														</span>
													)}
												</div>
												<p className="text-sm text-neutral-200 font-medium">
													{job.customer}
												</p>
												{job.address && (
													<p className="text-[11px] text-neutral-500 mt-0.5">
														📍 {job.address}
													</p>
												)}
												{dist !== undefined && (
													<p className="text-[11px] text-orange-400 mt-0.5">
														{dist.toFixed(1)} km
														away
													</p>
												)}
											</div>
										</div>

										<div className="mt-2.5 flex gap-2 flex-wrap">
											{isFlagged ? (
												<span className="rounded-lg border border-amber-800/50 bg-amber-950/40 px-4 py-2.5 text-xs text-amber-300 min-h-[44px] flex items-center">
													🙋 Flagged — waiting for
													scheduling
												</span>
											) : (
												<button
													onClick={() =>
														flagJob(job)
													}
													className="rounded-lg border border-amber-800 bg-amber-950 px-4 py-2.5 text-xs text-amber-300 cursor-pointer hover:border-amber-700 transition-colors min-h-[44px]"
												>
													🙋 I'm available for this
												</button>
											)}
											<button
												onClick={() =>
													navigate(`/job/${job.id}`)
												}
												className="rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2.5 text-xs text-neutral-300 cursor-pointer hover:border-neutral-600 transition-colors min-h-[44px]"
											>
												View
											</button>
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
