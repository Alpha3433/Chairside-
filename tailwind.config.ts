import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Guard-length zone palette used by the deterministic head diagram.
        // Kept in one place so the diagram and the spec-sheet legend never drift.
        guard: {
          skin: "#f6d7b0",
          0: "#e9b384",
          1: "#caa472",
          2: "#a9885c",
          3: "#8a6f49",
          4: "#6f5a3b",
          5: "#574730",
          6: "#433627",
          7: "#33291e",
          8: "#241d15",
          scissor: "#2b2b2b",
        },
        ink: "#1a1a1a",
        canvas: "#faf8f5",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
