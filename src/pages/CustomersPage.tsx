import { useState } from "react";
import { useApp } from "../AppContext";
import type { Customer } from "../types";

const EMPTY: Omit<Customer, "id"> = {
	name: "",
	email: "",
	phone: "",
	address: "",
	notes: "",
};

export function CustomersPage() {
	const {
		customers,
		createCustomer,
		updateCustomer,
		deleteCustomer,
		business,
		jobs,
	} = useApp();
	const [search, setSearch] = useState("");
	const [showForm, setShowForm] = useState(false);
	const [editId, setEditId] = useState<string | null>(null);
	const [form, setForm] = useState<Omit<Customer, "id">>(EMPTY);
	const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

	const filtered = customers.filter(
		(c) =>
			c.name.toLowerCase().includes(search.toLowerCase()) ||
			c.email.toLowerCase().includes(search.toLowerCase()) ||
			c.phone.includes(search),
	);

	function jobCount(customerId: string) {
		return jobs.filter((j) => j.customerId === customerId).length;
	}

	function openNew() {
		setForm(EMPTY);
		setEditId(null);
		setShowForm(true);
	}

	function openEdit(c: Customer) {
		setForm({
			name: c.name,
			email: c.email,
			phone: c.phone,
			address: c.address,
			notes: c.notes,
			xeroContactId: c.xeroContactId,
		});
		setEditId(c.id);
		setShowForm(true);
	}

	function handleSave() {
		if (!form.name || !form.email || !form.phone || !form.address) return;
		if (editId) {
			updateCustomer({ ...form, id: editId });
		} else {
			createCustomer(form);
		}
		setShowForm(false);
		setEditId(null);
		setForm(EMPTY);
	}

	function handleDelete(id: string) {
		deleteCustomer(id);
		setConfirmDelete(null);
	}

	function f(key: keyof Omit<Customer, "id">, value: string) {
		setForm((prev) => ({ ...prev, [key]: value }));
	}

	const inputClass =
		"w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2.5 text-sm text-neutral-100 outline-none focus:border-neutral-500 placeholder:text-neutral-600";

	return (
		<div className="p-5 md:p-7 max-w-4xl">
			<div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
				<h1 className="text-2xl font-normal text-neutral-100 tracking-tight">
					Customers
				</h1>
				<button
					onClick={openNew}
					className="rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
					style={{ backgroundColor: business.accentColor }}
				>
					+ Add Customer
				</button>
			</div>

			{/* Search */}
			<div className="mb-5">
				<input
					type="text"
					placeholder="Search by name, email or phone…"
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					className={inputClass}
				/>
			</div>

			{/* Form modal */}
			{showForm && (
				<>
					<div
						className="fixed inset-0 z-40 bg-black/60"
						onClick={() => setShowForm(false)}
					/>
					<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
						<div className="w-full max-w-lg rounded-xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl">
							<h2 className="text-lg font-medium text-neutral-100 mb-4">
								{editId ? "Edit Customer" : "New Customer"}
							</h2>
							<div className="space-y-3">
								<div>
									<label className="mb-1 block text-xs uppercase tracking-wider text-neutral-600">
										Name *
									</label>
									<input
										type="text"
										placeholder="e.g. Mr & Mrs Smith"
										value={form.name}
										onChange={(e) =>
											f("name", e.target.value)
										}
										className={inputClass}
									/>
								</div>
								<div>
									<label className="mb-1 block text-xs uppercase tracking-wider text-neutral-600">
										Email *
									</label>
									<input
										type="email"
										placeholder="email@example.com"
										value={form.email}
										onChange={(e) =>
											f("email", e.target.value)
										}
										className={inputClass}
									/>
								</div>
								<div>
									<label className="mb-1 block text-xs uppercase tracking-wider text-neutral-600">
										Phone *
									</label>
									<input
										type="tel"
										placeholder="07700 900123"
										value={form.phone}
										onChange={(e) =>
											f("phone", e.target.value)
										}
										className={inputClass}
									/>
								</div>
								<div>
									<label className="mb-1 block text-xs uppercase tracking-wider text-neutral-600">
										Default Address *
									</label>
									<input
										type="text"
										placeholder="Full property address"
										value={form.address}
										onChange={(e) =>
											f("address", e.target.value)
										}
										className={inputClass}
									/>
								</div>
								<div>
									<label className="mb-1 block text-xs uppercase tracking-wider text-neutral-600">
										Notes
									</label>
									<textarea
										rows={3}
										placeholder="Any additional info…"
										value={form.notes}
										onChange={(e) =>
											f("notes", e.target.value)
										}
										className={`${inputClass} resize-y`}
									/>
								</div>
								<div>
									<label className="mb-1 block text-xs uppercase tracking-wider text-neutral-600">
										Xero Contact ID
									</label>
									<input
										type="text"
										placeholder="e.g. abc-123-def-456"
										value={form.xeroContactId ?? ""}
										onChange={(e) =>
											f("xeroContactId", e.target.value)
										}
										className={inputClass}
									/>
								</div>
							</div>
							<div className="mt-5 flex gap-3">
								<button
									onClick={handleSave}
									disabled={
										!form.name ||
										!form.email ||
										!form.phone ||
										!form.address
									}
									className="rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
									style={{
										backgroundColor: business.accentColor,
									}}
								>
									{editId
										? "Save Changes"
										: "Create Customer"}
								</button>
								<button
									onClick={() => {
										setShowForm(false);
										setEditId(null);
									}}
									className="rounded-lg border border-neutral-700 bg-neutral-800 px-5 py-2.5 text-sm text-neutral-300 hover:border-neutral-600 transition-colors cursor-pointer"
								>
									Cancel
								</button>
							</div>
						</div>
					</div>
				</>
			)}

			{/* List */}
			{filtered.length === 0 ? (
				<div className="text-center py-16 text-neutral-600 text-sm">
					{customers.length === 0
						? "No customers yet — add your first contact above."
						: "No customers match your search."}
				</div>
			) : (
				<div className="space-y-2">
					{filtered.map((c) => (
						<div
							key={c.id}
							className="group flex items-center gap-4 rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3 hover:border-neutral-700 transition-colors"
						>
							{/* Avatar */}
							<div
								className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-medium"
								style={{
									background: business.accentColor + "22",
									border: `1px solid ${business.accentColor}44`,
									color: business.accentColor,
								}}
							>
								{c.name
									.split(" ")
									.map((w) => w[0])
									.join("")
									.slice(0, 2)
									.toUpperCase()}
							</div>

							{/* Info */}
							<div className="flex-1 min-w-0">
								<p className="text-sm font-medium text-neutral-200 truncate">
									{c.name}
								</p>
								<p className="text-xs text-neutral-500 truncate">
									{c.email}
									{c.phone && ` · ${c.phone}`}
									{c.address && ` · ${c.address}`}
								</p>
							</div>

							{/* Job count */}
							<span className="hidden sm:inline text-xs text-neutral-600">
								{jobCount(c.id)} job
								{jobCount(c.id) !== 1 ? "s" : ""}
							</span>

							{/* Actions */}
							<div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
								<button
									onClick={() => openEdit(c)}
									className="rounded-lg border border-neutral-700 bg-neutral-800 px-2.5 py-1.5 text-xs text-neutral-400 hover:text-neutral-200 hover:border-neutral-600 transition-colors cursor-pointer"
								>
									Edit
								</button>
								{confirmDelete === c.id ? (
									<button
										onClick={() => handleDelete(c.id)}
										className="rounded-lg border border-red-800 bg-red-950 px-2.5 py-1.5 text-xs text-red-400 hover:text-red-200 transition-colors cursor-pointer"
									>
										Confirm
									</button>
								) : (
									<button
										onClick={() => setConfirmDelete(c.id)}
										className="rounded-lg border border-neutral-700 bg-neutral-800 px-2.5 py-1.5 text-xs text-neutral-400 hover:text-red-400 hover:border-red-800 transition-colors cursor-pointer"
									>
										Delete
									</button>
								)}
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
