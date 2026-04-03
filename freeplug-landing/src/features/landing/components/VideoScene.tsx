'use client'

import { Canvas, useFrame } from '@react-three/fiber'
import { Suspense, useRef, useEffect, useState, useMemo } from 'react'
import * as THREE from 'three'

function FloatingParticles() {
  const particlesRef = useRef<THREE.Points>(null)
  const count = 60

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 20
      positions[i * 3 + 1] = (Math.random() - 0.5) * 12
      positions[i * 3 + 2] = (Math.random() - 0.5) * 5 - 2
      
      const isAccent = Math.random() > 0.75
      colors[i * 3] = isAccent ? 0.73 : 0.92
      colors[i * 3 + 1] = isAccent ? 0.24 : 0.92
      colors[i * 3 + 2] = isAccent ? 0.24 : 0.95
    }
    
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return geo
  }, [])

  useFrame((state) => {
    if (!particlesRef.current) return
    particlesRef.current.rotation.y = state.clock.elapsedTime * 0.015
    particlesRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.03) * 0.02
  })

  return (
    <points ref={particlesRef} geometry={geometry}>
      <pointsMaterial
        size={0.05}
        vertexColors
        transparent
        opacity={0.4}
        sizeAttenuation
      />
    </points>
  )
}

function GlowOrbs() {
  const orb1Ref = useRef<THREE.Mesh>(null)
  const orb2Ref = useRef<THREE.Mesh>(null)
  
  useFrame((state) => {
    if (orb1Ref.current) {
      orb1Ref.current.position.x = Math.sin(state.clock.elapsedTime * 0.25) * 3 - 4
      orb1Ref.current.position.y = Math.cos(state.clock.elapsedTime * 0.3) * 2 + 1
    }
    if (orb2Ref.current) {
      orb2Ref.current.position.x = Math.cos(state.clock.elapsedTime * 0.2) * 3 + 4
      orb2Ref.current.position.y = Math.sin(state.clock.elapsedTime * 0.25) * 2 - 1
    }
  })

  return (
    <>
      <mesh ref={orb1Ref} position={[-4, 1, -3]}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial color="#ba3d3d" transparent opacity={0.1} />
      </mesh>
      <mesh ref={orb2Ref} position={[4, -1, -3]}>
        <sphereGeometry args={[1.2, 32, 32]} />
        <meshBasicMaterial color="#8a2e2e" transparent opacity={0.08} />
      </mesh>
    </>
  )
}

function Scene() {
  return (
    <>
      <ambientLight intensity={1} />
      <Suspense fallback={null}>
        <FloatingParticles />
        <GlowOrbs />
      </Suspense>
    </>
  )
}

export function VideoScene() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return (
    <div className="absolute inset-0 -z-10 pointer-events-none">
      <Canvas
        gl={{ antialias: true, alpha: true }}
        camera={{ position: [0, 0, 10], fov: 50 }}
        style={{ background: 'transparent' }}
      >
        <Scene />
      </Canvas>
    </div>
  )
}
