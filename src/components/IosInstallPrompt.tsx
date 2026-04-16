import { useState } from "react";

const DISMISSED_KEY = "ios-install-prompt-dismissed";

function isIosSafari(): boolean {
	const ua = navigator.userAgent.toLowerCase();
	return /iphone|ipad|ipod/.test(ua) && !/(crios|fxios|opios|mercury)/.test(ua);
}

function isStandalone(): boolean {
	return window.matchMedia("(display-mode: standalone)").matches;
}

export function IosInstallPrompt() {
	const [dismissed, setDismissed] = useState(
		() => localStorage.getItem(DISMISSED_KEY) === "1",
	);

	if (dismissed || !isIosSafari() || isStandalone()) return null;

	function handleDismiss() {
		setDismissed(true);
		localStorage.setItem(DISMISSED_KEY, "1");
	}

	return (
		<div className="fixed bottom-4 left-4 right-4 z-[150] rounded-xl border border-neutral-700 bg-neutral-900 p-4 shadow-2xl md:left-auto md:right-6 md:max-w-sm">
			<div className="flex items-start gap-3">
				<span className="text-2xl flex-shrink-0">📱</span>
				<div className="flex-1">
					<p className="text-sm text-neutral-200 font-medium mb-1">
						Add to Home Screen
					</p>
					<p className="text-xs text-neutral-500">
						Tap the <strong className="text-neutral-300">Share</strong> button in Safari, then <strong className="text-neutral-300">"Add to Home Screen"</strong> to get push notifications and a full-screen experience.
					</p>
				</div>
				<button
					onClick={handleDismiss}
					className="text-neutral-600 hover:text-neutral-300 text-lg border-0 bg-transparent cursor-pointer flex-shrink-0"
				>
					&times;
				</button>
			</div>
		</div>
	);
}
