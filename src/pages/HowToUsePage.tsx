import { useNavigate } from "react-router-dom";
import { useApp } from "../AppContext";

const MASTER_SECTIONS = [
	{
		icon: "📅",
		title: "Creating a Job",
		steps: [
			"Open the sidebar and tap New Job.",
			"Select an existing customer or create a new one inline.",
			"Fill in the job description, category, priority, and estimated duration.",
			"Assign an engineer and pick a date & time slot — or leave it unscheduled to plan later.",
			"Hit Save. The job appears on the calendar and in the engineer's dashboard instantly.",
		],
	},
	{
		icon: "🗓️",
		title: "Using the Calendar",
		steps: [
			"Switch between Month, Week, and Day view with the tabs at the top.",
			"Each engineer gets their own column in Week / Day view so you can see the full team at a glance.",
			"Drag a job card to a different time slot or engineer column to reschedule.",
			"Colour-coded borders show status (scheduled, en route, on site, completed).",
			"Click any job card to open the full detail page.",
		],
	},
	{
		icon: "📋",
		title: "Unscheduled Job Queue",
		steps: [
			"Jobs without a date sit in the Unscheduled panel below the calendar.",
			"Use the distance sort to see which jobs are closest to a given location — great for squeezing in emergency callouts.",
			"Drag a job from the queue straight onto the calendar to schedule it.",
		],
	},
	{
		icon: "✅",
		title: "Reviewing & Invoicing",
		steps: [
			"When an engineer marks a job Completed, it shows up on your calendar with a completed badge.",
			"Open the job, review the engineer's notes & photos, then tap Ready to Invoice.",
			"If Xero integration is enabled, the job is sent as a draft invoice automatically — no double-entry.",
		],
	},
	{
		icon: "👥",
		title: "Managing the Team",
		steps: [
			"Go to Team to see all engineers and their roles.",
			"Use the Holidays page to view, approve, or decline time-off requests.",
			"Account settings let you configure business hours, accent colour, and Xero connection.",
		],
	},
];

const ENGINEER_SECTIONS = [
	{
		icon: "☀️",
		title: "Your Daily View — My Day",
		steps: [
			"Open My Day from the sidebar. This shows every job assigned to you today, in time order.",
			"Each card shows the customer name, address, time slot, and current status.",
			"Tap the GPS button to see distances from your current location and get a route link.",
		],
	},
	{
		icon: "🔄",
		title: "Progressing a Job",
		steps: [
			"When you're heading to site, tap En Route — this updates the office in real time.",
			"Arrive and tap On Site.",
			"When the work is done, tap Completed.",
			"Add notes about what was done, materials used, or anything the office needs to know — they auto-save.",
		],
	},
	{
		icon: "📸",
		title: "Photos & Notes",
		steps: [
			"On the job detail page you can upload photos directly from your phone camera or gallery.",
			"Use the notes field to log materials, observations, or follow-up actions.",
			"Everything you add is visible to the master back in the office immediately.",
		],
	},
	{
		icon: "📊",
		title: "Dashboard & Search",
		steps: [
			"The Dashboard gives you a searchable list of all your jobs.",
			"Filter by status or priority to find what you need quickly.",
			"Emergency jobs are highlighted so they stand out.",
		],
	},
	{
		icon: "🏖️",
		title: "Holidays",
		steps: [
			"Go to Holidays to request time off.",
			"Your master will approve or decline — you'll get a notification either way.",
			"Approved holidays block out your calendar column automatically.",
		],
	},
];

const JOB_FLOW = [
	{ label: "Scheduled", color: "bg-blue-500" },
	{ label: "En Route", color: "bg-amber-500" },
	{ label: "On Site", color: "bg-orange-500" },
	{ label: "Completed", color: "bg-green-500" },
	{ label: "Invoiced", color: "bg-neutral-500" },
];

