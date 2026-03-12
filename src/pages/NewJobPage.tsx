import { useRef, useState } from "react";
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
	const { createJob, business, users, customers } = useApp();
	const navigate = useNavigate();
	const [form, setForm] = useState<NewJobForm>(EMPTY);
	const [custSearch, setCustSearch] = useState("");
	const [showSuggestions, setShowSuggestions] = useState(false);
	const custRef = useRef<HTMLDivElement>(null);

	function f(key: keyof NewJobForm, value: string) {
		setForm((prev) => ({ ...prev, [key]: value }));
	}

	function handleCustomerInput(value: string) {
		setCustSearch(value);
		f("customer", value);
		// Clear customerId when typing freely
		setForm((prev) => ({ ...prev, customerId: undefined }));
		setShowSuggestions(value.length > 0);
	}

	function selectCustomer(c: {
		id: string;
		name: string;
		phone: string;
		address: string;
	}) {
		setCustSearch(c.name);
		setForm((prev) => ({
			...prev,
			customer: c.name,
			phone: c.phone || prev.phone,
			address: c.address || prev.address,
			customerId: c.id,
		}));
		setShowSuggestions(false);
	}

	const suggestions =
		custSearch.length > 0
			? customers.filter((c) =>
					c.name.toLowerCase().includes(custSearch.toLowerCase()),
				)
			: [];

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
				{/* Customer autocomplete */}
				<div className="flex flex-col gap-1.5 relative" ref={custRef}>
					<label className="text-xs uppercase tracking-wider text-neutral-600">
						Customer Name *
					</label>
					<input
						type="text"
						placeholder="e.g. Mr & Mrs Smith"
						value={custSearch || form.customer}
						onChange={(e) => handleCustomerInput(e.target.value)}
						onFocus={() =>
							custSearch.length > 0 && setShowSuggestions(true)
						}
						onBlur={() =>
							setTimeout(() => setShowSuggestions(false), 150)
						}
						className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2.5 text-sm text-neutral-100 outline-none focus:border-neutral-500 placeholder:text-neutral-600"
					/>
					{showSuggestions && suggestions.length > 0 && (
						<div className="absolute top-full left-0 right-0 z-20 mt-1 max-h-48 overflow-y-auto rounded-lg border border-neutral-700 bg-neutral-800 shadow-xl">
							{suggestions.map((c) => (
								<button
									key={c.id}
									type="button"
									onMouseDown={() => selectCustomer(c)}
									className="w-full text-left px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-700 transition-colors border-0 bg-transparent cursor-pointer"
								>
									<span className="font-medium">
										{c.name}
									</span>
									{c.email && (
										<span className="ml-2 text-xs text-neutral-500">
											{c.email}
										</span>
									)}
								</button>
							))}
						</div>
					)}
					{form.customerId && (
						<span className="text-[10px] text-green-500">
							Linked to contact
						</span>
					)}
				</div>

				{(
					[
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
