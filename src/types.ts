export type Role = "master" | "engineer";

export type Status =
	| "Scheduled"
	| "En Route"
	| "On Site"
	| "Completed"
	| "Invoiced";

export type Priority = "Emergency" | "High" | "Normal" | "Low";

export interface User {
	id: string;
	name: string;
	email: string;
	role: Role;
	avatar: string;
	home: string;
	phone: string;
	color?: string; // personal accent colour
	locked?: boolean;
	holidayAllowance: number; // annual holiday allowance in days
}

export interface Category {
	id: string;
	name: string;
	icon: string; // lucide icon name e.g. "Wrench"
	color: string; // hex color
	sortOrder: number;
}

export type HolidayType = "holiday" | "sick" | "training" | "other";
export type HolidayStatus = "pending" | "approved" | "declined";

export interface Holiday {
	id: string;
	profileId: string;
	date: string; // ISO date 'YYYY-MM-DD' (start date)
	endDate?: string; // ISO date 'YYYY-MM-DD' (inclusive end, for multi-day)
	halfDay: boolean;
	label: string;
	type: HolidayType;
	status: HolidayStatus;
}

export interface Job {
	id: string;
	ref: string;
	customer: string;
	phone: string;
	address: string;
	description: string;
	assignedTo?: string;
	status: Status;
	priority: Priority;
	date?: string; // ISO date 'YYYY-MM-DD' (start date)
	endDate?: string; // ISO date — for multi-day or early-completion
	startTime?: string; // 'HH:MM' e.g. '09:00'
	endTime?: string; // 'HH:MM' e.g. '10:30'
	categoryId?: string;
	materials: string;
	materialsCost: number;
	notes: string;
	timeSpent: number;
	readyToInvoice: boolean;
	sortOrder?: number;
	customerId?: string;
	repeatFrequency?: RepeatFrequency;
	// Actual timestamps (migration 26) — stamped as the engineer advances status.
	enRouteAt?: string; // ISO — left for the job
	onSiteAt?: string; // ISO — arrived / started work (billable start)
	completedAt?: string; // ISO — finished (billable end)
}

export interface Customer {
	id: string;
	name: string;
	email: string;
	phone: string;
	address: string;
	notes: string;
	xeroContactId?: string;
}

export interface Notification {
	id: string;
	icon: string;
	message: string;
	time: string;
	read: boolean;
	for: "master" | string;
	jobId?: string;
}

export interface Business {
	id: string;
	name: string;
	phone: string;
	email: string;
	address: string;
	vatNumber: string;
	accentColor: string;
	xeroConnected: boolean;
	xeroEmail: string;
	logoInitials: string;
	workDayStart: number; // hour 0-23, e.g. 7
	workDayEnd: number;   // hour 0-23, e.g. 17
	plan: BusinessPlan; // 'starter' = Tier 1, 'pro' = Tier 2 (gates Pro-only features e.g. SMS)
	pushEnabled: boolean; // opt-in for native Web Push (OS notifications). Default false — in-app notifications are always on regardless. See docs/NOTIFICATIONS.md
}

// Subscription tier. 'starter' = Tier 1 (no SMS), 'pro' = Tier 2 (SMS etc).
// Populated by Stripe once billing lands (see docs/STRIPE.md); defaults to 'starter'.
export type BusinessPlan = "starter" | "pro";

export type ReminderStatus = "open" | "done" | "dismissed";

// Free-form HQ reminder shown on the master dashboard's Upcoming Events feed.
// Distinct from auto-surfaced events (holidays / recurring jobs), which aren't stored.
export interface Reminder {
	id: string;
	title: string;
	body: string;
	dueDate?: string; // ISO 'YYYY-MM-DD' — optional; undated reminders are allowed
	customerId?: string;
	status: ReminderStatus;
	createdBy?: string;
	createdAt: string; // ISO timestamp
}

export interface NewJobForm {
	customer: string;
	phone: string;
	address: string;
	description: string;
	assignedTo?: string;
	date?: string;
	endDate?: string;
	priority: Priority;
	customerId?: string;
	categoryId?: string;
	startTime?: string;
	endTime?: string;
	repeatFrequency?: RepeatFrequency;
}

export type RepeatFrequency = "annually" | "biannually" | "quarterly";

export interface JobPhoto {
	id: string;
	jobId: string;
	storagePath: string;
	caption: string;
	uploadedBy: string;
	createdAt: string;
}
