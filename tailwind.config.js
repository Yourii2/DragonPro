/** @type {import('tailwindcss').Config} */ 
export default { 
  content: [ 
    "./index.html", 
    "./App.tsx", 
    "./App_new.tsx", 
    "./components/**/*.{js,ts,jsx,tsx}", 
    "./services/**/*.{js,ts,jsx,tsx}" 
  ], 
  darkMode: 'class',
  theme: { 
    extend: {}, 
  }, 
  plugins: [], 
}; 
