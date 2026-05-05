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
			includeAssets: ["favicon.ico", "apple-touch-icon.png"],
			manifest: {
				name: "HiveQ",
				short_name: "HiveQ",
				description: "Job management for trades teams",
				theme_color: "#fca500",
				background_color: "#0a0a0a",
				display: "standalone",
				orientation: "portrait",
				start_url: "/",
				scope: "/",
				icons: [
					{
						src: "android-chrome-192x192.png",
						sizes: "192x192",
						type: "image/png",
					},
					{
						src: "android-chrome-512x512.png",
						sizes: "512x512",
						type: "image/png",
						purpose: "any maskable",
					},
				],
			},
			workbox: {
				importScripts: ["/sw-push.js"],
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
						urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\//,
						handler: "NetworkOnly",
						method: "POST",
						options: {
							backgroundSync: {
								name: "supabase-mutations",
								options: { maxRetentionTime: 24 * 60 },
							},
						},
					},
					{
						urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\//,
						handler: "NetworkOnly",
						method: "PATCH",
						options: {
							backgroundSync: {
								name: "supabase-mutations",
								options: { maxRetentionTime: 24 * 60 },
							},
						},
					},
					{
						urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\//,
						handler: "NetworkOnly",
						method: "DELETE",
						options: {
							backgroundSync: {
								name: "supabase-mutations",
								options: { maxRetentionTime: 24 * 60 },
							},
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
