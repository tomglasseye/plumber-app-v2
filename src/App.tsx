import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
	Navigate,
	Route,
	Routes,
	useLocation,
	useNavigate,
} from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import { useBusiness } from "./hooks/useBusiness";
import { useNotifications } from "./hooks/useNotifications";
import { NotificationBell } from "./components/NotificationBell";
import { PushBanner } from "./components/PushBanner";
import { Sidebar } from "./components/Sidebar";
import { IosInstallPrompt } from "./components/IosInstallPrompt";
import { OfflineBanner } from "./components/OfflineBanner";

const AccountPage = lazy(() =>
	import("./pages/AccountPage").then((m) => ({ default: m.AccountPage })),
);
const AdminPage = lazy(() =>
	import("./pages/AdminPage").then((m) => ({ default: m.AdminPage })),
);
const CalendarPage = lazy(() =>
	import("./pages/CalendarPage").then((m) => ({ default: m.CalendarPage })),
);
const DashboardPage = lazy(() =>
	import("./pages/DashboardPage").then((m) => ({ default: m.DashboardPage })),
);
const JobDetailPage = lazy(() =>
	import("./pages/JobDetailPage").then((m) => ({ default: m.JobDetailPage })),
);
const LoginPage = lazy(() =>
	import("./pages/LoginPage").then((m) => ({ default: m.LoginPage })),
);
const MyDayPage = lazy(() =>
	import("./pages/MyDayPage").then((m) => ({ default: m.MyDayPage })),
);
const NewJobPage = lazy(() =>
	import("./pages/NewJobPage").then((m) => ({ default: m.NewJobPage })),
);
const TeamPage = lazy(() =>
	import("./pages/TeamPage").then((m) => ({ default: m.TeamPage })),
);
const CustomersPage = lazy(() =>
	import("./pages/CustomersPage").then((m) => ({ default: m.CustomersPage })),
);
const HolidaysPage = lazy(() =>
	import("./pages/HolidaysPage").then((m) => ({ default: m.HolidaysPage })),
);
const HowToUsePage = lazy(() =>
	import("./pages/HowToUsePage").then((m) => ({ default: m.HowToUsePage })),
);
const AboutPage = lazy(() =>
	import("./pages/AboutPage").then((m) => ({ default: m.AboutPage })),
);
const TimesheetsPage = lazy(() =>
	import("./pages/TimesheetsPage").then((m) => ({
		default: m.TimesheetsPage,
	})),
);

function RequireAuth({ children }: { children: React.ReactNode }) {
	const { currentUser } = useAuth();
	const location = useLocation();
	if (!currentUser)
		return <Navigate to="/login" state={{ from: location }} replace />;
	return <>{children}</>;
}

function RequireMaster({ children }: { children: React.ReactNode }) {
	const { isMaster } = useAuth();
	if (!isMaster) return <Navigate to="/" replace />;
	return <>{children}</>;
}

function RequireSuperAdmin({ children }: { children: React.ReactNode }) {
	const { isSuperAdmin } = useAuth();
	if (!isSuperAdmin) return <Navigate to="/" replace />;
	return <>{children}</>;
}

/** Redirect SA to /admin if they haven't entered a client yet */
function RequireClient({ children }: { children: React.ReactNode }) {
	const { isSuperAdmin } = useAuth();
	const { business } = useBusiness();
	if (isSuperAdmin && !business.id) return <Navigate to="/admin" replace />;
	return <>{children}</>;
}

