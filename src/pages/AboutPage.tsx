import { useNavigate } from "react-router-dom";

const FEATURES = [
	{
		icon: "📅",
		title: "Smart Scheduling Calendar",
		desc: "Month, week, and day views with per-engineer columns. Drag jobs between time slots and engineers instantly. Colour-coded by status, priority, and category — everything visible at a glance.",
	},
	{
		icon: "🔧",
		title: "Job Management",
		desc: "Create, assign, and track every job from first call to invoice. Log site notes, materials used, and time spent. Set recurring jobs for annual, biannual, or quarterly visits.",
	},
	{
		icon: "👥",
		title: "Team & Engineer Tools",
		desc: "Each engineer gets their own daily view showing exactly what's on their plate. Holiday and absence tracking built in. Real-time notifications keep the whole team in sync.",
	},
	{
		icon: "🏠",
		title: "Customer Records",
		desc: "Maintain a full customer database with contact details and job history. Link jobs to customer profiles for fast lookups and repeat bookings.",
	},
	{
		icon: "📋",
		title: "Unscheduled Job Queue",
		desc: "A live panel of unscheduled work sitting below your calendar. Sort by distance from your current location — ideal for fitting in emergency callouts. Drag directly onto the calendar to schedule.",
	},
	{
		icon: "💷",
		title: "Xero Integration",
		desc: "When a job is marked final-complete, send it straight to Xero as a draft invoice. No double-entry, no chasing paperwork — just one tap to bill.",
	},
	{
		icon: "📱",
		title: "Works on Any Device",
		desc: "Fully responsive on desktop, tablet, and mobile. Engineers can update job status, log notes, and check their schedule from anywhere on site.",
	},
	{
		icon: "🔔",
		title: "Real-Time Notifications",
		desc: "Instant alerts when jobs are assigned, updated, or completed. Masters get a summary of engineer activity; engineers get pinged when their schedule changes.",
	},
];

const PLANS = [
	{
		name: "Starter",
		price: "£120",
		period: "/month",
		users: "Up to 6–8 users",
		desc: "Everything a small team needs to get organised.",
		features: [
			"Full calendar & scheduling",
			"Job management & tracking",
			"Customer database",
			"Xero invoicing integration",
			"Per-engineer day columns",
			"Holiday & absence management",
			"Mobile-ready for engineers",
			"Real-time push notifications",
			"Email support",
		],
		highlight: false,
	},
	{
		name: "Pro",
		price: "£159",
		period: "/month",
		users: "Up to 6–8 users",
		desc: "For teams that want automated customer SMS built in.",
		features: [
			"Everything in Starter",
			"SMS notifications to customers",
			'"En Route" text — customers know when you\'re coming',
			'"Job Completed" confirmation SMS',
			"Day-before appointment reminders",
			"Rescheduled-job alerts",
			"Twilio integration (pay-as-you-go SMS cost included)",
			"Priority support & onboarding",
		],
		highlight: true,
	},
];

