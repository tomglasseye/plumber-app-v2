interface Props {
	title?: string;
	message?: string;
	onConfirm: () => void;
	onCancel: () => void;
}

export function ConfirmDeleteModal({
	title = "Delete this item?",
	message = "This action cannot be undone.",
	onConfirm,
	onCancel,
}: Props) {
	return (
		<>
			<div
				className="fixed inset-0 z-50 bg-black/60"
				onClick={onCancel}
			/>
			<div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
				<div className="w-full max-w-sm rounded-xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl pointer-events-auto">
					<h2 className="text-base font-medium text-neutral-100 mb-2">
						{title}
					</h2>
					<p className="text-sm text-neutral-500 mb-6">{message}</p>
					<div className="flex gap-3 justify-end">
						<button
							onClick={onCancel}
							className="rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-sm text-neutral-300 hover:border-neutral-600 transition-colors cursor-pointer"
						>
							Cancel
						</button>
						<button
							onClick={onConfirm}
							className="rounded-lg border border-red-800 bg-red-950 px-4 py-2 text-sm text-red-400 hover:text-red-200 hover:border-red-700 transition-colors cursor-pointer"
						>
							Yes, delete
						</button>
					</div>
				</div>
			</div>
		</>
	);
}
