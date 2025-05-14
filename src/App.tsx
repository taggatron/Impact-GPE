import { useState, useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import * as THREE from 'three';
import './App.css';
import React from 'react';

// Earth sphere with a crater (hemisphere subtraction illusion)
function EarthWithCrater({
  craterDepth,
  craterRadius,
  showCrater,
  craterDepthLinear,
  craterRadiusLinear,
  fitType,
}: {
  craterDepth: number;
  craterRadius: number;
  showCrater: boolean;
  craterDepthLinear: number;
  craterRadiusLinear: number;
  fitType: 'power' | 'linear';
}) {
  const earthRadius = 2;
  // Use Earth's real diameter for clamping
  // Earth's actual diameter in meters: 12742 km = 12,742,000 m
  // In our scene, earthRadius = 2, so 1 unit = 6371 km = 6,371,000 m
  // We'll set the max to 4x the real diameter in scene units
  const earthDiameterMeters = 12742000;
  const sceneUnitToMeters = earthDiameterMeters / (2 * earthRadius); // 1 scene unit = 3,185,500 m
  const maxCrater = (earthDiameterMeters * 10) / sceneUnitToMeters; // 4x diameter in scene units
  // Power law crater
  const depthPower = Math.max(0.01, Math.min(craterDepth / 100, maxCrater));
  const radiusPower = Math.max(0.01, Math.min(craterRadius, maxCrater));
  // Linear crater
  const depthLinear = Math.max(0.01, Math.min(craterDepthLinear / 100, maxCrater));
  const radiusLinear = Math.max(0.01, Math.min(craterRadiusLinear, maxCrater));

  // Double-ended arrow for Earth's diameter (to the left of the sphere)
  function Arrow({ start, end, color }: { start: [number, number, number]; end: [number, number, number]; color: string }) {
    const dir = new THREE.Vector3(end[0] - start[0], end[1] - start[1], end[2] - start[2]);
    const length = dir.length();
    dir.normalize();
    const arrowPos: [number, number, number] = [
      (start[0] + end[0]) / 2,
      (start[1] + end[1]) / 2,
      (start[2] + end[2]) / 2,
    ];
    // Quaternion for orientation
    const quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    return (
      <group position={arrowPos} quaternion={quaternion as any}>
        {/* Shaft */}
        <mesh>
          <cylinderGeometry args={[0.025, 0.025, length - 0.3, 16]} />
          <meshStandardMaterial color={color} />
        </mesh>
        {/* Arrowhead bottom */}
        <mesh position={[0, -(length / 2), 0]}>
          <coneGeometry args={[0.07, 0.15, 16]} />
          <meshStandardMaterial color={color} />
        </mesh>
        {/* Arrowhead top */}
        <mesh position={[0, length / 2, 0]} rotation={[0, 0, Math.PI]}>
          <coneGeometry args={[0.07, 0.15, 16]} />
          <meshStandardMaterial color={color} />
        </mesh>
      </group>
    );
  }

  // Power law hemisphere
  const fullHemisphereGeometryPower = useMemo(() => {
    const geo = new THREE.SphereGeometry(radiusPower, 64, 64, 0, 2 * Math.PI, 0, Math.PI / 1);
    geo.rotateX(Math.PI);
    geo.translate(0, earthRadius - depthPower, 0);
    return geo;
  }, [radiusPower, depthPower]);

  // Linear hemisphere
  const fullHemisphereGeometryLinear = useMemo(() => {
    const scaleRad = depthLinear/50
    const geo = new THREE.SphereGeometry(scaleRad, 64, 64, 0, 2 * Math.PI, 0, Math.PI / 1);
    geo.rotateX(Math.PI);
    geo.translate(0, earthRadius - scaleRad, 0);
    return geo;
  }, [radiusLinear, depthLinear]);

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
  }, [radiusPower, depthPower, radiusLinear, depthLinear]);

  return (
    <group>
      {/* Double-ended arrow and label for Earth's diameter */}
      <group>
        <Arrow
          start={[-2.7, -earthRadius, 0]}
          end={[-2.7, earthRadius, 0]}
          color="#ffb347"
        />
        <Text
          position={[-3.85, 0, 0]}
          fontSize={0.75}
          color="#ffb347"
          anchorX="center"
          anchorY="middle"
          outlineColor="#000"
          outlineWidth={0.02}
          rotation={[0, 0, Math.PI / 2]}
        >
          {`Earth diameter: 12,742 km`}
        </Text>
      </group>
      {/* Earth sphere with translucency */}
      <mesh castShadow receiveShadow>
        <sphereGeometry args={[earthRadius, 64, 64]} />
        <meshPhysicalMaterial color="#2a7fff" transparent opacity={0.5} roughness={0.3} metalness={0.1} transmission={0.7} thickness={0.5} />
      </mesh>
      {/* Crater (hemisphere, clipped to earth) */}
      {showCrater && fitType === 'power' && (
        <mesh geometry={fullHemisphereGeometryPower}>
          <meshStandardMaterial ref={craterMatRef} color="#222" roughness={1} metalness={0} side={THREE.DoubleSide} />
        </mesh>
      )}
      {showCrater && fitType === 'linear' && (
        <mesh geometry={fullHemisphereGeometryLinear}>
          <meshStandardMaterial ref={craterMatRef} color="#a0522d" roughness={1} metalness={0} side={THREE.DoubleSide} />
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

// Power law fit for crater radius based on height/depth data
function extrapolateRadius(data: { height: number; depth: number }[], targetHeight: number) {
  if (data.length < 2) return 0.7; // fallback
  // Assume radius is proportional to (depth^a * height^b), fit log-log
  // We'll use a simple model: radius = k * (depth^0.5)
  // Fit k using the data
  const radii = data.map(({ depth }) => Math.sqrt(depth));
  const avgK = radii.reduce((a, b) => a + b, 0) / radii.length;
  // Extrapolate using the predicted depth at targetHeight
  const predictedDepth = extrapolateDepth(data, targetHeight);
  return Math.max(0.2, avgK * Math.sqrt(predictedDepth));
}

function extrapolateDepthLinear(data: { height: number; depth: number }[], targetHeight: number) {
  if (data.length < 2) return 0;
  // Linear regression: depth = a * height + b
  const n = data.length;
  const sumX = data.reduce((a, b) => a + b.height, 0);
  const sumY = data.reduce((a, b) => a + b.depth, 0);
  const sumXX = data.reduce((a, b) => a + b.height * b.height, 0);
  const sumXY = data.reduce((a, b) => a + b.height * b.depth, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  return slope * targetHeight + intercept;
}

function extrapolateRadiusLinear(data: { height: number; depth: number }[], targetHeight: number) {
  if (data.length < 2) return 0.7;
  // Use the linear predicted depth
  const predictedDepth = extrapolateDepthLinear(data, targetHeight);
  // Use the same scaling as power, but with linear depth
  const radii = data.map(({ depth }) => Math.sqrt(depth));
  const avgK = radii.reduce((a, b) => a + b, 0) / radii.length;
  return Math.max(0.2, avgK * Math.sqrt(predictedDepth));
}

// --- Popup Chart Modal ---
function ExtrapolationChartModal({
  open,
  onClose,
  data,
  extrapolateDepth,
  extrapolateDepthLinear,
}: {
  open: boolean;
  onClose: () => void;
  data: { height: number; depth: number }[];
  extrapolateDepth: (data: { height: number; depth: number }[], h: number) => number;
  extrapolateDepthLinear: (data: { height: number; depth: number }[], h: number) => number;
}) {
  if (!open) return null;

  // Generate heights for plotting (linear scale)
  const tableHeights = data.map(d => d.height);
  let minH = Math.min(...tableHeights);
  let maxH = Math.max(...tableHeights);

  // Expand min/max for x axis (so points aren't at the very edge)
  if (minH === maxH) {
    minH -= 1;
    maxH += 1;
  } else {
    const padH = (maxH - minH) * 0.15;
    minH -= padH;
    maxH += padH;
    if (minH < 0) minH = 0;
  }

  // Generate heights for plotting (linear scale) using new minH/maxH
  const points = [];
  for (let i = 0; i <= 30; ++i) {
    const h = minH + (maxH - minH) * (i / 30);
    points.push({
      h,
      power: extrapolateDepth(data, h),
      linear: extrapolateDepthLinear(data, h),
    });
  }

  // Find min/max depth from table values only
  const tableDepths = data.map(d => d.depth);
  let minDepth = Math.min(...tableDepths);
  let maxDepth = Math.max(...tableDepths);

  // Expand min/max a bit for padding (so points aren't at the very edge)
  if (minDepth === maxDepth) {
    minDepth -= 1;
    maxDepth += 1;
  } else {
    const pad = (maxDepth - minDepth) * 0.15;
    minDepth -= pad;
    maxDepth += pad;
    if (minDepth < 0) minDepth = 0;
  }

  // SVG chart dimensions
  const width = 500, height = 320, pad = 50;
  const xScale = (h: number) =>
    pad + ((h - minH) / (maxH - minH)) * (width - 2 * pad);
  const yScale = (d: number) =>
    height - pad - ((d - minDepth) / (maxDepth - minDepth)) * (height - 2 * pad);

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{ background: '#fff', borderRadius: 8, padding: 24, minWidth: 540, boxShadow: '0 2px 16px #0005', position: 'relative' }}>
        {/* Close button in top right */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            right: 12,
            top: 12,
            fontSize: 24,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#222',
            fontWeight: 'bold',
            lineHeight: 1,
          }}
          aria-label="Close"
        >×</button>
        <h3 style={{ marginTop: 0, color: '#000' }}>Extrapolated Depth vs Height</h3>
        <svg width={width} height={height} style={{ background: '#f8f8f8', borderRadius: 6 }}>
          {/* Axes */}
          <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="#888" />
          <line x1={pad} y1={pad} x2={pad} y2={height - pad} stroke="#888" />
          {/* Axis labels */}
          <text x={width / 2} y={height - 10} textAnchor="middle" fontSize={14}>Height (m)</text>
          <text x={-20} y={pad -50} textAnchor="start" fontSize={14} transform={`rotate(-90,90,${pad + 10})`}>Depth (cm)</text>
          {/* Data points (table values only) */}
          {data.map((d, i) => (
            <circle key={i} cx={xScale(d.height)} cy={yScale(d.depth)} r={4} fill="#222" />
          ))}
          {/* Power law (curved) line */}
          <polyline
            fill="none"
            stroke="#2a7fff"
            strokeWidth={2}
            points={points.map(p => `${xScale(p.h)},${yScale(p.power)}`).join(' ')}
          />
          {/* Linear law line */}
          <polyline
            fill="none"
            stroke="#ffb347"
            strokeWidth={2}
            points={points.map(p => `${xScale(p.h)},${yScale(p.linear)}`).join(' ')}
          />
          {/* Legend */}
          <rect x={width - pad - 300} y={pad} width={110} height={60} fill="#fff" stroke="#ccc" />
          <circle cx={width - pad - 290} cy={pad + 16} r={4} fill="#222" />
          <text x={width - pad - 280} y={pad + 20} fontSize={13}>Data</text>
          <line x1={width - pad - 290} y1={pad + 30} x2={width - pad - 270} y2={pad + 30} stroke="#2a7fff" strokeWidth={3} />
          <text x={width - pad - 265} y={pad + 34} fontSize={13}>Curved</text>
          <line x1={width - pad - 290} y1={pad + 42} x2={width - pad - 270} y2={pad + 42} stroke="#ffb347" strokeWidth={3} />
          <text x={width - pad - 265} y={pad + 46} fontSize={13}>Linear</text>
        </svg>
        <div style={{ fontSize: 13, color: '#666', marginTop: 8 }}>
          <b>Note:</b> Blue = curved line fit, orange = linear fit, black dots = your data.
        </div>
        {/* Optional close button at bottom for accessibility */}
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button
            onClick={onClose}
            style={{
              background: '#a0522d',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              padding: '0.4rem 1.2rem',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontSize: 16,
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [data, setData] = useState([
    { height: 0.2, depth: 0.2 },
    { height: 0.4, depth: 0.8 },
  ]);
  const [newRow, setNewRow] = useState({ height: '', depth: '' });
  const [animate, setAnimate] = useState(false);
  const [showCrater, setShowCrater] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [fitType, setFitType] = useState<'power' | 'linear'>('power');
  const [showChart, setShowChart] = useState(false);
  const atmosphereHeight = 100000; // meters (100 km)

  // Choose extrapolation method
  const extrapolated =
    fitType === 'power'
      ? extrapolateDepth(data, atmosphereHeight)
      : extrapolateDepthLinear(data, atmosphereHeight);

  const craterRadius =
    fitType === 'power'
      ? extrapolateRadius(data, atmosphereHeight)
      : extrapolateRadiusLinear(data, atmosphereHeight);

  // Always compute both for visualization
  const extrapolatedPower = extrapolateDepth(data, atmosphereHeight);
  const craterRadiusPower = extrapolateRadius(data, atmosphereHeight);
  const extrapolatedLinear = extrapolateDepthLinear(data, atmosphereHeight);
  const craterRadiusLinear = extrapolateRadiusLinear(data, atmosphereHeight);

  return (
    <div className="container">
      <h1>Émilie du Châtelet Impact Extrapolator</h1>
      <p>Input your experimental data below (height in meters, depth in cm):</p>
      {/* Fit type toggle buttons */}
      <div style={{ marginBottom: 16 }}>
        <button
          onClick={() => setFitType('power')}
          style={{
            background: fitType === 'power' ? '#ffb347' : '#a0522d',
            color: fitType === 'power' ? '#222' : '#fff',
            fontWeight: fitType === 'power' ? 'bold' : 'normal',
            marginRight: 8,
            border: 'none',
            borderRadius: 4,
            padding: '0.4rem 1rem',
            cursor: 'pointer',
          }}
        >
          Curved Line
        </button>
        <button
          onClick={() => setFitType('linear')}
          style={{
            background: fitType === 'linear' ? '#ffb347' : '#a0522d',
            color: fitType === 'linear' ? '#222' : '#fff',
            fontWeight: fitType === 'linear' ? 'bold' : 'normal',
            border: 'none',
            borderRadius: 4,
            padding: '0.4rem 1rem',
            cursor: 'pointer',
          }}
        >
          Straight Line
        </button>
      </div>
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
              <td>
                <input
                  type="number"
                  value={row.height}
                  onChange={e => {
                    const newData = [...data];
                    newData[i] = { ...newData[i], height: Number(e.target.value) };
                    setData(newData);
                  }}
                  min="0.01"
                  step="any"
                  style={{ width: 80 }}
                />
              </td>
              <td>
                <input
                  type="number"
                  value={row.depth}
                  onChange={e => {
                    const newData = [...data];
                    newData[i] = { ...newData[i], depth: Number(e.target.value) };
                    setData(newData);
                  }}
                  min="0.01"
                  step="any"
                  style={{ width: 80 }}
                />
              </td>
              <td>
                <button onClick={() => setData(data.filter((_, j) => j !== i))} style={{ background: '#a00' }}>
                  Delete
                </button>
              </td>
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
      <div style={{ margin: '16px 0' }}>
        <button
          onClick={() => setShowChart(true)}
          style={{
            background: '#2a7fff',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            padding: '0.4rem 1.2rem',
            fontWeight: 'bold',
            cursor: 'pointer',
            fontSize: 16,
          }}
        >
          Show Extrapolation Plot
        </button>
      </div>
      <h2>Extrapolated Impact from Edge of Atmosphere (100 km)</h2>
      <p>
        Estimated crater depth: <b>{(extrapolated / 100000).toFixed(3)} km</b>
      </p>
      <div style={{ width: '100%', maxWidth: 600, height: 400, margin: 'auto', background: '#222', borderRadius: 8 }}>
        <Canvas camera={{ position: [0, 6, 24], fov: 50 }} shadows>
          <ambientLight intensity={0.7} />
          <directionalLight position={[5, 10, 7]} intensity={1} castShadow />
          <EarthWithCrater
            craterDepth={extrapolatedPower}
            craterRadius={craterRadiusPower}
            craterDepthLinear={extrapolatedLinear}
            craterRadiusLinear={craterRadiusLinear}
            showCrater={showCrater}
            fitType={fitType}
          />
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
      <ExtrapolationChartModal
        open={showChart}
        onClose={() => setShowChart(false)}
        data={data}
        extrapolateDepth={extrapolateDepth}
        extrapolateDepthLinear={extrapolateDepthLinear}
      />
      <p style={{ fontSize: '0.9em', color: '#888', marginTop: 80 }}>
        This extrapolation uses a power law fit to your data. For demonstration only.
      </p>
    </div>
  );
}

export default App;
