import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: "1rem", screens: { "2xl": "1400px" } },
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', '"Noto Sans Armenian"', '"Noto Sans"', "system-ui", "sans-serif"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
        brand: { DEFAULT: "#22382F", 50: "#EEF4F1", 100: "#D6E4DD", 200: "#AFC9BC", 300: "#7FA894", 400: "#4F8069", 500: "#36604F", 600: "#2B4A3D", 700: "#22382F", 800: "#1A2B24", 900: "#111D18" },
        ok: { DEFAULT: "#1F8A4C", soft: "#E3F4EA", fg: "#14653A" },
        warn: { DEFAULT: "#C77700", soft: "#FFF3DC", fg: "#8A5300" },
        crit: { DEFAULT: "#C62828", soft: "#FDE7E7", fg: "#9B1C1C" },
        info: { DEFAULT: "#2563EB", soft: "#E6EEFD", fg: "#1D4ED8" },
        solar: "#E3A008",
        grid: "#6366F1",
      },
      borderRadius: { lg: "var(--radius)", md: "calc(var(--radius) - 2px)", sm: "calc(var(--radius) - 4px)" },
      keyframes: {
        "flow-dash": { to: { strokeDashoffset: "-24" } },
      },
      animation: { "flow-dash": "flow-dash 1s linear infinite" },
    },
  },
  plugins: [animate],
} satisfies Config;
