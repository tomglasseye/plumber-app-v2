import { useAppContext } from "../AppContext";

export function useJobs() {
	const {
		jobs,
		myJobs,
		createJob,
		updateJob,
		deleteJob,
		changeStatus,
		changePriority,
		finalComplete,
		rescheduleJob,
		resizeJobTime,
	} = useAppContext();
	return {
		jobs,
		myJobs,
		createJob,
		updateJob,
		deleteJob,
		changeStatus,
		changePriority,
		finalComplete,
		rescheduleJob,
		resizeJobTime,
	};
}
