import { useState } from "react";
import { useApp } from "../AppContext";
import { TODAY } from "../data";
import type { Holiday, HolidayType } from "../types";

const HOLIDAY_TYPE_OPTIONS: {
	value: HolidayType;
	label: string;
	emoji: string;
	bg: string;
	text: string;
}[] = [
	{ value: "holiday", label: "Holiday", emoji: "🏖️", bg: "bg-blue-950/60", text: "text-blue-300" },
	{ value: "sick", label: "Sick", emoji: "🤒", bg: "bg-red-950/60", text: "text-red-300" },
	{ value: "training", label: "Training", emoji: "📚", bg: "bg-green-950/60", text: "text-green-300" },
	{ value: "other", label: "Other", emoji: "📅", bg: "bg-neutral-800", text: "text-neutral-400" },
];

const STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
	pending: { bg: "bg-amber-950/60", text: "text-amber-300", label: "Pending" },
	approved: { bg: "bg-green-950/60", text: "text-green-300", label: "Approved" },
	declined: { bg: "bg-red-950/60", text: "text-red-300", label: "Declined" },
};

function countDays(hols: Holiday[]): number {
	return hols.reduce((sum, h) => {
		if (h.halfDay) return sum + 0.5;
		if (h.endDate) {
			const start = new Date(h.date + "T00:00:00");
			const end = new Date(h.endDate + "T00:00:00");
			return sum + Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
		}
		return sum + 1;
	}, 0);
}

function computeStats(holidays: Holiday[], profileId: string, year: number, allowance: number) {
	const yearHols = holidays.filter(
		(h) => h.profileId === profileId && h.status === "approved" && h.date.startsWith(String(year)),
	);
	const holidayDays = countDays(yearHols.filter((h) => h.type === "holiday"));
	const sickDays = countDays(yearHols.filter((h) => h.type === "sick"));
	const trainingDays = countDays(yearHols.filter((h) => h.type === "training"));
	const otherDays = countDays(yearHols.filter((h) => h.type === "other"));
	const remaining = allowance - holidayDays; // Only holiday type counts against allowance
	return { holidayDays, sickDays, trainingDays, otherDays, remaining, allowance };
}

