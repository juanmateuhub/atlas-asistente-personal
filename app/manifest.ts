import type { MetadataRoute } from "next";

/**
 * Installable web app: added to the home screen, Atlas opens full screen
 * (no browser bars) with the Nocturne colours.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Atlas",
    short_name: "Atlas",
    description: "Tu organización personal: tareas, universidad, calendario y Jax.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f4f4f2",
    theme_color: "#f4f4f2",
    lang: "es",
    icons: [
      { src: "/icons/jax-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/jax-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/jax-icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
