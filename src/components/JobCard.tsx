import { useNavigate } from "react-router-dom";
import { PRIORITY_COLORS, STATUS_COLORS, userColor } from "../data";
import type { Job } from "../types";
import { useApp } from "../AppContext";

interface Props {
	job: Job;
}

export function JobCard({ job }: Props) {
	const { isMaster, users } = useApp();
	const navigate = useNavigate();
	const sc = STATUS_COLORS[job.status];
	const pc = PRIORITY_COLORS[job.priority];
	const eng = users.find((u) => u.id === job.assignedTo);

	return (
		<div
			onClick={() => navigate(`/job/${job.id}`)}
			className={`rounded-xl border bg-neutral-900 p-4 cursor-pointer hover:border-neutral-700 transition-colors ${
				job.priority === "Emergency"
					? "border-red-900/50"
					: "border-neutral-800"
			}`}
		>
			<div className="flex items-center justify-between mb-2 gap-2">
				<div className="flex items-center gap-2 min-w-0">
					<span className="text-[10px] text-neutral-600 uppercase tracking-widest flex-shrink-0">
						{job.ref}
					</span>
					<span
						className={`text-[10px] px-2 py-0.5 rounded-full ${pc.bg} ${pc.text}`}
					>
						{job.priority}
					</span>
					{job.readyToInvoice && (
						<span className="text-[10px] bg-green-950 text-green-400 px-2 py-0.5 rounded-full">
							✅ Final
						</span>
					)}
				</div>
				<span
					className={`text-[11px] px-2.5 py-1 rounded-full flex-shrink-0 font-mono ${sc.bg} ${sc.text}`}
				>
					{job.status}
				</span>
			</div>

			<h3 className="text-base text-neutral-100 font-normal mb-0.5">
				{job.customer}
			</h3>
			<p className="text-sm mb-3" style={{ color: "#f97316" }}>
				{job.type}
			</p>

			<div className="flex flex-wrap gap-3 items-center">
				<span className="text-xs text-neutral-600">
					📍 {job.address.split(",").slice(-2).join(",").trim()}
				</span>
				<span className="text-xs text-neutral-600">
					📅 {new Date(job.date).toLocaleDateString("en-GB")}
				</span>
				{isMaster && (
					<span
						className="ml-auto flex h-6 w-6 items-center justify-center rounded-full text-xs"
						style={{
							background: userColor(job.assignedTo, users) + "22",
							color: userColor(job.assignedTo, users),
						}}
					>
						{eng?.avatar}
					</span>
				)}
			</div>
		</div>
	);
}