export function HolidaysPage() {
	const {
		currentUser,
		isMaster,
		users,
		holidays,
		business,
		createHoliday,
		deleteHoliday,
		approveHoliday,
		declineHoliday,
		saveUser,
	} = useApp();

	const currentYear = new Date().getFullYear();
	const [selectedYear, setSelectedYear] = useState(currentYear);
	const [showForm, setShowForm] = useState(false);
	const [reqDate, setReqDate] = useState("");
	const [reqEndDate, setReqEndDate] = useState("");
	const [reqType, setReqType] = useState<HolidayType>("holiday");
	const [reqHalfDay, setReqHalfDay] = useState(false);
	const [reqLabel, setReqLabel] = useState("");
	const [editAllowance, setEditAllowance] = useState<string | null>(null);

	const engineers = users.filter((u) => u.role === "engineer");
	const pendingRequests = holidays.filter((h) => h.status === "pending");

	function handleSubmitRequest() {
		if (!reqDate || !currentUser) return;
		createHoliday({
			profileId: currentUser.id,
			date: reqDate,
			endDate: reqEndDate && reqEndDate > reqDate ? reqEndDate : undefined,
			halfDay: reqHalfDay,
			label: reqLabel || "Holiday",
			type: reqType,
			status: "pending",
		});
		setShowForm(false);
		setReqDate("");
		setReqEndDate("");
		setReqType("holiday");
		setReqHalfDay(false);
		setReqLabel("");
	}

	function formatDate(ds: string) {
		return new Date(ds + "T00:00:00").toLocaleDateString("en-GB", {
			weekday: "short",
			day: "numeric",
			month: "short",
		});
	}

	// ── Master View ──────────────────────────────────────────────
	if (isMaster) {
		return (
			<div className="p-5 md:p-7 max-w-5xl">
				<div className="flex items-center justify-between mb-6 flex-wrap gap-3">
					<h1 className="text-2xl font-normal text-neutral-100 tracking-tight">
						Team Holidays
					</h1>
					<div className="flex items-center gap-2">
						<button
							onClick={() => setSelectedYear((y) => y - 1)}
							className="rounded-lg border border-neutral-700 bg-neutral-800 px-2.5 py-1.5 text-sm text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
						>
							‹
						</button>
						<span className="text-sm text-neutral-300 min-w-[48px] text-center">
							{selectedYear}
						</span>
						<button
							onClick={() => setSelectedYear((y) => y + 1)}
							className="rounded-lg border border-neutral-700 bg-neutral-800 px-2.5 py-1.5 text-sm text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
						>
							›
						</button>
					</div>
				</div>

				{/* Pending Requests */}
				{pendingRequests.length > 0 && (
					<section className="mb-6">
						<h2 className="text-sm text-neutral-400 uppercase tracking-wider mb-3">
							Pending Requests ({pendingRequests.length})
						</h2>
						<div className="space-y-2">
							{pendingRequests.map((h) => {
								const eng = users.find((u) => u.id === h.profileId);
								const typeCfg = HOLIDAY_TYPE_OPTIONS.find((t) => t.value === h.type);
								return (
									<div
										key={h.id}
										className="flex items-center gap-3 rounded-xl border border-amber-800/30 bg-amber-950/10 px-4 py-3 flex-wrap"
									>
										<span className="text-lg">{typeCfg?.emoji ?? "📅"}</span>
										<div className="flex-1 min-w-0">
											<p className="text-sm text-neutral-200">{eng?.name ?? "Unknown"}</p>
											<p className="text-xs text-neutral-500">
												{formatDate(h.date)}
												{h.endDate ? ` – ${formatDate(h.endDate)}` : ""}
												{h.halfDay ? " (½ day)" : ""}
												{h.label !== "Holiday" ? ` · ${h.label}` : ""}
											</p>
										</div>
										<div className="flex gap-2">
											<button
												onClick={() => approveHoliday(h.id)}
												className="rounded-lg px-3 py-1.5 text-xs font-medium bg-green-900/50 text-green-300 hover:bg-green-900/80 transition-colors cursor-pointer border border-green-800/50"
											>
												Approve
											</button>
											<button
												onClick={() => declineHoliday(h.id)}
												className="rounded-lg px-3 py-1.5 text-xs font-medium bg-red-900/50 text-red-300 hover:bg-red-900/80 transition-colors cursor-pointer border border-red-800/50"
											>
												Decline
											</button>
										</div>
									</div>
								);
							})}
						</div>
					</section>
				)}

				{/* Team Stats Table */}
				<section className="mb-6">
					<h2 className="text-sm text-neutral-400 uppercase tracking-wider mb-3">
						Team Stats — {selectedYear}
					</h2>
					<div className="overflow-x-auto rounded-xl border border-neutral-800">
						<table className="w-full text-sm">
							<thead>
								<tr className="bg-neutral-900 text-neutral-500 text-xs uppercase tracking-wider">
									<th className="text-left px-4 py-2.5">Engineer</th>
									<th className="text-center px-3 py-2.5">Allowance</th>
									<th className="text-center px-3 py-2.5">🏖️ Holiday</th>
									<th className="text-center px-3 py-2.5">Remaining</th>
									<th className="text-center px-3 py-2.5">🤒 Sick</th>
									<th className="text-center px-3 py-2.5">📚 Training</th>
									<th className="text-center px-3 py-2.5">📅 Other</th>
								</tr>
							</thead>
							<tbody>
								{engineers.map((eng) => {
									const stats = computeStats(holidays, eng.id, selectedYear, eng.holidayAllowance);
									const isEditingAllowance = editAllowance === eng.id;
									return (
										<tr key={eng.id} className="border-t border-neutral-800 hover:bg-neutral-900/50">
											<td className="px-4 py-2.5 text-neutral-200">
												<div className="flex items-center gap-2">
													<div
														className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium flex-shrink-0"
														style={{
															background: (eng.color ?? business.accentColor) + "22",
															border: `1px solid ${eng.color ?? business.accentColor}44`,
															color: eng.color ?? business.accentColor,
														}}
													>
														{eng.avatar}
													</div>
													{eng.name}
												</div>
											</td>
											<td className="text-center px-3 py-2.5">
												{isEditingAllowance ? (
													<input
														type="number"
														defaultValue={eng.holidayAllowance}
														className="w-14 rounded border border-neutral-600 bg-neutral-800 px-1.5 py-0.5 text-center text-sm text-neutral-200 outline-none"
														autoFocus
														onBlur={(e) => {
															const val = parseInt(e.target.value, 10);
															if (!isNaN(val) && val !== eng.holidayAllowance) {
																saveUser({ ...eng, holidayAllowance: val });
															}
															setEditAllowance(null);
														}}
														onKeyDown={(e) => {
															if (e.key === "Enter") (e.target as HTMLInputElement).blur();
														}}
													/>
												) : (
													<span
														className="text-neutral-400 cursor-pointer hover:text-neutral-200"
														onClick={() => setEditAllowance(eng.id)}
														title="Click to edit"
													>
														{stats.allowance}
													</span>
												)}
											</td>
											<td className="text-center px-3 py-2.5 text-blue-300">{stats.holidayDays}</td>
											<td className={`text-center px-3 py-2.5 font-medium ${stats.remaining < 0 ? "text-red-400" : stats.remaining <= 5 ? "text-amber-400" : "text-green-400"}`}>
												{stats.remaining}
											</td>
											<td className="text-center px-3 py-2.5 text-red-300">{stats.sickDays}</td>
											<td className="text-center px-3 py-2.5 text-green-300">{stats.trainingDays}</td>
											<td className="text-center px-3 py-2.5 text-neutral-400">{stats.otherDays}</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				</section>

				{/* Holiday List */}
				<section>
					<h2 className="text-sm text-neutral-400 uppercase tracking-wider mb-3">
						All Holidays — {selectedYear}
					</h2>
					{(() => {
						const yearHols = holidays
							.filter((h) => h.date.startsWith(String(selectedYear)))
							.sort((a, b) => a.date.localeCompare(b.date));
						if (yearHols.length === 0)
							return <p className="text-sm text-neutral-600 py-4">No holidays recorded for {selectedYear}.</p>;
						return (
							<div className="space-y-1.5">
								{yearHols.map((h) => {
									const eng = users.find((u) => u.id === h.profileId);
									const typeCfg = HOLIDAY_TYPE_OPTIONS.find((t) => t.value === h.type);
									const statusBadge = STATUS_BADGE[h.status];
									return (
										<div
											key={h.id}
											className="flex items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900/50 px-4 py-2"
										>
											<span className="text-base">{typeCfg?.emoji ?? "📅"}</span>
											<div className="flex-1 min-w-0">
												<p className="text-sm text-neutral-200">
													{eng?.name ?? "Unknown"}
													{h.label !== "Holiday" && h.label !== typeCfg?.label ? ` · ${h.label}` : ""}
												</p>
												<p className="text-xs text-neutral-500">
													{formatDate(h.date)}
													{h.endDate ? ` – ${formatDate(h.endDate)}` : ""}
													{h.halfDay ? " (½ day)" : ""}
												</p>
											</div>
											<span className={`text-[10px] px-2 py-0.5 rounded-full ${statusBadge.bg} ${statusBadge.text}`}>
												{statusBadge.label}
											</span>
										</div>
									);
								})}
							</div>
						);
					})()}
				</section>
			</div>
		);
	}

	// ── Engineer View ────────────────────────────────────────────
	const myStats = currentUser
		? computeStats(holidays, currentUser.id, selectedYear, currentUser.holidayAllowance)
		: null;
	const myHolidays = holidays
		.filter((h) => h.profileId === currentUser?.id && h.date.startsWith(String(selectedYear)))
		.sort((a, b) => a.date.localeCompare(b.date));

	return (
		<div className="p-5 md:p-7 max-w-3xl">
			<div className="flex items-center justify-between mb-6 flex-wrap gap-3">
				<h1 className="text-2xl font-normal text-neutral-100 tracking-tight">
					My Holidays
				</h1>
				<div className="flex items-center gap-2">
					<button
						onClick={() => setSelectedYear((y) => y - 1)}
						className="rounded-lg border border-neutral-700 bg-neutral-800 px-2.5 py-1.5 text-sm text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
					>
						‹
					</button>
					<span className="text-sm text-neutral-300 min-w-[48px] text-center">
						{selectedYear}
					</span>
					<button
						onClick={() => setSelectedYear((y) => y + 1)}
						className="rounded-lg border border-neutral-700 bg-neutral-800 px-2.5 py-1.5 text-sm text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
					>
						›
					</button>
				</div>
			</div>

			{/* My Stats */}
			{myStats && (
				<div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
					<div className="rounded-xl border border-neutral-800 bg-neutral-900 p-3 text-center">
						<p className="text-2xl font-bold text-blue-300">{myStats.holidayDays}</p>
						<p className="text-[11px] text-neutral-500">Holiday Taken</p>
					</div>
					<div className={`rounded-xl border p-3 text-center ${myStats.remaining < 0 ? "border-red-800/50 bg-red-950/20" : myStats.remaining <= 5 ? "border-amber-800/50 bg-amber-950/20" : "border-neutral-800 bg-neutral-900"}`}>
						<p className={`text-2xl font-bold ${myStats.remaining < 0 ? "text-red-400" : myStats.remaining <= 5 ? "text-amber-400" : "text-green-400"}`}>
							{myStats.remaining}
						</p>
						<p className="text-[11px] text-neutral-500">Remaining (of {myStats.allowance})</p>
					</div>
					<div className="rounded-xl border border-neutral-800 bg-neutral-900 p-3 text-center">
						<p className="text-2xl font-bold text-red-300">{myStats.sickDays}</p>
						<p className="text-[11px] text-neutral-500">Sick Days</p>
					</div>
					<div className="rounded-xl border border-neutral-800 bg-neutral-900 p-3 text-center">
						<p className="text-2xl font-bold text-green-300">{myStats.trainingDays}</p>
						<p className="text-[11px] text-neutral-500">Training</p>
					</div>
				</div>
			)}

			{/* Request Button + Form */}
			{!showForm ? (
				<button
					onClick={() => setShowForm(true)}
					className="mb-6 rounded-lg px-4 py-2.5 text-sm font-medium text-white cursor-pointer"
					style={{ backgroundColor: business.accentColor }}
				>
					+ Request Holiday
				</button>
			) : (
				<div className="mb-6 rounded-xl border border-neutral-800 bg-neutral-900 p-4 space-y-3">
					<h3 className="text-sm font-medium text-neutral-200">Request Holiday</h3>
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
						<div>
							<label className="block text-xs text-neutral-500 mb-1">Start Date</label>
							<input
								type="date"
								value={reqDate}
								onChange={(e) => setReqDate(e.target.value)}
								min={TODAY}
								className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-neutral-500"
							/>
						</div>
						<div>
							<label className="block text-xs text-neutral-500 mb-1">End Date (optional)</label>
							<input
								type="date"
								value={reqEndDate}
								onChange={(e) => setReqEndDate(e.target.value)}
								min={reqDate || TODAY}
								className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-neutral-500"
							/>
						</div>
					</div>
					<div>
						<label className="block text-xs text-neutral-500 mb-1">Type</label>
						<div className="flex gap-2 flex-wrap">
							{HOLIDAY_TYPE_OPTIONS.map((opt) => (
								<button
									key={opt.value}
									onClick={() => setReqType(opt.value)}
									className={`rounded-lg px-3 py-1.5 text-xs cursor-pointer border transition-colors ${
										reqType === opt.value
											? `${opt.bg} ${opt.text} border-current`
											: "border-neutral-700 bg-neutral-800 text-neutral-500 hover:text-neutral-300"
									}`}
								>
									{opt.emoji} {opt.label}
								</button>
							))}
						</div>
					</div>
					<div className="flex items-center gap-4">
						<label className="flex items-center gap-2 text-sm text-neutral-400 cursor-pointer">
							<input
								type="checkbox"
								checked={reqHalfDay}
								onChange={(e) => setReqHalfDay(e.target.checked)}
								className="accent-orange-500"
							/>
							Half day
						</label>
					</div>
					<div>
						<label className="block text-xs text-neutral-500 mb-1">Note (optional)</label>
						<input
							type="text"
							value={reqLabel}
							onChange={(e) => setReqLabel(e.target.value)}
							placeholder="e.g. Family holiday, Dentist appointment"
							className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-neutral-500 placeholder:text-neutral-600"
						/>
					</div>
					<div className="flex gap-2 pt-1">
						<button
							onClick={handleSubmitRequest}
							disabled={!reqDate}
							className="rounded-lg px-4 py-2 text-sm font-medium text-white cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
							style={{ backgroundColor: business.accentColor }}
						>
							Submit Request
						</button>
						<button
							onClick={() => setShowForm(false)}
							className="rounded-lg px-4 py-2 text-sm text-neutral-400 hover:text-neutral-200 border border-neutral-700 bg-neutral-800 cursor-pointer transition-colors"
						>
							Cancel
						</button>
					</div>
				</div>
			)}

			{/* My Holidays List */}
			<section>
				<h2 className="text-sm text-neutral-400 uppercase tracking-wider mb-3">
					My Holidays — {selectedYear}
				</h2>
				{myHolidays.length === 0 ? (
					<p className="text-sm text-neutral-600 py-4">No holidays for {selectedYear}.</p>
				) : (
					<div className="space-y-1.5">
						{myHolidays.map((h) => {
							const typeCfg = HOLIDAY_TYPE_OPTIONS.find((t) => t.value === h.type);
							const statusBadge = STATUS_BADGE[h.status];
							return (
								<div
									key={h.id}
									className="flex items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900/50 px-4 py-2"
								>
									<span className="text-base">{typeCfg?.emoji ?? "📅"}</span>
									<div className="flex-1 min-w-0">
										<p className="text-sm text-neutral-200">
											{typeCfg?.label ?? h.type}
											{h.label !== "Holiday" && h.label !== typeCfg?.label ? ` · ${h.label}` : ""}
										</p>
										<p className="text-xs text-neutral-500">
											{formatDate(h.date)}
											{h.endDate ? ` – ${formatDate(h.endDate)}` : ""}
											{h.halfDay ? " (½ day)" : ""}
										</p>
									</div>
									<span className={`text-[10px] px-2 py-0.5 rounded-full ${statusBadge.bg} ${statusBadge.text}`}>
										{statusBadge.label}
									</span>
									{h.status === "pending" && (
										<button
											onClick={() => deleteHoliday(h.id)}
											className="text-xs text-neutral-600 hover:text-red-400 transition-colors cursor-pointer"
											title="Cancel request"
										>
											Cancel
										</button>
									)}
								</div>
							);
						})}
					</div>
				)}
			</section>
		</div>
	);
}
