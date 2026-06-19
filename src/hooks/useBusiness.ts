import { useAppContext } from "../AppContext";

export function useBusiness() {
	const {
		business,
		saveBusiness,
		switchBusiness,
		exitBusiness,
		theme,
		toggleTheme,
	} = useAppContext();
	return {
		business,
		saveBusiness,
		switchBusiness,
		exitBusiness,
		theme,
		toggleTheme,
	};
}
