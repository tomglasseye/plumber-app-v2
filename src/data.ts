import type {
	Business,
	HolidayType,
	Job,
	Priority,
	Status,
	User,
} from "./types";

export const TODAY = new Date().toISOString().slice(0, 10);

export const ACCENT_OPTIONS = [
	"#f97316", // orange
	"#f59e0b", // amber
	"#eab308", // yellow
	"#84cc16", // lime
	"#22c55e", // green
	"#10b981", // emerald
	"#14b8a6", // teal
	"#06b6d4", // cyan
	"#0ea5e9", // sky
	"#3b82f6", // blue
	"#6366f1", // indigo
	"#8b5cf6", // violet
	"#a855f7", // purple
	"#d946ef", // fuchsia
	"#ec4899", // pink
	"#f43f5e", // rose
	"#ef4444", // red
	"#dc2626", // red-600
];

export const INITIAL_BUSINESS: Business = {
	id: "dph-001",
	name: "DPH Plumbing Ltd",
	phone: "01202 555 123",
	email: "office@dphplumbing.co.uk",
	address: "Unit 4, Harbour Trade Park, Poole BH15 1TT",
	vatNumber: "GB 123 4567 89",
	accentColor: "#f97316",
	xeroConnected: false,
	xeroEmail: "",
	logoInitials: "DPH",
	workDayStart: 7,
	workDayEnd: 17,
};

export const USERS: User[] = [
	{
		id: "1",
		name: "Dave Harris",
		email: "dave@dphplumbing.co.uk",
		role: "master",
		avatar: "DH",
		home: "22 Harbour View, Poole BH15 1NN",
		phone: "07700 900001",
		holidayAllowance: 28,
	},
	{
		id: "2",
		name: "Tom Briggs",
		email: "tom@dphplumbing.co.uk",
		role: "engineer",
		avatar: "TB",
		home: "5 Sandbanks Rd, Poole BH14 8BU",
		phone: "07700 900002",
		holidayAllowance: 28,
	},
	{
		id: "3",
		name: "Sam Carter",
		email: "sam@dphplumbing.co.uk",
		role: "engineer",
		avatar: "SC",
		home: "17 Stour Rd, Christchurch BH23 1PL",
		phone: "07700 900003",
		holidayAllowance: 28,
	},
	{
		id: "4",
		name: "Lee Owens",
		email: "lee@dphplumbing.co.uk",
		role: "engineer",
		avatar: "LO",
		home: "8 Ringwood Rd, Bournemouth BH11 8LP",
		phone: "07700 900004",
		holidayAllowance: 28,
	},
];

export const STATUSES: Status[] = [
	"Scheduled",
	"En Route",
	"On Site",
	"Completed",
	"Invoiced",
];
export const PRIORITIES: Priority[] = ["Emergency", "High", "Normal", "Low"];

export function buildTimeOpts(hourStart: number, hourEnd: number) {
	const opts: { value: string; label: string }[] = [];
	for (let h = hourStart; h < hourEnd; h++) {
		for (const m of [0, 30]) {
			const value = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
			const ampm = h < 12 ? "am" : "pm";
			const dh = h > 12 ? h - 12 : h;
			opts.push({
				value,
				label: `${dh}:${String(m).padStart(2, "0")} ${ampm}`,
			});
		}
	}
	return opts;
}

export const PRIORITY_ORDER: Record<Priority, number> = {
	Emergency: 0,
	High: 1,
	Normal: 2,
	Low: 3,
};

export const STATUS_COLORS: Record<
	Status,
	{ bg: string; text: string; border: string }
> = {
	Scheduled: {
		bg: "bg-blue-950",
		text: "text-blue-300",
		border: "border-blue-800",
	},
	"En Route": {
		bg: "bg-yellow-950",
		text: "text-yellow-300",
		border: "border-yellow-800",
	},
	"On Site": {
		bg: "bg-green-950",
		text: "text-green-300",
		border: "border-green-800",
	},
	Completed: {
		bg: "bg-purple-950",
		text: "text-purple-300",
		border: "border-purple-800",
	},
	Invoiced: {
		bg: "bg-red-950",
		text: "text-red-300",
		border: "border-red-800",
	},
};

export const PRIORITY_COLORS: Record<
	Priority,
	{ bg: string; text: string; dot: string }
> = {
	Emergency: { bg: "bg-red-950", text: "text-red-400", dot: "bg-red-500" },
	High: {
		bg: "bg-orange-950",
		text: "text-orange-400",
		dot: "bg-orange-500",
	},
	Normal: { bg: "bg-blue-950", text: "text-blue-400", dot: "bg-blue-500" },
	Low: {
		bg: "bg-neutral-900",
		text: "text-neutral-500",
		dot: "bg-neutral-600",
	},
};

