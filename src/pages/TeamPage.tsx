import { useState } from "react";
import { useApp } from "../AppContext";
import { ACCENT_OPTIONS, userColor } from "../data";
import type { Role, User } from "../types";

interface EditForm {
	name: string;
	phone: string;
	home: string;
	avatar: string;
	role: Role;
	color: string;
}

interface AddForm {
	name: string;
	email: string;
	password: string;
	confirmPassword: string;
	phone: string;
	home: string;
	role: Role;
}

export function TeamPage() {
	const {
		users,
		saveUser,
		lockUser,
		unlockUser,
		deleteUser,
		changePassword,
		inviteUser,
		isMaster,
		business,
		currentUser,
	} = useApp();

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
	const [confirmDelete, setConfirmDelete] = useState(false);

	// Add member modal
	const [showAdd, setShowAdd] = useState(false);
	const [addForm, setAddForm] = useState<AddForm>({
		name: "",
		email: "",
		password: "",
		confirmPassword: "",
		phone: "",
		home: "",
		role: "engineer",
	});
	const [addSaving, setAddSaving] = useState(false);
	const [addError, setAddError] = useState<string | null>(null);

	function openAdd() {
		setAddForm({
			name: "",
			email: "",
			password: "",
			confirmPassword: "",
			phone: "",
			home: "",
			role: "engineer",
		});
		setAddError(null);
		setShowAdd(true);
	}

	function closeAdd() {
		setShowAdd(false);
		setAddError(null);
	}

	async function handleAdd() {
		if (!addForm.name.trim()) {
			setAddError("Name is required.");
			return;
		}
		if (!addForm.email.trim()) {
			setAddError("Email is required.");
			return;
		}
		if (addForm.password.length < 8) {
			setAddError("Password must be at least 8 characters.");
			return;
		}
		if (addForm.password !== addForm.confirmPassword) {
			setAddError("Passwords do not match.");
			return;
		}
		setAddSaving(true);
		setAddError(null);
		const err = await inviteUser({
			email: addForm.email.trim(),
			password: addForm.password,
			name: addForm.name.trim(),
			role: addForm.role,
			phone: addForm.phone.trim(),
			homeAddress: addForm.home.trim(),
		});
		setAddSaving(false);
		if (err) {
			setAddError(err);
		} else {
			closeAdd();
		}
	}

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
		setConfirmDelete(false);
		setNewPassword("");
		setConfirmPassword("");
		setPwError(null);
		setPwSuccess(false);
	}

	function closeEdit() {
		setEditing(null);
		setNewPassword("");
		setConfirmPassword("");
		setPwError(null);
		setPwSuccess(false);
		setConfirmDelete(false);
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

	function handleDelete() {
		if (!editing) return;
		deleteUser(editing.id);
		closeEdit();
	}

	const sorted = [...users].sort((a, b) => {
		if (a.role === b.role) return a.name.localeCompare(b.name);
		return a.role === "master" ? -1 : 1;
	});

	const engineers = sorted.filter((u) => u.role === "engineer");
	const masters = sorted.filter((u) => u.role === "master");

	const inputCls =
		"w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2.5 text-sm text-neutral-100 outline-none focus:border-neutral-500";

	return (
		<div className="p-6 md:p-8 max-w-3xl">
			<div className="flex items-center justify-between mb-6 gap-4">
				<div>
					<h1 className="text-2xl font-normal text-neutral-100 tracking-tight">
						Team
					</h1>
					<p className="mt-0.5 text-sm text-neutral-600">
						{users.length} member{users.length !== 1 ? "s" : ""}
					</p>
				</div>
				{isMaster && (
					<button
						onClick={openAdd}
						className="rounded-lg px-4 py-2 text-sm font-medium text-white cursor-pointer hover:opacity-90 transition-opacity"
						style={{ backgroundColor: business.accentColor }}
					>
						+ Add Member
					</button>
				)}
			</div>

			{/* Masters section */}
			{masters.length > 0 && (
				<section className="mb-8">
					<h2 className="text-[11px] uppercase tracking-wider text-neutral-600 mb-4">
						Administrators
					</h2>
					<div className="space-y-3">
						{masters.map((u) => (
							<MemberRow
								key={u.id}
								user={u}
								accent={u.color ?? business.accentColor}
								isSelf={u.id === currentUser?.id}
								canEdit={isMaster}
								onEdit={() => openEdit(u)}
								onLock={() => lockUser(u.id)}
								onUnlock={() => unlockUser(u.id)}
							/>
						))}
					</div>
				</section>
			)}

			{/* Engineers section */}
			<section>
				<h2 className="text-[11px] uppercase tracking-wider text-neutral-600 mb-4">
					Engineers
				</h2>
				{engineers.length === 0 ? (
					<div className="rounded-xl border border-dashed border-neutral-800 bg-neutral-900/50 py-10 text-center">
						<p className="text-sm text-neutral-600">
							No engineers yet
						</p>
						<p className="text-xs text-neutral-500 mt-1">
							Add team members from Account settings
						</p>
					</div>
				) : (
					<div className="space-y-3">
						{engineers.map((u) => (
							<MemberRow
								key={u.id}
								user={u}
								accent={userColor(u.id, users)}
								isSelf={u.id === currentUser?.id}
								canEdit={isMaster}
								onEdit={() => openEdit(u)}
								onLock={() => lockUser(u.id)}
								onUnlock={() => unlockUser(u.id)}
							/>
						))}
					</div>
				)}
			</section>

			{/* Add Member Modal */}
			{showAdd && (
				<div
					className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 overflow-y-auto"
					onClick={(e) => e.target === e.currentTarget && closeAdd()}
				>
					<div className="w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-900 p-6 my-4">
						<h2 className="mb-1 text-lg text-neutral-100">
							Add Team Member
						</h2>
						<p className="mb-5 text-xs text-neutral-600">
							Set their login details and share them directly.
						</p>

						<div className="space-y-4">
							<div>
								<label className="mb-1.5 block text-xs uppercase tracking-wider text-neutral-600">
									Full Name
								</label>
								<input
									type="text"
									value={addForm.name}
									onChange={(e) =>
										setAddForm((f) => ({
											...f,
											name: e.target.value,
										}))
									}
									className={inputCls}
									placeholder="e.g. Tom Briggs"
								/>
							</div>
							<div>
								<label className="mb-1.5 block text-xs uppercase tracking-wider text-neutral-600">
									Work Email
								</label>
								<input
									type="email"
									value={addForm.email}
									onChange={(e) =>
										setAddForm((f) => ({
											...f,
											email: e.target.value,
										}))
									}
									className={inputCls}
									placeholder="tom@yourcompany.co.uk"
								/>
							</div>
							<div>
								<label className="mb-1.5 block text-xs uppercase tracking-wider text-neutral-600">
									Role
								</label>
								<select
									value={addForm.role}
									onChange={(e) =>
										setAddForm((f) => ({
											...f,
											role: e.target.value as Role,
										}))
									}
									className={inputCls}
								>
									<option value="engineer">Engineer</option>
									<option value="master">
										Master (Admin)
									</option>
								</select>
							</div>
							<div>
								<label className="mb-1.5 block text-xs uppercase tracking-wider text-neutral-600">
									Phone
								</label>
								<input
									type="tel"
									value={addForm.phone}
									onChange={(e) =>
										setAddForm((f) => ({
											...f,
											phone: e.target.value,
										}))
									}
									className={inputCls}
									placeholder="07700 900000"
								/>
							</div>
							<div>
								<label className="mb-1.5 block text-xs uppercase tracking-wider text-neutral-600">
									Home Address
								</label>
								<input
									type="text"
									value={addForm.home}
									onChange={(e) =>
										setAddForm((f) => ({
											...f,
											home: e.target.value,
										}))
									}
									className={inputCls}
									placeholder="Optional"
								/>
							</div>
							<div className="border-t border-neutral-800 pt-4">
								<label className="mb-1.5 block text-xs uppercase tracking-wider text-neutral-600">
									Password
								</label>
								<input
									type="password"
									value={addForm.password}
									onChange={(e) =>
										setAddForm((f) => ({
											...f,
											password: e.target.value,
										}))
									}
									className={inputCls}
									placeholder="Min. 8 characters"
								/>
							</div>
							<div>
								<label className="mb-1.5 block text-xs uppercase tracking-wider text-neutral-600">
									Confirm Password
								</label>
								<input
									type="password"
									value={addForm.confirmPassword}
									onChange={(e) =>
										setAddForm((f) => ({
											...f,
											confirmPassword: e.target.value,
										}))
									}
									className={inputCls}
									placeholder="Repeat password"
								/>
							</div>
						</div>

						{addError && (
							<p className="mt-3 text-sm text-red-400">
								{addError}
							</p>
						)}

						<div className="mt-6 flex gap-3">
							<button
								onClick={closeAdd}
								className="flex-1 rounded-lg border border-neutral-700 px-4 py-2.5 text-sm text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
							>
								Cancel
							</button>
							<button
								onClick={handleAdd}
								disabled={addSaving}
								className="flex-1 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
								style={{
									backgroundColor: business.accentColor,
								}}
							>
								{addSaving ? "Creating..." : "Create Member"}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Edit Modal */}
			{editing && (
				<div
					className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 overflow-y-auto"
					onClick={(e) => e.target === e.currentTarget && closeEdit()}
				>
					<div className="w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-900 p-6 my-4">
						<h2 className="mb-5 text-lg text-neutral-100">
							Edit — {editing.name}
						</h2>

						<div className="space-y-4">
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
									className={inputCls}
								/>
							</div>
							<div>
								<label className="mb-1.5 block text-xs uppercase tracking-wider text-neutral-600">
									Initials (2-3 letters)
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
									className={inputCls + " uppercase"}
								/>
							</div>
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
									className={inputCls}
								/>
							</div>
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
									className={inputCls}
								/>
							</div>
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
									className={inputCls}
								>
									<option value="engineer">Engineer</option>
									<option value="master">Master</option>
								</select>
							</div>
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

						<div className="mt-6 flex gap-3">
							<button
								onClick={closeEdit}
								className="flex-1 rounded-lg border border-neutral-700 px-4 py-2.5 text-sm text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
							>
								Cancel
							</button>
							<button
								onClick={handleSave}
								disabled={saving || !form.name.trim()}
								className="flex-1 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
								style={{
									backgroundColor: business.accentColor,
								}}
							>
								{saving ? "Saving..." : "Save Changes"}
							</button>
						</div>

						{/* Lock / Unlock — not for self */}
						{editing.id !== currentUser?.id && (
							<div className="mt-4 border-t border-neutral-800 pt-4">
								<p className="mb-2 text-xs uppercase tracking-wider text-neutral-600">
									Account Access
								</p>
								{editing.locked ? (
									<button
										onClick={() => {
											unlockUser(editing.id);
											closeEdit();
										}}
										className="w-full rounded-lg border border-green-800 bg-green-950 px-4 py-2.5 text-sm text-green-400 hover:bg-green-900 transition-colors cursor-pointer"
									>
										Unlock Account
									</button>
								) : (
									<button
										onClick={() => {
											lockUser(editing.id);
											closeEdit();
										}}
										className="w-full rounded-lg border border-amber-800 bg-amber-950 px-4 py-2.5 text-sm text-amber-500 hover:bg-amber-900 transition-colors cursor-pointer"
									>
										Lock Account
									</button>
								)}
							</div>
						)}

						{/* Password section */}
						<div className="mt-4 border-t border-neutral-800 pt-4">
							<p className="mb-3 text-xs uppercase tracking-wider text-neutral-600">
								Reset Password
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
									className={inputCls}
								/>
								<input
									type="password"
									placeholder="Confirm new password"
									value={confirmPassword}
									onChange={(e) => {
										setConfirmPassword(e.target.value);
										setPwError(null);
									}}
									className={inputCls}
								/>
							</div>
							{pwError && (
								<p className="mt-2 text-xs text-red-400">
									{pwError}
								</p>
							)}
							{pwSuccess && (
								<p className="mt-2 text-xs text-emerald-400">
									Password updated
								</p>
							)}
							<button
								onClick={handlePasswordSave}
								disabled={
									pwSaving || !newPassword || !confirmPassword
								}
								className="mt-3 w-full rounded-lg border border-neutral-700 px-4 py-2.5 text-sm text-neutral-300 hover:text-neutral-100 hover:border-neutral-500 transition-colors disabled:opacity-40 cursor-pointer"
							>
								{pwSaving ? "Updating..." : "Update Password"}
							</button>
						</div>

						{/* Delete — not for self */}
						{editing.id !== currentUser?.id && (
							<div className="mt-4 border-t border-neutral-800 pt-4">
								<p className="mb-2 text-xs uppercase tracking-wider text-neutral-600">
									Danger Zone
								</p>
								{!confirmDelete ? (
									<button
										onClick={() => setConfirmDelete(true)}
										className="w-full rounded-lg border border-red-900 bg-neutral-900 px-4 py-2.5 text-sm text-red-600 hover:bg-red-950 hover:text-red-400 transition-colors cursor-pointer"
									>
										Delete Team Member
									</button>
								) : (
									<div className="space-y-3">
										<p className="text-xs text-red-400">
											This removes their profile
											permanently. Their jobs remain
											assigned to them. Are you sure?
										</p>
										<div className="flex gap-2">
											<button
												onClick={() =>
													setConfirmDelete(false)
												}
												className="flex-1 rounded-lg border border-neutral-700 px-3 py-2 text-sm text-neutral-400 hover:text-neutral-200 cursor-pointer"
											>
												Cancel
											</button>
											<button
												onClick={handleDelete}
												className="flex-1 rounded-lg bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-600 transition-colors cursor-pointer"
											>
												Yes, Delete
											</button>
										</div>
									</div>
								)}
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
}

// ── Member row component ────────────────────────────────────────────────────

function MemberRow({
	user,
	accent,
	isSelf,
	canEdit,
	onEdit,
	onLock,
	onUnlock,
}: {
	user: User;
	accent: string;
	isSelf: boolean;
	canEdit: boolean;
	onEdit: () => void;
	onLock: () => void;
	onUnlock: () => void;
}) {
	return (
		<div
			className={`flex items-center gap-4 rounded-xl border px-4 py-3 transition-colors ${user.locked ? "border-red-900/40 bg-neutral-900/60 opacity-60" : "border-neutral-800 bg-neutral-900"}`}
		>
			{/* Avatar */}
			<div
				className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-medium"
				style={{
					background: accent + "22",
					border: `1px solid ${accent}44`,
					color: accent,
				}}
			>
				{user.avatar}
				{user.locked && (
					<span className="absolute -top-1 -right-1 text-[10px]">
						🔒
					</span>
				)}
			</div>

			{/* Info */}
			<div className="flex-1 min-w-0">
				<div className="flex items-center gap-2 flex-wrap">
					<p className="text-sm text-neutral-100 font-medium truncate">
						{user.name}
					</p>
					{isSelf && (
						<span className="text-[9px] px-1.5 py-0.5 rounded-full bg-neutral-800 text-neutral-500">
							You
						</span>
					)}
					{user.role === "master" ? (
						<span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-orange-950 text-orange-400">
							Admin
						</span>
					) : user.locked ? (
						<span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-red-950 text-red-400">
							Locked
						</span>
					) : (
						<span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-blue-950 text-blue-400">
							Engineer
						</span>
					)}
				</div>
				<div className="flex items-center gap-3 mt-0.5 flex-wrap">
					{user.email && (
						<span className="text-xs text-neutral-600 truncate">
							{user.email}
						</span>
					)}
					{user.phone && (
						<span className="text-xs text-neutral-600">
							{user.phone}
						</span>
					)}
				</div>
			</div>

			{/* Quick actions */}
			{canEdit && (
				<div className="flex items-center gap-1 flex-shrink-0">
					{!isSelf && (
						<button
							onClick={(e) => {
								e.stopPropagation();
								user.locked ? onUnlock() : onLock();
							}}
							className={`rounded-lg p-2 transition-colors cursor-pointer ${user.locked ? "text-green-600 hover:text-green-400 hover:bg-green-950/50" : "text-neutral-700 hover:text-amber-500 hover:bg-amber-950/50"}`}
							title={
								user.locked ? "Unlock account" : "Lock account"
							}
						>
							<svg
								className="h-4 w-4"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								strokeWidth={1.5}
							>
								{user.locked ? (
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										d="M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
									/>
								) : (
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
									/>
								)}
							</svg>
						</button>
					)}
					<button
						onClick={onEdit}
						className="rounded-lg p-2 text-neutral-700 hover:text-neutral-300 hover:bg-neutral-800 transition-colors cursor-pointer"
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
				</div>
			)}
		</div>
	);
}
