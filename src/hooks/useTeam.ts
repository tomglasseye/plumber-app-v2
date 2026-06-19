import { useAppContext } from "../AppContext";

export function useTeam() {
	const {
		users,
		saveUser,
		lockUser,
		unlockUser,
		deleteUser,
		changePassword,
		changeEmail,
		inviteUser,
	} = useAppContext();
	return {
		users,
		saveUser,
		lockUser,
		unlockUser,
		deleteUser,
		changePassword,
		changeEmail,
		inviteUser,
	};
}
