import { useState, useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import './App.css';

// Earth sphere with a crater (hemisphere subtraction illusion)
function EarthWithCrater({ craterDepth, craterRadius, showCrater }: { craterDepth: number; craterRadius: number; showCrater: boolean }) {
  const earthRadius = 2;
  const depth = Math.min(craterDepth / 100, earthRadius * 0.7); // Clamp for realism
  const radius = Math.max(0.2, Math.min(craterRadius, earthRadius * 0.8));

  // Full hemisphere for the crater
  const fullHemisphereGeometry = useMemo(() => {
    const geo = new THREE.SphereGeometry(radius, 64, 64, 0, 2 * Math.PI, 0, Math.PI / 1);
    geo.rotateX(Math.PI);
    geo.translate(0, earthRadius - depth, 0);
    return geo;
  }, [radius, depth]);

  // Ref for custom shader material
  const craterMatRef = useRef<any>(null);

  // Custom shader logic to clip the crater outside the earth sphere
  useEffect(() => {
    if (craterMatRef.current) {
      craterMatRef.current.onBeforeCompile = (shader: any) => {
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <clipping_planes_fragment>',
          `#include <clipping_planes_fragment>
          // Discard fragments outside the earth sphere (in world space)
          vec3 worldPos = (modelMatrix * vec4(position, 1.0)).xyz;
          if (length(worldPos) > ${earthRadius.toFixed(2)} + 0.001) discard;`
        );
      };
      craterMatRef.current.needsUpdate = true;
    }
  }, [radius, depth]);

  return (
    <group>
      {/* Earth sphere with translucency */}
      <mesh castShadow receiveShadow>
        <sphereGeometry args={[earthRadius, 64, 64]} />
        <meshPhysicalMaterial color="#2a7fff" transparent opacity={0.5} roughness={0.3} metalness={0.1} transmission={0.7} thickness={0.5} />
      </mesh>
      {/* Crater (hemisphere, clipped to earth) */}
      {showCrater && (
        <mesh geometry={fullHemisphereGeometry}>
          <meshStandardMaterial ref={craterMatRef} color="#222" roughness={1} metalness={0} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}

// Meteor animation
function Meteor({ animate, onImpact, resetKey }: { animate: boolean; onImpact: () => void; resetKey: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const [impact, setImpact] = useState(false);

  // Reset meteor position and impact state when resetKey changes
  useEffect(() => {
    setImpact(false);
    if (ref.current) {
      ref.current.position.set(0, 8, 0);
    }
  }, [resetKey]);

  useFrame((_, delta) => {
    if (!animate || impact) return;
    if (ref.current) {
      // Move meteor down toward Earth
      ref.current.position.y -= delta * 8; // speed
      if (ref.current.position.y <= 2.2) {
        setImpact(true);
        onImpact();
      }
    }
  });
  return (
    <mesh ref={ref} position={[0, 8, 0]} visible={!impact} castShadow>
      <sphereGeometry args={[0.25, 32, 32]} />
      <meshStandardMaterial color="#888" />
    </mesh>
  );
}

function extrapolateDepth(data: { height: number; depth: number }[], targetHeight: number) {
  if (data.length < 2) return 0;
  const logs = data.map(({ height, depth }) => ({
    x: Math.log(height),
    y: Math.log(depth),
  }));
  const n = logs.length;
  const sumX = logs.reduce((a, b) => a + b.x, 0);
  const sumY = logs.reduce((a, b) => a + b.y, 0);
  const sumXX = logs.reduce((a, b) => a + b.x * b.x, 0);
  const sumXY = logs.reduce((a, b) => a + b.x * b.y, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  return Math.exp(intercept) * Math.pow(targetHeight, slope);
}

function App() {
  const [data, setData] = useState([
    { height: 1, depth: 0.5 },
    { height: 2, depth: 2 },
  ]);
  const [newRow, setNewRow] = useState({ height: '', depth: '' });
  const [animate, setAnimate] = useState(false);
  const [showCrater, setShowCrater] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const atmosphereHeight = 100000; // meters (100 km)
  const extrapolated = extrapolateDepth(data, atmosphereHeight);
  const craterRadius = 0.7 + extrapolated * 0.01; // for visualization

  return (
    <div className="container">
      <h1>Émilie du Châtelet Impact Extrapolator</h1>
      <p>Input your experimental data below (height in meters, depth in cm):</p>
      <table>
        <thead>
          <tr>
            <th>Height (m)</th>
            <th>Depth (cm)</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i}>
              <td>{row.height}</td>
              <td>{row.depth}</td>
            </tr>
          ))}
          <tr>
            <td>
              <input
                type="number"
                value={newRow.height}
                onChange={e => setNewRow({ ...newRow, height: e.target.value })}
                placeholder="Height"
                min="0.01"
                step="any"
              />
            </td>
            <td>
              <input
                type="number"
                value={newRow.depth}
                onChange={e => setNewRow({ ...newRow, depth: e.target.value })}
                placeholder="Depth"
                min="0.01"
                step="any"
              />
            </td>
            <td>
              <button
                onClick={() => {
                  if (
                    Number(newRow.height) > 0 &&
                    Number(newRow.depth) > 0
                  ) {
                    setData([
                      ...data,
                      {
                        height: Number(newRow.height),
                        depth: Number(newRow.depth),
                      },
                    ]);
                    setNewRow({ height: '', depth: '' });
                  }
                }}
              >
                Add
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <h2>Extrapolated Impact from Edge of Atmosphere (100 km)</h2>
      <p>
        Estimated crater depth: <b>{(extrapolated / 100).toFixed(3)} m</b>
      </p>
      <div style={{ width: '100%', maxWidth: 600, height: 400, margin: 'auto', background: '#222', borderRadius: 8 }}>
        <Canvas camera={{ position: [0, 6, 8], fov: 50 }} shadows>
          <ambientLight intensity={0.7} />
          <directionalLight position={[5, 10, 7]} intensity={1} castShadow />
          <EarthWithCrater craterDepth={extrapolated} craterRadius={craterRadius} showCrater={showCrater} />
          <Meteor animate={animate && !showCrater} onImpact={() => setShowCrater(true)} resetKey={resetKey} />
          <OrbitControls enablePan enableZoom enableRotate />
        </Canvas>
        <div style={{ textAlign: 'center', marginTop: 8, display: 'flex', justifyContent: 'center', gap: 12 }}>
          <button onClick={() => { setAnimate(false); setShowCrater(false); setTimeout(() => setAnimate(true), 100); }}>
            Play Animation
          </button>
          <button onClick={() => { setAnimate(false); setShowCrater(false); setResetKey(k => k + 1); }}>
            Reset
          </button>
        </div>
      </div>
      <p style={{ fontSize: '0.9em', color: '#888', marginTop: 32 }}>
        This extrapolation uses a power law fit to your data. For demonstration only.
      </p>
    </div>
  );
}

export default App;