export function AboutPage() {
	const navigate = useNavigate();

	return (
		<div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans">
			{/* Nav */}
			<nav className="sticky top-0 z-50 border-b border-neutral-800 bg-neutral-950/90 backdrop-blur-sm">
				<div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
					<div className="flex items-center gap-2">
						<img src="/icon.svg" alt="HiveQ" className="h-8" />
						<span className="text-lg font-bold text-amber-500 tracking-tight">
							HiveQ
						</span>
					</div>
					<div className="flex items-center gap-3">
						<a
							href="mailto:contacthiveq@gmail.com"
							className="rounded-lg border border-neutral-700 hover:border-neutral-500 px-4 py-2 text-sm text-neutral-300 transition-colors no-underline"
						>
							Contact
						</a>
						<button
							onClick={() => navigate("/login")}
							className="rounded-lg border border-amber-700 bg-amber-900/40 px-4 py-2 text-sm text-amber-300 hover:bg-amber-800/50 transition-colors cursor-pointer"
						>
							Sign in →
						</button>
					</div>
				</div>
			</nav>

			{/* Hero */}
			<section className="max-w-6xl mx-auto px-6 pt-20 pb-16 text-center">
				<p className="text-xs uppercase tracking-widest text-amber-500 mb-4">
					Field Service Management
				</p>
				<h1 className="text-5xl md:text-6xl font-normal tracking-tight text-neutral-100 mb-6 leading-tight">
					Every job. Every engineer.
					<br />
					<span className="text-amber-500">One calendar.</span>
				</h1>
				<p className="text-lg text-neutral-400 max-w-2xl mx-auto mb-10 leading-relaxed">
					HiveQ is built for any trade business with a team out in the
					field — plumbers, electricians, builders, HVAC, and more.
					Schedule jobs, manage your crew, and invoice without the
					spreadsheet chaos.
				</p>
				<div className="flex items-center justify-center gap-4 flex-wrap">
					<a
						href="mailto:contacthiveq@gmail.com"
						className="rounded-xl bg-amber-600 hover:bg-amber-500 transition-colors px-7 py-3.5 text-base font-medium text-white no-underline"
					>
						Contact us →
					</a>
					<a
						href="#pricing"
						className="rounded-xl border border-neutral-700 hover:border-neutral-500 transition-colors px-7 py-3.5 text-base text-neutral-300 no-underline"
					>
						See pricing
					</a>
				</div>
			</section>

			{/* Feature strip */}
			<section className="border-t border-neutral-800 py-4 overflow-hidden">
				<div className="max-w-6xl mx-auto px-6">
					<div className="flex flex-wrap justify-center gap-6 text-xs text-neutral-600 uppercase tracking-widest">
						{[
							"Drag & drop scheduling",
							"Xero integration",
							"Per-engineer views",
							"Real-time notifications",
							"Mobile ready",
							"Holiday tracking",
						].map((f) => (
							<span key={f} className="flex items-center gap-1.5">
								<span className="w-1 h-1 rounded-full bg-amber-700 inline-block" />
								{f}
							</span>
						))}
					</div>
				</div>
			</section>

			{/* Features */}
			<section className="max-w-6xl mx-auto px-6 py-20">
				<div className="text-center mb-14">
					<h2 className="text-3xl font-normal text-neutral-100 tracking-tight mb-3">
						Everything your team needs
					</h2>
					<p className="text-neutral-500 max-w-xl mx-auto">
						Built specifically for field service teams. No bloat, no
						learning curve — just the tools you actually use.
					</p>
				</div>
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
					{FEATURES.map((f) => (
						<div
							key={f.title}
							className="rounded-xl border border-neutral-800 bg-neutral-900 p-5 hover:border-neutral-700 transition-colors"
						>
							<div className="text-2xl mb-3">{f.icon}</div>
							<h3 className="text-sm font-medium text-neutral-200 mb-2">
								{f.title}
							</h3>
							<p className="text-xs text-neutral-500 leading-relaxed">
								{f.desc}
							</p>
						</div>
					))}
				</div>
			</section>

			{/* How it works */}
			<section className="border-t border-neutral-800 py-20">
				<div className="max-w-6xl mx-auto px-6">
					<div className="text-center mb-14">
						<h2 className="text-3xl font-normal text-neutral-100 tracking-tight mb-3">
							How it works
						</h2>
					</div>
					<div className="grid grid-cols-1 md:grid-cols-3 gap-8">
						{[
							{
								step: "01",
								title: "Book the job",
								body: "Log a new job with the customer details, address, category, and priority. Assign it to an engineer and pick a date — or drop it in the unscheduled queue to plan later.",
							},
							{
								step: "02",
								title: "Engineers get to work",
								body: "Each engineer sees their own daily view with time-slotted jobs. They update status from On Site to Completed, log materials used, and add site notes — all from their phone.",
							},
							{
								step: "03",
								title: "Invoice without the admin",
								body: "When you approve a completed job it goes straight to Xero as a draft invoice. One tap, no copy-pasting — your books stay up to date automatically.",
							},
						].map((s) => (
							<div key={s.step} className="flex gap-5">
								<span className="text-3xl font-bold text-neutral-800 leading-none pt-1 flex-shrink-0">
									{s.step}
								</span>
								<div>
									<h3 className="text-base font-medium text-neutral-200 mb-2">
										{s.title}
									</h3>
									<p className="text-sm text-neutral-500 leading-relaxed">
										{s.body}
									</p>
								</div>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* Pricing */}
			<section id="pricing" className="border-t border-neutral-800 py-20">
				<div className="max-w-6xl mx-auto px-6">
					<div className="text-center mb-14">
						<h2 className="text-3xl font-normal text-neutral-100 tracking-tight mb-3">
							Simple, transparent pricing
						</h2>
						<p className="text-neutral-500">
							No setup fees. No per-job charges. Cancel any time.
						</p>
					</div>
					<div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
						{PLANS.map((plan) => (
							<div
								key={plan.name}
								className={`rounded-2xl border p-8 ${
									plan.highlight
										? "border-amber-700/60 bg-amber-950/20"
										: "border-neutral-800 bg-neutral-900"
								}`}
							>
								{plan.highlight && (
									<p className="text-[10px] uppercase tracking-widest text-amber-500 mb-3">
										Most popular
									</p>
								)}
								<h3 className="text-xl font-medium text-neutral-100 mb-1">
									{plan.name}
								</h3>
								<p className="text-sm text-neutral-500 mb-5">
									{plan.desc}
								</p>
								<div className="flex items-end gap-1 mb-1">
									<span className="text-4xl font-light text-neutral-100">
										{plan.price}
									</span>
									<span className="text-neutral-500 mb-1.5 text-sm">
										{plan.period}
									</span>
								</div>
								<p className="text-xs text-amber-500 mb-6">
									{plan.users}
								</p>
								<ul className="space-y-2.5 mb-8">
									{plan.features.map((f) => (
										<li
											key={f}
											className="flex items-start gap-2 text-sm text-neutral-400"
										>
											<span className="text-amber-600 mt-0.5 flex-shrink-0">
												✓
											</span>
											{f}
										</li>
									))}
								</ul>
								<a
									href="mailto:contacthiveq@gmail.com"
									className={`w-full rounded-xl py-3 text-sm font-medium transition-colors text-center block no-underline ${
										plan.highlight
											? "bg-amber-600 hover:bg-amber-500 text-white"
											: "border border-neutral-700 hover:border-neutral-500 text-neutral-300 bg-transparent"
									}`}
								>
									Contact us →
								</a>
							</div>
						))}
					</div>
					<p className="text-center text-xs text-neutral-500 mt-8">
						Prices exclude VAT. Annual billing available on request.
					</p>
				</div>
			</section>

			{/* Footer CTA */}
			<section className="border-t border-neutral-800 py-20 text-center">
				<div className="max-w-xl mx-auto px-6">
					<h2 className="text-3xl font-normal text-neutral-100 tracking-tight mb-4">
						Ready to get organised?
					</h2>
					<p className="text-neutral-500 mb-8">
						Set up takes minutes. Your team will wonder how they
						managed without it.
					</p>
					<button
						onClick={() => navigate("/login")}
						className="rounded-xl bg-amber-600 hover:bg-amber-500 transition-colors px-8 py-4 text-base font-medium text-white cursor-pointer"
					>
						Sign in to your account →
					</button>
				</div>
			</section>

			{/* Footer */}
			<footer className="border-t border-neutral-900 py-8">
				<div className="max-w-6xl mx-auto px-6 flex items-center justify-between flex-wrap gap-4">
					<span className="text-sm font-bold text-amber-500">
						HiveQ
					</span>
					<p className="text-xs text-neutral-500">
						© {new Date().getFullYear()} HiveQ. Field service
						management for small trade teams.
					</p>
				</div>
			</footer>
		</div>
	);
}
