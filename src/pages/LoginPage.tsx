import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../AppContext";

const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 15 * 60;
const LS_LOCKOUT_KEY = "login_lockout_until";
const LS_ATTEMPTS_KEY = "login_attempts";

export function LoginPage() {
	const { login } = useApp();
	const navigate = useNavigate();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);
	const [attempts, setAttempts] = useState(() => {
		return parseInt(localStorage.getItem(LS_ATTEMPTS_KEY) ?? "0", 10);
	});
	const [lockoutUntil, setLockoutUntil] = useState<number | null>(() => {
		const stored = localStorage.getItem(LS_LOCKOUT_KEY);
		if (!stored) return null;
		const ts = parseInt(stored, 10);
		return ts > Date.now() ? ts : null;
	});
	const [remaining, setRemaining] = useState(0);

	useEffect(() => {
		if (!lockoutUntil) return;
		const tick = () => {
			const secs = Math.ceil((lockoutUntil - Date.now()) / 1000);
			if (secs <= 0) {
				setLockoutUntil(null);
				setAttempts(0);
				setRemaining(0);
				localStorage.removeItem(LS_LOCKOUT_KEY);
				localStorage.removeItem(LS_ATTEMPTS_KEY);
			} else {
				setRemaining(secs);
			}
		};
		tick();
		const id = setInterval(tick, 1000);
		return () => clearInterval(id);
	}, [lockoutUntil]);

	const isLockedOut = lockoutUntil !== null && Date.now() < lockoutUntil;

	function formatRemaining(secs: number) {
		const m = Math.floor(secs / 60);
		const s = secs % 60;
		return m > 0 ? `${m}m ${s}s` : `${s}s`;
	}

	async function callRateLimit(
		phase: "check" | "record-failure",
	): Promise<{ blocked: boolean; message?: string; reachable: boolean }> {
		try {
			const res = await fetch("/.netlify/functions/login-rate-limit", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ phase, email }),
			});
			if (res.status === 429) {
				const body = await res.json().catch(() => ({}));
				return { blocked: true, message: body.message, reachable: true };
			}
			if (!res.ok) {
				// Server error — fail closed so a misconfigured/erroring limiter
				// doesn't silently disable rate limiting in production.
				return { blocked: true, reachable: true };
			}
			return { blocked: false, reachable: true };
		} catch {
			// Network failure (offline, function not running locally) — fail
			// open so dev still works. Supabase Auth has its own server-side
			// limits as a backstop.
			return { blocked: false, reachable: false };
		}
	}

	async function handleLogin() {
		if (isLockedOut) return;
		if (!email || !password) {
			setError("Please enter your email and password.");
			return;
		}
		setBusy(true);
		setError("");

		const check = await callRateLimit("check");
		if (check.blocked) {
			setBusy(false);
			setError(
				check.message ??
					"Too many login attempts. Please try again later.",
			);
			return;
		}

		const result = await login(email, password);
		if (!result && check.reachable) {
			// Only count failures, never successes.
			await callRateLimit("record-failure");
		}
		setBusy(false);
		if (result) {
			if (result.superAdmin) {
				navigate("/admin");
			} else {
				navigate(result.role === "engineer" ? "/my-day" : "/");
			}
		} else {
			const next = attempts + 1;
			setAttempts(next);
			localStorage.setItem(LS_ATTEMPTS_KEY, String(next));
			if (next >= MAX_ATTEMPTS) {
				const until = Date.now() + LOCKOUT_SECONDS * 1000;
				setLockoutUntil(until);
				localStorage.setItem(LS_LOCKOUT_KEY, String(until));
				setError(
					`Too many failed attempts. Try again in ${formatRemaining(LOCKOUT_SECONDS)}.`,
				);
			} else {
				setError(
					`Invalid email or password. ${MAX_ATTEMPTS - next} attempt${MAX_ATTEMPTS - next !== 1 ? "s" : ""} remaining.`,
				);
			}
		}
	}

	return (
		<div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4 font-sans">
			<div className="w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-900 p-8">
				{/* Logo */}
				<div className="mb-1">
					<img src="/icon.svg" alt="HiveQ" className="h-20" />
				</div>
				<p className="text-sm text-neutral-600 mb-6">
					Job management for trade teams
				</p>

				<form
					onSubmit={(e) => {
						e.preventDefault();
						handleLogin();
					}}
					className="space-y-0"
				>
					<div className="mb-4">
						<label className="mb-1.5 block text-xs uppercase tracking-wider text-neutral-600">
							Work Email
						</label>
						<input
							type="email"
							placeholder="you@yourcompany.co.uk"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							disabled={isLockedOut}
							autoComplete="email"
							className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2.5 text-sm text-neutral-100 outline-none focus:border-neutral-500 placeholder:text-neutral-600 disabled:opacity-40"
						/>
					</div>

					<div className="mb-4">
						<label className="mb-1.5 block text-xs uppercase tracking-wider text-neutral-600">
							Password
						</label>
						<input
							type="password"
							placeholder="••••••••"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							disabled={isLockedOut}
							autoComplete="current-password"
							className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2.5 text-sm text-neutral-100 outline-none focus:border-neutral-500 placeholder:text-neutral-600 disabled:opacity-40"
						/>
					</div>

					{error && (
						<p className="mb-3 text-sm text-red-400">{error}</p>
					)}

					<button
						type="submit"
						disabled={busy || isLockedOut}
						className="w-full rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
					>
						{isLockedOut
							? `Locked — ${formatRemaining(remaining)}`
							: busy
								? "Signing in…"
								: "Sign In"}
					</button>
				</form>

				<p className="mt-4 text-center text-xs text-neutral-500">
					Forgotten your password? Contact your administrator.
				</p>
			</div>
		</div>
	);
}
