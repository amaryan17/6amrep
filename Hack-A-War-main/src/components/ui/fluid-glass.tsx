/* eslint-disable react/no-unknown-property */
"use client";

import * as THREE from 'three';
import { useRef, useState, useMemo, useEffect } from 'react';
import { Canvas, createPortal, useFrame, useThree } from '@react-three/fiber';
import {
  useFBO,
  MeshTransmissionMaterial,
} from '@react-three/drei';
import { easing } from 'maath';

export function FluidGlass({ 
  mode = 'lens', 
  lensProps = {}, 
  barProps = {}, 
  cubeProps = {},
  className = "" 
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const Wrapper = mode === 'bar' ? Bar : mode === 'cube' ? Cube : Lens;
  const rawOverrides: any = mode === 'bar' ? barProps : mode === 'cube' ? cubeProps : lensProps;

  const {
    ...modeProps
  } = rawOverrides;

  return (
    <div className={`absolute inset-0 pointer-events-none ${className}`}>
      <Canvas camera={{ position: [0, 0, 20], fov: 15 }} gl={{ alpha: true }}>
        <Wrapper modeProps={modeProps}>
          {/* Abstract background for refraction */}
          <group>
            {[...Array(15)].map((_, i) => (
              <mesh key={i} position={[(i - 7) * 2, Math.sin(i) * 5, 0]}>
                <sphereGeometry args={[0.5, 32, 32]} />
                <meshBasicMaterial color={modeProps.color || "#ffffff"} opacity={0.1} transparent />
              </mesh>
            ))}
          </group>
        </Wrapper>
      </Canvas>
    </div>
  );
}

function ModeWrapper({
  children,
  type = 'sphere',
  lockToBottom = false,
  followPointer = true,
  modeProps = {},
  ...props
}: any) {
  const ref = useRef<THREE.Mesh>(null!);
  const buffer = useFBO();
  const { viewport: vp } = useThree();
  const [scene] = useState(() => new THREE.Scene());

  useFrame((state, delta) => {
    const { gl, viewport, pointer, camera } = state;
    const v = viewport.getCurrentViewport(camera, [0, 0, 15]);

    const destX = followPointer ? (pointer.x * v.width) / 2 : 0;
    const destY = lockToBottom ? -v.height / 2 + 0.2 : followPointer ? (pointer.y * v.height) / 2 : 0;
    
    if (ref.current) {
        easing.damp3(ref.current.position, [destX, destY, 15], 0.15, delta);
    }

    gl.setRenderTarget(buffer);
    gl.render(scene, camera);
    gl.setRenderTarget(null);
  });

  const { scale, ior, thickness, anisotropy, chromaticAberration, ...extraMat } = modeProps as any;

  return (
    <>
      {createPortal(children, scene)}
      <mesh scale={[vp.width, vp.height, 1]}>
        <planeGeometry />
        <meshBasicMaterial map={buffer.texture} transparent opacity={0.01} />
      </mesh>
      <mesh ref={ref} scale={scale ?? 0.15} {...props}>
        {type === 'sphere' ? (
          <sphereGeometry args={[5, 64, 64]} />
        ) : (
          <boxGeometry args={[10, 10, 10]} />
        )}
        <MeshTransmissionMaterial
          buffer={buffer.texture}
          ior={ior ?? 1.15}
          thickness={thickness ?? 2}
          anisotropy={anisotropy ?? 0.01}
          chromaticAberration={chromaticAberration ?? 0.1}
          transmission={1}
          roughness={0}
          {...extraMat}
        />
      </mesh>
    </>
  );
}

function Lens({ modeProps, ...p }: any) {
  return <ModeWrapper type="sphere" followPointer modeProps={modeProps} {...p} />;
}

function Cube({ modeProps, ...p }: any) {
  return <ModeWrapper type="box" followPointer modeProps={modeProps} {...p} />;
}

function Bar({ modeProps = {}, ...p }: any) {
  const defaultMat = {
    transmission: 1,
    roughness: 0,
    thickness: 10,
    ior: 1.15,
    color: '#ffffff',
    attenuationColor: '#ffffff',
    attenuationDistance: 0.25
  };

  return (
    <ModeWrapper
      type="box"
      lockToBottom
      followPointer={false}
      modeProps={{ ...defaultMat, ...modeProps }}
      {...p}
      scale={[0.5, 0.05, 0.1] as any}
    />
  );
}
