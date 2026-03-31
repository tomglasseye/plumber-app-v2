import { useEffect } from "react";

interface CalendarShortcutHandlers {
	goToday: () => void;
	setView: (view: "month" | "week" | "day") => void;
	prevPeriod: () => void;
	nextPeriod: () => void;
	openNewJob: () => void;
	closeOverlay: () => void;
}

export function useCalendarShortcuts(handlers: CalendarShortcutHandlers) {
	useEffect(() => {
		function onKeyDown(e: KeyboardEvent) {
			const tag = (document.activeElement?.tagName ?? "").toLowerCase();
			if (tag === "input" || tag === "textarea" || tag === "select") return;
			if (e.metaKey || e.ctrlKey || e.altKey) return;

			switch (e.key.toLowerCase()) {
				case "t":
					e.preventDefault();
					handlers.goToday();
					break;
				case "d":
					e.preventDefault();
					handlers.setView("day");
					break;
				case "w":
					e.preventDefault();
					handlers.setView("week");
					break;
				case "m":
					e.preventDefault();
					handlers.setView("month");
					break;
				case "n":
					e.preventDefault();
					handlers.openNewJob();
					break;
				case "arrowleft":
					e.preventDefault();
					handlers.prevPeriod();
					break;
				case "arrowright":
					e.preventDefault();
					handlers.nextPeriod();
					break;
				case "escape":
					e.preventDefault();
					handlers.closeOverlay();
					break;
			}
		}

		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, [handlers]);
}
