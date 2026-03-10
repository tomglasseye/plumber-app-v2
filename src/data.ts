import type { Business, Job, Priority, Status, User } from "./types";

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
	},
	{
		id: "2",
		name: "Tom Briggs",
		email: "tom@dphplumbing.co.uk",
		role: "engineer",
		avatar: "TB",
		home: "5 Sandbanks Rd, Poole BH14 8BU",
		phone: "07700 900002",
	},
	{
		id: "3",
		name: "Sam Carter",
		email: "sam@dphplumbing.co.uk",
		role: "engineer",
		avatar: "SC",
		home: "17 Stour Rd, Christchurch BH23 1PL",
		phone: "07700 900003",
	},
	{
		id: "4",
		name: "Lee Owens",
		email: "lee@dphplumbing.co.uk",
		role: "engineer",
		avatar: "LO",
		home: "8 Ringwood Rd, Bournemouth BH11 8LP",
		phone: "07700 900004",
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

export const INITIAL_JOBS: Job[] = [
	{
		id: "1",
		ref: "DPH-001",
		customer: "Mr & Mrs Patel",
		address: "14 Orchard Lane, Poole BH15 1AB",
		type: "Boiler Service",
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
		address: "2 Quay Rd, Poole BH15 4AB",
		type: "Emergency Leak",
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
		address: "88 Canford Rd, Wimborne BH21 2EE",
		type: "Bathroom Fit",
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
		address: "Unit 6, Parkside, Bournemouth BH8 1AA",
		type: "Radiator Replacement",
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
		address: "31 Pine Ave, Ferndown BH22 9XT",
		type: "Boiler Repair",
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
		address: "4 Victoria Rd, Bournemouth BH1 4QR",
		type: "Boiler Service",
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

export function genRef(jobs: Job[]): string {
	return `DPH-${String(jobs.length + 1).padStart(3, "0")}`;
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
