import { useAppContext } from "../AppContext";

export function useAuth() {
	const {
		loading,
		currentUser,
		login,
		logout,
		isMaster,
		isSuperAdmin,
		saveError,
		dismissSaveError,
		idleWarning,
		dismissIdleWarning,
	} = useAppContext();
	return {
		loading,
		currentUser,
		login,
		logout,
		isMaster,
		isSuperAdmin,
		saveError,
		dismissSaveError,
		idleWarning,
		dismissIdleWarning,
	};
}
