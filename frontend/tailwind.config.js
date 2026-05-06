export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg:       "var(--bg)",
        "bg-soft": "var(--bg-soft)",
        "bg-deep": "var(--bg-deep)",
        panel:    "var(--panel)",
        ink:      "var(--ink)",
        "ink-2":  "var(--ink-2)",
        "ink-3":  "var(--ink-3)",
        "ink-4":  "var(--ink-4)",
        rule:     "var(--rule)",
        "rule-2": "var(--rule-2)",
        accent:   "var(--accent)",
        "accent-2": "var(--accent-2)",
      },
      fontFamily: {
        serif: ["var(--serif)"],
        sans:  ["var(--sans)"],
        mono:  ["var(--mono)"],
      },
      borderRadius: {
        sm: "var(--r-sm)",
        md: "var(--r-md)",
        lg: "var(--r-lg)",
      },
    },
  },
  plugins: [],
};
