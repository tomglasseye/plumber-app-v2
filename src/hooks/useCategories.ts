import { useAppContext } from "../AppContext";

export function useCategories() {
	const {
		categories,
		createCategory,
		updateCategory,
		deleteCategory,
	} = useAppContext();
	return {
		categories,
		createCategory,
		updateCategory,
		deleteCategory,
	};
}
