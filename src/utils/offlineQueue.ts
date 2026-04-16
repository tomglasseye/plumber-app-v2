export interface QueuedMutation {
	table: string;
	operation: "update" | "insert";
	id: string;
	fields: Record<string, unknown>;
	timestamp: number;
}

const QUEUE_KEY = "offline-mutation-queue";

export function queueMutation(mutation: QueuedMutation): void {
	const queue = getQueue();
	queue.push(mutation);
	localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function getQueue(): QueuedMutation[] {
	try {
		return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]");
	} catch {
		return [];
	}
}

export function clearQueue(): void {
	localStorage.removeItem(QUEUE_KEY);
}
