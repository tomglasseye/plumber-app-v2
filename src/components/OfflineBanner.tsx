import { useOnlineStatus } from "../hooks/useOnlineStatus";

export function OfflineBanner() {
	const online = useOnlineStatus();

	if (online) return null;

	return (
		<div className="fixed bottom-0 left-0 right-0 z-[200] flex items-center justify-center gap-2 bg-amber-900/95 border-t border-amber-700 px-5 py-3 shadow-2xl">
			<span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse" />
			<span className="text-sm text-amber-200">
				You're offline — changes will sync when connected
			</span>
		</div>
	);
}
