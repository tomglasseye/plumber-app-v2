import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useApp } from "../AppContext";
import type { RepeatFrequency, RepeatTask } from "../types";
import { TODAY } from "../data";

const FREQ_LABELS: Record<RepeatFrequency, string> = {
	annually: "Annually",
	biannually: "Every 6 months",
	quarterly: "Every 3 months",
};

const emptyForm = {
	customer: "",
	address: "",
	type: "Boiler Service",
	description: "",
	frequency: "annually" as RepeatFrequency,
};

export function RepeatTasksPage() {
	const {
		repeatTasks,
		createRepeatTask,
		updateRepeatTask,
		deleteRepeatTask,
		business,
	} = useApp();

	const accent = business.accentColor;
	const navigate = useNavigate();

	const [showForm, setShowForm] = useState(false);
	const [editing, setEditing] = useState<RepeatTask | null>(null);
	const [form, setForm] = useState(emptyForm);
	const [search, setSearch] = useState("");

	function openNew() {
		setEditing(null);
		setForm(emptyForm);
		setShowForm(true);
	}

	function openEdit(task: RepeatTask) {
		setEditing(task);
		setForm({
			customer: task.customer,
			address: task.address,
			type: task.type,
			description: task.description,
			frequency: task.frequency,
		});
		setShowForm(true);
	}

	function handleSave() {
		if (!form.customer) return;
		if (editing) {
			updateRepeatTask({ ...editing, ...form });
		} else {
			createRepeatTask(form);
		}
		setShowForm(false);
		setEditing(null);
	}

	const filtered = repeatTasks.filter(
		(t) =>
			!search ||
			t.customer.toLowerCase().includes(search.toLowerCase()) ||
			t.address.toLowerCase().includes(search.toLowerCase()),
	);

	const today = TODAY;
	const overdue = filtered.filter((t) => t.nextDueDate <= today);
	const upcoming = filtered.filter((t) => t.nextDueDate > today);

	const inputCls =
		"w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-neutral-500";

	return (
		<div className="p-5 md:p-7 max-w-5xl">
			{/* Header */}
			<div className="flex items-start justify-between mb-5 gap-4 flex-wrap">
				<div>
					<h1 className="text-2xl font-normal text-neutral-100 tracking-tight">
						Repeat Reminders
					</h1>
					<p className="mt-1 text-sm text-neutral-600">
						Annual boiler services & recurring work
					</p>
				</div>
				<button
					onClick={openNew}
					className="rounded-lg px-4 py-2 text-sm font-medium text-white"
					style={{ backgroundColor: accent }}
				>
					+ Add Reminder
				</button>
			</div>

			{/* Search */}
			<input
				type="text"
				placeholder="Search by customer or address…"
				value={search}
				onChange={(e) => setSearch(e.target.value)}
				className="mb-5 w-full max-w-sm rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-neutral-500 placeholder:text-neutral-600"
			/>

			{/* Overdue / Due Now */}
			{overdue.length > 0 && (
				<div className="mb-6">
					<h2 className="text-sm font-medium text-red-400 uppercase tracking-wider mb-3">
						Due Now ({overdue.length})
					</h2>
					<div className="space-y-2">
						{overdue.map((task) => (
							<ReminderRow
								key={task.id}
								task={task}
								onView={() =>
									navigate(`/repeat-tasks/${task.id}`)
								}
								onEdit={() => openEdit(task)}
								onDelete={() => deleteRepeatTask(task.id)}
								isOverdue
							/>
						))}
					</div>
				</div>
			)}

			{/* Upcoming */}
			<div className="mb-6">
				<h2 className="text-sm font-medium text-neutral-500 uppercase tracking-wider mb-3">
					Upcoming ({upcoming.length})
				</h2>
				{upcoming.length === 0 && overdue.length === 0 && (
					<p className="text-sm text-neutral-600">
						No reminders yet.{" "}
						<button
							onClick={openNew}
							className="underline hover:text-neutral-300 bg-transparent border-0 cursor-pointer text-neutral-500 text-sm"
						>
							Add one
						</button>
					</p>
				)}
				<div className="space-y-2">
					{upcoming.map((task) => (
						<ReminderRow
							key={task.id}
							task={task}
							onView={() => navigate(`/repeat-tasks/${task.id}`)}
							onEdit={() => openEdit(task)}
							onDelete={() => deleteRepeatTask(task.id)}
							isOverdue={false}
						/>
					))}
				</div>
			</div>

			{/* Form modal */}
			{showForm && (
				<>
					<div
						className="fixed inset-0 z-50 bg-black/60"
						onClick={() => setShowForm(false)}
					/>
					<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
						<div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
							<h2 className="text-lg text-neutral-100 mb-4">
								{editing ? "Edit Reminder" : "New Reminder"}
							</h2>

							<div className="space-y-3">
								<div>
									<label className="mb-1 block text-xs uppercase tracking-wider text-neutral-600">
										Customer
									</label>
									<input
										className={inputCls}
										value={form.customer}
										onChange={(e) =>
											setForm({
												...form,
												customer: e.target.value,
											})
										}
									/>
								</div>
								<div>
									<label className="mb-1 block text-xs uppercase tracking-wider text-neutral-600">
										Address
									</label>
									<input
										className={inputCls}
										value={form.address}
										onChange={(e) =>
											setForm({
												...form,
												address: e.target.value,
											})
										}
									/>
								</div>
								<div>
									<label className="mb-1 block text-xs uppercase tracking-wider text-neutral-600">
										Job Type
									</label>
									<input
										className={inputCls}
										value={form.type}
										onChange={(e) =>
											setForm({
												...form,
												type: e.target.value,
											})
										}
									/>
								</div>
								<div>
									<label className="mb-1 block text-xs uppercase tracking-wider text-neutral-600">
										Description
									</label>
									<textarea
										className={inputCls + " resize-none"}
										rows={2}
										value={form.description}
										onChange={(e) =>
											setForm({
												...form,
												description: e.target.value,
											})
										}
									/>
								</div>
								<div>
									<label className="mb-1 block text-xs uppercase tracking-wider text-neutral-600">
										Frequency
									</label>
									<select
										className={inputCls}
										value={form.frequency}
										onChange={(e) =>
											setForm({
												...form,
												frequency: e.target
													.value as RepeatFrequency,
											})
										}
									>
										<option value="annually">
											Annually
										</option>
										<option value="biannually">
											Every 6 months
										</option>
										<option value="quarterly">
											Every 3 months
										</option>
									</select>
								</div>
							</div>

							<div className="flex justify-end gap-3 mt-5">
								<button
									onClick={() => setShowForm(false)}
									className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-400 hover:text-neutral-200 bg-transparent cursor-pointer"
								>
									Cancel
								</button>
								<button
									onClick={handleSave}
									className="rounded-lg px-4 py-2 text-sm font-medium text-white cursor-pointer"
									style={{ backgroundColor: accent }}
								>
									{editing ? "Save Changes" : "Add Reminder"}
								</button>
							</div>
						</div>
					</div>
				</>
			)}
		</div>
	);
}

