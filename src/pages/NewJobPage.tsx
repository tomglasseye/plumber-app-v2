import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../AppContext";
import { PRIORITIES } from "../data";
import type { NewJobForm } from "../types";

const EMPTY: NewJobForm = {
	customer: "",
	phone: "",
	address: "",
	type: "",
	description: "",
	assignedTo: "",
	date: "",
	priority: "Normal",
};

export function NewJobPage() {
	const { createJob, business, users } = useApp();
	const navigate = useNavigate();
	const [form, setForm] = useState<NewJobForm>(EMPTY);

	function f(key: keyof NewJobForm, value: string) {
		setForm((prev) => ({ ...prev, [key]: value }));
	}

	function handleSubmit() {
		if (
			!form.customer ||
			!form.address ||
			!form.type ||
			!form.date ||
			!form.assignedTo
		)
			return;
		createJob(form);
		navigate("/");
	}

	const engineers = users.filter((u) => u.role === "engineer");

	return (
		<div className="p-5 md:p-7 max-w-2xl">
			<button
				onClick={() => navigate(-1)}
				className="mb-5 text-sm text-neutral-600 hover:text-neutral-300 transition-colors border-0 bg-transparent p-0 cursor-pointer block"
			>
				← Back
			</button>
			<h1 className="mb-6 text-2xl font-normal text-neutral-100 tracking-tight">
				Create New Job
			</h1>

			<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
				{(
					[
						{
							label: "Customer Name *",
							key: "customer",
							type: "text",
							ph: "e.g. Mr & Mrs Smith",
						},
						{
							label: "Phone Number",
							key: "phone",
							type: "tel",
							ph: "e.g. 07700 900123",
						},
						{
							label: "Address *",
							key: "address",
							type: "text",
							ph: "Full property address",
						},
						{
							label: "Job Type *",
							key: "type",
							type: "text",
							ph: "e.g. Boiler Service",
						},
						{
							label: "Scheduled Date *",
							key: "date",
							type: "date",
							ph: "",
						},
					] as const
				).map((field) => (
					<div key={field.key} className="flex flex-col gap-1.5">
						<label className="text-xs uppercase tracking-wider text-neutral-600">
							{field.label}
						</label>
						<input
							type={field.type}
							placeholder={field.ph}
							value={form[field.key]}
							onChange={(e) => f(field.key, e.target.value)}
							className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2.5 text-sm text-neutral-100 outline-none focus:border-neutral-500 placeholder:text-neutral-600"
						/>
					</div>
				))}

				<div className="flex flex-col gap-1.5">
					<label className="text-xs uppercase tracking-wider text-neutral-600">
						Assign To *
					</label>
					<select
						value={form.assignedTo}
						onChange={(e) => f("assignedTo", e.target.value)}
						className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2.5 text-sm text-neutral-100 outline-none focus:border-neutral-500"
					>
						<option value="">Select engineer…</option>
						{engineers.map((u) => (
							<option key={u.id} value={u.id}>
								{u.name}
							</option>
						))}
					</select>
				</div>

				<div className="flex flex-col gap-1.5">
					<label className="text-xs uppercase tracking-wider text-neutral-600">
						Priority
					</label>
					<select
						value={form.priority}
						onChange={(e) => f("priority", e.target.value)}
						className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2.5 text-sm text-neutral-100 outline-none focus:border-neutral-500"
					>
						{PRIORITIES.map((p) => (
							<option key={p} value={p}>
								{p}
							</option>
						))}
					</select>
				</div>

				<div className="sm:col-span-2 flex flex-col gap-1.5">
					<label className="text-xs uppercase tracking-wider text-neutral-600">
						Job Description
					</label>
					<textarea
						rows={4}
						placeholder="Describe the work required…"
						value={form.description}
						onChange={(e) => f("description", e.target.value)}
						className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2.5 text-sm text-neutral-100 outline-none focus:border-neutral-500 resize-y placeholder:text-neutral-600"
					/>
				</div>
			</div>

			<div className="mt-6 flex gap-3">
				<button
					onClick={handleSubmit}
					disabled={
						!form.customer ||
						!form.address ||
						!form.type ||
						!form.date ||
						!form.assignedTo
					}
					className="rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
					style={{ backgroundColor: business.accentColor }}
				>
					Create Job Sheet
				</button>
				<button
					onClick={() => navigate(-1)}
					className="rounded-lg border border-neutral-700 bg-neutral-800 px-5 py-2.5 text-sm text-neutral-300 hover:border-neutral-600 transition-colors cursor-pointer"
				>
					Cancel
				</button>
			</div>
		</div>
	);
}
