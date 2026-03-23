import { useState } from "react";
import {
	AlertTriangle,
	Bath,
	Building2,
	Clock,
	Droplets,
	Flame,
	Gauge,
	Hammer,
	Home,
	Layers,
	Package,
	Plug,
	Settings,
	Star,
	Tag,
	Thermometer,
	Waves,
	Wind,
	Wrench,
	Zap,
} from "lucide-react";
import { useApp } from "../AppContext";
import { ACCENT_OPTIONS } from "../data";
import type { Business, Category, Job, User } from "../types";

// ── Icon Registry ────────────────────────────────────────────────────────────

type IconComponent = React.ComponentType<{
	size?: number;
	color?: string;
	strokeWidth?: number;
}>;

export const CATEGORY_ICONS: Record<string, IconComponent> = {
	Wrench,
	Flame,
	Droplets,
	Thermometer,
	Zap,
	Home,
	AlertTriangle,
	Settings,
	Hammer,
	Package,
	Wind,
	Gauge,
	Building2,
	Plug,
	Bath,
	Waves,
	Star,
	Clock,
	Tag,
	Layers,
};

export const ICON_NAMES = Object.keys(CATEGORY_ICONS);

export function CategoryIcon({
	name,
	size = 16,
	color,
	strokeWidth,
}: {
	name: string;
	size?: number;
	color?: string;
	strokeWidth?: number;
}) {
	const Icon = CATEGORY_ICONS[name] ?? Wrench;
	return <Icon size={size} color={color} strokeWidth={strokeWidth} />;
}

// ── Excel helpers ────────────────────────────────────────────────────────────