/* ── Detail page: /repeat-tasks/:id ── */

export function RepeatTaskDetailPage() {
	const {
		repeatTasks,
		deleteRepeatTask,
		scheduleRepeatJob,
		users,
		business,
	} = useApp();
	const { id } = useParams<{ id: string }>();
	const navigate = useNavigate();
	const task = repeatTasks.find((t) => t.id === id);
	const engineers = users.filter((u) => u.role === "engineer");
	const accent = business.accentColor;

	const [assignedTo, setAssignedTo] = useState("");
	const [date, setDate] = useState(task?.nextDueDate ?? TODAY);

	if (!task) {
		return (
			<div className="p-5 md:p-7 max-w-3xl">
				<p className="text-neutral-500 text-sm">Reminder not found.</p>
				<button
					onClick={() => navigate("/repeat-tasks")}
					className="mt-3 text-sm underline text-neutral-400 hover:text-neutral-200 bg-transparent border-0 cursor-pointer"
				>
					Back to Reminders
				</button>
			</div>
		);
	}

	const dueDateFmt = new Date(
		task.nextDueDate + "T00:00:00",
	).toLocaleDateString("en-GB", {
		weekday: "long",
		day: "numeric",
		month: "long",
		year: "numeric",
	});

	function handleSchedule() {
		if (!assignedTo) return;
		scheduleRepeatJob(task!.id, assignedTo, date);
		navigate("/repeat-tasks");
	}

	function handleDelete() {
		deleteRepeatTask(task!.id);
		navigate("/repeat-tasks");
	}

	const inputCls =
		"w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-neutral-500";

	return (
		<div className="p-5 md:p-7 max-w-3xl">
			<button
				onClick={() => navigate("/repeat-tasks")}
				className="mb-4 text-sm text-neutral-500 hover:text-neutral-200 bg-transparent border-0 cursor-pointer"
			>
				← Back to Reminders
			</button>

			<div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
				<div className="flex items-center gap-3 mb-1">
					<span className="text-2xl">🔁</span>
					<h1 className="text-xl text-neutral-100">
						{task.customer}
					</h1>
				</div>
				<p className="text-sm text-neutral-500 mb-4">{task.address}</p>

				<div className="grid grid-cols-2 gap-4 mb-6 text-sm">
					<div>
						<span className="text-neutral-600 text-xs uppercase tracking-wider">
							Type
						</span>
						<p className="text-neutral-200 mt-0.5">{task.type}</p>
					</div>
					<div>
						<span className="text-neutral-600 text-xs uppercase tracking-wider">
							Frequency
						</span>
						<p className="text-neutral-200 mt-0.5">
							{FREQ_LABELS[task.frequency]}
						</p>
					</div>
					<div>
						<span className="text-neutral-600 text-xs uppercase tracking-wider">
							Next Due
						</span>
						<p className="text-neutral-200 mt-0.5">{dueDateFmt}</p>
					</div>
				</div>

				{task.description && (
					<div className="mb-6">
						<span className="text-neutral-600 text-xs uppercase tracking-wider">
							Description
						</span>
						<p className="text-neutral-300 text-sm mt-1">
							{task.description}
						</p>
					</div>
				)}

				{/* Schedule as Job */}
				<div className="border-t border-neutral-800 pt-5 mt-2">
					<h2 className="text-sm font-medium text-neutral-300 mb-3">
						Schedule as Job
					</h2>
					<div className="flex flex-col sm:flex-row gap-3 mb-4">
						<div className="flex-1">
							<label className="mb-1 block text-xs uppercase tracking-wider text-neutral-600">
								Assign To
							</label>
							<select
								className={inputCls}
								value={assignedTo}
								onChange={(e) => setAssignedTo(e.target.value)}
							>
								<option value="">Select engineer…</option>
								{engineers.map((u) => (
									<option key={u.id} value={u.id}>
										{u.name}
									</option>
								))}
							</select>
						</div>
						<div className="flex-1">
							<label className="mb-1 block text-xs uppercase tracking-wider text-neutral-600">
								Date
							</label>
							<input
								type="date"
								className={inputCls}
								value={date}
								onChange={(e) => setDate(e.target.value)}
							/>
						</div>
					</div>
					<button
						onClick={handleSchedule}
						disabled={!assignedTo}
						className="rounded-lg px-4 py-2 text-sm font-medium text-white cursor-pointer border-0 disabled:opacity-40 disabled:cursor-not-allowed"
						style={{ backgroundColor: accent }}
					>
						Create Job
					</button>
				</div>

				{/* Delete reminder */}
				<div className="border-t border-neutral-800 pt-5 mt-5">
					<button
						onClick={handleDelete}
						className="rounded-lg border border-red-800 px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:border-red-700 bg-transparent cursor-pointer"
					>
						Delete Reminder
					</button>
				</div>
			</div>
		</div>
	);
}

