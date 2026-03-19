/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#10b981",
        "primary-dark": "#059669"
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: 0, transform: "translateY(12px)" },
          "100%": { opacity: 1, transform: "translateY(0)" }
        },
        "fade-in": {
          "0%": { opacity: 0 },
          "100%": { opacity: 1 }
        },
        "scale-in": {
          "0%": { opacity: 0, transform: "scale(0.97)" },
          "100%": { opacity: 1, transform: "scale(1)" }
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" }
        },
        "orbit-slow": {
          "0%": { transform: "rotate(0deg) translateX(2px) rotate(0deg)" },
          "100%": { transform: "rotate(360deg) translateX(2px) rotate(-360deg)" }
        },
        "pulse-soft": {
          "0%, 100%": { opacity: 0.75 },
          "50%": { opacity: 1 }
        },
        "drift-diagonal": {
          "0%": { transform: "translate(0, 0)" },
          "50%": { transform: "translate(6px, -6px)" },
          "100%": { transform: "translate(0, 0)" }
        }
      },
      animation: {
        "fade-up": "fade-up 0.5s ease-out forwards",
        "fade-up-delayed": "fade-up 0.6s ease-out 0.1s forwards",
        "fade-in": "fade-in 0.4s ease-out forwards",
        "scale-in": "scale-in 0.45s ease-out forwards",
        float: "float 3s ease-in-out infinite",
        "orbit-slow": "orbit-slow 12s linear infinite",
        "pulse-soft": "pulse-soft 4s ease-in-out infinite",
        "drift-diagonal": "drift-diagonal 10s ease-in-out infinite"
      }
    }
  },
  plugins: []
};


