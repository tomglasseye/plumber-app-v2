import { useEffect, useRef, useState } from "react";
import { supabase } from "../supabase";
import { useApp } from "../AppContext";
import type { JobPhoto } from "../types";

const MAX_PHOTOS = 2;

function mapPhoto(r: Record<string, unknown>): JobPhoto {
	return {
		id: r.id as string,
		jobId: r.job_id as string,
		storagePath: r.storage_path as string,
		caption: (r.caption as string) ?? "",
		uploadedBy: r.uploaded_by as string,
		createdAt: r.created_at as string,
	};
}

interface Props {
	jobId: string;
	canEdit: boolean;
}

export function JobPhotos({ jobId, canEdit }: Props) {
	const { currentUser, isMaster } = useApp();
	const [photos, setPhotos] = useState<JobPhoto[]>([]);
	const [urls, setUrls] = useState<Record<string, string>>({});
	const [uploading, setUploading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const fileRef = useRef<HTMLInputElement>(null);

	// Fetch photos on mount
	useEffect(() => {
		let cancelled = false;
		async function load() {
			const { data } = await supabase
				.from("job_photos")
				.select("*")
				.eq("job_id", jobId)
				.order("created_at", { ascending: true });
			if (!cancelled && data) {
				const mapped = data.map(mapPhoto);
				setPhotos(mapped);
				// Get signed URLs
				const urlMap: Record<string, string> = {};
				for (const p of mapped) {
					const { data: signed } = await supabase.storage
						.from("job-photos")
						.createSignedUrl(p.storagePath, 3600);
					if (signed?.signedUrl) urlMap[p.id] = signed.signedUrl;
				}
				if (!cancelled) setUrls(urlMap);
			}
		}
		load();
		return () => { cancelled = true; };
	}, [jobId]);

	async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (!file || !currentUser) return;
		if (photos.length >= MAX_PHOTOS) {
			setError(`Maximum ${MAX_PHOTOS} photos per job`);
			return;
		}

		setUploading(true);
		setError(null);

		try {
			// Resize large images client-side
			const resized = await resizeImage(file, 1200);
			const ext = file.name.split(".").pop() ?? "jpg";
			const path = `${jobId}/${crypto.randomUUID()}.${ext}`;

			const { error: uploadErr } = await supabase.storage
				.from("job-photos")
				.upload(path, resized, { contentType: resized.type });
			if (uploadErr) throw new Error(uploadErr.message);

			const { data: row, error: insertErr } = await supabase
				.from("job_photos")
				.insert({
					job_id: jobId,
					storage_path: path,
					caption: "",
					uploaded_by: currentUser.id,
				})
				.select()
				.single();
			if (insertErr) throw new Error(insertErr.message);

			const photo = mapPhoto(row);
			const { data: signed } = await supabase.storage
				.from("job-photos")
				.createSignedUrl(path, 3600);

			setPhotos((prev) => [...prev, photo]);
			if (signed?.signedUrl) {
				setUrls((prev) => ({ ...prev, [photo.id]: signed.signedUrl }));
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Upload failed");
		} finally {
			setUploading(false);
			if (fileRef.current) fileRef.current.value = "";
		}
	}

	async function handleDelete(photo: JobPhoto) {
		setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
		setUrls((prev) => {
			const next = { ...prev };
			delete next[photo.id];
			return next;
		});
		await supabase.storage.from("job-photos").remove([photo.storagePath]);
		await supabase.from("job_photos").delete().eq("id", photo.id);
	}

	const canDelete = (photo: JobPhoto) =>
		isMaster || photo.uploadedBy === currentUser?.id;

	return (
		<div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
			<div className="flex items-center justify-between mb-4">
				<h4 className="text-[10px] uppercase tracking-widest text-neutral-600">
					Photos ({photos.length}/{MAX_PHOTOS})
				</h4>
			</div>

			{/* Photo grid */}
			{photos.length > 0 && (
				<div className="grid grid-cols-2 gap-3 mb-4">
					{photos.map((photo) => (
						<div
							key={photo.id}
							className="relative group rounded-lg overflow-hidden border border-neutral-700 bg-neutral-800 aspect-[4/3]"
						>
							{urls[photo.id] ? (
								<img
									src={urls[photo.id]}
									alt={photo.caption || "Job photo"}
									className="w-full h-full object-cover"
								/>
							) : (
								<div className="w-full h-full flex items-center justify-center text-neutral-600 text-xs">
									Loading...
								</div>
							)}
							{canEdit && canDelete(photo) && (
								<button
									onClick={() => handleDelete(photo)}
									className="absolute top-1.5 right-1.5 h-7 w-7 rounded-full bg-black/70 text-red-400 hover:text-red-300 text-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer border-0"
									title="Delete photo"
								>
									&times;
								</button>
							)}
						</div>
					))}
				</div>
			)}

			{/* Empty state */}
			{photos.length === 0 && !uploading && (
				<div className="py-6 text-center text-sm text-neutral-600 border border-dashed border-neutral-800 rounded-lg mb-4">
					No photos yet
				</div>
			)}

			{/* Upload button */}
			{canEdit && photos.length < MAX_PHOTOS && (
				<>
					<input
						ref={fileRef}
						type="file"
						accept="image/*"
						capture="environment"
						onChange={handleUpload}
						className="hidden"
					/>
					<button
						onClick={() => fileRef.current?.click()}
						disabled={uploading}
						className="w-full flex items-center justify-center gap-2 rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2.5 text-sm text-neutral-300 hover:border-neutral-600 cursor-pointer transition-colors disabled:opacity-50"
					>
						{uploading ? (
							<>
								<span className="inline-block h-3.5 w-3.5 border-2 border-neutral-500 border-t-transparent rounded-full animate-spin" />
								Uploading...
							</>
						) : (
							<>📷 Add Photo</>
						)}
					</button>
				</>
			)}

			{error && (
				<p className="mt-2 text-xs text-red-400">{error}</p>
			)}
		</div>
	);
}

/** Resize an image file to maxWidth, returns a Blob. */
async function resizeImage(file: File, maxWidth: number): Promise<Blob> {
	return new Promise((resolve) => {
		const img = new Image();
		img.onload = () => {
			if (img.width <= maxWidth) {
				resolve(file);
				return;
			}
			const scale = maxWidth / img.width;
			const canvas = document.createElement("canvas");
			canvas.width = maxWidth;
			canvas.height = img.height * scale;
			const ctx = canvas.getContext("2d")!;
			ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
			canvas.toBlob(
				(blob) => resolve(blob ?? file),
				"image/jpeg",
				0.85,
			);
		};
		img.src = URL.createObjectURL(file);
	});
}
