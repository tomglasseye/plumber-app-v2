import {
	createContext,
	useContext,
	useEffect,
	useRef,
	useState,
	type ReactNode,
} from "react";
import { supabase } from "./supabase";
import { fmtTime, genRef, INITIAL_BUSINESS } from "./data";
import type {
	Business,
	Category,
	Customer,
	Holiday,
	HolidayType,
	Job,
	NewJobForm,
	Notification,
	Priority,
	RepeatFrequency,
	Role,
	Status,
	User,
} from "./types";


interface AppCtx {
	loading: boolean;
	currentUser: User | null;
	login: (email: string, password: string) => Promise<Role | null>;
	logout: () => void;
	resetPassword: (email: string) => Promise<string | null>;
	business: Business;
	saveBusiness: (b: Business) => void;
	users: User[];
	jobs: Job[];
	myJobs: Job[];
	isMaster: boolean;
	saveUser: (user: User) => Promise<void>;
	lockUser: (id: string) => void;
	unlockUser: (id: string) => void;
	deleteUser: (id: string) => void;
	changePassword: (
		userId: string,
		password: string,
	) => Promise<string | null>;
	theme: "dark" | "light";
	toggleTheme: () => void;
	createJob: (form: NewJobForm) => Promise<void>;
	updateJob: <K extends keyof Job>(
		id: string,
		field: K,
		value: Job[K],
	) => void;
	changeStatus: (id: string, status: Job["status"]) => void;
	changePriority: (id: string, priority: Job["priority"]) => void;
	finalComplete: (id: string) => void;
	notifications: Notification[];
	myNotifs: Notification[];
	addNotification: (n: Omit<Notification, "id" | "time" | "read">) => void;
	clearNotifs: () => void;
	pushBanner: Notification | null;
	dismissPush: () => void;
	saveError: string | null;
	dismissSaveError: () => void;
	idleWarning: boolean;
	dismissIdleWarning: () => void;
	customers: Customer[];
	createCustomer: (c: Omit<Customer, "id">) => string;
	updateCustomer: (c: Customer) => void;
	deleteCustomer: (id: string) => void;
	// Categories
	categories: Category[];
	createCategory: (c: Omit<Category, "id">) => void;
	updateCategory: (c: Category) => void;
	deleteCategory: (id: string) => void;
	// Holidays
	holidays: Holiday[];
	createHoliday: (h: Omit<Holiday, "id">) => void;
	deleteHoliday: (id: string) => void;
	updateHoliday: (id: string, changes: Partial<Omit<Holiday, "id">>) => void;
	// Atomic scheduling helpers (single DB call)
	rescheduleJob: (jobId: string, date: string, startTime?: string, endTime?: string, assignedTo?: string) => void;
	resizeJobTime: (jobId: string, startTime: string, endTime: string) => void;
}

const Ctx = createContext<AppCtx>(null!);

export function useApp() {
	return useContext(Ctx);
}

