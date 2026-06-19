import { useAppContext } from "../AppContext";

export function useNotifications() {
	const {
		notifications,
		myNotifs,
		addNotification,
		clearNotifs,
		dismissNotif,
		pushBanner,
		dismissPush,
	} = useAppContext();
	return {
		notifications,
		myNotifs,
		addNotification,
		clearNotifs,
		dismissNotif,
		pushBanner,
		dismissPush,
	};
}
