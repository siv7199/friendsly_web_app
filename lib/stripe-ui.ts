export const STRIPE_APPEARANCE = {
  theme: "stripe" as const,
  variables: {
    colorPrimary: "#7C3AED",
    colorBackground: "#ffffff",
    colorText: "#111827",
    colorTextSecondary: "#4b5563",
    colorTextPlaceholder: "#6b7280",
    colorDanger: "#f87171",
    fontFamily: "inherit",
    borderRadius: "12px",
  },
  rules: {
    ".Label": {
      color: "#111827",
      fontWeight: "600",
    },
    ".Block": {
      backgroundColor: "#ffffff",
      boxShadow: "none",
      borderColor: "rgba(124,92,231,0.18)",
    },
    ".Tab": {
      backgroundColor: "#f8fafc",
      color: "#111827",
      borderColor: "rgba(124,92,231,0.14)",
    },
    ".Tab:hover": {
      color: "#111827",
    },
    ".Tab--selected": {
      backgroundColor: "#ede9fe",
      color: "#5b21b6",
      borderColor: "rgba(124,92,231,0.35)",
    },
    ".Input": {
      backgroundColor: "#ffffff",
      borderColor: "rgba(124,92,231,0.24)",
      color: "#111827",
    },
    ".Input--focused": {
      borderColor: "#7C3AED",
      boxShadow: "0 0 0 2px rgba(124,92,231,0.2)",
    },
    ".Input--invalid": {
      borderColor: "#f87171",
      color: "#991b1b",
    },
    ".Error": {
      color: "#b91c1c",
    },
  },
};

export const STRIPE_OPTIONS = {
  appearance: STRIPE_APPEARANCE,
};
