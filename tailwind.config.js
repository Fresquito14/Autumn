/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  safelist: [
    'bg-autumn-progress',
    'bg-autumn-critical',
    'bg-accent',
    'hover:bg-autumn-progress/90',
    'hover:bg-autumn-critical/90',
    'hover:bg-accent/90',
    'border-autumn-progress/20',
    'border-autumn-critical/20',
    'text-autumn-progress',
    'text-autumn-critical',
    'text-autumn-progress-foreground',
    'text-autumn-critical-foreground',
    'fill-autumn-progress-foreground',
    'fill-autumn-critical-foreground',
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        // Autumn-themed custom colors (mapped to CSS variables)
        'autumn-critical': 'hsl(var(--autumn-critical))',
        'autumn-critical-foreground': 'hsl(var(--autumn-critical-foreground))',
        'autumn-progress': 'hsl(var(--autumn-progress))',
        'autumn-progress-foreground': 'hsl(var(--autumn-progress-foreground))',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [
    require('tailwind-scrollbar-hide')
  ],
}
