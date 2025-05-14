# Émilie du Châtelet Impact Extrapolator

This web app lets you input experimental data from Émilie du Châtelet's classic impact experiment (height of drop and depth of impact in clay), then extrapolates the results to simulate dropping a ball from the edge of Earth's atmosphere (100 km). The resulting impact crater is visualized in 3D using Three.js (React Three Fiber).

## Features
- Input table for height (m) and depth (cm) data
- Power law extrapolation to estimate crater depth from 100 km
- 3D animated crater visualization
- Modern, dark-themed UI

## How to Run

1. Install dependencies:
   ```sh
   npm install
   ```
2. Start the development server:
   ```sh
   npm run dev
   ```
3. Open the app in your browser at the URL shown in the terminal (usually http://localhost:5173)

## Technologies Used
- React + TypeScript
- Vite
- Three.js via @react-three/fiber and @react-three/drei

## Credits
Inspired by the 18th-century experiments of Émilie du Châtelet.

---

*This project is for educational and demonstration purposes only.*
