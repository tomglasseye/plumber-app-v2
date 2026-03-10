import {
	createContext,
	useContext,
	useEffect,
	useRef,
	useState,
	type ReactNode,
} from "react";
import { supabase, supabaseAdmin } from "./supabase";
import { fmtTime, genRef, INITIAL_BUSINESS } from "./data";
import type {
	Business,
	Job,
	NewJobForm,
	Notification,
	Priority,
	Role,
	Status,
	User,
} from "./types";

interface AppCtx {
	loading: boolean;
	currentUser: User | null;
	login: (email: string, password: string) => Promise<boolean>;
	logout: () => void;
	resetPassword: (email: string) => Promise<string | null>;
	business: Business;
	saveBusiness: (b: Business) => void;
	users: User[];
	jobs: Job[];
	myJobs: Job[];
	isMaster: boolean;
	saveUser: (user: User) => void;
	changePassword: (
		userId: string,
		password: string,
	) => Promise<string | null>;
	theme: "dark" | "light";
	toggleTheme: () => void;
	createJob: (form: NewJobForm) => void;
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
		address: r.address,
		type: r.type,
		description: r.description ?? "",
		assignedTo: r.assigned_to,
		status: r.status as Status,
		priority: r.priority as Priority,
		date: r.date,
		materials: r.materials ?? "",
		notes: r.notes ?? "",
		timeSpent: r.time_spent ?? 0,
		readyToInvoice: r.ready_to_invoice ?? false,
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
	const notifCounter = useRef(1000);

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
			}
		});
		return () => subscription.unsubscribe();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

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

	// Helper: fire-and-forget DB write with error feedback
	function dbSave(promise: PromiseLike<{ error: unknown }>) {
		promise.then(({ error }) => {
			if (error) {
				const msg =
					error instanceof Error
						? error.message
						: typeof error === "object" &&
							  error !== null &&
							  "message" in error
							? String((error as { message: unknown }).message)
							: "Save failed";
				setSaveError(msg);
			}
		});
	}

	async function loadUserData(userId: string) {
		const { data: profile } = await supabase
			.from("profiles")
			.select("*")
			.eq("id", userId)
			.single();
		if (!profile) return;

		const user = mapProfile(profile);
		setCurrentUser(user);
		const saved = localStorage.getItem(`theme_${userId}`) as
			| "dark"
			| "light"
			| null;
		if (saved) setTheme(saved);

		const notifQuery = supabase
			.from("notifications")
			.select("*")
			.eq("business_id", profile.business_id)
			.eq("read", false)
			.order("created_at", { ascending: false })
			.limit(20);

		const [bizRes, jobsRes, profilesRes, notifsRes] = await Promise.all([
			supabase
				.from("businesses")
				.select("*")
				.eq("id", profile.business_id)
				.single(),
			supabase
				.from("jobs")
				.select("*")
				.eq("business_id", profile.business_id)
				.order("date", { ascending: false }),
			supabase
				.from("profiles")
				.select("*")
				.eq("business_id", profile.business_id),
			profile.role === "master"
				? notifQuery.eq("for_role", "master")
				: notifQuery.eq("for_user", userId),
		]);

		if (bizRes.data) setBusiness(mapBusiness(bizRes.data));
		if (jobsRes.data) setJobs(jobsRes.data.map(mapJob));
		if (profilesRes.data) setUsers(profilesRes.data.map(mapProfile));
		if (notifsRes.data)
			setNotifications(notifsRes.data.map(mapNotification));
	}

	async function login(email: string, password: string): Promise<boolean> {
		const { data, error } = await supabase.auth.signInWithPassword({
			email,
			password,
		});
		if (error || !data.user) return false;
		await loadUserData(data.user.id);
		return true;
	}

	function logout() {
		supabase.auth.signOut();
		setCurrentUser(null);
		setBusiness(INITIAL_BUSINESS);
		setUsers([]);
		setJobs([]);
		setNotifications([]);
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
		dbSave(supabase.from("notifications").insert(row));
	}

	function updateJob<K extends keyof Job>(
		id: string,
		field: K,
		value: Job[K],
	) {
		setJobs((prev) =>
			prev.map((j) => (j.id === id ? { ...j, [field]: value } : j)),
		);
		dbSave(
			supabase
				.from("jobs")
				.update({ [jobCol(field)]: value })
				.eq("id", id),
		);
	}

	function changeStatus(id: string, status: Job["status"]) {
		const job = jobs.find((j) => j.id === id)!;
		setJobs((prev) =>
			prev.map((j) => (j.id === id ? { ...j, status } : j)),
		);
		dbSave(supabase.from("jobs").update({ status }).eq("id", id));
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
		setJobs((prev) =>
			prev.map((j) => (j.id === id ? { ...j, priority } : j)),
		);
		dbSave(supabase.from("jobs").update({ priority }).eq("id", id));
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
	}

	function createJob(form: NewJobForm) {
		const ref = genRef(jobs);
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
		dbSave(
			supabase.from("jobs").insert({
				id: newJob.id,
				business_id: business.id,
				ref,
				customer: form.customer,
				address: form.address,
				type: form.type,
				description: form.description,
				assigned_to: form.assignedTo,
				status: "Scheduled",
				priority: form.priority,
				date: form.date,
			}),
		);
		addNotification({
			icon: "📋",
			message: `New job ${ref} assigned to you — ${form.customer} (${form.type})`,
			for: form.assignedTo,
			jobId: newJob.id,
		});
	}

	function saveBusiness(b: Business) {
		setBusiness(b);
		dbSave(
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
				})
				.eq("id", b.id),
		);
	}

	function saveUser(user: User) {
		setUsers((prev) => prev.map((u) => (u.id === user.id ? user : u)));
		if (currentUser?.id === user.id) setCurrentUser(user);
		dbSave(
			supabase
				.from("profiles")
				.update({
					name: user.name,
					phone: user.phone,
					home_address: user.home,
					avatar: user.avatar,
					role: user.role,
					accent_color: user.color,
				})
				.eq("id", user.id),
		);
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
			return error?.message ?? null;
		}
		if (!supabaseAdmin) {
			return "Admin key not configured (VITE_SUPABASE_SERVICE_KEY missing).";
		}
		const { error } = await supabaseAdmin.auth.admin.updateUserById(
			userId,
			{ password },
		);
		return error?.message ?? null;
	}

	function clearNotifs() {
		setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
		if (currentUser) {
			const col = isMaster ? "for_role" : "for_user";
			const val = isMaster ? "master" : currentUser.id;
			dbSave(
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
			}}
		>
			{children}
		</Ctx.Provider>
	);
}
