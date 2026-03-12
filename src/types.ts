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
}

export interface Job {
	id: string;
	ref: string;
	customer: string;
	address: string;
	type: string;
	description: string;
	assignedTo: string;
	status: Status;
	priority: Priority;
	date: string;
	materials: string;
	notes: string;
	timeSpent: number;
	readyToInvoice: boolean;
	sortOrder?: number;
}

export interface Notification {
	id: string;
	icon: string;
	message: string;
	time: string;
	read: boolean;
	for: "master" | string;
	jobId?: string;
	repeatTaskId?: string;
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
}

export interface NewJobForm {
	customer: string;
	address: string;
	type: string;
	description: string;
	assignedTo: string;
	date: string;
	priority: Priority;
}

export type RepeatFrequency = "annually" | "biannually" | "quarterly";

export interface RepeatTask {
	id: string;
	customer: string;
	address: string;
	type: string;
	description: string;
	frequency: RepeatFrequency;
	nextDueDate: string;
}
