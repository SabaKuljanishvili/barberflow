import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "no-console": ["error", { allow: ["error", "warn"] }],
      "no-eval": "error",
      "react/no-danger": "warn",
    },
  },
  { ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts", "scripts/**"] },
];

export default eslintConfig;
