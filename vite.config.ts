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
				name: "PipeLine",
				short_name: "PipeLine",
				description: "Job management for trades teams",
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
			workbox: {
				globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
				runtimeCaching: [
					{
						urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\//,
						handler: "NetworkFirst",
						options: {
							cacheName: "supabase-api",
							expiration: {
								maxAgeSeconds: 60 * 60 * 24,
							},
							networkTimeoutSeconds: 5,
						},
					},
					{
						urlPattern:
							/^https:\/\/.*\.supabase\.co\/storage\/v1\//,
						handler: "CacheFirst",
						options: {
							cacheName: "supabase-storage",
							expiration: {
								maxEntries: 200,
								maxAgeSeconds: 60 * 60 * 24 * 7,
							},
						},
					},
				],
			},
		}),
	],
});
