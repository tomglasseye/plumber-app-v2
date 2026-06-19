import { useAppContext } from "../AppContext";

export function useCustomers() {
	const {
		customers,
		createCustomer,
		updateCustomer,
		deleteCustomer,
	} = useAppContext();
	return {
		customers,
		createCustomer,
		updateCustomer,
		deleteCustomer,
	};
}
