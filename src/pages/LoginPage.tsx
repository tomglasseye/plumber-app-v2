import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../AppContext";

const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 15 * 60;
const LS_LOCKOUT_KEY = "login_lockout_until";
const LS_ATTEMPTS_KEY = "login_attempts";

export function LoginPage() {
	const { login, resetPassword, business } = useApp();
	const navigate = useNavigate();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [info, setInfo] = useState("");
	const [busy, setBusy] = useState(false);
	const [showReset, setShowReset] = useState(false);
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

	async function handleLogin() {
		if (isLockedOut) return;
		if (!email || !password) {
			setError("Please enter your email and password.");
			return;
		}
		setBusy(true);
		setError("");
		const role = await login(email, password);
		setBusy(false);
		if (role) {
			navigate(role === "engineer" ? "/my-day" : "/");
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
				<div className="flex items-center gap-3 mb-1">
					<div
						className="flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold text-white flex-shrink-0"
						style={{ backgroundColor: business.accentColor }}
					>
						{business.logoInitials}
					</div>
					<span className="text-xl text-neutral-100">
						{business.name}
					</span>
				</div>
				<p className="text-sm text-neutral-600 mb-6">
					Team Job Sheet System
				</p>

				<div className="mb-4">
					<label className="mb-1.5 block text-xs uppercase tracking-wider text-neutral-600">
						Work Email
					</label>
					<input
						type="email"
						placeholder="you@yourcompany.co.uk"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						onKeyDown={(e) => e.key === "Enter" && handleLogin()}
						disabled={isLockedOut}
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
						onKeyDown={(e) => e.key === "Enter" && handleLogin()}
						disabled={isLockedOut}
						className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2.5 text-sm text-neutral-100 outline-none focus:border-neutral-500 placeholder:text-neutral-600 disabled:opacity-40"
					/>
				</div>

				{error && <p className="mb-3 text-sm text-red-400">{error}</p>}
				{info && <p className="mb-3 text-sm text-green-400">{info}</p>}

				{showReset ? (
					<>
						<button
							onClick={async () => {
								if (!email) {
									setError("Enter your email address above.");
									return;
								}
								setBusy(true);
								setError("");
								const err = await resetPassword(email);
								setBusy(false);
								if (err) setError(err);
								else {
									setInfo(
										"Password reset email sent. Check your inbox.",
									);
									setShowReset(false);
								}
							}}
							disabled={busy}
							className="w-full rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
							style={{ backgroundColor: business.accentColor }}
						>
							{busy ? "Sending…" : "Send Reset Link"}
						</button>
						<button
							onClick={() => {
								setShowReset(false);
								setError("");
								setInfo("");
							}}
							className="mt-3 w-full text-center text-xs text-neutral-500 hover:text-neutral-300 transition-colors bg-transparent border-0 cursor-pointer"
						>
							Back to sign in
						</button>
					</>
				) : (
					<>
						<button
							onClick={handleLogin}
							disabled={busy || isLockedOut}
							className="w-full rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
							style={{ backgroundColor: business.accentColor }}
						>
							{isLockedOut
								? `Locked — ${formatRemaining(remaining)}`
								: busy
									? "Signing in…"
									: "Sign In"}
						</button>
						<button
							onClick={() => {
								setShowReset(true);
								setError("");
								setInfo("");
							}}
							className="mt-3 w-full text-center text-xs text-neutral-500 hover:text-neutral-300 transition-colors bg-transparent border-0 cursor-pointer"
						>
							Forgot password?
						</button>
					</>
				)}
			</div>
		</div>
	);
}
