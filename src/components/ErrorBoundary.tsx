import { Component, type ReactNode } from "react";

interface Props {
	children: ReactNode;
}
interface State {
	error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
	state: State = { error: null };

	static getDerivedStateFromError(error: Error) {
		return { error };
	}

	render() {
		if (this.state.error) {
			return (
				<div className="min-h-screen bg-neutral-950 flex items-center justify-center p-6 font-serif">
					<div className="max-w-md rounded-2xl border border-neutral-800 bg-neutral-900 p-8 text-center">
						<p className="text-3xl mb-3">⚠️</p>
						<h1 className="text-lg text-neutral-100 mb-2">
							Something went wrong
						</h1>
						<p className="text-sm text-neutral-500 mb-5">
							{this.state.error.message}
						</p>
						<button
							onClick={() => {
								this.setState({ error: null });
								window.location.href = "/";
							}}
							className="rounded-lg bg-neutral-800 px-5 py-2.5 text-sm text-neutral-200 hover:bg-neutral-700 transition-colors"
						>
							Back to Dashboard
						</button>
					</div>
				</div>
			);
		}
		return this.props.children;
	}
}
