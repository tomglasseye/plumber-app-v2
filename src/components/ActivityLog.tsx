import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { useApp } from "../AppContext";

interface AuditEntry {
	id: string;
	actorId: string;
	action: string;
	targetType: string;
	targetId: string;
	details: Record<string, string> | null;
	createdAt: string;
}

const ACTION_LABELS: Record<string, (d: Record<string, string> | null) => string> = {
	"job.created": (d) => `Created job ${d?.ref ?? ""} for ${d?.customer ?? ""}`,
	"job.status_changed": (d) => `Changed status from ${d?.old ?? "?"} to ${d?.new ?? "?"}${d?.ref ? ` on ${d.ref}` : ""}`,
	"job.priority_changed": (d) => `Changed priority from ${d?.old ?? "?"} to ${d?.new ?? "?"}${d?.ref ? ` on ${d.ref}` : ""}`,
	"job.field_updated": (d) => `Updated ${d?.field ?? "field"}${d?.ref ? ` on ${d.ref}` : ""}`,
	"job.rescheduled": (d) => `Rescheduled${d?.ref ? ` ${d.ref}` : ""} from ${d?.old_date ?? "?"} to ${d?.new_date ?? "?"}`,
	"job.final_completed": (d) => `Marked ${d?.ref ?? "job"} as Final Complete`,
	"business.settings_updated": () => "Updated business settings",
	"profile.locked": () => "Locked user account",
	"profile.unlocked": () => "Unlocked user account",
	"profile.deleted": () => "Deleted user account",
	"auth.password_change_self": () => "Changed own password",
	"auth.password_changed_by_master": () => "Reset user password",
};

function describeAction(action: string, details: Record<string, string> | null): string {
	const fn = ACTION_LABELS[action];
	if (fn) return fn(details);
	return action.replace(/\./g, " ");
}

function timeAgo(iso: string): string {
	const diff = Date.now() - new Date(iso).getTime();
	const mins = Math.floor(diff / 60000);
	if (mins < 1) return "just now";
	if (mins < 60) return `${mins}m ago`;
	const hrs = Math.floor(mins / 60);
	if (hrs < 24) return `${hrs}h ago`;
	const days = Math.floor(hrs / 24);
	if (days < 7) return `${days}d ago`;
	return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

type FilterTab = "all" | "jobs" | "users" | "settings";

interface Props {
	/** Filter to a specific job's history */
	jobId?: string;
	/** Maximum entries to show */
	limit?: number;
	/** Show filter tabs (for global log) */
	showFilters?: boolean;
}

export function ActivityLog({ jobId, limit = 50, showFilters = false }: Props) {
	const { users, isMaster } = useApp();
	const [entries, setEntries] = useState<AuditEntry[]>([]);
	const [loading, setLoading] = useState(true);
	const [tab, setTab] = useState<FilterTab>("all");

	useEffect(() => {
		let cancelled = false;
		async function load() {
			setLoading(true);
			let query = supabase
				.from("audit_log")
				.select("*")
				.order("created_at", { ascending: false })
				.limit(limit);

			if (jobId) {
				query = query.eq("target_id", jobId);
			}

			const { data } = await query;
			if (!cancelled && data) {
				setEntries(
					data.map((r: Record<string, unknown>) => ({
						id: r.id as string,
						actorId: r.actor_id as string,
						action: r.action as string,
						targetType: r.target_type as string,
						targetId: r.target_id as string,
						details: r.details as Record<string, string> | null,
						createdAt: r.created_at as string,
					})),
				);
			}
			if (!cancelled) setLoading(false);
		}
		load();
		return () => { cancelled = true; };
	}, [jobId, limit]);

	if (!isMaster) return null;

	const filtered = entries.filter((e) => {
		if (tab === "all") return true;
		if (tab === "jobs") return e.targetType === "job";
		if (tab === "users") return e.targetType === "profile" || e.action.startsWith("auth.");
		if (tab === "settings") return e.targetType === "business";
		return true;
	});

	const userMap = new Map(users.map((u) => [u.id, u.name]));

	return (
		<div>
			{showFilters && (
				<div className="flex gap-1.5 mb-4">
					{(["all", "jobs", "users", "settings"] as FilterTab[]).map((t) => (
						<button
							key={t}
							onClick={() => setTab(t)}
							className={`rounded-lg px-3 py-1.5 text-xs cursor-pointer transition-colors border-0 ${
								tab === t
									? "bg-neutral-700 text-neutral-200"
									: "bg-neutral-800 text-neutral-500 hover:text-neutral-300"
							}`}
						>
							{t.charAt(0).toUpperCase() + t.slice(1)}
						</button>
					))}
				</div>
			)}

			{loading ? (
				<p className="py-6 text-center text-sm text-neutral-600 animate-pulse">
					Loading activity...
				</p>
			) : filtered.length === 0 ? (
				<p className="py-6 text-center text-sm text-neutral-600">
					No activity recorded yet.
				</p>
			) : (
				<div className="space-y-1">
					{filtered.map((entry) => (
						<div
							key={entry.id}
							className="flex items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-neutral-800/50 transition-colors"
						>
							<div className="flex-shrink-0 mt-0.5">
								<div className="h-2 w-2 rounded-full bg-neutral-600" />
							</div>
							<div className="flex-1 min-w-0">
								<p className="text-sm text-neutral-300">
									<span className="text-neutral-400 font-medium">
										{userMap.get(entry.actorId) ?? "System"}
									</span>{" "}
									{describeAction(entry.action, entry.details)}
								</p>
								<p className="text-[10px] text-neutral-600 mt-0.5">
									{timeAgo(entry.createdAt)}
								</p>
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
