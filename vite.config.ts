import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
	plugins: [
		react(),
		tailwindcss(),
		VitePWA({
			registerType: "autoUpdate",
			includeAssets: ["vite.svg"],
			manifest: {
				name: "DPH Jobs",
				short_name: "DPH Jobs",
				description: "Job sheet management for plumbing & trades teams",
				theme_color: "#0a0a0a",
				background_color: "#0a0a0a",
				display: "standalone",
				start_url: "/",
				icons: [
					{
						src: "vite.svg",
						sizes: "any",
						type: "image/svg+xml",
						purpose: "any maskable",
					},
				],
			},
		}),
	],
});
