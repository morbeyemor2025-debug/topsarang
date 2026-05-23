import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#111318",
        baobab: "#ba7a2b",
        mango: "#f4b23f",
        leaf: "#0f8f64",
        coral: "#dc5750",
        mist: "#f7f5ef"
      },
      boxShadow: {
        glow: "0 24px 80px rgba(186,122,43,0.18)",
        glass: "0 20px 60px rgba(17,19,24,0.08)"
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "Inter", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};

export default config;