function escapeXML(val: string): string {
	return val
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function xmlRow(cells: string[]): string {
	return (
		"<Row>" +
		cells
			.map(
				(c) =>
					`<Cell><Data ss:Type="String">${escapeXML(c)}</Data></Cell>`,
			)
			.join("") +
		"</Row>"
	);
}

function buildWorkbook(
	jobs: Job[],
	users: User[],
): string {
	const userMap = Object.fromEntries(users.map((u) => [u.id, u.name]));

	const jobHeader = [
		"Ref",
		"Customer",
		"Address",
		"Description",
		"Assigned To",
		"Status",
		"Priority",
		"Date",
		"Start Time",
		"End Time",
		"Materials",
		"Notes",
		"Time Spent (hrs)",
		"Ready to Invoice",
	];
	const jobRows = jobs.map((j) =>
		xmlRow([
			j.ref,
			j.customer,
			j.address,
			j.description,
			userMap[j.assignedTo] || j.assignedTo,
			j.status,
			j.priority,
			j.date,
			j.startTime ?? "",
			j.endTime ?? "",
			j.materials,
			j.notes,
			String(j.timeSpent),
			j.readyToInvoice ? "Yes" : "No",
		]),
	);

	return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles><Style ss:ID="hdr"><Font ss:Bold="1"/></Style></Styles>
<Worksheet ss:Name="Jobs"><Table>${xmlRow(jobHeader).replace("<Row>", '<Row ss:StyleID="hdr">')}${jobRows.join("")}</Table></Worksheet>
</Workbook>`;
}

function downloadXML(xml: string, filename: string) {
	const blob = new Blob([xml], { type: "application/vnd.ms-excel" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}

// ── Export Panel ─────────────────────────────────────────────────────────────

function ExportPanel({
	jobs,
	users,
	accent,
}: {
	jobs: Job[];
	users: User[];
	accent: string;
}) {
	const today = new Date().toISOString().slice(0, 10);
	const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000)
		.toISOString()
		.slice(0, 10);

	const [from, setFrom] = useState(thirtyDaysAgo);
	const [to, setTo] = useState(today);
	const [exported, setExported] = useState(false);

	const filteredJobs = jobs.filter((j) => j.date >= from && j.date <= to);
	const totalRows = filteredJobs.length;

	function handleExport() {
		const xml = buildWorkbook(filteredJobs, users);
		downloadXML(xml, `export_${from}_to_${to}.xls`);
		setExported(true);
		setTimeout(() => setExported(false), 2000);
	}

	const inputClass =
		"w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-neutral-500";

	return (
		<div className="grid grid-cols-1 md:grid-cols-2 gap-5">
			<div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
				<h4 className="mb-4 text-[10px] uppercase tracking-widest text-neutral-600">
					Date Range
				</h4>
				<div className="space-y-3">
					<div>
						<label className="mb-1 block text-xs uppercase tracking-wider text-neutral-600">
							From
						</label>
						<input
							type="date"
							value={from}
							onChange={(e) => setFrom(e.target.value)}
							className={inputClass}
						/>
					</div>
					<div>
						<label className="mb-1 block text-xs uppercase tracking-wider text-neutral-600">
							To
						</label>
						<input
							type="date"
							value={to}
							onChange={(e) => setTo(e.target.value)}
							className={inputClass}
						/>
					</div>
				</div>
				<p className="mt-4 text-xs text-neutral-600">
					Exports as a spreadsheet with Jobs and Reminders on separate
					tabs — import directly into Google Sheets.
				</p>
			</div>

			<div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
				<h4 className="mb-4 text-[10px] uppercase tracking-widest text-neutral-600">
					Export Summary
				</h4>
				<div className="space-y-2 mb-5">
					<div className="flex justify-between text-sm">
						<span className="text-neutral-500">Jobs</span>
						<span className="text-neutral-300">
							{filteredJobs.length}
						</span>
					</div>
					<div className="border-t border-neutral-800 pt-2 flex justify-between text-sm font-medium">
						<span className="text-neutral-400">Total rows</span>
						<span className="text-neutral-200">{totalRows}</span>
					</div>
				</div>
				<button
					onClick={handleExport}
					disabled={totalRows === 0}
					className="w-full rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-all disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
					style={{ background: exported ? "#16a34a" : accent }}
				>
					{exported ? "✓ Downloaded" : "Export Spreadsheet"}
				</button>
			</div>
		</div>
	);
}

// ── Categories Panel ──────────────────────────────────────────────────────────

const DEFAULT_COLORS = [
	"#f97316",
	"#f59e0b",
	"#22c55e",
	"#10b981",
	"#06b6d4",
	"#3b82f6",
	"#8b5cf6",
	"#ec4899",
	"#ef4444",
	"#64748b",
];

function CategoriesPanel({ accent }: { accent: string }) {
	const { categories, createCategory, updateCategory, deleteCategory } =
		useApp();

	const [editingId, setEditingId] = useState<string | null>(null);
	const [showNew, setShowNew] = useState(false);
	const [form, setForm] = useState({
		name: "",
		icon: "Wrench",
		color: "#f97316",
	});

	function openNew() {
		setForm({ name: "", icon: "Wrench", color: "#f97316" });
		setShowNew(true);
		setEditingId(null);
	}

	function openEdit(cat: Category) {
		setForm({ name: cat.name, icon: cat.icon, color: cat.color });
		setEditingId(cat.id);
		setShowNew(false);
	}

	function handleSave() {
		if (!form.name.trim()) return;
		if (editingId) {
			const cat = categories.find((c) => c.id === editingId)!;
			updateCategory({ ...cat, ...form });
			setEditingId(null);
		} else {
			createCategory({
				...form,
				sortOrder: categories.length,
			});
			setShowNew(false);
		}
	}

	function handleCancel() {
		setEditingId(null);
		setShowNew(false);
	}

	const inputClass =
		"w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-neutral-500";

	function CategoryForm() {
		return (
			<div className="rounded-xl border border-neutral-700 bg-neutral-800/60 p-4 space-y-3">
				<div>
					<label className="mb-1 block text-[10px] uppercase tracking-wider text-neutral-600">
						Category Name
					</label>
					<input
						type="text"
						value={form.name}
						onChange={(e) =>
							setForm((f) => ({ ...f, name: e.target.value }))
						}
						placeholder="e.g. Gas Work, Installs, Service…"
						maxLength={100}
						className={inputClass}
						autoFocus
					/>
				</div>

				<div>
					<label className="mb-2 block text-[10px] uppercase tracking-wider text-neutral-600">
						Icon
					</label>
					<div className="grid grid-cols-10 gap-1.5">
						{ICON_NAMES.map((name) => (
							<button
								key={name}
								type="button"
								onClick={() =>
									setForm((f) => ({ ...f, icon: name }))
								}
								className={`flex items-center justify-center rounded-lg p-2 transition-colors cursor-pointer ${
									form.icon === name
										? "bg-neutral-600 ring-2 ring-white/30"
										: "bg-neutral-800 hover:bg-neutral-700"
								}`}
								title={name}
							>
								<CategoryIcon
									name={name}
									size={16}
									color={
										form.icon === name
											? form.color
											: "#6b7280"
									}
								/>
							</button>
						))}
					</div>
				</div>

				<div>
					<label className="mb-2 block text-[10px] uppercase tracking-wider text-neutral-600">
						Colour
					</label>
					<div className="flex flex-wrap gap-2">
						{DEFAULT_COLORS.map((c) => (
							<div
								key={c}
								onClick={() =>
									setForm((f) => ({ ...f, color: c }))
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

				{/* Preview */}
				<div className="flex items-center gap-2 rounded-lg bg-neutral-950 px-3 py-2">
					<div
						className="flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0"
						style={{ background: form.color + "22" }}
					>
						<CategoryIcon
							name={form.icon}
							size={16}
							color={form.color}
						/>
					</div>
					<span className="text-sm text-neutral-200">
						{form.name || "Category Name"}
					</span>
				</div>

				<div className="flex gap-2 pt-1">
					<button
						onClick={handleSave}
						disabled={!form.name.trim()}
						className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed transition-opacity hover:opacity-90"
						style={{ background: accent }}
					>
						{editingId ? "Update" : "Add Category"}
					</button>
					<button
						onClick={handleCancel}
						className="rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-sm text-neutral-300 hover:border-neutral-600 transition-colors cursor-pointer"
					>
						Cancel
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<p className="text-sm text-neutral-500">
					Categories let you tag and filter jobs on the calendar and
					dashboard.
				</p>
				{!showNew && !editingId && (
					<button
						onClick={openNew}
						className="rounded-lg px-4 py-2 text-sm font-medium text-white cursor-pointer hover:opacity-90 transition-opacity flex-shrink-0"
						style={{ background: accent }}
					>
						+ Add Category
					</button>
				)}
			</div>

			{showNew && <CategoryForm />}

			{categories.length === 0 && !showNew ? (
				<div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-700 py-12 text-center">
					<div className="mb-3 text-3xl opacity-40">
						<Wrench size={32} color="#6b7280" />
					</div>
					<p className="text-sm text-neutral-600">
						No categories yet.
					</p>
					<p className="text-xs text-neutral-700 mt-1">
						Add categories like Gas, Installs, Service, Emergency…
					</p>
				</div>
			) : (
				<div className="space-y-2">
					{categories.map((cat) => (
						<div key={cat.id}>
							{editingId === cat.id ? (
								<CategoryForm />
							) : (
								<div className="flex items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3">
									<div
										className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
										style={{ background: cat.color + "22" }}
									>
										<CategoryIcon
											name={cat.icon}
											size={18}
											color={cat.color}
										/>
									</div>
									<span className="flex-1 text-sm text-neutral-200 font-medium">
										{cat.name}
									</span>
									<button
										onClick={() => openEdit(cat)}
										className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors cursor-pointer border-0 bg-transparent p-0 mr-2"
									>
										Edit
									</button>
									<button
										onClick={() => deleteCategory(cat.id)}
										className="text-xs text-red-600 hover:text-red-400 transition-colors cursor-pointer border-0 bg-transparent p-0"
									>
										Delete
									</button>
								</div>
							)}
						</div>
					))}
				</div>
			)}
		</div>
	);
}

// ── Account Page ──────────────────────────────────────────────────────────────

export function AccountPage() {
	const {
		business,
		saveBusiness,
		theme,
		toggleTheme,
		jobs,
		users,
	} = useApp();
	const [form, setForm] = useState<Business>(business);
	const [tab, setTab] = useState<
		"business" | "categories" | "xero" | "export"
	>("business");
	const [saved, setSaved] = useState(false);

	function f(key: keyof Business, value: string | boolean | number) {
		setForm((prev) => ({ ...prev, [key]: value }));
	}

	function handleSave() {
		saveBusiness(form);
		setSaved(true);
		setTimeout(() => setSaved(false), 2000);
	}

	const tabs: {
		id: "business" | "categories" | "xero" | "export";
		icon: string;
		label: string;
	}[] = [
		{ id: "business", icon: "🏢", label: "Business" },
		{ id: "categories", icon: "🏷️", label: "Categories" },
		{ id: "xero", icon: "📊", label: "Xero" },
		{ id: "export", icon: "📥", label: "Export" },
	];

	return (
		<div className="p-5 md:p-7 max-w-4xl">
			<div className="mb-5">
				<h1 className="text-2xl font-normal text-neutral-100 tracking-tight">
					Account Settings
				</h1>
				<p className="mt-1 text-sm text-neutral-600">
					Manage your business profile, categories, and integrations
				</p>
			</div>

			{/* Tabs */}
			<div className="mb-6 flex border-b border-neutral-800">
				{tabs.map((t) => (
					<button
						key={t.id}
						onClick={() => setTab(t.id)}
						className={`px-4 py-2.5 text-sm transition-colors border-b-2 -mb-px bg-transparent cursor-pointer ${
							tab === t.id
								? "border-orange-500 text-neutral-100"
								: "border-transparent text-neutral-600 hover:text-neutral-400"
						}`}
					>
						{t.icon} {t.label}
					</button>
				))}
			</div>

			{/* Business tab */}
			{tab === "business" && (
				<div className="grid grid-cols-1 md:grid-cols-2 gap-5">
					<div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
						<h4 className="mb-4 text-[10px] uppercase tracking-widest text-neutral-600">
							Business Details
						</h4>
						<div className="space-y-3">
							{(
								[
									{
										label: "Company Name",
										key: "name",
										type: "text",
										maxLength: 200,
									},
									{
										label: "Phone",
										key: "phone",
										type: "text",
										maxLength: 30,
									},
									{
										label: "Email",
										key: "email",
										type: "email",
										maxLength: 254,
									},
									{
										label: "Address",
										key: "address",
										type: "text",
										maxLength: 500,
									},
									{
										label: "VAT Number",
										key: "vatNumber",
										type: "text",
										maxLength: 30,
									},
								] as const
							).map((field) => (
								<div key={field.key}>
									<label className="mb-1 block text-xs uppercase tracking-wider text-neutral-600">
										{field.label}
									</label>
									<input
										type={field.type}
										value={form[field.key]}
										onChange={(e) =>
											f(field.key, e.target.value)
										}
										maxLength={field.maxLength}
										className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-neutral-500"
									/>
								</div>
							))}
						</div>
					</div>

					<div className="flex flex-col gap-5">
						<div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
							<h4 className="mb-4 text-[10px] uppercase tracking-widest text-neutral-600">
								Branding
							</h4>
							<div className="mb-4">
								<label className="mb-1.5 block text-xs uppercase tracking-wider text-neutral-600">
									Logo Initials
								</label>
								<input
									type="text"
									maxLength={3}
									value={form.logoInitials}
									onChange={(e) =>
										f(
											"logoInitials",
											e.target.value.toUpperCase(),
										)
									}
									className="w-20 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm uppercase text-neutral-100 outline-none focus:border-neutral-500"
								/>
							</div>
							<div className="mb-5">
								<label className="mb-2 block text-xs uppercase tracking-wider text-neutral-600">
									Accent Colour
								</label>
								<div className="flex flex-wrap gap-2.5">
									{ACCENT_OPTIONS.map((c) => (
										<div
											key={c}
											onClick={() =>
												f("accentColor", c)
											}
											className="h-7 w-7 cursor-pointer rounded-full transition-transform hover:scale-110"
											style={{
												background: c,
												outline:
													form.accentColor === c
														? "2px solid white"
														: "2px solid transparent",
												outlineOffset: 2,
											}}
										/>
									))}
								</div>
							</div>
							{/* Preview */}
							<div className="flex items-center gap-3 rounded-lg bg-neutral-950 p-3">
								<div
									className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
									style={{ background: form.accentColor }}
								>
									{form.logoInitials}
								</div>
								<div>
									<p className="text-sm text-neutral-200">
										{form.name}
									</p>
									<p className="text-xs text-neutral-600">
										Preview
									</p>
								</div>
							</div>
						</div>

						<div className="mb-5">
							<label className="mb-2 block text-xs uppercase tracking-wider text-neutral-600">
								App Theme
							</label>
							<div className="flex gap-2">
								<button
									onClick={() =>
										theme !== "dark" && toggleTheme()
									}
									className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm transition-all cursor-pointer ${theme === "dark" ? "border-neutral-500 bg-neutral-800 text-neutral-100" : "border-neutral-700 bg-neutral-900 text-neutral-500"}`}
								>
									🌙 Dark
								</button>
								<button
									onClick={() =>
										theme !== "light" && toggleTheme()
									}
									className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm transition-all cursor-pointer ${theme === "light" ? "border-neutral-500 bg-neutral-800 text-neutral-100" : "border-neutral-700 bg-neutral-900 text-neutral-500"}`}
								>
									☀️ Light
								</button>
							</div>
						</div>

						<div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
							<h4 className="mb-4 text-[10px] uppercase tracking-widest text-neutral-600">
								Working Hours
							</h4>
							<div className="flex items-center gap-3">
								<div className="flex flex-col gap-1.5 flex-1">
									<label className="text-xs uppercase tracking-wider text-neutral-600">Start</label>
									<select
										value={form.workDayStart}
										onChange={(e) => f("workDayStart", Number(e.target.value))}
										className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-neutral-500"
									>
										{Array.from({ length: 13 }, (_, i) => i + 6).map((h) => (
											<option key={h} value={h}>
												{h < 12 ? `${h}am` : h === 12 ? "12pm" : `${h - 12}pm`}
											</option>
										))}
									</select>
								</div>
								<span className="text-neutral-600 text-sm mt-4">→</span>
								<div className="flex flex-col gap-1.5 flex-1">
									<label className="text-xs uppercase tracking-wider text-neutral-600">End</label>
									<select
										value={form.workDayEnd}
										onChange={(e) => f("workDayEnd", Number(e.target.value))}
										className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-neutral-500"
									>
										{Array.from({ length: 13 }, (_, i) => i + 12).map((h) => (
											<option key={h} value={h} disabled={h <= form.workDayStart}>
												{h === 12 ? "12pm" : h < 12 ? `${h}am` : `${h - 12}pm`}
											</option>
										))}
									</select>
								</div>
							</div>
							<p className="mt-2 text-[10px] text-neutral-700">Controls the calendar time grid and time slot options when creating jobs.</p>
						</div>

						<button
							onClick={handleSave}
							className="rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-all cursor-pointer"
							style={{
								background: saved
									? "#16a34a"
									: form.accentColor,
							}}
						>
							{saved ? "✓ Saved" : "Save Changes"}
						</button>
					</div>

					<div className="md:col-span-2 rounded-xl border border-neutral-800 bg-neutral-900 p-5">
						<h4 className="mb-2 text-[10px] uppercase tracking-widest text-neutral-600">
							Multi-Client Note
						</h4>
						<p className="text-sm text-neutral-500 leading-relaxed">
							In the live version each business that signs up gets
							their own isolated account — their own jobs,
							engineers, and Xero connection. Engineers only ever
							see jobs belonging to their employer. This screen is
							where each business owner configures their profile.
						</p>
					</div>
				</div>
			)}

			{/* Categories tab */}
			{tab === "categories" && (
				<CategoriesPanel accent={form.accentColor} />
			)}

			{/* Export tab */}
			{tab === "export" && (
				<ExportPanel
					jobs={jobs}
					users={users}
					accent={form.accentColor}
				/>
			)}

			{/* Xero tab */}
			{tab === "xero" && (
				<div className="grid grid-cols-1 md:grid-cols-2 gap-5">
					<div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
						<h4 className="mb-4 text-[10px] uppercase tracking-widest text-neutral-600">
							Xero Integration
						</h4>

						<div
							className={`flex items-center gap-3 rounded-xl border p-4 mb-4 ${form.xeroConnected ? "border-green-900 bg-green-950/30" : "border-neutral-700 bg-neutral-800/40"}`}
						>
							<span className="text-2xl">
								{form.xeroConnected ? "✅" : "🔗"}
							</span>
							<div>
								<p
									className={`text-sm ${form.xeroConnected ? "text-green-400" : "text-neutral-400"}`}
								>
									{form.xeroConnected
										? "Connected to Xero"
										: "Not connected"}
								</p>
								{form.xeroConnected && (
									<p className="text-xs text-neutral-600">
										{form.xeroEmail}
									</p>
								)}
							</div>
							{form.xeroConnected && (
								<button
									onClick={() => {
										f("xeroConnected", false);
										f("xeroEmail", "");
									}}
									className="ml-auto rounded-lg border border-red-900 bg-red-950/40 px-3 py-1.5 text-xs text-red-400 cursor-pointer hover:border-red-800 transition-colors"
								>
									Disconnect
								</button>
							)}
						</div>

						{!form.xeroConnected && (
							<>
								<p className="mb-3 text-sm text-neutral-500">
									Connect your Xero account to push completed
									jobs directly as draft invoices — one click
									per job, no double entry.
								</p>
								<div className="mb-3">
									<label className="mb-1.5 block text-xs uppercase tracking-wider text-neutral-600">
										Xero Account Email
									</label>
									<input
										type="email"
										placeholder="your@xero.com"
										value={form.xeroEmail}
										onChange={(e) =>
											f("xeroEmail", e.target.value)
										}
										className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-neutral-500 placeholder:text-neutral-600"
									/>
								</div>
								<button
									onClick={() => {
										if (form.xeroEmail) {
											f("xeroConnected", true);
											saveBusiness({
												...form,
												xeroConnected: true,
											});
										}
									}}
									className="rounded-lg bg-green-900 px-4 py-2 text-sm text-green-300 hover:bg-green-800 transition-colors border-0 cursor-pointer"
								>
									Connect to Xero (OAuth)
								</button>
								<p className="mt-2 text-xs text-neutral-600">
									In production this opens Xero's OAuth flow.
									This simulates the connection.
								</p>
							</>
						)}
					</div>

					<div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
						<h4 className="mb-4 text-[10px] uppercase tracking-widest text-neutral-600">
							Invoice Workflow
						</h4>
						<div className="space-y-3">
							{[
								{
									icon: "🔧",
									step: "Engineer marks job as Completed",
									highlight: false,
								},
								{
									icon: "📋",
									step: "Engineer fills in materials & time spent",
									highlight: false,
								},
								{
									icon: "✅",
									step: "HQ reviews and clicks Final Complete",
									highlight: true,
								},
								{
									icon: "📤",
									step: "HQ clicks Send to Xero",
									highlight: true,
								},
								{
									icon: "🧾",
									step: "Draft invoice created in Xero",
									highlight: false,
								},
							].map((s, i) => (
								<div
									key={i}
									className="flex items-center gap-3"
								>
									<div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-neutral-700 bg-neutral-800 text-xs text-neutral-500">
										{i + 1}
									</div>
									<span
										className={`text-sm ${s.highlight ? "text-orange-400" : "text-neutral-500"}`}
									>
										{s.icon} {s.step}
									</span>
								</div>
							))}
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
