import { useState, useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, Stars, Trail } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import './App.css';

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
  const earthDiameterMeters = 12742000;
  const sceneUnitToMeters = earthDiameterMeters / (2 * earthRadius);
  const maxCrater = (earthDiameterMeters * 10) / sceneUnitToMeters;
  
  const depthPower = Math.max(0.01, Math.min(craterDepth / 100, maxCrater));
  const radiusPower = Math.max(0.01, Math.min(craterRadius, maxCrater));
  const depthLinear = Math.max(0.01, Math.min(craterDepthLinear / 100, maxCrater));
  const radiusLinear = Math.max(0.01, Math.min(craterRadiusLinear, maxCrater));

  function Arrow({ start, end, color }: { start: [number, number, number]; end: [number, number, number]; color: string }) {
    const dir = new THREE.Vector3(end[0] - start[0], end[1] - start[1], end[2] - start[2]);
    const length = dir.length();
    dir.normalize();
    const arrowPos: [number, number, number] = [
      (start[0] + end[0]) / 2,
      (start[1] + end[1]) / 2,
      (start[2] + end[2]) / 2,
    ];
    const quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    return (
      <group position={arrowPos} quaternion={quaternion as any}>
        <mesh>
          <cylinderGeometry args={[0.015, 0.015, length - 0.3, 16]} />
          <meshBasicMaterial color={color} />
        </mesh>
        <mesh position={[0, -(length / 2), 0]}>
          <coneGeometry args={[0.06, 0.15, 16]} />
          <meshBasicMaterial color={color} />
        </mesh>
        <mesh position={[0, length / 2, 0]} rotation={[0, 0, Math.PI]}>
          <coneGeometry args={[0.06, 0.15, 16]} />
          <meshBasicMaterial color={color} />
        </mesh>
      </group>
    );
  }

  const fullHemisphereGeometryPower = useMemo(() => {
    const geo = new THREE.SphereGeometry(radiusPower, 64, 64, 0, 2 * Math.PI, 0, Math.PI / 1);
    geo.rotateX(Math.PI);
    geo.translate(0, earthRadius - depthPower, 0);
    return geo;
  }, [radiusPower, depthPower]);

  const fullHemisphereGeometryLinear = useMemo(() => {
    const scaleRad = depthLinear / 50;
    const geo = new THREE.SphereGeometry(scaleRad, 64, 64, 0, 2 * Math.PI, 0, Math.PI / 1);
    geo.rotateX(Math.PI);
    geo.translate(0, earthRadius - scaleRad, 0);
    return geo;
  }, [radiusLinear, depthLinear]);

  const craterMatPowerRef = useRef<any>(null);
  const craterMatLinearRef = useRef<any>(null);

  useEffect(() => {
    const applyShader = (matRef: any) => {
      if (matRef.current) {
        matRef.current.onBeforeCompile = (shader: any) => {
          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <clipping_planes_fragment>',
            `#include <clipping_planes_fragment>
            vec3 worldPos = (modelMatrix * vec4(position, 1.0)).xyz;
            if (length(worldPos) > ${earthRadius.toFixed(2)} + 0.001) discard;`
          );
        };
        matRef.current.needsUpdate = true;
      }
    };
    
    applyShader(craterMatPowerRef);
    applyShader(craterMatLinearRef);
  }, [radiusPower, depthPower, radiusLinear, depthLinear, showCrater, fitType]);

  return (
    <group>
      <group>
        <Arrow start={[-2.7, -earthRadius, 0]} end={[-2.7, earthRadius, 0]} color="#38bdf8" />
        <Text
          position={[-2.9, 0, 0]}
          fontSize={0.25}
          color="#38bdf8"
          anchorX="center"
          anchorY="middle"
          rotation={[0, 0, Math.PI / 2]}
        >
          {`Earth diameter: 12,742 km`}
        </Text>
      </group>
      
      {/* Earth Base */}
      <mesh castShadow receiveShadow>
        <sphereGeometry args={[earthRadius, 64, 64]} />
        <meshPhysicalMaterial 
          color="#0ea5e9"
          roughness={0.6}
          metalness={0.1}
          clearcoat={0.3}
          clearcoatRoughness={0.2}
        />
      </mesh>
      
      {/* Atmosphere Glow */}
      <mesh>
        <sphereGeometry args={[earthRadius * 1.03, 64, 64]} />
        <meshPhysicalMaterial 
          color="#7dd3fc"
          transparent
          opacity={0.15}
          roughness={0}
          transmission={0.8}
          thickness={1}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Crater (Always rendered to ensure shader compilation, but visibility toggled) */}
      <mesh geometry={fullHemisphereGeometryPower} visible={showCrater && fitType === 'power'}>
        <meshStandardMaterial 
          ref={craterMatPowerRef} 
          color="#222" 
          emissive="#ef4444"
          emissiveIntensity={2}
          roughness={0.8} 
          side={THREE.DoubleSide} 
        />
      </mesh>
      
      <mesh geometry={fullHemisphereGeometryLinear} visible={showCrater && fitType === 'linear'}>
        <meshStandardMaterial 
          ref={craterMatLinearRef} 
          color="#222"
          emissive="#f59e0b"
          emissiveIntensity={2}
          roughness={0.8} 
          side={THREE.DoubleSide} 
        />
      </mesh>>
    </group>
  );
}