const ENG_PALETTE = [
	"#f97316",
	"#38bdf8",
	"#a78bfa",
	"#34d399",
	"#fb7185",
	"#fbbf24",
];
export function engColor(id: string): string {
	let h = 0;
	for (let i = 0; i < id.length; i++)
		h = (Math.imul(31, h) + id.charCodeAt(i)) | 0;
	return ENG_PALETTE[Math.abs(h) % ENG_PALETTE.length];
}

/** Resolves a user's colour: uses their saved accent colour if set, otherwise falls back to the hash-based palette colour. */
export function userColor(id: string, users: User[]): string {
	const u = users.find((u) => u.id === id);
	return u?.color ?? engColor(id);
}

export const HOLIDAY_TYPE_CONFIG: Record<
	HolidayType,
	{ label: string; emoji: string; bg: string; text: string }
> = {
	holiday: {
		label: "Holiday",
		emoji: "🏖️",
		bg: "bg-blue-950/60",
		text: "text-blue-300",
	},
	sick: {
		label: "Sick Day",
		emoji: "🤒",
		bg: "bg-red-950/60",
		text: "text-red-300",
	},
	training: {
		label: "Training",
		emoji: "📚",
		bg: "bg-green-950/60",
		text: "text-green-300",
	},
	other: {
		label: "Other",
		emoji: "📅",
		bg: "bg-neutral-800",
		text: "text-neutral-400",
	},
};

// ── UK Bank Holidays ────────────────────────────────────────────────────────

export interface BankHoliday {
	date: string; // YYYY-MM-DD
	name: string;
}

/** Compute Easter Sunday for a given year (Anonymous Gregorian algorithm). */
function easterSunday(year: number): Date {
	const a = year % 19;
	const b = Math.floor(year / 100);
	const c = year % 100;
	const d = Math.floor(b / 4);
	const e = b % 4;
	const f = Math.floor((b + 8) / 25);
	const g = Math.floor((b - f + 1) / 3);
	const h = (19 * a + b - d - g + 15) % 30;
	const i = Math.floor(c / 4);
	const k = c % 4;
	const l = (32 + 2 * e + 2 * i - h - k) % 7;
	const m = Math.floor((a + 11 * h + 22 * l) / 451);
	const month = Math.floor((h + l - 7 * m + 114) / 31);
	const day = ((h + l - 7 * m + 114) % 31) + 1;
	return new Date(year, month - 1, day);
}

