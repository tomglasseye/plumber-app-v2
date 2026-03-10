import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../AppContext";
import { ACCENT_OPTIONS, STATUS_COLORS, TODAY, userColor } from "../data";
import type { Job, Role, User } from "../types";

interface EditForm {
	name: string;
	phone: string;
	home: string;
	avatar: string;
	role: Role;
	color: string;
}

export function TeamPage() {
	const {
		jobs,
		users,
		saveUser,
		changePassword,
		isMaster,
		business,
		updateJob,
		addNotification,
		currentUser,
	} = useApp();
	const navigate = useNavigate();

	const [editing, setEditing] = useState<User | null>(null);
	const [form, setForm] = useState<EditForm>({
		name: "",
		phone: "",
		home: "",
		avatar: "",
		role: "engineer",
		color: "#f97316",
	});
	const [saving, setSaving] = useState(false);
	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [pwSaving, setPwSaving] = useState(false);
	const [pwError, setPwError] = useState<string | null>(null);
	const [pwSuccess, setPwSuccess] = useState(false);

	function openEdit(u: User) {
		setEditing(u);
		setForm({
			name: u.name,
			phone: u.phone,
			home: u.home,
			avatar: u.avatar,
			role: u.role,
			color: u.color ?? "#f97316",
		});
	}

	function closeEdit() {
		setEditing(null);
		setNewPassword("");
		setConfirmPassword("");
		setPwError(null);
		setPwSuccess(false);
	}

	async function handleSave() {
		if (!editing) return;
		setSaving(true);
		await saveUser({
			...editing,
			name: form.name.trim(),
			phone: form.phone.trim(),
			home: form.home.trim(),
			avatar: form.avatar.trim().toUpperCase().slice(0, 3),
			role: form.role,
			color: form.color,
		});
		setSaving(false);
		closeEdit();
	}

	async function handlePasswordSave() {
		if (!editing) return;
		if (newPassword.length < 8) {
			setPwError("Password must be at least 8 characters.");
			return;
		}
		if (newPassword !== confirmPassword) {
			setPwError("Passwords do not match.");
			return;
		}
		setPwSaving(true);
		setPwError(null);
		const err = await changePassword(editing.id, newPassword);
		setPwSaving(false);
		if (err) {
			setPwError(err);
		} else {
			setPwSuccess(true);
			setNewPassword("");
			setConfirmPassword("");
			setTimeout(() => setPwSuccess(false), 3000);
		}
	}

	// Drag-and-drop state for today's job ordering
	const [dragJobId, setDragJobId] = useState<string | null>(null);
	const [todayOrders, setTodayOrders] = useState<Record<string, string[]>>(
		{},
	);

	function dayLabel(date: string): string {
		const tomorrow = new Date(TODAY + "T00:00:00");
		tomorrow.setDate(tomorrow.getDate() + 1);
		const tomorrowStr = tomorrow.toISOString().slice(0, 10);
		if (date === TODAY) return "Today";
		if (date === tomorrowStr) return "Tomorrow";
		return new Date(date + "T00:00:00").toLocaleDateString("en-GB", {
			weekday: "long",
			day: "numeric",
			month: "short",
		});
	}

	function handleDrop(engId: string, targetId: string, currentIds: string[]) {
		if (!dragJobId || dragJobId === targetId) return;
		const from = currentIds.indexOf(dragJobId);
		const to = currentIds.indexOf(targetId);
		if (from < 0 || to < 0) return;
		const next = [...currentIds];
		next.splice(from, 1);
		next.splice(to, 0, dragJobId);
		setTodayOrders((p) => ({ ...p, [engId]: next }));
		next.forEach((id, i) => updateJob(id, "sortOrder", i + 1));
		setDragJobId(null);
		// Notify the engineer their run order has changed
		const eng = users.find((u) => u.id === engId);
		if (eng) {
			addNotification({
				icon: "🗺",
				message: `${currentUser?.name ?? "Master"} updated your job run order for today`,
				for: engId,
			});
		}
	}

	// All users — master first, then engineers alphabetically
	const sorted = [...users].sort((a, b) => {
		if (a.role === b.role) return a.name.localeCompare(b.name);
		return a.role === "master" ? -1 : 1;
	});

	return (
		<div className="p-5 md:p-7 max-w-6xl overflow-x-hidden">
			<h1 className="mb-6 text-2xl font-normal text-neutral-100 tracking-tight">
				Team
			</h1>

			{/* Masters — compact row */}
			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
				{sorted
					.filter((u) => u.role === "master")
					.map((u) => {
						const ec = u.color ?? business.accentColor;
						return (
							<div
								key={u.id}
								className="rounded-xl border border-neutral-800 bg-neutral-900 p-5"
							>
								<div className="flex gap-3 items-start">
									<div
										className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-medium"
										style={{
											background: ec + "22",
											border: `1px solid ${ec}44`,
											color: ec,
										}}
									>
										{u.avatar}
									</div>
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-2">
											<p className="text-base text-neutral-100 truncate">
												{u.name}
											</p>
											<span className="flex-shrink-0 text-[10px] px-2 py-0.5 rounded-full font-mono bg-orange-950 text-orange-400">
												Master
											</span>
										</div>
										{u.phone && (
											<p className="text-xs text-neutral-600 mt-0.5">
												📞 {u.phone}
											</p>
										)}
										{u.home && (
											<p className="mt-0.5 text-xs text-neutral-700 truncate">
												🏠 {u.home}
											</p>
										)}
									</div>
									{isMaster && (
										<button
											onClick={() => openEdit(u)}
											className="flex-shrink-0 rounded-lg p-1.5 text-neutral-600 hover:text-neutral-300 hover:bg-neutral-800 transition-colors"
											title="Edit member"
										>
											<svg
												className="h-4 w-4"
												fill="none"
												viewBox="0 0 24 24"
												stroke="currentColor"
												strokeWidth={1.5}
											>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"
												/>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													d="M19.5 7.125L18 8.625"
												/>
											</svg>
										</button>
									)}
								</div>
							</div>
						);
					})}
			</div>

			{/* Engineers — full-width cards with day-grouped schedule */}
			<div className="space-y-4">
				{sorted
					.filter((u) => u.role === "engineer")
					.map((u) => {
						const ec = userColor(u.id, users);
						const assigned = jobs.filter(
							(j) => j.assignedTo === u.id,
						);
						const active = assigned.filter((j) =>
							["En Route", "On Site"].includes(j.status),
						);
						const done = assigned.filter(
							(j) => j.status === "Completed",
						);

						// Today + future, excluding completed/invoiced
						const upcoming = assigned
							.filter(
								(j) =>
									j.date >= TODAY &&
									!["Completed", "Invoiced"].includes(
										j.status,
									),
							)
							.sort(
								(a, b) =>
									a.date.localeCompare(b.date) ||
									(a.sortOrder ?? 0) - (b.sortOrder ?? 0),
							);

						// Group by date
						const byDate: Record<string, Job[]> = {};
						for (const j of upcoming) {
							(byDate[j.date] ??= []).push(j);
						}

						const todayJobsForEng = byDate[TODAY] ?? [];
						const currentTodayOrder =
							todayOrders[u.id] ??
							todayJobsForEng.map((j) => j.id);
						const orderedToday = currentTodayOrder
							.map((id) =>
								todayJobsForEng.find((j) => j.id === id),
							)
							.filter(Boolean) as Job[];

						const dateEntries = Object.entries(byDate).sort(
							([a], [b]) => a.localeCompare(b),
						);

						return (
							<div
								key={u.id}
								className="rounded-xl border border-neutral-800 bg-neutral-900 p-5 flex flex-col md:flex-row gap-5 md:gap-6"
							>
								{/* Left panel: user info + stats */}
								<div className="md:w-52 flex-shrink-0">
									<div className="flex gap-3 items-start mb-4">
										<div
											className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-medium"
											style={{
												background: ec + "22",
												border: `1px solid ${ec}44`,
												color: ec,
											}}
										>
											{u.avatar}
										</div>
										<div className="flex-1 min-w-0">
											<div className="flex items-center gap-2 flex-wrap">
												<p className="text-base text-neutral-100 truncate">
													{u.name}
												</p>
												<span className="flex-shrink-0 text-[10px] px-2 py-0.5 rounded-full font-mono bg-blue-950 text-blue-400">
													Engineer
												</span>
											</div>
											{u.phone && (
												<p className="text-xs text-neutral-600 mt-0.5">
													📞 {u.phone}
												</p>
											)}
											{u.home && (
												<p className="mt-0.5 text-xs text-neutral-700 truncate">
													🏠 {u.home}
												</p>
											)}
										</div>
										{isMaster && (
											<button
												onClick={() => openEdit(u)}
												className="flex-shrink-0 rounded-lg p-1.5 text-neutral-600 hover:text-neutral-300 hover:bg-neutral-800 transition-colors"
												title="Edit member"
											>
												<svg
													className="h-4 w-4"
													fill="none"
													viewBox="0 0 24 24"
													stroke="currentColor"
													strokeWidth={1.5}
												>
													<path
														strokeLinecap="round"
														strokeLinejoin="round"
														d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"
													/>
													<path
														strokeLinecap="round"
														strokeLinejoin="round"
														d="M19.5 7.125L18 8.625"
													/>
												</svg>
											</button>
										)}
									</div>

									{/* Stats */}
									<div className="flex rounded-xl bg-neutral-950 overflow-hidden">
										{[
											{
												label: "Total",
												count: assigned.length,
												color: "text-neutral-200",
											},
											{
												label: "Active",
												count: active.length,
												color: "text-green-400",
											},
											{
												label: "Done",
												count: done.length,
												color: "text-purple-400",
											},
										].map((s) => (
											<div
												key={s.label}
												className="flex-1 py-2.5 text-center"
											>
												<span
													className={`block text-xl font-light ${s.color}`}
												>
													{s.count}
												</span>
												<span className="block text-[10px] text-neutral-600">
													{s.label}
												</span>
											</div>
										))}
									</div>
								</div>

								{/* Right panel: day-grouped schedule */}
								<div className="flex-1 min-w-0 md:border-l md:border-neutral-800 md:pl-6">
									{dateEntries.length === 0 ? (
										<p className="text-xs text-neutral-700 py-2">
											No upcoming jobs scheduled
										</p>
									) : (
										<div className="space-y-5">
											{dateEntries.map(
												([date, dateJobs]) => {
													const isToday =
														date === TODAY;
													const displayJobs = isToday
														? orderedToday
														: dateJobs;
													return (
														<div key={date}>
															<p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-2 flex items-center gap-2">
																{dayLabel(date)}
																{isToday &&
																	isMaster && (
																		<span className="normal-case tracking-normal text-neutral-700">
																			—
																			drag
																			to
																			reorder
																		</span>
																	)}
															</p>
															<div>
																{displayJobs.map(
																	(
																		j,
																		idx,
																	) => {
																		const sc =
																			STATUS_COLORS[
																				j
																					.status
																			];
																		return (
																			<div
																				key={
																					j.id
																				}
																				draggable={
																					isToday &&
																					isMaster
																				}
																				onDragStart={() => {
																					if (
																						isToday &&
																						isMaster
																					)
																						setDragJobId(
																							j.id,
																						);
																				}}
																				onDragOver={(
																					e,
																				) => {
																					if (
																						isToday &&
																						isMaster
																					)
																						e.preventDefault();
																				}}
																				onDrop={(
																					e,
																				) => {
																					e.preventDefault();
																					if (
																						isToday &&
																						isMaster
																					)
																						handleDrop(
																							u.id,
																							j.id,
																							currentTodayOrder,
																						);
																				}}
																				onClick={() =>
																					navigate(
																						`/job/${j.id}`,
																					)
																				}
																				className={`flex items-center gap-2 border-t border-neutral-800 py-2 -mx-1 px-1 rounded hover:bg-neutral-800/40 transition-colors select-none ${isToday && isMaster ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"} ${dragJobId === j.id ? "opacity-30" : ""}`}
																			>
																				{isToday &&
																					isMaster && (
																						<svg
																							className="h-3.5 w-3.5 text-neutral-700 flex-shrink-0"
																							fill="currentColor"
																							viewBox="0 0 20 20"
																						>
																							<path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
																						</svg>
																					)}
																				{isToday && (
																					<span className="w-4 flex-shrink-0 text-[10px] text-neutral-700 font-mono text-center">
																						{idx +
																							1}
																					</span>
																				)}
																				<div
																					className="h-2 w-2 flex-shrink-0 rounded-full"
																					style={{
																						background:
																							ec,
																					}}
																				/>
																				<span className="hidden sm:block w-14 flex-shrink-0 text-[10px] text-neutral-600">
																					{
																						j.ref
																					}
																				</span>
																				<div className="flex-1 min-w-0">
																					<span className="block truncate text-sm text-neutral-400">
																						{
																							j.customer
																						}
																					</span>
																					<span className="block truncate text-xs text-neutral-600">
																						📍{" "}
																						{
																							j.address
																						}
																					</span>
																				</div>
																				<span
																					className={`hidden sm:inline text-[10px] px-2 py-0.5 rounded-full flex-shrink-0 font-mono ${sc.bg} ${sc.text}`}
																				>
																					{
																						j.status
																					}
																				</span>
																			</div>
																		);
																	},
																)}
															</div>
														</div>
													);
												},
											)}
										</div>
									)}
								</div>
							</div>
						);
					})}
			</div>

			{/* Edit Modal */}
			{editing && (
				<div
					className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
					onClick={(e) => e.target === e.currentTarget && closeEdit()}
				>
					<div className="w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
						<h2 className="mb-5 text-lg text-neutral-100">
							Edit — {editing.name}
						</h2>

						<div className="space-y-4">
							{/* Name */}
							<div>
								<label className="mb-1.5 block text-xs uppercase tracking-wider text-neutral-600">
									Full Name
								</label>
								<input
									type="text"
									value={form.name}
									onChange={(e) =>
										setForm((f) => ({
											...f,
											name: e.target.value,
										}))
									}
									className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2.5 text-sm text-neutral-100 outline-none focus:border-neutral-500"
								/>
							</div>

							{/* Avatar initials */}
							<div>
								<label className="mb-1.5 block text-xs uppercase tracking-wider text-neutral-600">
									Initials (2–3 letters)
								</label>
								<input
									type="text"
									maxLength={3}
									value={form.avatar}
									onChange={(e) =>
										setForm((f) => ({
											...f,
											avatar: e.target.value,
										}))
									}
									className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2.5 text-sm text-neutral-100 outline-none focus:border-neutral-500 uppercase"
								/>
							</div>

							{/* Phone */}
							<div>
								<label className="mb-1.5 block text-xs uppercase tracking-wider text-neutral-600">
									Phone
								</label>
								<input
									type="tel"
									value={form.phone}
									onChange={(e) =>
										setForm((f) => ({
											...f,
											phone: e.target.value,
										}))
									}
									className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2.5 text-sm text-neutral-100 outline-none focus:border-neutral-500"
								/>
							</div>

							{/* Home address */}
							<div>
								<label className="mb-1.5 block text-xs uppercase tracking-wider text-neutral-600">
									Home Address
								</label>
								<input
									type="text"
									value={form.home}
									onChange={(e) =>
										setForm((f) => ({
											...f,
											home: e.target.value,
										}))
									}
									className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2.5 text-sm text-neutral-100 outline-none focus:border-neutral-500"
								/>
							</div>

							{/* Role */}
							<div>
								<label className="mb-1.5 block text-xs uppercase tracking-wider text-neutral-600">
									Role
								</label>
								<select
									value={form.role}
									onChange={(e) =>
										setForm((f) => ({
											...f,
											role: e.target.value as Role,
										}))
									}
									className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2.5 text-sm text-neutral-100 outline-none focus:border-neutral-500"
								>
									<option value="engineer">Engineer</option>
									<option value="master">Master</option>
								</select>
							</div>

							{/* Accent colour */}
							<div>
								<label className="mb-1.5 block text-xs uppercase tracking-wider text-neutral-600">
									Accent Colour
								</label>
								<div className="flex flex-wrap gap-2">
									{ACCENT_OPTIONS.map((c) => (
										<div
											key={c}
											onClick={() =>
												setForm((f) => ({
													...f,
													color: c,
												}))
											}
											className="h-7 w-7 cursor-pointer rounded-full transition-transform hover:scale-110"
											style={{
												background: c,
												outline:
													form.color === c
														? "2px solid white"
														: "2px solid transparent",
												outlineOffset: 2,
											}}
										/>
									))}
								</div>
							</div>
						</div>
						{/* end space-y-4 */}

						<div className="mt-6 flex gap-3">
							<button
								onClick={closeEdit}
								className="flex-1 rounded-lg border border-neutral-700 px-4 py-2.5 text-sm text-neutral-400 hover:text-neutral-200 transition-colors"
							>
								Cancel
							</button>
							<button
								onClick={handleSave}
								disabled={saving || !form.name.trim()}
								className="flex-1 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
								style={{
									backgroundColor: business.accentColor,
								}}
							>
								{saving ? "Saving…" : "Save Changes"}
							</button>
						</div>

						{/* Password section */}
						<div className="mt-5 border-t border-neutral-800 pt-5">
							<p className="mb-3 text-xs uppercase tracking-wider text-neutral-600">
								Set New Password
							</p>
							<div className="space-y-3">
								<input
									type="password"
									placeholder="New password (min. 8 chars)"
									value={newPassword}
									onChange={(e) => {
										setNewPassword(e.target.value);
										setPwError(null);
									}}
									className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2.5 text-sm text-neutral-100 outline-none focus:border-neutral-500"
								/>
								<input
									type="password"
									placeholder="Confirm new password"
									value={confirmPassword}
									onChange={(e) => {
										setConfirmPassword(e.target.value);
										setPwError(null);
									}}
									className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2.5 text-sm text-neutral-100 outline-none focus:border-neutral-500"
								/>
							</div>
							{pwError && (
								<p className="mt-2 text-xs text-red-400">
									{pwError}
								</p>
							)}
							{pwSuccess && (
								<p className="mt-2 text-xs text-emerald-400">
									✓ Password updated
								</p>
							)}
							<button
								onClick={handlePasswordSave}
								disabled={
									pwSaving || !newPassword || !confirmPassword
								}
								className="mt-3 w-full rounded-lg border border-neutral-700 px-4 py-2.5 text-sm text-neutral-300 hover:text-neutral-100 hover:border-neutral-500 transition-colors disabled:opacity-40"
							>
								{pwSaving ? "Updating…" : "Update Password"}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
