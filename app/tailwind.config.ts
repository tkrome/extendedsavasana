import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        sage: {
          50: "#f3f7f3",
          100: "#e3ede3",
          200: "#c8dac9",
          300: "#a0bfa2",
          400: "#729e74",
          500: "#507d52",
          600: "#3c6340",
          700: "#314f34",
          800: "#293f2c",
          900: "#223425",
        },
      },
    },
  },
  plugins: [],
};

export default config;