// Map snake_case DB column names to camelCase Job fields
const JOB_COL: Partial<Record<keyof Job, string>> = {
	assignedTo: "assigned_to",
	timeSpent: "time_spent",
	readyToInvoice: "ready_to_invoice",
	sortOrder: "sort_order",
	categoryId: "category_id",
	startTime: "start_time",
	endTime: "end_time",
	endDate: "end_date",
	repeatFrequency: "repeat_frequency",
};
function jobCol(field: keyof Job): string {
	return JOB_COL[field] ?? field;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapJob(r: any): Job {
	return {
		id: r.id,
		ref: r.ref,
		customer: r.customer,
		phone: r.phone ?? "",
		address: r.address,
		description: r.description ?? "",
		assignedTo: r.assigned_to,
		status: r.status as Status,
		priority: r.priority as Priority,
		date: r.date,
		endDate: r.end_date ?? undefined,
		startTime: r.start_time ?? undefined,
		endTime: r.end_time ?? undefined,
		categoryId: r.category_id ?? undefined,
		materials: r.materials ?? "",
		notes: r.notes ?? "",
		timeSpent: r.time_spent ?? 0,
		readyToInvoice: r.ready_to_invoice ?? false,
		sortOrder: r.sort_order ?? 0,
		customerId: r.customer_id ?? undefined,
	repeatFrequency: (r.repeat_frequency ?? undefined) as RepeatFrequency | undefined,
	};
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapProfile(r: any): User {
	return {
		id: r.id,
		name: r.name,
		email: r.email ?? "",
		role: r.role as Role,
		avatar:
			r.avatar ??
			(r.name as string)
				.split(" ")
				.map((n: string) => n[0])
				.join("")
				.toUpperCase(),
		home: r.home_address ?? "",
		phone: r.phone ?? "",
		color: r.accent_color ?? "#f97316",
		locked: r.locked ?? false,
	};
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapBusiness(r: any): Business {
	return {
		id: r.id,
		name: r.name,
		phone: r.phone ?? "",
		email: r.email ?? "",
		address: r.address ?? "",
		vatNumber: r.vat_number ?? "",
		accentColor: r.accent_color ?? "#f97316",
		xeroConnected: r.xero_connected ?? false,
		xeroEmail: r.xero_email ?? "",
		logoInitials:
			r.logo_initials ?? (r.name as string).slice(0, 3).toUpperCase(),
		workDayStart: r.work_day_start ?? 7,
		workDayEnd: r.work_day_end ?? 17,
	};
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapCustomer(r: any): Customer {
	return {
		id: r.id,
		name: r.name,
		email: r.email,
		phone: r.phone ?? "",
		address: r.address ?? "",
		notes: r.notes ?? "",
		xeroContactId: r.xero_contact_id ?? undefined,
	};
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapNotification(r: any): Notification {
	return {
		id: r.id,
		icon: r.icon ?? "🔔",
		message: r.message,
		time: new Date(r.created_at).toLocaleTimeString("en-GB", {
			hour: "2-digit",
			minute: "2-digit",
		}),
		read: r.read ?? false,
		for: r.for_role === "master" ? "master" : r.for_user,
		jobId: r.job_id ?? undefined,
		};
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapCategory(r: any): Category {
	return {
		id: r.id,
		name: r.name,
		icon: r.icon ?? "Wrench",
		color: r.color ?? "#f97316",
		sortOrder: r.sort_order ?? 0,
	};
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapHoliday(r: any): Holiday {
	return {
		id: r.id,
		profileId: r.profile_id,
		date: r.date,
		endDate: r.end_date ?? undefined,
		halfDay: r.half_day ?? false,
		label: r.label ?? "Holiday",
		type: (r.type ?? "holiday") as HolidayType,
	};
}

function formatError(error: unknown): string {
	if (error instanceof Error) return error.message;
	if (typeof error === "object" && error !== null && "message" in error)
		return String((error as { message: unknown }).message);
	return "Save failed";
}

const IDLE_WARN_MS = 29 * 60 * 1000;  // 29 minutes → show warning
const IDLE_LOGOUT_MS = 30 * 60 * 1000; // 30 minutes → sign out

export function AppProvider({ children }: { children: ReactNode }) {
	const [loading, setLoading] = useState(true);
	const [currentUser, setCurrentUser] = useState<User | null>(null);
	const [business, setBusiness] = useState<Business>(INITIAL_BUSINESS);
	const [users, setUsers] = useState<User[]>([]);
	const [jobs, setJobs] = useState<Job[]>([]);
	const [notifications, setNotifications] = useState<Notification[]>([]);
	const [pushBanner, setPushBanner] = useState<Notification | null>(null);
	const [theme, setTheme] = useState<"dark" | "light">("dark");
	const [saveError, setSaveError] = useState<string | null>(null);
	const [idleWarning, setIdleWarning] = useState(false);
	const [customers, setCustomers] = useState<Customer[]>([]);
	const [categories, setCategories] = useState<Category[]>([]);
	const [holidays, setHolidays] = useState<Holiday[]>([]);
	const notifCounter = useRef(1000);
	const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const warnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const resetIdleRef = useRef<() => void>(() => {});

	const isMaster = currentUser?.role === "master";
	const myJobs = isMaster
		? jobs
		: jobs.filter((j) => j.assignedTo === currentUser?.id);
	const myNotifs = isMaster
		? notifications.filter((n) => n.for === "master")
		: notifications.filter((n) => n.for === currentUser?.id);

	// Apply theme to <html>
	useEffect(() => {
		document.documentElement.setAttribute("data-theme", theme);
	}, [theme]);

	// Restore session on mount
	useEffect(() => {
		supabase.auth.getSession().then(({ data: { session } }) => {
			if (session?.user) {
				loadUserData(session.user.id).finally(() => setLoading(false));
			} else {
				setLoading(false);
			}
		});

		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange((event) => {
			if (event === "SIGNED_OUT") {
				setCurrentUser(null);
				setBusiness(INITIAL_BUSINESS);
				setUsers([]);
				setJobs([]);
				setNotifications([]);
				setTheme("dark");
				setIdleWarning(false);
			}
		});
		return () => subscription.unsubscribe();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// Idle timeout — 29 min warning, 30 min auto sign-out
	useEffect(() => {
		if (!currentUser) return;

		const resetIdle = () => {
			setIdleWarning(false);
			if (warnTimerRef.current) clearTimeout(warnTimerRef.current);
			if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
			warnTimerRef.current = setTimeout(
				() => setIdleWarning(true),
				IDLE_WARN_MS,
			);
			idleTimerRef.current = setTimeout(
				() => supabase.auth.signOut(),
				IDLE_LOGOUT_MS,
			);
		};

		resetIdleRef.current = resetIdle;

		const events = ["mousemove", "keydown", "click", "touchstart", "scroll"];
		events.forEach((ev) =>
			window.addEventListener(ev, resetIdle, { passive: true }),
		);
		resetIdle(); // start timers

		return () => {
			events.forEach((ev) => window.removeEventListener(ev, resetIdle));
			if (warnTimerRef.current) clearTimeout(warnTimerRef.current);
			if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
		};
	}, [currentUser]);

	// Supabase Realtime — listen for new notifications
	useEffect(() => {
		if (!currentUser) return;

		const channel = supabase
			.channel("app-notifications")
			.on(
				"postgres_changes",
				{
					event: "INSERT",
					schema: "public",
					table: "notifications",
				},
				(payload) => {
					const row = payload.new;
					const isForMe =
						(isMaster && row.for_role === "master") ||
						(!isMaster && row.for_user === currentUser.id);
					if (!isForMe) return;
					const notif = mapNotification(row);
					setNotifications((prev) => {
						if (prev.some((n) => n.id === notif.id)) return prev;
						return [notif, ...prev];
					});
					setPushBanner(notif);
				},
			)
			.subscribe();

		return () => {
			supabase.removeChannel(channel);
		};
	}, [currentUser, isMaster]);

	// ── DB write helpers ──────────────────────────────────────────

	// Fire-and-forget with one automatic retry after 1s.
	// Takes a factory function so the query can be re-executed on retry.
	function dbSave(factory: () => PromiseLike<{ error: unknown }>) {
		factory().then(({ error }) => {
			if (!error) return;
			setTimeout(() => {
				factory().then(({ error: e2 }) => {
					if (e2) setSaveError(formatError(e2));
				});
			}, 1000);
		});
	}

	// Critical write: one retry, then revert optimistic state and show error.
	function dbSaveCritical(
		factory: () => PromiseLike<{ error: unknown }>,
		revert: () => void,
	) {
		factory().then(({ error }) => {
			if (!error) return;
			setTimeout(() => {
				factory().then(({ error: e2 }) => {
					if (e2) {
						setSaveError("Save failed — your change has been reverted. Please try again.");
						revert();
					}
				});
			}, 1000);
		});
	}

	async function loadUserData(userId: string): Promise<Role | null> {
		const { data: profile } = await supabase
			.from("profiles")
			.select("*")
			.eq("id", userId)
			.single();
		if (!profile) return null;
		if (profile.locked) {
			await supabase.auth.signOut();
			return null;
		}

		const user = mapProfile(profile);
		setCurrentUser(user);
		const saved = localStorage.getItem(`theme_${userId}`);
		if (saved === "dark" || saved === "light") setTheme(saved);

		const notifQuery = supabase
			.from("notifications")
			.select("*")
			.eq("business_id", profile.business_id)
			.eq("read", false)
			.order("created_at", { ascending: false })
			.limit(20);

		const [bizRes, jobsRes, profilesRes, notifsRes, catsRes, holsRes] =
			await Promise.all([
				supabase
					.from("businesses")
					.select("*")
					.eq("id", profile.business_id)
					.single(),
				supabase
					.from("jobs")
					.select("*")
					.eq("business_id", profile.business_id)
					.order("date", { ascending: false })
					.limit(1000), // safety cap — prevents slow loads beyond ~2 years of data
				supabase
					.from("profiles")
					.select("*")
					.eq("business_id", profile.business_id),
				profile.role === "master"
					? notifQuery.eq("for_role", "master")
					: notifQuery.eq("for_user", userId),
				supabase
					.from("categories")
					.select("*")
					.eq("business_id", profile.business_id)
					.order("sort_order", { ascending: true }),
				supabase
					.from("team_holidays")
					.select("*")
					.eq("business_id", profile.business_id)
					.order("date", { ascending: true }),
			]);

		if (bizRes.data) setBusiness(mapBusiness(bizRes.data));
		if (jobsRes.data) setJobs(jobsRes.data.map(mapJob));
		if (profilesRes.data) setUsers(profilesRes.data.map(mapProfile));
		if (notifsRes.data)
			setNotifications(notifsRes.data.map(mapNotification));
		if (catsRes.data) setCategories(catsRes.data.map(mapCategory));
		if (holsRes.data) setHolidays(holsRes.data.map(mapHoliday));

		// Load customers for master users
		if (profile.role === "master") {
			const { data: custData } = await supabase
				.from("customers")
				.select("*")
				.eq("business_id", profile.business_id)
				.order("name", { ascending: true });
			if (custData) setCustomers(custData.map(mapCustomer));
		}
		return profile.role as Role;
	}

	async function login(
		email: string,
		password: string,
	): Promise<Role | null> {
		const { data, error } = await supabase.auth.signInWithPassword({
			email,
			password,
		});
		if (error || !data.user) return null;
		return loadUserData(data.user.id);
	}

	function logout() {
		supabase.auth.signOut();
		setCurrentUser(null);
		setBusiness(INITIAL_BUSINESS);
		setUsers([]);
		setJobs([]);
		setNotifications([]);
		setCustomers([]);
		setCategories([]);
		setHolidays([]);
	}

	function addNotification(n: Omit<Notification, "id" | "time" | "read">) {
		const full: Notification = {
			...n,
			id: String(notifCounter.current++),
			time: fmtTime(),
			read: false,
		};
		// Only show locally if it's for the current user
		const isForMe =
			(isMaster && n.for === "master") ||
			(!isMaster && n.for === currentUser?.id);
		if (isForMe) {
			setNotifications((prev) => [full, ...prev]);
			setPushBanner(full);
		}
		// Persist to DB
		const row: Record<string, unknown> = {
			business_id: business.id,
			icon: n.icon,
			message: n.message,
			read: false,
		};
		if (n.jobId) row.job_id = n.jobId;
			if (n.for === "master") {
			row.for_role = "master";
		} else {
			row.for_user = n.for;
			row.for_role = "engineer";
		}
		dbSave(() => supabase.from("notifications").insert(row));
	}

	function updateJob<K extends keyof Job>(
		id: string,
		field: K,
		value: Job[K],
	) {
		const prev_val = jobs.find((j) => j.id === id)?.[field];
		setJobs((prev) =>
			prev.map((j) => (j.id === id ? { ...j, [field]: value } : j)),
		);
		dbSaveCritical(
			() =>
				supabase
					.from("jobs")
					.update({ [jobCol(field)]: value })
					.eq("id", id),
			() =>
				setJobs((prev) =>
					prev.map((j) => (j.id === id ? { ...j, [field]: prev_val } : j)),
				),
		);
	}

	function changeStatus(id: string, status: Job["status"]) {
		const job = jobs.find((j) => j.id === id)!;
		const prevStatus = job.status;
		// When completing a timed job, snap endTime to now if now is after startTime
		const now = new Date();
		const nowStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
		const snapEnd =
			status === "Completed" &&
			job.startTime &&
			nowStr > job.startTime
				? nowStr
				: undefined;
		setJobs((prev) =>
			prev.map((j) =>
				j.id === id
					? { ...j, status, ...(snapEnd ? { endTime: snapEnd } : {}) }
					: j,
			),
		);
		dbSaveCritical(
			() =>
				supabase
					.from("jobs")
					.update({ status, ...(snapEnd ? { end_time: snapEnd } : {}) })
					.eq("id", id),
			() =>
				setJobs((prev) =>
					prev.map((j) => (j.id === id ? { ...j, status: prevStatus } : j)),
				),
		);
		if (!isMaster) {
			addNotification({
				icon:
					status === "Completed"
						? "✅"
						: status === "On Site"
							? "🔧"
							: "🚗",
				message: `${currentUser!.name} updated ${job.ref} (${job.customer}) to ${status}`,
				for: "master",
				jobId: id,
			});
		} else {
			addNotification({
				icon: "📋",
				message: `HQ updated your job ${job.ref} (${job.customer}) to ${status}`,
				for: job.assignedTo,
				jobId: id,
			});
		}
	}

	function changePriority(id: string, priority: Job["priority"]) {
		const job = jobs.find((j) => j.id === id)!;
		const prevPriority = job.priority;
		setJobs((prev) =>
			prev.map((j) => (j.id === id ? { ...j, priority } : j)),
		);
		dbSaveCritical(
			() => supabase.from("jobs").update({ priority }).eq("id", id),
			() =>
				setJobs((prev) =>
					prev.map((j) =>
						j.id === id ? { ...j, priority: prevPriority } : j,
					),
				),
		);
		if (isMaster && priority === "Emergency") {
			addNotification({
				icon: "🚨",
				message: `URGENT: HQ changed ${job.ref} (${job.customer}) to Emergency`,
				for: job.assignedTo,
				jobId: id,
			});
		}
	}

	function finalComplete(id: string) {
		const job = jobs.find((j) => j.id === id)!;
		setJobs((prev) =>
			prev.map((j) => (j.id === id ? { ...j, readyToInvoice: true } : j)),
		);
		dbSave(
			() =>
				supabase
					.from("jobs")
					.update({ ready_to_invoice: true })
					.eq("id", id),
		);
		addNotification({
			icon: "✅",
			message: `${job.ref} (${job.customer}) marked Final Complete — ready for Xero`,
			for: "master",
			jobId: id,
		});
		addNotification({
			icon: "✅",
			message: `HQ approved your job ${job.ref} (${job.customer}) — invoice will be raised`,
			for: job.assignedTo,
			jobId: id,
		});
		// Auto-schedule next occurrence for recurring jobs
		if (job.repeatFrequency) {
			const next = new Date(job.date + "T00:00:00");
			if (job.repeatFrequency === "annually") next.setFullYear(next.getFullYear() + 1);
			else if (job.repeatFrequency === "biannually") next.setMonth(next.getMonth() + 6);
			else next.setMonth(next.getMonth() + 3);
			const nextDate = next.toISOString().slice(0, 10);
			createJob({
				customer: job.customer,
				phone: job.phone,
				address: job.address,
				description: job.description,
				assignedTo: job.assignedTo,
				date: nextDate,
				priority: job.priority,
				customerId: job.customerId,
				categoryId: job.categoryId,
				repeatFrequency: job.repeatFrequency,
			});
		}
	}

	async function createJob(form: NewJobForm) {
		const ref = genRef(jobs, business.logoInitials);
		const newJob: Job = {
			...form,
			id: crypto.randomUUID(),
			ref,
			status: "Scheduled",
			materials: "",
			notes: "",
			timeSpent: 0,
			readyToInvoice: false,
			assignedTo: form.assignedTo,
		};
		setJobs((prev) => [...prev, newJob]);
		// Await the insert so the job exists in DB before the notification FK reference
		const { error } = await supabase.from("jobs").insert({
			id: newJob.id,
			business_id: business.id,
			ref,
			customer: form.customer,
			phone: form.phone ?? "",
			address: form.address,
			description: form.description,
			assigned_to: form.assignedTo,
			status: "Scheduled",
			priority: form.priority,
			date: form.date,
			end_date: form.endDate ?? null,
			category_id: form.categoryId ?? null,
			start_time: form.startTime ?? null,
			end_time: form.endTime ?? null,
			customer_id: form.customerId ?? null,
			repeat_frequency: form.repeatFrequency ?? null,
		});
		if (error) {
			setSaveError(
				error instanceof Error ? error.message : String((error as { message?: unknown }).message ?? "Save failed"),
			);
			setJobs((prev) => prev.filter((j) => j.id !== newJob.id));
			return;
		}
		addNotification({
			icon: "📋",
			message: `New job ${ref} assigned to you — ${form.customer}`,
			for: form.assignedTo,
			jobId: newJob.id,
		});
	}

	function saveBusiness(b: Business) {
		setBusiness(b);
		dbSave(
			() =>
				supabase
					.from("businesses")
					.update({
						name: b.name,
						phone: b.phone,
						email: b.email,
						address: b.address,
						vat_number: b.vatNumber,
						accent_color: b.accentColor,
						logo_initials: b.logoInitials,
						work_day_start: b.workDayStart,
						work_day_end: b.workDayEnd,
					})
					.eq("id", b.id),
		);
		supabase.rpc("log_audit_event", {
			p_action: "business.settings_updated",
			p_target_type: "business",
			p_target_id: b.id,
		});
	}

	async function saveUser(user: User) {
		setUsers((prev) => prev.map((u) => (u.id === user.id ? user : u)));
		if (currentUser?.id === user.id) setCurrentUser(user);
		const { error } = await supabase
			.from("profiles")
			.update({
				name: user.name,
				phone: user.phone,
				home_address: user.home,
				avatar: user.avatar,
				role: user.role,
				accent_color: user.color,
			})
			.eq("id", user.id);
		if (error) {
			const msg =
				error instanceof Error
					? error.message
					: ((error as { message?: string }).message ??
						"Save failed");
			setSaveError(msg);
		}
	}

	function lockUser(id: string) {
		setUsers((prev) =>
			prev.map((u) => (u.id === id ? { ...u, locked: true } : u)),
		);
		dbSave(() => supabase.from("profiles").update({ locked: true }).eq("id", id));
		supabase.rpc("log_audit_event", {
			p_action: "profile.locked",
			p_target_type: "profile",
			p_target_id: id,
		});
	}

	function unlockUser(id: string) {
		setUsers((prev) =>
			prev.map((u) => (u.id === id ? { ...u, locked: false } : u)),
		);
		dbSave(() => supabase.from("profiles").update({ locked: false }).eq("id", id));
		supabase.rpc("log_audit_event", {
			p_action: "profile.unlocked",
			p_target_type: "profile",
			p_target_id: id,
		});
	}

	async function deleteUser(id: string) {
		setUsers((prev) => prev.filter((u) => u.id !== id));
		const { error } = await supabase.from("profiles").delete().eq("id", id);
		if (error) {
			// Revert optimistic removal and show error
			const { data } = await supabase
				.from("profiles")
				.select("*")
				.eq("id", id)
				.single();
			if (data) setUsers((prev) => [...prev, mapProfile(data)].sort((a, b) => a.name.localeCompare(b.name)));
			setSaveError(formatError(error));
			return;
		}
		supabase.rpc("log_audit_event", {
			p_action: "profile.deleted",
			p_target_type: "profile",
			p_target_id: id,
		});
	}

	function toggleTheme() {
		setTheme((t) => {
			const next = t === "dark" ? "light" : "dark";
			if (currentUser)
				localStorage.setItem(`theme_${currentUser.id}`, next);
			return next;
		});
	}

	async function changePassword(
		userId: string,
		password: string,
	): Promise<string | null> {
		if (userId === currentUser?.id) {
			const { error } = await supabase.auth.updateUser({ password });
			if (!error) {
				supabase.rpc("log_audit_event", {
					p_action: "auth.password_change_self",
					p_target_type: "profile",
					p_target_id: userId,
				});
			}
			return error?.message ?? null;
		}
		// Master resetting another user's password — calls Netlify Function
		const {
			data: { session },
		} = await supabase.auth.getSession();
		if (!session) return "Not authenticated";
		try {
			const res = await fetch(
				"/.netlify/functions/admin-update-password",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${session.access_token}`,
					},
					body: JSON.stringify({ userId, password }),
				},
			);
			const body = await res.json();
			if (res.ok) {
				supabase.rpc("log_audit_event", {
					p_action: "auth.password_changed_by_master",
					p_target_type: "profile",
					p_target_id: userId,
				});
			}
			return res.ok ? null : (body.error ?? "Failed to update password");
		} catch {
			return "Network error — could not reach server";
		}
	}

	function clearNotifs() {
		setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
		if (currentUser) {
			const col = isMaster ? "for_role" : "for_user";
			const val = isMaster ? "master" : currentUser.id;
			dbSave(
				() =>
					supabase
						.from("notifications")
						.update({ read: true })
						.eq(col, val),
			);
		}
	}

	async function resetPassword(email: string): Promise<string | null> {
		const { error } = await supabase.auth.resetPasswordForEmail(email);
		return error?.message ?? null;
	}

	function createCustomer(c: Omit<Customer, "id">): string {
		const id = crypto.randomUUID();
		const full: Customer = { ...c, id };
		setCustomers((prev) =>
			[...prev, full].sort((a, b) => a.name.localeCompare(b.name)),
		);
		dbSave(
			() =>
				supabase.from("customers").insert({
					id,
					business_id: business.id,
					name: c.name,
					email: c.email,
					phone: c.phone,
					address: c.address,
					notes: c.notes,
					xero_contact_id: c.xeroContactId ?? null,
				}),
		);
		return id;
	}

	function updateCustomer(c: Customer) {
		setCustomers((prev) =>
			prev
				.map((x) => (x.id === c.id ? c : x))
				.sort((a, b) => a.name.localeCompare(b.name)),
		);
		dbSave(
			() =>
				supabase
					.from("customers")
					.update({
						name: c.name,
						email: c.email,
						phone: c.phone,
						address: c.address,
						notes: c.notes,
						xero_contact_id: c.xeroContactId ?? null,
					})
					.eq("id", c.id),
		);
	}

	function deleteCustomer(id: string) {
		setCustomers((prev) => prev.filter((c) => c.id !== id));
		dbSave(() => supabase.from("customers").delete().eq("id", id));
	}


	// ── Categories CRUD ──────────────────────────────────────────

	function createCategory(c: Omit<Category, "id">) {
		const id = crypto.randomUUID();
		const full: Category = { ...c, id };
		setCategories((prev) =>
			[...prev, full].sort((a, b) => a.sortOrder - b.sortOrder),
		);
		dbSave(
			() =>
				supabase.from("categories").insert({
					id,
					business_id: business.id,
					name: c.name,
					icon: c.icon,
					color: c.color,
					sort_order: c.sortOrder,
				}),
		);
	}

	function updateCategory(c: Category) {
		setCategories((prev) =>
			prev
				.map((x) => (x.id === c.id ? c : x))
				.sort((a, b) => a.sortOrder - b.sortOrder),
		);
		dbSave(
			() =>
				supabase
					.from("categories")
					.update({
						name: c.name,
						icon: c.icon,
						color: c.color,
						sort_order: c.sortOrder,
					})
					.eq("id", c.id),
		);
	}

	function deleteCategory(id: string) {
		setCategories((prev) => prev.filter((c) => c.id !== id));
		dbSave(() => supabase.from("categories").delete().eq("id", id));
	}

	// ── Holidays CRUD ────────────────────────────────────────────

	function createHoliday(h: Omit<Holiday, "id">) {
		const id = crypto.randomUUID();
		const full: Holiday = { ...h, id };
		setHolidays((prev) =>
			[...prev, full].sort((a, b) => a.date.localeCompare(b.date)),
		);
		dbSave(
			() =>
				supabase.from("team_holidays").insert({
					id,
					business_id: business.id,
					profile_id: h.profileId,
					date: h.date,
					end_date: h.endDate ?? null,
					half_day: h.halfDay,
					label: h.label,
					type: h.type,
				}),
		);
	}

	// Single-call reschedule (date + times together — avoids 3 separate DB round-trips)
	function rescheduleJob(
		jobId: string,
		date: string,
		startTime?: string,
		endTime?: string,
		assignedTo?: string,
	) {
		const job = jobs.find((j) => j.id === jobId);
		const prev = job ? { date: job.date, startTime: job.startTime, endTime: job.endTime, assignedTo: job.assignedTo } : null;
		setJobs((prev_jobs) =>
			prev_jobs.map((j) =>
				j.id === jobId
					? { ...j, date, startTime, endTime, ...(assignedTo ? { assignedTo } : {}) }
					: j,
			),
		);
		dbSaveCritical(
			() =>
				supabase
					.from("jobs")
					.update({
						date,
						start_time: startTime ?? null,
						end_time: endTime ?? null,
						...(assignedTo ? { assigned_to: assignedTo } : {}),
					})
					.eq("id", jobId),
			() => {
				if (prev)
					setJobs((pj) =>
						pj.map((j) =>
							j.id === jobId
								? { ...j, date: prev.date, startTime: prev.startTime, endTime: prev.endTime, assignedTo: prev.assignedTo }
								: j,
						),
					);
			},
		);
	}

	// Single-call resize (start + end time together)
	function resizeJobTime(jobId: string, startTime: string, endTime: string) {
		const job = jobs.find((j) => j.id === jobId);
		const prevStart = job?.startTime;
		const prevEnd = job?.endTime;
		setJobs((prev) =>
			prev.map((j) =>
				j.id === jobId ? { ...j, startTime, endTime } : j,
			),
		);
		dbSaveCritical(
			() =>
				supabase
					.from("jobs")
					.update({ start_time: startTime, end_time: endTime })
					.eq("id", jobId),
			() =>
				setJobs((prev) =>
					prev.map((j) =>
						j.id === jobId
							? { ...j, startTime: prevStart, endTime: prevEnd }
							: j,
					),
				),
		);
	}

	function deleteHoliday(id: string) {
		setHolidays((prev) => prev.filter((h) => h.id !== id));
		dbSave(() => supabase.from("team_holidays").delete().eq("id", id));
	}

	function updateHoliday(id: string, changes: Partial<Omit<Holiday, "id">>) {
		setHolidays((prev) =>
			prev.map((h) => (h.id === id ? { ...h, ...changes } : h)),
		);
		const dbChanges: Record<string, unknown> = {};
		if (changes.profileId !== undefined) dbChanges.profile_id = changes.profileId;
		if (changes.date !== undefined) dbChanges.date = changes.date;
		if (changes.endDate !== undefined) dbChanges.end_date = changes.endDate;
		if (changes.halfDay !== undefined) dbChanges.half_day = changes.halfDay;
		if (changes.label !== undefined) dbChanges.label = changes.label;
		if (changes.type !== undefined) dbChanges.type = changes.type;
		dbSave(() => supabase.from("team_holidays").update(dbChanges).eq("id", id));
	}

	return (
		<Ctx.Provider
			value={{
				loading,
				currentUser,
				login,
				logout,
				resetPassword,
				business,
				saveBusiness,
				users,
				jobs,
				myJobs,
				isMaster: !!isMaster,
				saveUser,
			lockUser,
			unlockUser,
			deleteUser,
				changePassword,
				theme,
				toggleTheme,
				createJob,
				updateJob,
				changeStatus,
				changePriority,
				finalComplete,
				notifications,
				myNotifs,
				addNotification,
				clearNotifs,
				pushBanner,
				dismissPush: () => setPushBanner(null),
				saveError,
				dismissSaveError: () => setSaveError(null),
				idleWarning,
				dismissIdleWarning: () => resetIdleRef.current(),
				customers,
				createCustomer,
				updateCustomer,
				deleteCustomer,
				categories,
				createCategory,
				updateCategory,
				deleteCategory,
				holidays,
				createHoliday,
				deleteHoliday,
				updateHoliday,
				rescheduleJob,
				resizeJobTime,
			}}
		>
			{children}
		</Ctx.Provider>
	);
}