function fmtDate(d: Date): string {
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(d: Date, n: number): Date {
	const r = new Date(d);
	r.setDate(r.getDate() + n);
	return r;
}

/** If date falls on Sat → substitute Mon; if Sun → substitute Mon. */
function substituteDay(d: Date): Date {
	const dow = d.getDay();
	if (dow === 6) return addDays(d, 2); // Sat → Mon
	if (dow === 0) return addDays(d, 1); // Sun → Mon
	return d;
}

/** Returns all UK (England & Wales) bank holidays for a given year. */
export function getUKBankHolidays(year: number): BankHoliday[] {
	const holidays: BankHoliday[] = [];

	// New Year's Day (1 Jan, substituted)
	holidays.push({
		date: fmtDate(substituteDay(new Date(year, 0, 1))),
		name: "New Year's Day",
	});

	// Good Friday (Easter - 2)
	const easter = easterSunday(year);
	holidays.push({ date: fmtDate(addDays(easter, -2)), name: "Good Friday" });

	// Easter Monday (Easter + 1)
	holidays.push({ date: fmtDate(addDays(easter, 1)), name: "Easter Monday" });

	// Early May bank holiday (first Monday of May)
	const may1 = new Date(year, 4, 1);
	const earlyMayOffset = (8 - may1.getDay()) % 7;
	holidays.push({
		date: fmtDate(new Date(year, 4, 1 + earlyMayOffset)),
		name: "Early May Bank Holiday",
	});

	// Spring bank holiday (last Monday of May)
	const may31 = new Date(year, 4, 31);
	const springOffset = (may31.getDay() + 6) % 7;
	holidays.push({
		date: fmtDate(new Date(year, 4, 31 - springOffset)),
		name: "Spring Bank Holiday",
	});

	// Summer bank holiday (last Monday of August)
	const aug31 = new Date(year, 7, 31);
	const summerOffset = (aug31.getDay() + 6) % 7;
	holidays.push({
		date: fmtDate(new Date(year, 7, 31 - summerOffset)),
		name: "Summer Bank Holiday",
	});

	// Christmas Day (25 Dec, substituted)
	const xmas = new Date(year, 11, 25);
	holidays.push({
		date: fmtDate(substituteDay(xmas)),
		name: "Christmas Day",
	});

	// Boxing Day (26 Dec, substituted — if Xmas is on Fri, boxing day substitute is Mon)
	const boxing = new Date(year, 11, 26);
	const boxingSub =
		boxing.getDay() === 6
			? addDays(boxing, 2)
			: boxing.getDay() === 0
				? addDays(boxing, 1)
				: boxing;
	// If xmas substitute is same as boxing substitute, shift boxing to next day
	const xmasSub = substituteDay(xmas);
	const boxingFinal =
		fmtDate(boxingSub) === fmtDate(xmasSub)
			? addDays(boxingSub, 1)
			: boxingSub;
	holidays.push({ date: fmtDate(boxingFinal), name: "Boxing Day" });

	return holidays.sort((a, b) => a.date.localeCompare(b.date));
}

/** Returns a lookup of date string → bank holiday name for a range of years. */
export function bankHolidayMap(years: number[]): Record<string, string> {
	const m: Record<string, string> = {};
	for (const y of years) {
		for (const h of getUKBankHolidays(y)) {
			m[h.date] = h.name;
		}
	}
	return m;
}

export function getWeekStart(d: Date): Date {
	const result = new Date(d);
	const day = result.getDay();
	const diff = day === 0 ? -6 : 1 - day;
	result.setDate(result.getDate() + diff);
	return result;
}

export const INITIAL_JOBS: Job[] = [
	{
		id: "1",
		ref: "DPH-001",
		customer: "Mr & Mrs Patel",
		phone: "",
		address: "14 Orchard Lane, Poole BH15 1AB",
		description: "Annual boiler service and safety check.",
		assignedTo: "2",
		status: "Completed",
		priority: "Normal",
		date: "2026-03-08",
		materials: "Boiler filter x1, gasket set",
		notes: "Service completed.",
		timeSpent: 2.5,
		readyToInvoice: false,
	},
	{
		id: "2",
		ref: "DPH-002",
		customer: "Riverside Cafe",
		phone: "",
		address: "2 Quay Rd, Poole BH15 4AB",
		description: "Burst pipe under kitchen sink, water damage to unit.",
		assignedTo: "3",
		status: "On Site",
		priority: "Emergency",
		date: "2026-03-09",
		materials: "",
		notes: "",
		timeSpent: 0,
		readyToInvoice: false,
	},
	{
		id: "3",
		ref: "DPH-003",
		customer: "Mrs J Thompson",
		phone: "",
		address: "88 Canford Rd, Wimborne BH21 2EE",
		description:
			"Full bathroom refit - new suite, tiling, thermostatic shower.",
		assignedTo: "2",
		status: "Scheduled",
		priority: "Normal",
		date: "2026-03-09",
		materials: "",
		notes: "",
		timeSpent: 0,
		readyToInvoice: false,
	},
	{
		id: "4",
		ref: "DPH-004",
		customer: "Parkside Apartments",
		phone: "",
		address: "Unit 6, Parkside, Bournemouth BH8 1AA",
		description: "Replace 3 radiators in lounge and bedrooms.",
		assignedTo: "4",
		status: "En Route",
		priority: "High",
		date: "2026-03-09",
		materials: "",
		notes: "",
		timeSpent: 0,
		readyToInvoice: false,
	},
	{
		id: "5",
		ref: "DPH-005",
		customer: "Mr Blake",
		phone: "",
		address: "31 Pine Ave, Ferndown BH22 9XT",
		description: "No hot water - likely diverter valve fault.",
		assignedTo: "3",
		status: "Scheduled",
		priority: "High",
		date: "2026-03-09",
		materials: "",
		notes: "",
		timeSpent: 0,
		readyToInvoice: false,
	},
	{
		id: "6",
		ref: "DPH-006",
		customer: "Mrs Holloway",
		phone: "",
		address: "4 Victoria Rd, Bournemouth BH1 4QR",
		description: "Annual boiler service.",
		assignedTo: "2",
		status: "Scheduled",
		priority: "Low",
		date: "2026-03-09",
		materials: "",
		notes: "",
		timeSpent: 0,
		readyToInvoice: false,
	},
];

export function genRef(jobs: Job[], prefix: string): string {
	let max = 0;
	for (const j of jobs) {
		const m = j.ref.match(/-(\d+)$/);
		if (m) max = Math.max(max, parseInt(m[1], 10));
	}
	return `${prefix}-${String(max + 1).padStart(3, "0")}`;
}

export function getUser(id: string): User | undefined {
	return USERS.find((u) => u.id === id);
}

export function fmtTime(): string {
	return new Date().toLocaleTimeString("en-GB", {
		hour: "2-digit",
		minute: "2-digit",
	});
}

export function mapsRouteUrl(stops: string[]): string {
	const enc = stops.map((a) => encodeURIComponent(a));
	if (enc.length === 2)
		return `https://www.google.com/maps/dir/${enc[0]}/${enc[1]}`;
	return `https://www.google.com/maps/dir/${enc[0]}/${enc.slice(1, -1).join("/")}/${enc[enc.length - 1]}`;
}
