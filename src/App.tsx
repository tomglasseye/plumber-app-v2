import { useState } from "react";
import {
	Navigate,
	Route,
	Routes,
	useLocation,
	useNavigate,
} from "react-router-dom";
import { useApp } from "./AppContext";
import { NotificationBell } from "./components/NotificationBell";
import { PushBanner } from "./components/PushBanner";
import { Sidebar } from "./components/Sidebar";
import { AccountPage } from "./pages/AccountPage";
import { CalendarPage } from "./pages/CalendarPage";
import { DashboardPage } from "./pages/DashboardPage";
import { JobDetailPage } from "./pages/JobDetailPage";
import { LoginPage } from "./pages/LoginPage";
import { MyDayPage } from "./pages/MyDayPage";
import { NewJobPage } from "./pages/NewJobPage";
import { RepeatTasksPage, RepeatTaskDetailPage } from "./pages/RepeatTasksPage";
import { TeamPage } from "./pages/TeamPage";

function RequireAuth({ children }: { children: React.ReactNode }) {
	const { currentUser } = useApp();
	const location = useLocation();
	if (!currentUser)
		return <Navigate to="/login" state={{ from: location }} replace />;
	return <>{children}</>;
}

function RequireMaster({ children }: { children: React.ReactNode }) {
	const { isMaster } = useApp();
	if (!isMaster) return <Navigate to="/" replace />;
	return <>{children}</>;
}

export default function App() {
	const {
		currentUser,
		pushBanner,
		dismissPush,
		loading,
		saveError,
		dismissSaveError,
		myNotifs,
		clearNotifs,
	} = useApp();
	const [sidebarOpen, setSidebarOpen] = useState(false);
	const { business } = useApp();
	const navigate = useNavigate();

	if (loading) {
		return (
			<div className="min-h-screen bg-neutral-950 flex items-center justify-center">
				<span className="text-neutral-600 text-sm animate-pulse">
					Loading…
				</span>
			</div>
		);
	}

	// Public login page
	if (!currentUser) {
		return (
			<Routes>
				<Route path="*" element={<LoginPage />} />
			</Routes>
		);
	}

	return (
		<div className="flex min-h-screen bg-neutral-950 font-sans text-neutral-100">
			<PushBanner push={pushBanner} onDismiss={dismissPush} />

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
			<div className="flex-1 md:ml-56 flex flex-col min-h-screen">
				{/* Mobile header */}
				<header className="flex items-center justify-between border-b border-neutral-800 bg-neutral-900 px-4 py-3 md:hidden sticky top-0 z-30">
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
						onNavigate={(path) => navigate(path)}
					/>
				</header>

				{/* Desktop top bar */}
				<div className="hidden md:flex items-center justify-end border-b border-neutral-800 bg-neutral-950 px-6 py-2 sticky top-0 z-30">
					<NotificationBell
						notifications={myNotifs}
						onClear={clearNotifs}
						onNavigate={(path) => navigate(path)}
					/>
				</div>

				<main className="flex-1 overflow-y-auto">
					<Routes>
						<Route path="/login" element={<LoginPage />} />
						<Route
							path="/"
							element={
								<RequireAuth>
									<DashboardPage />
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
							path="/repeat-tasks"
							element={
								<RequireAuth>
									<RequireMaster>
										<RepeatTasksPage />
									</RequireMaster>
								</RequireAuth>
							}
						/>
						<Route
							path="/repeat-tasks/:id"
							element={
								<RequireAuth>
									<RequireMaster>
										<RepeatTaskDetailPage />
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
						<Route path="*" element={<Navigate to="/" replace />} />
					</Routes>
				</main>
			</div>
		</div>
	);
}
