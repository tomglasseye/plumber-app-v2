import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App.tsx";

// After a new deploy, stale lazy-loaded chunk hashes 404. Reload once to get
// fresh HTML with the correct hashes rather than showing a crash screen.
window.addEventListener("vite:preloadError", () => {
	window.location.reload();
});
import { AppProvider } from "./AppContext.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<ErrorBoundary>
			<BrowserRouter>
				<AppProvider>
					<App />
				</AppProvider>
			</BrowserRouter>
		</ErrorBoundary>
	</StrictMode>,
);
