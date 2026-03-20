import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useApp } from "../AppContext";
import { CategoryIcon } from "./AccountPage";
import {
	PRIORITIES,
	PRIORITY_COLORS,
	STATUSES,
	STATUS_COLORS,
} from "../data";
import type { Priority, RepeatFrequency, Status } from "../types";

// Generate 30-min time options 07:00 – 20:00
function timeOptions() {
	const opts: { value: string; label: string }[] = [];
	for (let h = 7; h <= 20; h++) {
		for (const m of [0, 30]) {
			const value = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
			const ampm = h < 12 ? "am" : "pm";
			const displayH = h > 12 ? h - 12 : h;
			const label = `${displayH}:${String(m).padStart(2, "0")} ${ampm}`;
			opts.push({ value, label });
		}
	}
	return opts;
}
const TIME_OPTS = timeOptions();

export function JobDetailPage() {
	const { id } = useParams<{ id: string }>();
	const navigate = useNavigate();
	const {
		jobs,
		users,
		isMaster,
		currentUser,
		changeStatus,
		changePriority,
		updateJob,
		finalComplete,
		addNotification,
		business,
		customers,
		categories,
	} = useApp();

	const job = jobs.find((j) => j.id === id);
	const linkedCustomer = job?.customerId
		? customers.find((c) => c.id === job.customerId)
		: undefined;

	const [draftCustomer, setDraftCustomer] = useState(job?.customer ?? "");
	const [draftAddress, setDraftAddress] = useState(job?.address ?? "");
	const [draftPhone, setDraftPhone] = useState(job?.phone ?? "");
	const [draftDescription, setDraftDescription] = useState(
		job?.description ?? "",
	);
	const [draftAssignedTo, setDraftAssignedTo] = useState(
		job?.assignedTo ?? "",
	);
	const [draftDate, setDraftDate] = useState(job?.date ?? "");
	const [draftEndDate, setDraftEndDate] = useState(job?.endDate ?? "");
	const [draftStartTime, setDraftStartTime] = useState(
		job?.startTime ?? "",
	);
	const [draftEndTime, setDraftEndTime] = useState(job?.endTime ?? "");
	const [draftCategoryId, setDraftCategoryId] = useState(
		job?.categoryId ?? "",
	);
	const [draftStatus, setDraftStatus] = useState<Status>(
		job?.status ?? "Scheduled",
	);
	const [draftPriority, setDraftPriority] = useState<Priority>(
		job?.priority ?? "Normal",
	);
	const [draftNotes, setDraftNotes] = useState(job?.notes ?? "");
	const [draftMaterials, setDraftMaterials] = useState(
		job?.materials ?? "",
	);
	const [draftTimeSpent, setDraftTimeSpent] = useState(
		job?.timeSpent ?? 0,
	);
	const [draftRepeatFrequency, setDraftRepeatFrequency] = useState<RepeatFrequency | undefined>(job?.repeatFrequency);
	const [saved, setSaved] = useState(false);

	// Re-sync draft if navigating to a different job
	useEffect(() => {
		if (!job) return;
		setDraftCustomer(job.customer);
		setDraftAddress(job.address);
		setDraftPhone(job.phone ?? "");
			setDraftDescription(job.description);
		setDraftAssignedTo(job.assignedTo);
		setDraftDate(job.date);
		setDraftEndDate(job.endDate ?? "");
		setDraftStartTime(job.startTime ?? "");
		setDraftEndTime(job.endTime ?? "");
		setDraftCategoryId(job.categoryId ?? "");
		setDraftStatus(job.status);
		setDraftPriority(job.priority);
		setDraftNotes(job.notes);
		setDraftMaterials(job.materials);
		setDraftTimeSpent(job.timeSpent);
		setDraftRepeatFrequency(job.repeatFrequency);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [job?.id]);

	if (!job) return <div className="p-8 text-neutral-500">Job not found.</div>;

	const sc = STATUS_COLORS[draftStatus];
	const pc = PRIORITY_COLORS[draftPriority];
	const eng = users.find((u) => u.id === draftAssignedTo);
	const canEdit = isMaster || currentUser?.id === job.assignedTo;
	const selectedCategory = categories.find((c) => c.id === draftCategoryId);

	const isDirty =
		(isMaster &&
			(draftCustomer !== job.customer ||
				draftAddress !== job.address ||
				draftPhone !== job.phone ||
				draftDescription !== job.description ||
				draftAssignedTo !== job.assignedTo ||
				draftDate !== job.date ||
				draftEndDate !== (job.endDate ?? "") ||
				draftStartTime !== (job.startTime ?? "") ||
				draftEndTime !== (job.endTime ?? "") ||
				draftCategoryId !== (job.categoryId ?? "") ||
				draftRepeatFrequency !== job.repeatFrequency)) ||
		draftStatus !== job.status ||
		draftPriority !== job.priority ||
		draftNotes !== job.notes ||
		draftMaterials !== job.materials ||
		draftTimeSpent !== job.timeSpent;

	function handleSave() {
		if (!job) return;
		if (isMaster) {
			if (draftCustomer !== job.customer)
				updateJob(job.id, "customer", draftCustomer);
			if (draftAddress !== job.address)
				updateJob(job.id, "address", draftAddress);
				if (draftDescription !== job.description)
				updateJob(job.id, "description", draftDescription);
			if (draftAssignedTo !== job.assignedTo) {
				updateJob(job.id, "assignedTo", draftAssignedTo);
				addNotification({
					icon: "📋",
					message: `Job ${job.ref} has been assigned to you — ${draftCustomer}`,
					for: draftAssignedTo,
					jobId: job.id,
				});
			}
			if (draftDate !== job.date) updateJob(job.id, "date", draftDate);
			if (draftPhone !== job.phone)
				updateJob(job.id, "phone", draftPhone);
			if (draftEndDate !== (job.endDate ?? ""))
				updateJob(
					job.id,
					"endDate",
					draftEndDate || (undefined as unknown as string),
				);
			if (draftStartTime !== (job.startTime ?? ""))
				updateJob(
					job.id,
					"startTime",
					draftStartTime || (undefined as unknown as string),
				);
			if (draftEndTime !== (job.endTime ?? ""))
				updateJob(
					job.id,
					"endTime",
					draftEndTime || (undefined as unknown as string),
				);
			if (draftCategoryId !== (job.categoryId ?? ""))
				updateJob(
					job.id,
					"categoryId",
					draftCategoryId || (undefined as unknown as string),
				);
			if (draftRepeatFrequency !== job.repeatFrequency)
				updateJob(job.id, "repeatFrequency", draftRepeatFrequency as unknown as RepeatFrequency);
		}
		if (draftStatus !== job.status) changeStatus(job.id, draftStatus);
		if (draftPriority !== job.priority)
			changePriority(job.id, draftPriority);
		if (draftNotes !== job.notes) updateJob(job.id, "notes", draftNotes);
		if (draftMaterials !== job.materials)
			updateJob(job.id, "materials", draftMaterials);
		if (draftTimeSpent !== job.timeSpent)
			updateJob(job.id, "timeSpent", draftTimeSpent);
		if (
			!isMaster &&
			(draftNotes !== job.notes ||
				draftMaterials !== job.materials ||
				draftTimeSpent !== job.timeSpent)
		) {
			addNotification({
				icon: "📝",
				message: `${currentUser!.name} updated job ${job.ref} (${job.customer})`,
				for: "master",
				jobId: job.id,
			});
		}
		setSaved(true);
		setTimeout(() => setSaved(false), 2500);
	}

	// Engineer: mark job completed early — set end date to today
	function handleEarlyComplete() {
		if (!job) return;
		const today = new Date().toISOString().slice(0, 10);
		updateJob(job.id, "endDate", today);
		setDraftEndDate(today);
	}

	const inputClass =
		"w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-200 outline-none focus:border-neutral-500";

	return (
		<div className="p-5 md:p-7 max-w-4xl">
			<button
				onClick={() => navigate(-1)}
				className="mb-5 text-sm text-neutral-600 hover:text-neutral-300 transition-colors border-0 bg-transparent p-0 cursor-pointer block"
			>
				← Back
			</button>

			{/* Job header */}
			<div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
				<div>
					<div className="flex items-center gap-2 mb-1 flex-wrap">
						<span className="text-[10px] text-neutral-600 uppercase tracking-widest">
							{job.ref}
						</span>
						<span
							className={`text-xs px-2.5 py-0.5 rounded-full ${pc.bg} ${pc.text}`}
						>
							{draftPriority}
						</span>
						{/* Category badge */}
						{selectedCategory && (
							<span
								className="flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full"
								style={{
									background: selectedCategory.color + "22",
									color: selectedCategory.color,
								}}
							>
								<CategoryIcon
									name={selectedCategory.icon}
									size={11}
									color={selectedCategory.color}
								/>
								{selectedCategory.name}
							</span>
						)}
						{job.readyToInvoice && (
							<span className="text-xs bg-green-950 text-green-400 px-2.5 py-0.5 rounded-full">
								✅ Final Complete
							</span>
						)}
					</div>
					<h1 className="text-2xl font-normal text-neutral-100 tracking-tight">
						{draftCustomer || job.customer}
					</h1>
					{linkedCustomer && (
						<button
							onClick={() => navigate("/customers")}
							className="mt-0.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors border-0 bg-transparent p-0 cursor-pointer"
						>
							View contact →
						</button>
					)}
					{selectedCategory && (
						<p
							className="mt-0.5 text-sm"
							style={{ color: selectedCategory.color }}
						>
							{selectedCategory.name}
						</p>
					)}
					{/* Time display */}
					{(job.startTime || job.endTime) && (
						<p className="mt-0.5 text-xs text-neutral-500">
							🕐{" "}
							{job.startTime ?? "?"}
							{job.endTime ? ` – ${job.endTime}` : ""}
							{job.endDate && job.endDate !== job.date
								? ` (ends ${new Date(job.endDate + "T00:00:00").toLocaleDateString("en-GB")})`
								: ""}
						</p>
					)}
					{job.phone && (
						<a
							href={`tel:${job.phone}`}
							className="mt-1 inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-neutral-200 transition-colors"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 20 20"
								fill="currentColor"
								className="w-3.5 h-3.5 flex-shrink-0"
							>
								<path
									fillRule="evenodd"
									d="M2 3.5A1.5 1.5 0 0 1 3.5 2h1.148a1.5 1.5 0 0 1 1.465 1.175l.716 3.223a1.5 1.5 0 0 1-1.052 1.767l-.933.267c-.41.117-.643.555-.48.95a11.542 11.542 0 0 0 6.254 6.254c.395.163.833-.07.95-.48l.267-.933a1.5 1.5 0 0 1 1.767-1.052l3.223.716A1.5 1.5 0 0 1 18 16.352V17.5a1.5 1.5 0 0 1-1.5 1.5H15c-1.149 0-2.263-.15-3.326-.43A13.022 13.022 0 0 1 2.43 8.326 13.019 13.019 0 0 1 2 5V3.5Z"
									clipRule="evenodd"
								/>
							</svg>
							{job.phone}
						</a>
					)}
				</div>
				<span
					className={`text-sm px-3 py-1.5 rounded-full font-mono ${sc.bg} ${sc.text}`}
				>
					{draftStatus}
				</span>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				{/* Details */}
				<div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
					<h4 className="mb-3 text-[10px] uppercase tracking-widest text-neutral-600">
						Job Details
					</h4>
					{isMaster ? (
						<div className="space-y-3">
							{(
								[
									[
										"Customer",
										draftCustomer,
										setDraftCustomer,
										"text",
									],
									[
										"Address",
										draftAddress,
										setDraftAddress,
										"text",
									],
									[
										"Phone",
										draftPhone,
										setDraftPhone,
										"tel",
									],
									[
										"Description",
										draftDescription,
										setDraftDescription,
										"text",
									],
								] as [
									string,
									string,
									(v: string) => void,
									string,
								][]
							).map(([label, val, setter, type]) => (
								<div key={label}>
									<label className="mb-1 block text-[10px] uppercase tracking-wider text-neutral-600">
										{label}
									</label>
									<input
										type={type}
										value={val}
										onChange={(e) => setter(e.target.value)}
										className={inputClass}
									/>
								</div>
							))}

							{/* Dates */}
							<div className="grid grid-cols-2 gap-3">
								<div>
									<label className="mb-1 block text-[10px] uppercase tracking-wider text-neutral-600">
										Start Date
									</label>
									<input
										type="date"
										value={draftDate}
										onChange={(e) =>
											setDraftDate(e.target.value)
										}
										className={inputClass}
									/>
								</div>
								<div>
									<label className="mb-1 block text-[10px] uppercase tracking-wider text-neutral-600">
										End Date
									</label>
									<input
										type="date"
										value={draftEndDate}
										onChange={(e) =>
											setDraftEndDate(e.target.value)
										}
										className={inputClass}
										min={draftDate}
									/>
								</div>
							</div>

							{/* Time slots */}
							<div className="grid grid-cols-2 gap-3">
								<div>
									<label className="mb-1 block text-[10px] uppercase tracking-wider text-neutral-600">
										Start Time
									</label>
									<select
										value={draftStartTime}
										onChange={(e) =>
											setDraftStartTime(e.target.value)
										}
										className={inputClass}
									>
										<option value="">No time</option>
										{TIME_OPTS.map((o) => (
											<option
												key={o.value}
												value={o.value}
											>
												{o.label}
											</option>
										))}
									</select>
								</div>
								<div>
									<label className="mb-1 block text-[10px] uppercase tracking-wider text-neutral-600">
										End Time
									</label>
									<select
										value={draftEndTime}
										onChange={(e) =>
											setDraftEndTime(e.target.value)
										}
										className={inputClass}
									>
										<option value="">No time</option>
										{TIME_OPTS.filter(
											(o) =>
												!draftStartTime ||
												o.value > draftStartTime,
										).map((o) => (
											<option
												key={o.value}
												value={o.value}
											>
												{o.label}
											</option>
										))}
									</select>
								</div>
							</div>

							{/* Category */}
							{categories.length > 0 && (
								<div>
									<label className="mb-2 block text-[10px] uppercase tracking-wider text-neutral-600">
										Category
									</label>
									<div className="flex flex-wrap gap-1.5">
										<button
											type="button"
											onClick={() =>
												setDraftCategoryId("")
											}
											className={`rounded-lg border px-2.5 py-1 text-xs transition-colors cursor-pointer ${!draftCategoryId ? "border-neutral-500 bg-neutral-700 text-neutral-200" : "border-neutral-700 text-neutral-500 hover:border-neutral-600"}`}
										>
											None
										</button>
										{categories.map((cat) => (
											<button
												key={cat.id}
												type="button"
												onClick={() =>
													setDraftCategoryId(cat.id)
												}
												className="flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs transition-colors cursor-pointer"
												style={
													draftCategoryId === cat.id
														? {
																background:
																	cat.color +
																	"22",
																color: cat.color,
																borderColor:
																	cat.color,
															}
														: {
																borderColor:
																	"#404040",
																color: "#6b7280",
															}
												}
											>
												<CategoryIcon
													name={cat.icon}
													size={11}
													color={
														draftCategoryId ===
														cat.id
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

							{/* Recurring */}
							<div>
								<label className="mb-2 block text-[10px] uppercase tracking-wider text-neutral-600">
									Recurring
								</label>
								<div className="flex flex-wrap gap-1.5">
									{([undefined, "annually", "biannually", "quarterly"] as (RepeatFrequency | undefined)[]).map((freq) => (
										<button key={freq ?? "none"} type="button" onClick={() => setDraftRepeatFrequency(freq)}
											className={`rounded-lg border px-2.5 py-1 text-xs transition-colors cursor-pointer ${draftRepeatFrequency === freq ? "border-neutral-500 bg-neutral-700 text-neutral-200" : "border-neutral-700 text-neutral-500 hover:border-neutral-600"}`}>
											{freq === undefined ? "One-off" : freq === "annually" ? "🔁 Annually" : freq === "biannually" ? "🔁 6 months" : "🔁 Quarterly"}
										</button>
									))}
								</div>
							</div>

							<div>
								<label className="mb-1 block text-[10px] uppercase tracking-wider text-neutral-600">
									Assigned To
								</label>
								<select
									value={draftAssignedTo}
									onChange={(e) =>
										setDraftAssignedTo(e.target.value)
									}
									className={inputClass}
								>
									{users
										.filter((u) => u.role === "engineer")
										.map((u) => (
											<option key={u.id} value={u.id}>
												{u.name}
											</option>
										))}
								</select>
							</div>
							<a
								href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(draftAddress)}`}
								target="_blank"
								rel="noreferrer"
								className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-blue-900 bg-blue-950 px-3 py-1.5 text-xs text-blue-300 no-underline"
							>
								View on Google Maps
							</a>
						</div>
					) : (
						<>
							{[
								["Address", job.address],
								[
									"Date",
									new Date(
										job.date + "T00:00:00",
									).toLocaleDateString("en-GB"),
								],
								["Assigned To", eng?.name ?? "-"],
								["Description", job.description],
							].map(([l, v]) => (
								<div
									key={l}
									className="flex gap-3 mb-2.5 flex-wrap"
								>
									<span className="w-24 flex-shrink-0 text-xs text-neutral-600">
										{l}
									</span>
									<span className="flex-1 text-sm text-neutral-300">
										{v}
									</span>
								</div>
							))}
							{(job.startTime || job.endTime) && (
								<div className="flex gap-3 mb-2.5">
									<span className="w-24 flex-shrink-0 text-xs text-neutral-600">
										Time
									</span>
									<span className="flex-1 text-sm text-neutral-300">
										{job.startTime ?? "?"}
										{job.endTime
											? ` – ${job.endTime}`
											: ""}
									</span>
								</div>
							)}
							{job.phone && (
								<div className="mb-3">
									<a
										href={`tel:${job.phone}`}
										className="inline-flex items-center gap-2 rounded-lg border border-green-900 bg-green-950 px-3 py-1.5 text-sm text-green-300 no-underline hover:bg-green-900 transition-colors"
									>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											viewBox="0 0 20 20"
											fill="currentColor"
											className="w-4 h-4 flex-shrink-0"
										>
											<path
												fillRule="evenodd"
												d="M2 3.5A1.5 1.5 0 0 1 3.5 2h1.148a1.5 1.5 0 0 1 1.465 1.175l.716 3.223a1.5 1.5 0 0 1-1.052 1.767l-.933.267c-.41.117-.643.555-.48.95a11.542 11.542 0 0 0 6.254 6.254c.395.163.833-.07.95-.48l.267-.933a1.5 1.5 0 0 1 1.767-1.052l3.223.716A1.5 1.5 0 0 1 18 16.352V17.5a1.5 1.5 0 0 1-1.5 1.5H15c-1.149 0-2.263-.15-3.326-.43A13.022 13.022 0 0 1 2.43 8.326 13.019 13.019 0 0 1 2 5V3.5Z"
												clipRule="evenodd"
											/>
										</svg>
										Call {job.phone}
									</a>
								</div>
							)}
							<a
								href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address)}`}
								target="_blank"
								rel="noreferrer"
								className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-blue-900 bg-blue-950 px-3 py-1.5 text-xs text-blue-300 no-underline"
							>
								View on Google Maps
							</a>
						</>
					)}
				</div>

				{/* Priority + Status */}
				{canEdit && (
					<div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
						<h4 className="mb-3 text-[10px] uppercase tracking-widest text-neutral-600">
							Priority
						</h4>
						<div className="flex flex-wrap gap-2 mb-4">
							{PRIORITIES.map((p) => {
								const c = PRIORITY_COLORS[p];
								return (
									<button
										key={p}
										onClick={() => setDraftPriority(p)}
										className={`rounded-lg px-3 py-1.5 text-xs transition-colors border cursor-pointer ${
											draftPriority === p
												? `${c.bg} ${c.text} border-current`
												: "bg-neutral-800 text-neutral-500 border-neutral-700 hover:border-neutral-600"
										}`}
									>
										{p}
									</button>
								);
							})}
						</div>
						<h4 className="mb-3 text-[10px] uppercase tracking-widest text-neutral-600">
							Update Status
						</h4>
						<div className="flex flex-wrap gap-2">
							{STATUSES.filter((s) => s !== "Invoiced").map(
								(s) => {
									const c = STATUS_COLORS[s];
									return (
										<button
											key={s}
											onClick={() => setDraftStatus(s)}
											className={`rounded-lg px-3 py-1.5 text-xs transition-colors border cursor-pointer ${
												draftStatus === s
													? `${c.bg} ${c.text} border-current`
													: "bg-neutral-800 text-neutral-500 border-neutral-700 hover:border-neutral-600"
											}`}
										>
											{s}
										</button>
									);
								},
							)}
						</div>

						{/* Early completion shortcut (non-master only) */}
						{!isMaster &&
							job.endDate &&
							job.endDate > new Date().toISOString().slice(0, 10) && (
								<div className="mt-4 pt-4 border-t border-neutral-800">
									<p className="text-xs text-neutral-600 mb-2">
										Finished early?
									</p>
									<button
										onClick={handleEarlyComplete}
										className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-xs text-neutral-300 hover:border-neutral-600 transition-colors cursor-pointer"
									>
										Set end date to today
									</button>
								</div>
							)}
					</div>
				)}

				{/* Notes */}
				<div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
					<h4 className="mb-3 text-[10px] uppercase tracking-widest text-neutral-600">
						Site Notes
					</h4>
					<textarea
						rows={4}
						placeholder="Add notes from site…"
						value={draftNotes}
						readOnly={!canEdit}
						onChange={(e) => setDraftNotes(e.target.value)}
						className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-200 outline-none focus:border-neutral-500 resize-y placeholder:text-neutral-600"
					/>
				</div>

				{/* Materials */}
				<div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
					<h4 className="mb-3 text-[10px] uppercase tracking-widest text-neutral-600">
						Materials Used
					</h4>
					<textarea
						rows={3}
						placeholder="e.g. 22mm copper pipe x2, PTFE tape…"
						value={draftMaterials}
						readOnly={!canEdit}
						onChange={(e) => setDraftMaterials(e.target.value)}
						className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-200 outline-none focus:border-neutral-500 resize-y placeholder:text-neutral-600"
					/>
					<div className="mt-3">
						<label className="mb-1 block text-[10px] uppercase tracking-wider text-neutral-600">
							Time Spent (hrs)
						</label>
						<input
							type="number"
							step="0.5"
							min="0"
							value={draftTimeSpent}
							readOnly={!canEdit}
							onChange={(e) =>
								setDraftTimeSpent(
									parseFloat(e.target.value) || 0,
								)
							}
							className="w-28 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-200 outline-none focus:border-neutral-500"
						/>
					</div>
				</div>

				{/* Save bar */}
				{canEdit && (
					<div className="md:col-span-2 flex items-center justify-between gap-4 rounded-xl border border-neutral-800 bg-neutral-900 px-5 py-4">
						<p className="text-sm text-neutral-500">
							{isDirty
								? "You have unsaved changes."
								: "All changes saved."}
						</p>
						<button
							onClick={handleSave}
							disabled={!isDirty}
							className="rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-all disabled:opacity-40 cursor-pointer"
							style={{
								background: saved
									? "#16a34a"
									: business.accentColor,
							}}
						>
							{saved ? "✓ Saved" : "Save Changes"}
						</button>
					</div>
				)}

				{/* Awaiting HQ approval */}
				{isMaster &&
					job.status === "Completed" &&
					!job.readyToInvoice && (
						<div className="md:col-span-2 rounded-xl border border-orange-800/40 bg-orange-950/30 p-5">
							<p className="mb-1 text-base text-neutral-100">
								⏳ Awaiting HQ Approval
							</p>
							<p className="mb-4 text-sm text-neutral-500">
								The engineer has marked this job complete.
								Review the notes and materials above, then
								approve to enable invoicing.
							</p>
							<button
								onClick={() => finalComplete(job.id)}
								className="rounded-lg bg-green-800 px-5 py-2.5 text-sm font-medium text-white hover:bg-green-700 transition-colors border-0 cursor-pointer"
							>
								✅ Mark as Final Complete
							</button>
						</div>
					)}

				{/* Ready to invoice */}
				{isMaster && job.readyToInvoice && (
					<div className="md:col-span-2 flex items-center gap-4 rounded-xl border border-green-900 bg-green-950/40 p-5 flex-wrap">
						<div className="text-2xl font-bold text-green-400">
							X
						</div>
						<div className="flex-1">
							<p className="text-base text-green-400">
								Approved — Ready to Invoice
							</p>
							<p className="mt-0.5 text-sm text-neutral-500">
								{business.xeroConnected
									? "Xero is connected. Click to create a draft invoice."
									: "Connect Xero in Account Settings to enable invoicing."}
							</p>
						</div>
						<button
							onClick={() => {
								if (!business.xeroConnected)
									navigate("/account");
								else {
									updateJob(job.id, "status", "Invoiced");
									changeStatus(job.id, "Invoiced");
								}
							}}
							className={`rounded-lg border border-green-700 bg-green-900 px-4 py-2 text-sm text-green-300 transition-colors hover:bg-green-800 cursor-pointer ${!business.xeroConnected ? "opacity-50" : ""}`}
						>
							{business.xeroConnected
								? "Send to Xero"
								: "Connect Xero first"}
						</button>
					</div>
				)}
			</div>
		</div>
	);
}
