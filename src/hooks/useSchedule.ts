import { useAppContext } from "../AppContext";

export function useSchedule() {
	const {
		holidays,
		createHoliday,
		updateHoliday,
		deleteHoliday,
		approveHoliday,
		declineHoliday,
		reminders,
		createReminder,
		updateReminder,
		setReminderStatus,
		deleteReminder,
	} = useAppContext();
	return {
		holidays,
		createHoliday,
		updateHoliday,
		deleteHoliday,
		approveHoliday,
		declineHoliday,
		reminders,
		createReminder,
		updateReminder,
		setReminderStatus,
		deleteReminder,
	};
}
