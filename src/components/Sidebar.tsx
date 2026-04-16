import type { ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useApp } from "../AppContext";

interface Props {
	onClose?: () => void;
}

export function Sidebar({ onClose }: Props) {
	const { currentUser, isMaster, isSuperAdmin, logout, business, theme, toggleTheme, exitBusiness } =
		useApp();
	const navigate = useNavigate();

	const activeColor = business.accentColor;
	const avatarColor = currentUser?.color ?? business.accentColor;
	// SA with no client loaded — hide regular nav
	const hasClient = !isSuperAdmin || business.id !== "";

	function handleLogout() {
		logout();
		navigate("/login");
		onClose?.();
	}

	const S = "h-4 w-4";
	const navItems: { to: string; icon: ReactNode; label: string }[] = [
		{
			to: "/",
			label: "Dashboard",
			icon: (
				<svg
					className={S}
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					strokeWidth={1.8}
				>
					<rect x="3" y="3" width="7" height="7" rx="1" />
					<rect x="14" y="3" width="7" height="7" rx="1" />
					<rect x="3" y="14" width="7" height="7" rx="1" />
					<rect x="14" y="14" width="7" height="7" rx="1" />
				</svg>
			),
		},
		{
			to: "/calendar",
			label: "Calendar",
			icon: (
				<svg
					className={S}
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					strokeWidth={1.8}
				>
					<rect x="3" y="4" width="18" height="18" rx="2" />
					<path strokeLinecap="round" d="M16 2v4M8 2v4M3 10h18" />
				</svg>
			),
		},
		{
			to: "/holidays",
			label: "Holidays",
			icon: (
				<svg
					className={S}
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					strokeWidth={1.8}
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
					/>
				</svg>
			),
		},
		...(!isMaster
			? [
					{
						to: "/my-day",
						label: "My Day",
						icon: (
							<svg
								className={S}
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								strokeWidth={1.8}
							>
								<circle cx="12" cy="12" r="4" />
								<path
									strokeLinecap="round"
									d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
								/>
							</svg>
						),
					},
				]
			: []),
		...(isMaster
			? [
					{
						to: "/new-job",
						label: "New Job",
						icon: (
							<svg
								className={S}
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								strokeWidth={1.8}
							>
								<path
									strokeLinecap="round"
									d="M12 5v14M5 12h14"
								/>
							</svg>
						),
					},
				]
			: []),
		...(isMaster
			? [
					{
						to: "/customers",
						label: "Customers",
						icon: (
							<svg
								className={S}
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								strokeWidth={1.8}
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
								/>
							</svg>
						),
					},
				]
			: []),
		...(isMaster
			? [
					{
						to: "/team",
						label: "Team",
						icon: (
							<svg
								className={S}
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								strokeWidth={1.8}
							>
								<path
									strokeLinecap="round"
									d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"
								/>
								<circle cx="9" cy="7" r="4" />
								<path
									strokeLinecap="round"
									d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"
								/>
							</svg>
						),
					},
				]
			: []),
		...(isMaster
			? [
					{
						to: "/account",
						label: "Account",
						icon: (
							<svg
								className={S}
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								strokeWidth={1.8}
							>
								<path
									strokeLinecap="round"
									d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
								/>
								<circle cx="12" cy="12" r="3" />
							</svg>
						),
					},
				]
			: []),
		{
			to: "/how-to-use",
			label: "How to Use",
			icon: (
				<svg
					className={S}
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					strokeWidth={1.8}
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M12 18h.01"
					/>
					<circle cx="12" cy="12" r="9" />
				</svg>
			),
		},
	];

	const linkClass = ({ isActive }: { isActive: boolean }) =>
		`flex items-center gap-3 px-3 py-3 rounded-lg text-sm transition-colors w-full text-left ${
			isActive
				? "bg-neutral-800 font-medium"
				: "text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800/60"
		}`;

	return (
		<aside className="flex h-full w-full flex-col bg-neutral-900 border-r border-neutral-800">
			{/* Logo */}
			<div className="flex items-center gap-3 border-b border-neutral-800 px-4 py-5">
				<div
					className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
					style={{ backgroundColor: business.accentColor }}
				>
					{business.logoInitials}
				</div>
				<div className="min-w-0">
					<span className="text-sm text-neutral-200 truncate block">
						{business.name.split(" ")[0]}
						<strong>
							{" " + business.name.split(" ").slice(1).join(" ")}
						</strong>
					</span>
					{isSuperAdmin && (
						<span className="text-[10px] text-orange-500 uppercase tracking-wider">
							Super Admin
						</span>
					)}
				</div>
			</div>

			{/* Nav */}
			<nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
				{hasClient && navItems.map((item) => (
					<NavLink
						key={item.to}
						to={item.to}
						end={item.to === "/"}
						className={({ isActive }) => linkClass({ isActive })}
						style={({ isActive }) =>
							isActive ? { color: activeColor } : undefined
						}
						onClick={onClose}
					>
						<span className="w-5 text-center text-base">
							{item.icon}
						</span>
						{item.label}
					</NavLink>
				))}
			</nav>

			{/* Super Admin — always-visible home button */}
			{isSuperAdmin && (
				<div className="px-3 pb-2">
					<NavLink
						to="/admin"
						className={({ isActive }) =>
							`flex items-center gap-3 px-3 py-3 rounded-lg text-sm transition-colors w-full text-left ${
								isActive
									? "bg-orange-900/40 border border-orange-800 font-medium text-orange-300"
									: "text-orange-400 hover:bg-orange-900/30 hover:text-orange-300 border border-transparent"
							}`
						}
						onClick={() => {
							exitBusiness();
							onClose?.();
						}}
					>
						<span className="w-5 text-center">
							<svg
								className={S}
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								strokeWidth={1.8}
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
								/>
							</svg>
						</span>
						Admin Home
					</NavLink>
				</div>
			)}

			{/* User footer */}
			{currentUser && (
				<div className="flex items-center gap-3 border-t border-neutral-800 px-4 py-4">
					<div
						className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-medium"
						style={{
							background: avatarColor + "22",
							border: `1px solid ${avatarColor}44`,
							color: avatarColor,
						}}
					>
						{currentUser.avatar}
					</div>
					<div className="flex-1 min-w-0">
						<p className="text-sm text-neutral-300 truncate">
							{currentUser.name}
						</p>
						<p className="text-xs text-neutral-600">
							{isSuperAdmin && !hasClient ? "Super Admin" : isMaster ? "Administrator" : "Engineer"}
						</p>
					</div>
					<button
						onClick={toggleTheme}
						className="text-neutral-600 hover:text-neutral-300 transition-colors border-0 bg-transparent p-1"
						title={
							theme === "dark"
								? "Switch to light mode"
								: "Switch to dark mode"
						}
					>
						{theme === "dark" ? "☀️" : "🌙"}
					</button>
					<button
						onClick={handleLogout}
						className="text-neutral-600 hover:text-neutral-300 transition-colors border-0 bg-transparent p-1"
						title="Sign out"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							className="h-4 w-4"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							strokeWidth={2}
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
							/>
						</svg>
					</button>
				</div>
			)}
		</aside>
	);
}