function Meteor({ animate, onImpact, resetKey }: { animate: boolean; onImpact: () => void; resetKey: number }) {
  const ref = useRef<THREE.Group>(null);
  const meteorMesh = useRef<THREE.Mesh>(null);
  const [impact, setImpact] = useState(false);

  useEffect(() => {
    setImpact(false);
    if (ref.current) {
      ref.current.position.set(2, 10, 0); // Start off-center
    }
  }, [resetKey]);

  useFrame((_, delta) => {
    if (!animate || impact) return;
    if (ref.current && meteorMesh.current) {
      const target = new THREE.Vector3(0, 2, 0);
      const direction = new THREE.Vector3().subVectors(target, ref.current.position).normalize();
      
      // Move meteor towards target
      ref.current.position.add(direction.multiplyScalar(delta * 12));
      meteorMesh.current.rotation.x += delta * 5;
      meteorMesh.current.rotation.y += delta * 5;

      if (ref.current.position.length() <= 2.1) {
        setImpact(true);
        onImpact();
      }
    }
  });

  return (
    <group ref={ref} visible={!impact}>
      <Trail
        width={1.5}
        color={new THREE.Color('#fca5a5')}
        length={15}
        decay={1.2}
        local={false}
        stride={0}
        interval={1}
      >
        <mesh ref={meteorMesh} castShadow>
          <sphereGeometry args={[0.2, 16, 16]} />
          <meshStandardMaterial 
            color="#444" 
            emissive="#ef4444" 
            emissiveIntensity={4} 
            roughness={0.4} 
          />
        </mesh>
      </Trail>
      <pointLight color="#ef4444" intensity={5} distance={10} />
    </group>
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

function extrapolateRadius(data: { height: number; depth: number }[], targetHeight: number) {
  if (data.length < 2) return 0.7; 
  const radii = data.map(({ depth }) => Math.sqrt(depth));
  const avgK = radii.reduce((a, b) => a + b, 0) / radii.length;
  const predictedDepth = extrapolateDepth(data, targetHeight);
  return Math.max(0.2, avgK * Math.sqrt(predictedDepth));
}

function extrapolateDepthLinear(data: { height: number; depth: number }[], targetHeight: number) {
  if (data.length < 2) return 0;
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
  const predictedDepth = extrapolateDepthLinear(data, targetHeight);
  const radii = data.map(({ depth }) => Math.sqrt(depth));
  const avgK = radii.reduce((a, b) => a + b, 0) / radii.length;
  return Math.max(0.2, avgK * Math.sqrt(predictedDepth));
}

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

  const tableHeights = data.map(d => d.height);
  let minH = Math.min(...tableHeights);
  let maxH = Math.max(...tableHeights);

  if (minH === maxH) {
    minH -= 1;
    maxH += 1;
  } else {
    const padH = (maxH - minH) * 0.15;
    minH -= padH;
    maxH += padH;
    if (minH < 0) minH = 0;
  }

  const points = [];
  for (let i = 0; i <= 30; ++i) {
    const h = minH + (maxH - minH) * (i / 30);
    points.push({
      h,
      power: extrapolateDepth(data, h),
      linear: extrapolateDepthLinear(data, h),
    });
  }

  const tableDepths = data.map(d => d.depth);
  let minDepth = Math.min(...tableDepths);
  let maxDepth = Math.max(...tableDepths);

  if (minDepth === maxDepth) {
    minDepth -= 1;
    maxDepth += 1;
  } else {
    const pad = (maxDepth - minDepth) * 0.15;
    minDepth -= pad;
    maxDepth += pad;
    if (minDepth < 0) minDepth = 0;
  }

  const width = 500, height = 320, pad = 50;
  const xScale = (h: number) => pad + ((h - minH) / (maxH - minH)) * (width - 2 * pad);
  const yScale = (d: number) => height - pad - ((d - minDepth) / (maxDepth - minDepth)) * (height - 2 * pad);

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <button onClick={onClose} className="close-btn" aria-label="Close">✕</button>
        <h3>Extrapolated Details Mode</h3>
        
        <svg width={width} height={height}>
          <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="rgba(255,255,255,0.2)" />
          <line x1={pad} y1={pad} x2={pad} y2={height - pad} stroke="rgba(255,255,255,0.2)" />
          <text x={width / 2} y={height - 10} fill="#94a3b8" textAnchor="middle" fontSize={13}>Height (m)</text>
          <text x={-20} y={pad - 50} fill="#94a3b8" textAnchor="start" fontSize={13} transform={`rotate(-90,90,${pad + 10})`}>Depth (cm)</text>
          
          {data.map((d, i) => (
            <circle key={i} cx={xScale(d.height)} cy={yScale(d.depth)} r={4} fill="#e2e8f0" />
          ))}
          
          <polyline fill="none" stroke="#38bdf8" strokeWidth={2}
            points={points.map(p => `${xScale(p.h)},${yScale(p.power)}`).join(' ')} />
            
          <polyline fill="none" stroke="#f472b6" strokeWidth={2}
            points={points.map(p => `${xScale(p.h)},${yScale(p.linear)}`).join(' ')} />
            
          <rect x={width - pad - 120} y={pad} width={110} height={70} fill="rgba(15,23,42,0.8)" rx={6} stroke="rgba(255,255,255,0.1)" />
          <circle cx={width - pad - 105} cy={pad + 18} r={4} fill="#e2e8f0" />
          <text x={width - pad - 95} y={pad + 22} fill="#e2e8f0" fontSize={12}>Data</text>
          <line x1={width - pad - 110} y1={pad + 38} x2={width - pad - 95} y2={pad + 38} stroke="#38bdf8" strokeWidth={3} />
          <text x={width - pad - 85} y={pad + 42} fill="#e2e8f0" fontSize={12}>Curved</text>
          <line x1={width - pad - 110} y1={pad + 54} x2={width - pad - 95} y2={pad + 54} stroke="#f472b6" strokeWidth={3} />
          <text x={width - pad - 85} y={pad + 58} fill="#e2e8f0" fontSize={12}>Linear</text>
        </svg>
        
        <div style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: '1rem', textAlign: 'center' }}>
          Compare the mathematical models predicting the crater.
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
  
  const atmosphereHeight = 100000;

  const extrapolated = fitType === 'power'
    ? extrapolateDepth(data, atmosphereHeight)
    : extrapolateDepthLinear(data, atmosphereHeight);

  const extrapolatedPower = extrapolateDepth(data, atmosphereHeight);
  const craterRadiusPower = extrapolateRadius(data, atmosphereHeight);
  const extrapolatedLinear = extrapolateDepthLinear(data, atmosphereHeight);
  const craterRadiusLinear = extrapolateRadiusLinear(data, atmosphereHeight);

  return (
    <div className="container">
      <h1>Impact Extrapolator</h1>
      <p className="subtitle">Simulate & Extrapolate From Experimental Data</p>
      
      <div className="toggle-group">
        <button
          className={`toggle-btn ${fitType === 'power' ? 'active' : ''}`}
          onClick={() => setFitType('power')}
        >
          Curved Law (Realistic)
        </button>
        <button
          className={`toggle-btn ${fitType === 'linear' ? 'active' : ''}`}
          onClick={() => setFitType('linear')}
        >
          Linear Law
        </button>
      </div>
      
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Drop Height (m)</th>
              <th>Crater Depth (cm)</th>
              <th>Actions</th>
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
                  />
                </td>
                <td>
                  <button className="btn btn-danger" onClick={() => setData(data.filter((_, j) => j !== i))}>
                    Remove
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
                  placeholder="e.g. 1.5"
                  min="0.01"
                  step="any"
                />
              </td>
              <td>
                <input
                  type="number"
                  value={newRow.depth}
                  onChange={e => setNewRow({ ...newRow, depth: e.target.value })}
                  placeholder="e.g. 2.1"
                  min="0.01"
                  step="any"
                />
              </td>
              <td>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    if (Number(newRow.height) > 0 && Number(newRow.depth) > 0) {
                      setData([...data, { height: Number(newRow.height), depth: Number(newRow.depth) }]);
                      setNewRow({ height: '', depth: '' });
                    }
                  }}
                >
                  Add Data
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <button className="btn btn-large" onClick={() => setShowChart(true)}>
        Show Extrapolation Plot
      </button>
      
      <div className="sim-container">
        <h2>Atmospheric Drop Simulation (100km)</h2>
        <div className="sim-result">
          Estimated theoretical crater depth: <b>{(extrapolated / 100000).toFixed(3)} km</b>
        </div>
        
        <div className="canvas-wrapper">
          <Canvas camera={{ position: [0, 6, 12], fov: 55 }} shadows dpr={[1, 2]}>
            <color attach="background" args={['#050814']} />
            <fog attach="fog" args={['#050814', 10, 40]} />
            
            <ambientLight intensity={0.2} />
            <directionalLight position={[10, 10, 10]} intensity={2} color="#ffffff" castShadow />
            <directionalLight position={[-10, 10, -10]} intensity={0.5} color="#38bdf8" />
            
            <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
            
            <EarthWithCrater
              craterDepth={extrapolatedPower}
              craterRadius={craterRadiusPower}
              craterDepthLinear={extrapolatedLinear}
              craterRadiusLinear={craterRadiusLinear}
              showCrater={showCrater}
              fitType={fitType}
            />
            
            <Meteor animate={animate && !showCrater} onImpact={() => setShowCrater(true)} resetKey={resetKey} />
            
            <OrbitControls 
              enablePan={false} 
              enableZoom 
              enableRotate 
              minDistance={3}
              maxDistance={25}
              maxPolarAngle={Math.PI / 1.5}
            />
            
            <EffectComposer>
              <Bloom mipmapBlur intensity={1.2} luminanceThreshold={0.2} radius={0.8} />
            </EffectComposer>
          </Canvas>
        </div>
        
        <div className="canvas-controls">
          <button onClick={() => { setAnimate(false); setShowCrater(false); setTimeout(() => setAnimate(true), 100); }}>
            Launch Meteor
          </button>
          <button onClick={() => { setAnimate(false); setShowCrater(false); setResetKey(k => k + 1); }}>
            Reset Earth
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
    </div>
  );
}

export default App;
