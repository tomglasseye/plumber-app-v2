import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../AppContext";
import { CategoryIcon } from "./AccountPage";
import { buildTimeOpts, PRIORITIES } from "../data";
import type { NewJobForm, RepeatFrequency } from "../types";

const EMPTY: NewJobForm = {
	customer: "",
	phone: "",
	address: "",
	description: "",
	assignedTo: "",
	date: "",
	priority: "Normal",
	startTime: "",
	endTime: "",
	repeatFrequency: undefined,
};

// TIME_OPTS built dynamically in component from business work hours

export function NewJobPage() {
	const { createJob, createCustomer, business, users, customers, categories } =
		useApp();
	const navigate = useNavigate();
	const TIME_OPTS = buildTimeOpts(business.workDayStart, business.workDayEnd);
	const [form, setForm] = useState<NewJobForm>(EMPTY);
	const [custSearch, setCustSearch] = useState("");
	const [showSuggestions, setShowSuggestions] = useState(false);
	const [saveAsContact, setSaveAsContact] = useState(false);
	const custRef = useRef<HTMLDivElement>(null);

	function f(key: keyof NewJobForm, value: string) {
		setForm((prev) => ({ ...prev, [key]: value }));
	}

	function handleCustomerInput(value: string) {
		setCustSearch(value);
		f("customer", value);
		setForm((prev) => ({ ...prev, customerId: undefined }));
		setSaveAsContact(false);
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
		setSaveAsContact(false);
		setShowSuggestions(false);
	}

	// Auto-set end time 1hr after start time
	function handleStartTime(val: string) {
		setForm((prev) => {
			const next: NewJobForm = { ...prev, startTime: val };
			if (val) {
				const [h, m] = val.split(":").map(Number);
				const endH = h + 1;
				if (endH <= business.workDayEnd) {
					next.endTime = `${String(endH).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
				}
			}
			return next;
		});
	}

	const isUnlinked = form.customer.length > 0 && !form.customerId;

	const suggestions =
		custSearch.length > 0
			? customers.filter((c) =>
					c.name.toLowerCase().includes(custSearch.toLowerCase()),
				)
			: [];

	function handleSubmit() {
		if (
			!form.customer ||
			!form.phone ||
			!form.address ||
			!form.date ||
			!form.assignedTo
		)
			return;
		let jobForm = form;
		if (saveAsContact && !form.customerId) {
			const custId = createCustomer({
				name: form.customer,
				email: "",
				phone: form.phone,
				address: form.address,
				notes: "",
			});
			jobForm = { ...form, customerId: custId };
		}
		// Strip empty optional strings
		if (!jobForm.startTime) jobForm = { ...jobForm, startTime: undefined };
		if (!jobForm.endTime) jobForm = { ...jobForm, endTime: undefined };
		if (!jobForm.endDate || jobForm.endDate <= jobForm.date) jobForm = { ...jobForm, endDate: undefined };
		if (!jobForm.categoryId) jobForm = { ...jobForm, categoryId: undefined };
		createJob(jobForm);
		navigate("/");
	}

	const engineers = users.filter((u) => u.role === "engineer");

	const inputClass =
		"rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2.5 text-sm text-neutral-100 outline-none focus:border-neutral-500 placeholder:text-neutral-600";

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
						className={inputClass}
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
					{isUnlinked && (
						<label className="flex items-center gap-2 mt-0.5 cursor-pointer">
							<input
								type="checkbox"
								checked={saveAsContact}
								onChange={(e) =>
									setSaveAsContact(e.target.checked)
								}
								className="accent-orange-500"
							/>
							<span className="text-[10px] text-amber-500">
								Save as new contact
							</span>
						</label>
					)}
				</div>

				{/* Phone */}
				<div className="flex flex-col gap-1.5">
					<label className="text-xs uppercase tracking-wider text-neutral-600">
						Phone Number *
					</label>
					<input
						type="tel"
						placeholder="e.g. 07700 900123"
						value={form.phone}
						onChange={(e) => f("phone", e.target.value)}
						className={inputClass}
					/>
				</div>

				{/* Address */}
				<div className="flex flex-col gap-1.5 sm:col-span-2">
					<label className="text-xs uppercase tracking-wider text-neutral-600">
						Address *
					</label>
					<input
						type="text"
						placeholder="Full property address"
						value={form.address}
						onChange={(e) => f("address", e.target.value)}
						className={inputClass}
					/>
				</div>

				{/* Category */}
				{categories.length > 0 && (
					<div className="flex flex-col gap-1.5">
						<label className="text-xs uppercase tracking-wider text-neutral-600">
							Category
						</label>
						<div className="flex flex-wrap gap-2">
							<button
								type="button"
								onClick={() =>
									setForm((p) => ({
										...p,
										categoryId: undefined,
									}))
								}
								className={`rounded-lg border px-3 py-1.5 text-xs transition-colors cursor-pointer ${!form.categoryId ? "border-neutral-500 bg-neutral-700 text-neutral-200" : "border-neutral-700 bg-neutral-800 text-neutral-500 hover:border-neutral-600"}`}
							>
								None
							</button>
							{categories.map((cat) => (
								<button
									key={cat.id}
									type="button"
									onClick={() =>
										setForm((p) => ({
											...p,
											categoryId: cat.id,
										}))
									}
									className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors cursor-pointer ${form.categoryId === cat.id ? "border-current" : "border-neutral-700 bg-neutral-800 text-neutral-500 hover:border-neutral-600"}`}
									style={
										form.categoryId === cat.id
											? {
													background:
														cat.color + "22",
													color: cat.color,
													borderColor: cat.color,
												}
											: {}
									}
								>
									<CategoryIcon
										name={cat.icon}
										size={12}
										color={
											form.categoryId === cat.id
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

				{/* Date */}
				<div className="flex flex-col gap-1.5">
					<label className="text-xs uppercase tracking-wider text-neutral-600">
						Start Date *
					</label>
					<input
						type="date"
						value={form.date}
						onChange={(e) => {
							f("date", e.target.value);
							if (form.endDate && form.endDate < e.target.value)
								f("endDate", e.target.value);
						}}
						className={inputClass}
					/>
				</div>

				{/* End Date */}
				<div className="flex flex-col gap-1.5">
					<label className="text-xs uppercase tracking-wider text-neutral-600">
						End Date
					</label>
					<input
						type="date"
						value={form.endDate ?? ""}
						min={form.date || undefined}
						onChange={(e) => f("endDate", e.target.value)}
						className={inputClass}
					/>
					<p className="text-[10px] text-neutral-700">Leave blank for single day</p>
				</div>

				{/* Time slots */}
				<div className="flex flex-col gap-1.5 sm:col-span-2">
					<label className="text-xs uppercase tracking-wider text-neutral-600">
						Time Slot
					</label>
					<div className="flex items-center gap-2">
						<select
							value={form.startTime ?? ""}
							onChange={(e) => handleStartTime(e.target.value)}
							className={`flex-1 ${inputClass}`}
						>
							<option value="">Start time</option>
							{TIME_OPTS.map((o) => (
								<option key={o.value} value={o.value}>
									{o.label}
								</option>
							))}
						</select>
						<span className="text-neutral-600 text-sm flex-shrink-0">
							→
						</span>
						<select
							value={form.endTime ?? ""}
							onChange={(e) => f("endTime", e.target.value)}
							disabled={!form.startTime}
							className={`flex-1 ${inputClass} disabled:opacity-40`}
						>
							<option value="">End time</option>
							{TIME_OPTS.filter(
								(o) =>
									!form.startTime ||
									o.value > form.startTime,
							).map((o) => (
								<option key={o.value} value={o.value}>
									{o.label}
								</option>
							))}
						</select>
					</div>
					<p className="text-[10px] text-neutral-700">
						Min 1 hour — leave blank for all-day
					</p>
				</div>

				{/* Assign To */}
				<div className="flex flex-col gap-1.5">
					<label className="text-xs uppercase tracking-wider text-neutral-600">
						Assign To *
					</label>
					<select
						value={form.assignedTo}
						onChange={(e) => f("assignedTo", e.target.value)}
						className={inputClass}
					>
						<option value="">Select engineer…</option>
						{engineers.map((u) => (
							<option key={u.id} value={u.id}>
								{u.name}
							</option>
						))}
					</select>
				</div>

				{/* Priority */}
				<div className="flex flex-col gap-1.5">
					<label className="text-xs uppercase tracking-wider text-neutral-600">
						Priority
					</label>
					<select
						value={form.priority}
						onChange={(e) => f("priority", e.target.value)}
						className={inputClass}
					>
						{PRIORITIES.map((p) => (
							<option key={p} value={p}>
								{p}
							</option>
						))}
					</select>
				</div>

				{/* Description */}
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

			{/* Recurring */}
			<div className="flex flex-col gap-1.5 mt-4">
				<label className="text-xs uppercase tracking-wider text-neutral-600">
					Recurring
				</label>
				<div className="flex flex-wrap gap-2">
					{(
						[
							undefined,
							"annually",
							"biannually",
							"quarterly",
						] as (RepeatFrequency | undefined)[]
					).map((freq) => (
						<button
							key={freq ?? "none"}
							type="button"
							onClick={() =>
								setForm((p) => ({ ...p, repeatFrequency: freq }))
							}
							className={`rounded-lg border px-3 py-1.5 text-xs transition-colors cursor-pointer ${form.repeatFrequency === freq ? "border-neutral-500 bg-neutral-700 text-neutral-200" : "border-neutral-700 bg-neutral-800 text-neutral-500 hover:border-neutral-600"}`}
						>
							{freq === undefined
								? "One-off"
								: freq === "annually"
									? "🔁 Annually"
									: freq === "biannually"
										? "🔁 Every 6 months"
										: "🔁 Quarterly"}
						</button>
					))}
				</div>
			</div>

			<div className="mt-6 flex gap-3">
				<button
					onClick={handleSubmit}
					disabled={
						!form.customer ||
						!form.phone ||
						!form.address ||
						!form.date ||
						!form.assignedTo
					}
					className="rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
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
