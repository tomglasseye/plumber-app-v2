import { useEffect, useRef, useState } from "react";
import type { Notification } from "../types";

interface Props {
	notifications: Notification[];
	onClear: () => void;
	onNavigate: (path: string) => void;
}

export function NotificationBell({
	notifications,
	onClear,
	onNavigate,
}: Props) {
	const [open, setOpen] = useState(false);
	const ref = useRef<HTMLDivElement>(null);
	const unread = notifications.filter((n) => !n.read);
	const unreadCount = unread.length;

	useEffect(() => {
		function handler(e: MouseEvent) {
			if (ref.current && !ref.current.contains(e.target as Node))
				setOpen(false);
		}
		document.addEventListener("mousedown", handler);
		return () => document.removeEventListener("mousedown", handler);
	}, []);

	return (
		<div ref={ref} className="relative">
			<button
				onClick={() => setOpen(!open)}
				className="relative p-2 text-neutral-400 hover:text-white transition-colors"
				aria-label="Notifications"
			>
				🔔
				{unreadCount > 0 && (
					<span className="absolute top-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
						{unreadCount > 9 ? "9+" : unreadCount}
					</span>
				)}
			</button>

			{open && (
				<div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-neutral-800 bg-neutral-900 shadow-2xl z-50">
					<div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
						<span className="text-xs text-neutral-400 uppercase tracking-wider">
							Notifications
						</span>
						{unread.length > 0 && (
							<button
								onClick={() => {
									onClear();
									setOpen(false);
								}}
								className="text-xs text-neutral-600 hover:text-neutral-400 transition-colors border-0 bg-transparent p-0"
							>
								Clear all
							</button>
						)}
					</div>
					{unread.length === 0 ? (
						<p className="px-4 py-6 text-center text-sm text-neutral-600">
							No notifications
						</p>
					) : (
						<div className="max-h-80 overflow-y-auto divide-y divide-neutral-800/50">
							{unread.map((n) => (
								<div
									key={n.id}
									onClick={() => {
										if (n.jobId) {
											onNavigate(`/job/${n.jobId}`);
											setOpen(false);
										}
									}}
									className={`flex gap-3 px-4 py-3 items-start bg-neutral-800/40 ${
										n.jobId
											? "cursor-pointer hover:bg-neutral-700/50 transition-colors"
											: ""
									}`}
								>
									<span className="text-base mt-0.5">
										{n.icon}
									</span>
									<div className="flex-1 min-w-0">
										<p className="text-sm leading-snug text-neutral-200">
											{n.message}
										</p>
										<p className="mt-0.5 text-xs text-neutral-600">
											{n.time}
										</p>
									</div>
								</div>
							))}
						</div>
					)}
				</div>
			)}
		</div>
	);
}
