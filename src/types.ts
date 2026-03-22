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
}

export interface Category {
	id: string;
	name: string;
	icon: string; // lucide icon name e.g. "Wrench"
	color: string; // hex color
	sortOrder: number;
}

export type HolidayType = "holiday" | "sick" | "training" | "other";

export interface Holiday {
	id: string;
	profileId: string;
	date: string; // ISO date 'YYYY-MM-DD' (start date)
	endDate?: string; // ISO date 'YYYY-MM-DD' (inclusive end, for multi-day)
	halfDay: boolean;
	label: string;
	type: HolidayType;
}

export interface Job {
	id: string;
	ref: string;
	customer: string;
	phone: string;
	address: string;
	description: string;
	assignedTo: string;
	status: Status;
	priority: Priority;
	date: string; // ISO date 'YYYY-MM-DD' (start date)
	endDate?: string; // ISO date — for multi-day or early-completion
	startTime?: string; // 'HH:MM' e.g. '09:00'
	endTime?: string; // 'HH:MM' e.g. '10:30'
	categoryId?: string;
	materials: string;
	notes: string;
	timeSpent: number;
	readyToInvoice: boolean;
	sortOrder?: number;
	customerId?: string;
	repeatFrequency?: RepeatFrequency;
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
}

export interface NewJobForm {
	customer: string;
	phone: string;
	address: string;
	description: string;
	assignedTo: string;
	date: string;
	endDate?: string;
	priority: Priority;
	customerId?: string;
	categoryId?: string;
	startTime?: string;
	endTime?: string;
	repeatFrequency?: RepeatFrequency;
}

export type RepeatFrequency = "annually" | "biannually" | "quarterly";
