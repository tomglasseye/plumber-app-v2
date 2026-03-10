import { NavLink, useNavigate } from "react-router-dom";
import { useApp } from "../AppContext";

interface Props {
	onClose?: () => void;
}

export function Sidebar({ onClose }: Props) {
	const { currentUser, isMaster, logout, business, theme, toggleTheme } =
		useApp();
	const navigate = useNavigate();

	const activeColor = currentUser?.color ?? business.accentColor;

	function handleLogout() {
		logout();
		navigate("/login");
		onClose?.();
	}

	const navItems = [
		{ to: "/", icon: "⊞", label: "Dashboard" },
		{ to: "/calendar", icon: "▦", label: "Calendar" },
		...(!isMaster ? [{ to: "/my-day", icon: "⬡", label: "My Day" }] : []),
		...(isMaster ? [{ to: "/new-job", icon: "+", label: "New Job" }] : []),
		...(isMaster ? [{ to: "/team", icon: "◎", label: "Team" }] : []),
		...(isMaster ? [{ to: "/account", icon: "⚙", label: "Account" }] : []),
	];

	const linkClass = ({ isActive }: { isActive: boolean }) =>
		`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors w-full text-left ${
			isActive
				? "bg-neutral-800 font-medium"
				: "text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800/60"
		}`;

	return (
		<aside className="flex h-full w-full flex-col bg-neutral-900 border-r border-neutral-800">
			{/* Logo */}
			<div className="flex items-center gap-3 border-b border-neutral-800 px-4 py-4">
				<div
					className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
					style={{ backgroundColor: business.accentColor }}
				>
					{business.logoInitials}
				</div>
				<span className="text-sm text-neutral-200 truncate">
					{business.name.split(" ")[0]}
					<strong>
						{" " + business.name.split(" ").slice(1).join(" ")}
					</strong>
				</span>
			</div>

			{/* Nav */}
			<nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
				{navItems.map((item) => (
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

			{/* User footer */}
			{currentUser && (
				<div className="flex items-center gap-3 border-t border-neutral-800 px-4 py-3">
					<div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-neutral-800 border border-neutral-700 text-xs text-neutral-400">
						{currentUser.avatar}
					</div>
					<div className="flex-1 min-w-0">
						<p className="text-sm text-neutral-300 truncate">
							{currentUser.name}
						</p>
						<p className="text-xs text-neutral-600">
							{isMaster ? "Administrator" : "Engineer"}
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
						⏻
					</button>
				</div>
			)}
		</aside>
	);
}
