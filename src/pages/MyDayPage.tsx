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
	const { currentUser, jobs } = useApp();
	const navigate = useNavigate();
	const [activeStop, setActiveStop] = useState<string | null>(null);

	if (!currentUser) return null;

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

	const routeUrl =
		todayJobs.length > 0
			? mapsRouteUrl([
					currentUser.home,
					...todayJobs.map((j) => j.address),
				])
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
						{/* Start — home */}
						<div className="flex gap-3 items-start mb-1">
							<div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border-2 border-orange-500 bg-neutral-900 text-orange-500 text-sm">
								🏠
							</div>
							<div className="mt-1">
								<p className="text-[10px] uppercase tracking-wider text-neutral-600">
									Start — Home
								</p>
								<p className="text-xs text-neutral-500 mt-0.5">
									{currentUser.home}
								</p>
							</div>
						</div>

						{todayJobs.map((job, idx) => {
							const pc = PRIORITY_COLORS[job.priority];
							const sc = STATUS_COLORS[job.status];
							const isOpen = activeStop === job.id;

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
											isOpen
												? "border-orange-500/50"
												: "border-neutral-800 hover:border-neutral-700"
										}`}
									>
										{/* Order badge */}
										<div
											className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${pc.dot}`}
										>
											{idx + 1}
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
													<p className="text-base text-neutral-100">
														{job.customer}
													</p>
													<p
														className="text-xs mt-0.5"
														style={{
															color: "#f97316",
														}}
													>
														{job.type}
													</p>
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
