import React, { createContext, useContext, useState } from "react";

const THEMES = [
  {
    id: "space-desert",
    name: "Cosmic Horizon",
    description: "Alien landscape, teal sky & planets",
    image: "/themes/space-desert.png",
    overlay: "dark",
    cardStyle: "glass-light",
    accent: "green"
  },
  {
    id: "race-car",
    name: "Crimson Speed",
    description: "Red sports car, dynamic stripes",
    image: "/themes/race-car.jpg",
    overlay: "dark",
    cardStyle: "glass-light",
    accent: "red",
    bgPosition: "center bottom"
  },
  {
    id: "astro-kid",
    name: "Space Explorer",
    description: "Friendly astronaut, stars & rocket",
    image: "/themes/astro-kid.jpg",
    overlay: "dark",
    cardStyle: "glass-light",
    accent: "green"
  },
  {
    id: "sci-fi-corridor",
    name: "Neon Corridor",
    description: "Red neon hallway, sci-fi",
    image: "/themes/sci-fi-corridor.jpg",
    overlay: "dark",
    cardStyle: "glass-light",
    accent: "red"
  },
  {
    id: "hero-astronaut",
    name: "Lunar Hero",
    description: "Astronaut on floating cliffs, blue cosmos",
    image: "/themes/hero-astronaut.jpg",
    overlay: "dark",
    cardStyle: "glass-light",
    accent: "green"
  }
];

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  // Always start with default — no localStorage persistence
  const [themeId, setThemeId] = useState("default");

  const activeTheme = THEMES.find((t) => t.id === themeId) || null;

  // Reset to default theme
  const resetTheme = () => setThemeId("default");

  const value = {
    themes: THEMES,
    themeId,
    activeTheme,
    setThemeId,
    resetTheme
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
