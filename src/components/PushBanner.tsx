import { useEffect } from "react";
import type { Notification } from "../types";

interface Props {
	push: Notification | null;
	onDismiss: () => void;
}

export function PushBanner({ push, onDismiss }: Props) {
	useEffect(() => {
		if (!push) return;
		const t = setTimeout(onDismiss, 5000);
		return () => clearTimeout(t);
	}, [push]);

	if (!push) return null;

	return (
		<div className="fixed top-4 left-1/2 -translate-x-1/2 z-[999] flex items-start gap-3 rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 shadow-2xl max-w-sm w-[calc(100%-2rem)]">
			<span className="text-2xl flex-shrink-0 mt-0.5">{push.icon}</span>
			<div className="flex-1 min-w-0">
				<p className="text-sm font-semibold text-white leading-snug">
					{push.message}
				</p>
				<p className="mt-0.5 text-xs text-neutral-500">{push.time}</p>
			</div>
			<button
				onClick={onDismiss}
				className="flex-shrink-0 text-neutral-600 hover:text-neutral-300 transition-colors border-0 bg-transparent p-0 ml-2"
			>
				✕
			</button>
		</div>
	);
}