export default function App() {
	const { currentUser, loading, saveError, dismissSaveError, idleWarning, dismissIdleWarning } = useAuth();
	const { pushBanner, dismissPush, myNotifs, clearNotifs, dismissNotif } = useNotifications();
	const { business } = useBusiness();
	const [sidebarOpen, setSidebarOpen] = useState(false);
	const navigate = useNavigate();

	// Any logout (manual, idle timeout, or session expiry) funnels through
	// currentUser → null. Redirect to /login on that transition so a signed-out
	// user always lands on the login page — not the public home (AboutPage at "/").
	// A fresh visitor who was never signed in still sees the public home.
	const wasAuthed = useRef(false);
	useEffect(() => {
		if (currentUser) {
			wasAuthed.current = true;
		} else if (wasAuthed.current) {
			wasAuthed.current = false;
			navigate("/login", { replace: true });
		}
	}, [currentUser, navigate]);

	if (loading) {
		return (
			<div className="min-h-screen bg-neutral-950 flex items-center justify-center">
				<span className="text-neutral-600 text-sm animate-pulse">
					Loading…
				</span>
			</div>
		);
	}

	// Public routes (no auth required)
	if (!currentUser) {
		return (
			<Suspense
				fallback={<div className="min-h-screen bg-neutral-950" />}
			>
				<Routes>
					<Route path="/" element={<AboutPage />} />
					<Route path="/login" element={<LoginPage />} />
					<Route path="*" element={<Navigate to="/" replace />} />
				</Routes>
			</Suspense>
		);
	}

	return (
		<div className="flex min-h-screen bg-neutral-950 font-sans text-neutral-100">
			<PushBanner push={pushBanner} onDismiss={dismissPush} />
			<OfflineBanner />
			<IosInstallPrompt />

			{/* Idle warning banner */}
			{idleWarning && (
				<div className="fixed top-0 left-0 right-0 z-[200] flex items-center justify-between gap-3 bg-amber-900/95 border-b border-amber-700 px-5 py-3 shadow-2xl">
					<span className="text-sm text-amber-200">
						You've been inactive for a while. You'll be signed out
						in 1 minute.
					</span>
					<button
						onClick={dismissIdleWarning}
						className="rounded-lg bg-amber-700 hover:bg-amber-600 px-3 py-1.5 text-xs font-medium text-white transition-colors border-0 cursor-pointer flex-shrink-0"
					>
						Stay signed in
					</button>
				</div>
			)}

			{/* Save error toast */}
			{saveError && (
				<div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 rounded-xl border border-red-800 bg-red-950 px-5 py-3 shadow-2xl">
					<span className="text-sm text-red-300">⚠️ {saveError}</span>
					<button
						onClick={dismissSaveError}
						className="text-red-500 hover:text-red-300 text-lg border-0 bg-transparent cursor-pointer"
					>
						×
					</button>
				</div>
			)}

			{/* Desktop sidebar */}
			<div className="hidden md:flex w-56 flex-shrink-0 fixed top-0 left-0 h-full z-40">
				<Sidebar />
			</div>

			{/* Mobile sidebar overlay */}
			{sidebarOpen && (
				<>
					<div
						className="fixed inset-0 z-40 bg-black/60 md:hidden"
						onClick={() => setSidebarOpen(false)}
					/>
					<div className="fixed top-0 left-0 z-50 h-full w-64 md:hidden">
						<Sidebar onClose={() => setSidebarOpen(false)} />
					</div>
				</>
			)}

			{/* Main */}
			<div className="flex-1 min-w-0 md:ml-56 flex flex-col min-h-screen">
				{/* Mobile header */}
				<header className="flex items-center justify-between border-b border-neutral-800 bg-neutral-900 px-5 py-4 md:hidden sticky top-0 z-30">
					<button
						onClick={() => setSidebarOpen(true)}
						className="text-xl text-neutral-300 border-0 bg-transparent cursor-pointer p-1"
					>
						☰
					</button>
					<span
						className="text-base font-bold"
						style={{ color: business.accentColor }}
					>
						{business.logoInitials}Jobs
					</span>
					<NotificationBell
						notifications={myNotifs}
						onClear={clearNotifs}
						onDismiss={dismissNotif}
						onNavigate={(path) => navigate(path)}
					/>
				</header>

				{/* Desktop top bar */}
				<div className="hidden md:flex items-center justify-end border-b border-neutral-800 bg-neutral-950 px-6 py-3 sticky top-0 z-30">
					<NotificationBell
						notifications={myNotifs}
						onClear={clearNotifs}
						onDismiss={dismissNotif}
						onNavigate={(path) => navigate(path)}
					/>
				</div>

				<main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden">
					<Suspense
						fallback={
							<div className="min-h-screen bg-neutral-950" />
						}
					>
						<Routes>
							<Route path="/login" element={<LoginPage />} />
							<Route
								path="/"
								element={
									<RequireAuth>
										<RequireClient>
											<DashboardPage />
										</RequireClient>
									</RequireAuth>
								}
							/>
							<Route
								path="/calendar"
								element={
									<RequireAuth>
										<CalendarPage />
									</RequireAuth>
								}
							/>
							<Route
								path="/holidays"
								element={
									<RequireAuth>
										<HolidaysPage />
									</RequireAuth>
								}
							/>
							<Route
								path="/job/:id"
								element={
									<RequireAuth>
										<JobDetailPage />
									</RequireAuth>
								}
							/>
							<Route
								path="/my-day"
								element={
									<RequireAuth>
										<MyDayPage />
									</RequireAuth>
								}
							/>
							<Route
								path="/new-job"
								element={
									<RequireAuth>
										<RequireMaster>
											<NewJobPage />
										</RequireMaster>
									</RequireAuth>
								}
							/>
							<Route
								path="/customers"
								element={
									<RequireAuth>
										<RequireMaster>
											<CustomersPage />
										</RequireMaster>
									</RequireAuth>
								}
							/>
							<Route
								path="/team"
								element={
									<RequireAuth>
										<RequireMaster>
											<TeamPage />
										</RequireMaster>
									</RequireAuth>
								}
							/>
							<Route
								path="/account"
								element={
									<RequireAuth>
										<RequireMaster>
											<AccountPage />
										</RequireMaster>
									</RequireAuth>
								}
							/>
							<Route
								path="/timesheets"
								element={
									<RequireAuth>
										<RequireMaster>
											<TimesheetsPage />
										</RequireMaster>
									</RequireAuth>
								}
							/>
							<Route
								path="/admin"
								element={
									<RequireAuth>
										<RequireSuperAdmin>
											<AdminPage />
										</RequireSuperAdmin>
									</RequireAuth>
								}
							/>
							<Route
								path="/how-to-use"
								element={
									<RequireAuth>
										<HowToUsePage />
									</RequireAuth>
								}
							/>
							<Route
								path="*"
								element={
									<RequireClient>
										<Navigate to="/" replace />
									</RequireClient>
								}
							/>
						</Routes>
					</Suspense>
				</main>
			</div>
		</div>
	);
}
