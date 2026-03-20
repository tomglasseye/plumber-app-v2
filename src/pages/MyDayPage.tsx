import { useState } from "react";
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

export function MyDayPage() {
	const { currentUser, jobs, categories } = useApp();
	const navigate = useNavigate();
	const [activeStop, setActiveStop] = useState<string | null>(null);
	const [gpsStart, setGpsStart] = useState<string | null>(null);
	const [gpsLoading, setGpsLoading] = useState(false);
	const [gpsError, setGpsError] = useState<string | null>(null);

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
			// If master has set a sort order, use it; otherwise fall back to priority
			const aOrder = a.sortOrder ?? 0;
			const bOrder = b.sortOrder ?? 0;
			if (aOrder !== 0 || bOrder !== 0)
				return (aOrder || 999) - (bOrder || 999);
			return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
		});

	const DONE_STATUSES = ["Completed", "Invoiced"];
	const routeJobs = todayJobs.filter(
		(j) => !DONE_STATUSES.includes(j.status),
	);

	const routeUrl =
		routeJobs.length > 0
			? mapsRouteUrl([routeStart, ...routeJobs.map((j) => j.address)])
			: null;

	return (
		<div className="p-5 md:p-7 max-w-xl">
			<div className="flex items-start justify-between mb-5 gap-4 flex-wrap">
				<div>
					<h1 className="text-2xl font-normal text-neutral-100 tracking-tight">
						My Day
					</h1>
					<p className="mt-1 text-sm text-neutral-600">
						{new Date(TODAY).toLocaleDateString("en-GB", {
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
						className="flex items-center gap-1.5 rounded-lg border border-green-900 bg-green-950 px-3 py-2 text-sm text-green-300 no-underline"
					>
						🗺 Open route in Google Maps
					</a>
				)}
			</div>

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
					<div className="mb-4 flex flex-wrap gap-3 rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-2.5">
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
							<div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border-2 border-orange-500 bg-neutral-900 text-orange-500 text-sm">
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
											className="text-[10px] text-neutral-500 hover:text-neutral-300 underline cursor-pointer transition-colors"
										>
											Use home address instead
										</button>
									) : (
										<button
											onClick={requestLocation}
											disabled={gpsLoading}
											className="flex items-center gap-1 rounded-md border border-neutral-700 bg-neutral-800 px-2.5 py-1 text-[10px] text-neutral-300 hover:border-neutral-500 disabled:opacity-50 cursor-pointer transition-colors"
										>
											{gpsLoading ? (
												<>
													<svg
														className="h-3 w-3 animate-spin"
														viewBox="0 0 24 24"
														fill="none"
													>
														<circle
															className="opacity-25"
															cx="12"
															cy="12"
															r="10"
															stroke="currentColor"
															strokeWidth="4"
														/>
														<path
															className="opacity-75"
															fill="currentColor"
															d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
														/>
													</svg>
													Locating…
												</>
											) : (
												<>
													<svg
														className="h-3 w-3"
														viewBox="0 0 24 24"
														fill="none"
														stroke="currentColor"
														strokeWidth="2"
													>
														<circle
															cx="12"
															cy="12"
															r="3"
														/>
														<path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
														<path d="M12 8a4 4 0 100 8 4 4 0 000-8z" />
													</svg>
													Use my current location
												</>
											)}
										</button>
									)}
								</div>
							</div>
						</div>

						{todayJobs.map((job) => {
							const pc = PRIORITY_COLORS[job.priority];
							const sc = STATUS_COLORS[job.status];
							const isOpen = activeStop === job.id;
							const isDone = DONE_STATUSES.includes(job.status);
							const routeIdx = routeJobs.indexOf(job);

							return (
								<div key={job.id}>
									{/* Connector line */}
									<div className="ml-[15px] h-4 w-0.5 bg-neutral-800" />

									<div
										onClick={() =>
											setActiveStop(
												isOpen ? null : job.id,
											)
										}
										className={`flex gap-3 rounded-xl border bg-neutral-900 p-4 cursor-pointer transition-colors ${
											isDone
												? "border-neutral-800 opacity-50"
												: isOpen
													? "border-orange-500/50"
													: "border-neutral-800 hover:border-neutral-700"
										}`}
									>
										{/* Order badge */}
										<div
											className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${
												isDone
													? "bg-neutral-700"
													: pc.dot
											}`}
										>
											{isDone ? "✓" : routeIdx + 1}
										</div>

										<div className="flex-1 min-w-0">
											<div className="flex items-start justify-between gap-2 flex-wrap">
												<div>
													<div className="flex items-center gap-2 mb-1">
														<span className="text-[10px] text-neutral-600 uppercase tracking-widest">
															{job.ref}
														</span>
														<span
															className={`text-[10px] px-2 py-0.5 rounded-full ${pc.bg} ${pc.text}`}
														>
															{job.priority}
														</span>
													</div>
													<p
														className={`text-base ${isDone ? "line-through text-neutral-500" : "text-neutral-100"}`}
													>
														{job.customer}
													</p>
													{(() => { const cat = categories.find(c => c.id === job.categoryId); return cat ? <p className="text-xs mt-0.5" style={{ color: cat.color }}>{cat.name}</p> : null; })()}
												</div>
												<span
													className={`text-[11px] px-2.5 py-1 rounded-full font-mono flex-shrink-0 ${sc.bg} ${sc.text}`}
												>
													{job.status}
												</span>
											</div>
											<p className="mt-2 text-xs text-neutral-600">
												📍 {job.address}
											</p>

											{isOpen && (
												<div className="mt-3 flex gap-2 flex-wrap">
													{!isDone && (
														<a
															href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(job.address)}&travelmode=driving`}
															target="_blank"
															rel="noreferrer"
															className="rounded-lg border border-blue-800 bg-blue-950 px-3 py-1.5 text-xs text-blue-300 no-underline"
															onClick={(e) =>
																e.stopPropagation()
															}
														>
															▲ Navigate
														</a>
													)}
													<button
														onClick={(e) => {
															e.stopPropagation();
															navigate(
																`/job/${job.id}`,
															);
														}}
														className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-xs text-neutral-300 hover:border-neutral-600 cursor-pointer transition-colors"
													>
														View Job Sheet
													</button>
												</div>
											)}
										</div>
									</div>
								</div>
							);
						})}

						{/* End of day */}
						<div className="ml-[15px] h-4 w-0.5 bg-neutral-800" />
						<div className="flex gap-3 items-start opacity-40">
							<div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-neutral-700 text-neutral-600 text-xs">
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
							className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-green-900 bg-green-950 py-3 text-sm text-green-300 no-underline"
						>
							🗺 Open full route in Google Maps
						</a>
					)}
				</>
			)}
		</div>
	);
}