/* ── Row component ── */

function ReminderRow({
	task,
	onView,
	onEdit,
	onDelete,
	isOverdue,
}: {
	task: RepeatTask;
	onView: () => void;
	onEdit: () => void;
	onDelete: () => void;
	isOverdue: boolean;
}) {
	const dueDateFmt = new Date(
		task.nextDueDate + "T00:00:00",
	).toLocaleDateString("en-GB", {
		day: "numeric",
		month: "short",
		year: "numeric",
	});

	return (
		<div
			onClick={onView}
			className={`flex items-center gap-4 rounded-xl border px-4 py-3 cursor-pointer transition-colors ${
				isOverdue
					? "border-red-800/50 bg-red-950/30 hover:bg-red-950/50"
					: "border-neutral-800 bg-neutral-900 hover:bg-neutral-800/60"
			}`}
		>
			<span className="text-lg flex-shrink-0">🔁</span>
			<div className="flex-1 min-w-0">
				<p className="text-sm text-neutral-100 font-medium truncate">
					{task.customer}
				</p>
				<p className="text-xs text-neutral-500 truncate">
					{task.address}
				</p>
				<div className="flex items-center gap-3 mt-1 flex-wrap">
					<span className="text-xs text-neutral-600">
						{task.type}
					</span>
					<span className="text-xs text-neutral-600">
						{FREQ_LABELS[task.frequency]}
					</span>
				</div>
			</div>

			<div className="text-right flex-shrink-0">
				<p
					className={`text-sm font-medium ${
						isOverdue ? "text-red-400" : "text-neutral-300"
					}`}
				>
					{isOverdue ? "Due now" : `Due ${dueDateFmt}`}
				</p>
			</div>

			<div
				className="flex items-center gap-1 flex-shrink-0"
				onClick={(e) => e.stopPropagation()}
			>
				<button
					onClick={onEdit}
					title="Edit"
					className="rounded-lg px-2 py-1.5 text-xs text-neutral-400 hover:text-neutral-200 bg-transparent border border-neutral-700 cursor-pointer"
				>
					Edit
				</button>
				<button
					onClick={onDelete}
					title="Delete"
					className="rounded-lg px-2 py-1.5 text-xs text-red-500 hover:text-red-300 bg-transparent border border-neutral-700 cursor-pointer"
				>
					✕
				</button>
			</div>
		</div>
	);
}
