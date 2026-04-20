export const STRIPE_APPEARANCE = {
  theme: "night" as const,
  variables: {
    colorPrimary: "#7C3AED",
    colorBackground: "#1A1535",
    colorText: "#f1f5f9",
    colorTextSecondary: "#c4b5fd",
    colorTextPlaceholder: "#7c6fa0",
    colorDanger: "#f87171",
    fontFamily: "inherit",
    borderRadius: "12px",
  },
  rules: {
    ".Label": {
      color: "#c4b5fd",
      fontWeight: "500",
    },
    ".Input": {
      borderColor: "rgba(124,92,231,0.35)",
      color: "#f1f5f9",
    },
    ".Input--focused": {
      borderColor: "#7C3AED",
      boxShadow: "0 0 0 2px rgba(124,92,231,0.2)",
    },
    ".Input--invalid": {
      borderColor: "#f87171",
      color: "#fca5a5",
    },
    ".Error": {
      color: "#fca5a5",
    },
  },
};

export const STRIPE_OPTIONS = {
  appearance: STRIPE_APPEARANCE,
};
