import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CategoryIcon } from "../pages/AccountPage";
import { STATUS_COLORS } from "../data";
import { haversine, geocodeAddress } from "../utils/geo";
import type { Category, Job } from "../types";

interface Props {
	jobs: Job[];
	categories: Category[];
	onSchedule: (jobId: string, date: string, startTime?: string, endTime?: string) => void;
	accentColor: string;
	workDayStart: number;
	workDayEnd: number;
	onPointerDragStart?: (jobId: string, clientX: number, clientY: number) => void;
}

const PRIORITY_COLORS: Record<string, string> = {
	Emergency: "bg-red-900/60 text-red-300",
	High: "bg-amber-900/60 text-amber-300",
	Normal: "bg-neutral-800 text-neutral-400",
	Low: "bg-neutral-900 text-neutral-600",
};

export function UnscheduledPanel({ jobs, categories, onPointerDragStart }: Props) {
	const navigate = useNavigate();
	const [expanded, setExpanded] = useState(false);
	const [locating, setLocating] = useState(false);
	const didDragRef = useRef(false);
	const [distances, setDistances] = useState<Record<string, number>>({});
	const geocodeCache = useRef<Map<string, [number, number]>>(new Map());

	const unscheduled = jobs.filter(
		(j) =>
			!j.startTime &&
			j.status !== "Completed" &&
			j.status !== "Invoiced",
	);

	if (unscheduled.length === 0) return null;

	// Sort by distance if available, otherwise by date
	const sorted = [...unscheduled].sort((a, b) => {
		if (distances[a.id] !== undefined && distances[b.id] !== undefined) {
			return distances[a.id] - distances[b.id];
		}
		return (a.date ?? "").localeCompare(b.date ?? "");
	});

	async function handleNearMe() {
		setLocating(true);
		try {
			const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
				navigator.geolocation.getCurrentPosition(resolve, reject),
			);
			const { latitude, longitude } = pos.coords;

			const newDistances: Record<string, number> = {};

			for (let i = 0; i < unscheduled.length; i++) {
				const job = unscheduled[i];
				if (!job.address) continue;

				// Rate limit: 1 per second
				if (i > 0) {
					await new Promise((r) => setTimeout(r, 1000));
				}
				const coords = await geocodeAddress(job.address, geocodeCache.current);

				if (coords) {
					newDistances[job.id] = haversine(latitude, longitude, coords[0], coords[1]);
				}
			}

			setDistances(newDistances);
		} catch {
			// geolocation denied or failed
		} finally {
			setLocating(false);
		}
	}

	return (
		<div className="rounded-xl border border-neutral-800 bg-neutral-900 overflow-hidden">
			{/* Header / toggle bar */}
			<button
				onClick={() => setExpanded((v) => !v)}
				className="w-full flex items-center justify-between px-4 py-2.5 text-sm cursor-pointer hover:bg-neutral-800/50 transition-colors border-0 bg-transparent text-left"
			>
				<span className="flex items-center gap-2 text-neutral-300 font-medium">
					<span>&#128203;</span>
					Unscheduled Jobs
					<span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-neutral-700 text-neutral-300 text-[10px] font-bold">
						{unscheduled.length}
					</span>
				</span>
				<span className={`text-neutral-500 transition-transform ${expanded ? "rotate-180" : ""}`}>
					&#8963;
				</span>
			</button>

			{expanded && (
				<div className="border-t border-neutral-800">
					{/* Near me button */}
					<div className="px-4 py-2 flex items-center gap-2">
						<button
							onClick={handleNearMe}
							disabled={locating}
							className="flex items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-xs text-neutral-300 hover:border-neutral-600 cursor-pointer transition-colors disabled:opacity-50"
						>
							{locating ? (
								<>
									<span className="inline-block w-3 h-3 border border-neutral-500 border-t-transparent rounded-full animate-spin" />
									Locating...
								</>
							) : (
								<>&#128205; Sort by distance</>
							)}
						</button>
						{Object.keys(distances).length > 0 && (
							<span className="text-[10px] text-neutral-600">
								Sorted by distance from your location
							</span>
						)}
					</div>

					{/* Job cards — horizontal scroll on desktop, vertical on mobile */}
					<div className="pb-3 px-4">
						<div className="flex gap-2 overflow-x-auto pb-1 md:flex-row flex-col md:overflow-x-auto">
							{sorted.map((job) => {
								const sc = STATUS_COLORS[job.status];
								const priColor = PRIORITY_COLORS[job.priority] ?? PRIORITY_COLORS.Normal;
								const dist = distances[job.id];

								const cat = categories.find((c) => c.id === job.categoryId);
								return (
									<div
										key={job.id}
										onPointerDown={(e) => {
											if (onPointerDragStart && e.button === 0) {
												e.preventDefault();
												didDragRef.current = false;
												// Track if a real drag happens (mouse moves beyond threshold)
												const startX = e.clientX, startY = e.clientY;
												const checkDrag = (ev: MouseEvent) => {
													if (Math.abs(ev.clientX - startX) >= 8 || Math.abs(ev.clientY - startY) >= 8) {
														didDragRef.current = true;
													}
												};
												const cleanup = () => {
													document.removeEventListener("mousemove", checkDrag);
													document.removeEventListener("mouseup", cleanup);
												};
												document.addEventListener("mousemove", checkDrag);
												document.addEventListener("mouseup", cleanup);
												onPointerDragStart(job.id, e.clientX, e.clientY);
											}
										}}
										onClick={(e) => {
											if (didDragRef.current) { e.preventDefault(); return; }
											navigate(`/job/${job.id}`);
										}}
										className={`flex-shrink-0 w-48 rounded-lg border border-neutral-700 ${sc.bg} p-2.5 cursor-grab select-none hover:border-neutral-600 transition-colors active:cursor-grabbing`}
									>
										<div className="flex items-start justify-between gap-1 mb-0.5">
											<p className={`text-xs font-semibold truncate ${sc.text}`}>
												{job.customer}
											</p>
											{cat && <CategoryIcon name={cat.icon} size={10} color={cat.color} />}
										</div>
										{job.address && (
											<p className="text-[10px] text-neutral-500 truncate mt-0.5">
												{job.address}
											</p>
										)}
										{job.date && (
											<p className="text-[10px] text-neutral-600 mt-1">
												{new Date(job.date + "T00:00:00").toLocaleDateString("en-GB", {
													day: "numeric",
													month: "short",
												})}
											</p>
										)}
										<div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
											<span
												className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-medium ${priColor}`}
											>
												{job.priority}
											</span>
											{dist !== undefined && (
												<span className="text-[9px] text-neutral-500">
													{dist.toFixed(1)} km
												</span>
											)}
										</div>
									</div>
								);
							})}
						</div>
						<p className="text-[10px] text-neutral-700 mt-2">
							Drag a card onto the calendar to schedule it
						</p>
					</div>
				</div>
			)}
		</div>
	);
}