export function HowToUsePage() {
	const navigate = useNavigate();
	const { isMaster } = useApp();

	return (
		<div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans">
			<div className="max-w-5xl mx-auto px-6 py-12">
				{/* Header */}
				<div className="mb-12">
					<p className="text-xs uppercase tracking-widest text-orange-500 mb-3">
						User Guide
					</p>
					<h1 className="text-4xl font-normal tracking-tight text-neutral-100 mb-4">
						How to use PipeLine
					</h1>
					<p className="text-neutral-400 max-w-2xl leading-relaxed">
						A quick walkthrough for administrators (masters) and
						engineers. Everything you need to know to get your team
						up and running.
					</p>
				</div>

				{/* Job lifecycle */}
				<section className="mb-16">
					<h2 className="text-2xl font-normal text-neutral-100 tracking-tight mb-6">
						Job lifecycle
					</h2>
					<p className="text-sm text-neutral-400 mb-6">
						{isMaster
							? "Every job follows the same flow. Engineers progress the status on site; you review and invoice."
							: "Every job follows the same flow. You progress the status on site; your master reviews and invoices."}
					</p>
					<div className="flex flex-wrap items-center gap-2">
						{JOB_FLOW.map((s, i) => (
							<div
								key={s.label}
								className="flex items-center gap-2"
							>
								<span
									className={`inline-flex items-center rounded-full px-3.5 py-1.5 text-xs font-medium text-white ${s.color}`}
								>
									{s.label}
								</span>
								{i < JOB_FLOW.length - 1 && (
									<span className="text-neutral-700">→</span>
								)}
							</div>
						))}
					</div>
					<p className="text-xs text-neutral-600 mt-3">
						{isMaster
							? "Engineers handle Scheduled → Completed · You handle Completed → Invoiced"
							: "You handle Scheduled → Completed · Your master handles Completed → Invoiced"}
					</p>
				</section>

				{/* Master guide */}
				{isMaster && (
					<section className="mb-16">
						<div className="flex items-center gap-3 mb-8">
							<span className="inline-flex items-center rounded-lg bg-orange-900/40 border border-orange-800 px-3 py-1.5 text-xs font-medium text-orange-300">
								Administrator / Master
							</span>
						</div>
						<div className="space-y-8">
							{MASTER_SECTIONS.map((sec) => (
								<div
									key={sec.title}
									className="rounded-xl border border-neutral-800 bg-neutral-900 p-6"
								>
									<h3 className="text-base font-medium text-neutral-200 mb-4 flex items-center gap-2">
										<span className="text-xl">
											{sec.icon}
										</span>
										{sec.title}
									</h3>
									<ol className="space-y-2 list-decimal list-inside">
										{sec.steps.map((step, i) => (
											<li
												key={i}
												className="text-sm text-neutral-400 leading-relaxed pl-1"
											>
												{step}
											</li>
										))}
									</ol>
								</div>
							))}
						</div>
					</section>
				)}

				{/* Engineer guide */}
				<section className="mb-16">
					<div className="flex items-center gap-3 mb-8">
						<span className="inline-flex items-center rounded-lg bg-blue-900/40 border border-blue-800 px-3 py-1.5 text-xs font-medium text-blue-300">
							Engineer
						</span>
					</div>

					{/* Typical engineer process */}
					<div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-6 mb-8">
						<h3 className="text-base font-medium text-neutral-200 mb-4">
							A typical day as an engineer
						</h3>
						<ol className="space-y-3 list-decimal list-inside">
							<li className="text-sm text-neutral-400 leading-relaxed pl-1">
								Open{" "}
								<strong className="text-neutral-300">
									My Day
								</strong>{" "}
								first thing — see all your jobs for today in
								time order.
							</li>
							<li className="text-sm text-neutral-400 leading-relaxed pl-1">
								Tap{" "}
								<strong className="text-neutral-300">
									GPS
								</strong>{" "}
								to check distances and plan your route.
							</li>
							<li className="text-sm text-neutral-400 leading-relaxed pl-1">
								Head to your first job and mark it{" "}
								<strong className="text-neutral-300">
									En Route
								</strong>{" "}
								— the office sees it in real time.
							</li>
							<li className="text-sm text-neutral-400 leading-relaxed pl-1">
								Arrive on site, tap{" "}
								<strong className="text-neutral-300">
									On Site
								</strong>
								, and get to work.
							</li>
							<li className="text-sm text-neutral-400 leading-relaxed pl-1">
								When finished, tap{" "}
								<strong className="text-neutral-300">
									Completed
								</strong>
								. Add notes about what was done and any photos.
							</li>
							<li className="text-sm text-neutral-400 leading-relaxed pl-1">
								Move on to the next job — your master handles
								invoicing from there.
							</li>
						</ol>
					</div>

					<div className="space-y-8">
						{ENGINEER_SECTIONS.map((sec) => (
							<div
								key={sec.title}
								className="rounded-xl border border-neutral-800 bg-neutral-900 p-6"
							>
								<h3 className="text-base font-medium text-neutral-200 mb-4 flex items-center gap-2">
									<span className="text-xl">{sec.icon}</span>
									{sec.title}
								</h3>
								<ol className="space-y-2 list-decimal list-inside">
									{sec.steps.map((step, i) => (
										<li
											key={i}
											className="text-sm text-neutral-400 leading-relaxed pl-1"
										>
											{step}
										</li>
									))}
								</ol>
							</div>
						))}
					</div>
				</section>

				{/* Quick tips */}
				<section className="mb-16">
					<h2 className="text-2xl font-normal text-neutral-100 tracking-tight mb-6">
						Quick tips
					</h2>
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
						{[
							{
								tip: "Works offline",
								detail: "The app caches your data so you can view jobs even with no signal. Changes sync when you're back online.",
							},
							{
								tip: "Install on your phone",
								detail: "On iOS, tap Share → Add to Home Screen. On Android, tap the install banner. It works like a native app.",
							},
							{
								tip: "Push notifications",
								detail: "Enable notifications when prompted — you'll get alerts for new assignments, schedule changes, and completed jobs.",
							},
							{
								tip: "Keyboard shortcuts",
								detail: "On desktop, use arrow keys to navigate calendar days and Enter to open a slot. Press N to start a new job.",
							},
						].map((t) => (
							<div
								key={t.tip}
								className="rounded-xl border border-neutral-800 bg-neutral-900 p-5"
							>
								<h4 className="text-sm font-medium text-neutral-200 mb-1">
									{t.tip}
								</h4>
								<p className="text-xs text-neutral-500 leading-relaxed">
									{t.detail}
								</p>
							</div>
						))}
					</div>
				</section>

				{/* Back */}
				<div className="text-center pt-4 pb-8">
					<button
						onClick={() => navigate(-1)}
						className="rounded-xl border border-neutral-700 hover:border-neutral-500 transition-colors px-6 py-3 text-sm text-neutral-400 bg-transparent cursor-pointer"
					>
						← Back
					</button>
				</div>
			</div>
		</div>
	);
}
