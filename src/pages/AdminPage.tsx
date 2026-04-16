import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { ACCENT_OPTIONS } from "../data";
import { useApp } from "../AppContext";

interface BizRow {
	id: string;
	name: string;
	logo_initials: string;
	accent_color: string;
	phone: string;
	email: string;
	profiles: { count: number }[];
}

export function AdminPage() {
	const { switchBusiness, business } = useApp();
	const navigate = useNavigate();
	const [name, setName] = useState("");
	const [logoInitials, setLogoInitials] = useState("");
	const [accentColor, setAccentColor] = useState("#f97316");
	const [phone, setPhone] = useState("");
	const [email, setEmail] = useState("");
	const [address, setAddress] = useState("");
	const [masterName, setMasterName] = useState("");
	const [masterEmail, setMasterEmail] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

	// Business list for switching
	const [allBiz, setAllBiz] = useState<BizRow[]>([]);
	const [loadingBiz, setLoadingBiz] = useState(true);

	useEffect(() => {
		supabase
			.from("businesses")
			.select("id, name, logo_initials, accent_color, phone, email, profiles(count)")
			.order("name", { ascending: true })
			.then(({ data }) => {
				if (data) setAllBiz(data as unknown as BizRow[]);
				setLoadingBiz(false);
			});
	}, [result]); // re-fetch after creating a new business

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!name || !masterName || !masterEmail) return;

		setSubmitting(true);
		setResult(null);

		try {
			const { data: { session } } = await supabase.auth.getSession();
			const res = await fetch("/.netlify/functions/create-business", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${session?.access_token}`,
				},
				body: JSON.stringify({
					name,
					logoInitials: logoInitials || name.slice(0, 3).toUpperCase(),
					accentColor,
					phone,
					email,
					address,
					masterName,
					masterEmail,
				}),
			});

			const data = await res.json();
			if (res.ok) {
				setResult({ ok: true, message: data.message ?? "Business created successfully" });
				setName("");
				setLogoInitials("");
				setPhone("");
				setEmail("");
				setAddress("");
				setMasterName("");
				setMasterEmail("");
			} else {
				setResult({ ok: false, message: data.error ?? "Something went wrong" });
			}
		} catch {
			setResult({ ok: false, message: "Network error — please try again" });
		} finally {
			setSubmitting(false);
		}
	}

	const inputClass =
		"w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2.5 text-sm text-neutral-100 outline-none focus:border-neutral-500 placeholder:text-neutral-600";

	return (
		<div className="p-6 md:p-8 max-w-2xl">
			{/* ── Client list ── */}
			<h1 className="text-2xl font-normal text-neutral-100 tracking-tight mb-2">
				Admin — Clients
			</h1>
			<p className="text-sm text-neutral-500 mb-6">
				Switch into any client's app to manage their jobs, team, and settings.
			</p>

			{loadingBiz ? (
				<p className="text-sm text-neutral-600 animate-pulse mb-10">Loading businesses…</p>
			) : allBiz.length === 0 ? (
				<p className="text-sm text-neutral-600 mb-10">No businesses yet — create one below.</p>
			) : (
				<div className="space-y-2 mb-10">
					{allBiz.map((b) => (
						<div
							key={b.id}
							className={`flex items-center gap-4 rounded-xl border p-4 transition-colors ${
								b.id === business.id
									? "border-orange-700/60 bg-orange-950/20"
									: "border-neutral-800 bg-neutral-900 hover:border-neutral-700"
							}`}
						>
							<div
								className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
								style={{ backgroundColor: b.accent_color || "#f97316" }}
							>
								{b.logo_initials || b.name.slice(0, 2).toUpperCase()}
							</div>
							<div className="flex-1 min-w-0">
								<p className="text-sm font-medium text-neutral-200 truncate">{b.name}</p>
								<p className="text-xs text-neutral-500 truncate">
									{[b.email, b.phone].filter(Boolean).join(" · ") || "No contact details"}
								</p>
								<p className="text-xs text-neutral-600 mt-0.5">
									{b.profiles?.[0]?.count ?? 0} team member{(b.profiles?.[0]?.count ?? 0) !== 1 ? "s" : ""}
								</p>
							</div>
							{b.id === business.id ? (
								<span className="rounded-lg bg-orange-900/40 border border-orange-800 px-3 py-1.5 text-[11px] font-medium text-orange-300 flex-shrink-0">
									Active
								</span>
							) : (
								<button
									onClick={async () => {
										await switchBusiness(b.id);
										navigate("/");
									}}
									className="rounded-lg border border-neutral-700 hover:border-neutral-500 bg-transparent px-4 py-1.5 text-xs text-neutral-300 transition-colors cursor-pointer flex-shrink-0"
								>
									Enter →
								</button>
							)}
						</div>
					))}
				</div>
			)}

			{/* ── Create new business ── */}
			<h2 className="text-xl font-normal text-neutral-100 tracking-tight mb-2">
				Create New Client
			</h2>
			<p className="text-sm text-neutral-500 mb-8">
				Set up a new business and invite their administrator. They'll receive an email to set their password.
			</p>

			<form onSubmit={handleSubmit} className="space-y-6">
				{/* Company Details */}
				<section>
					<h2 className="text-[11px] uppercase tracking-wider text-neutral-600 mb-4">
						Company Details
					</h2>
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
						<div className="sm:col-span-2">
							<label className="mb-1.5 block text-xs uppercase tracking-wider text-neutral-600">
								Company Name *
							</label>
							<input
								type="text"
								value={name}
								onChange={(e) => setName(e.target.value)}
								placeholder="e.g. Smith Plumbing Ltd"
								required
								className={inputClass}
							/>
						</div>
						<div>
							<label className="mb-1.5 block text-xs uppercase tracking-wider text-neutral-600">
								Logo Initials
							</label>
							<input
								type="text"
								value={logoInitials}
								onChange={(e) => setLogoInitials(e.target.value.toUpperCase().slice(0, 4))}
								placeholder={name ? name.slice(0, 3).toUpperCase() : "SPL"}
								maxLength={4}
								className={inputClass}
							/>
						</div>
						<div>
							<label className="mb-1.5 block text-xs uppercase tracking-wider text-neutral-600">
								Brand Colour
							</label>
							<div className="flex flex-wrap gap-1.5">
								{ACCENT_OPTIONS.slice(0, 12).map((c) => (
									<button
										key={c}
										type="button"
										onClick={() => setAccentColor(c)}
										className="h-7 w-7 rounded-full border-2 cursor-pointer transition-transform hover:scale-110"
										style={{
											backgroundColor: c,
											borderColor: accentColor === c ? "white" : "transparent",
										}}
									/>
								))}
							</div>
						</div>
						<div>
							<label className="mb-1.5 block text-xs uppercase tracking-wider text-neutral-600">
								Phone
							</label>
							<input
								type="tel"
								value={phone}
								onChange={(e) => setPhone(e.target.value)}
								placeholder="01234 567890"
								className={inputClass}
							/>
						</div>
						<div>
							<label className="mb-1.5 block text-xs uppercase tracking-wider text-neutral-600">
								Email
							</label>
							<input
								type="email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								placeholder="office@company.co.uk"
								className={inputClass}
							/>
						</div>
						<div className="sm:col-span-2">
							<label className="mb-1.5 block text-xs uppercase tracking-wider text-neutral-600">
								Address
							</label>
							<input
								type="text"
								value={address}
								onChange={(e) => setAddress(e.target.value)}
								placeholder="Business address"
								className={inputClass}
							/>
						</div>
					</div>
				</section>

				{/* Master User */}
				<section>
					<h2 className="text-[11px] uppercase tracking-wider text-neutral-600 mb-4">
						Administrator
					</h2>
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
						<div>
							<label className="mb-1.5 block text-xs uppercase tracking-wider text-neutral-600">
								Full Name *
							</label>
							<input
								type="text"
								value={masterName}
								onChange={(e) => setMasterName(e.target.value)}
								placeholder="e.g. Jane Smith"
								required
								className={inputClass}
							/>
						</div>
						<div>
							<label className="mb-1.5 block text-xs uppercase tracking-wider text-neutral-600">
								Email *
							</label>
							<input
								type="email"
								value={masterEmail}
								onChange={(e) => setMasterEmail(e.target.value)}
								placeholder="jane@company.co.uk"
								required
								className={inputClass}
							/>
						</div>
					</div>
				</section>

				{/* Result */}
				{result && (
					<div
						className={`rounded-xl border p-4 text-sm ${
							result.ok
								? "border-green-800 bg-green-950/40 text-green-300"
								: "border-red-800 bg-red-950/40 text-red-300"
						}`}
					>
						{result.ok ? "✅ " : "⚠️ "}{result.message}
					</div>
				)}

				{/* Submit */}
				<button
					type="submit"
					disabled={submitting || !name || !masterName || !masterEmail}
					className="rounded-lg px-6 py-3 text-sm font-medium text-white transition-all disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
					style={{ backgroundColor: accentColor }}
				>
					{submitting ? "Creating..." : "Create Business & Send Invite"}
				</button>
			</form>
		</div>
	);
}
