'use client'

import { Canvas, useFrame } from '@react-three/fiber'
import { Suspense, useRef, useEffect, useState, useMemo } from 'react'
import * as THREE from 'three'

function FloatingParticles() {
  const particlesRef = useRef<THREE.Points>(null)
  const count = 80

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 25
      positions[i * 3 + 1] = (Math.random() - 0.5) * 15
      positions[i * 3 + 2] = (Math.random() - 0.5) * 8 - 2
      
      const isRed = Math.random() > 0.7
      colors[i * 3] = isRed ? 0.73 : 1.0
      colors[i * 3 + 1] = isRed ? 0.24 : 1.0
      colors[i * 3 + 2] = isRed ? 0.24 : 1.0
    }
    
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return geo
  }, [])

  useFrame((state) => {
    if (!particlesRef.current) return
    particlesRef.current.rotation.y = state.clock.elapsedTime * 0.02
    particlesRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.05) * 0.05
  })

  return (
    <points ref={particlesRef} geometry={geometry}>
      <pointsMaterial
        size={0.06}
        vertexColors
        transparent
        opacity={0.5}
        sizeAttenuation
      />
    </points>
  )
}

function GlowOrbs() {
  const orb1Ref = useRef<THREE.Mesh>(null)
  const orb2Ref = useRef<THREE.Mesh>(null)
  const orb3Ref = useRef<THREE.Mesh>(null)
  
  useFrame((state) => {
    if (orb1Ref.current) {
      orb1Ref.current.position.x = Math.sin(state.clock.elapsedTime * 0.3) * 3 - 5
      orb1Ref.current.position.y = Math.cos(state.clock.elapsedTime * 0.4) * 2 + 1
    }
    if (orb2Ref.current) {
      orb2Ref.current.position.x = Math.cos(state.clock.elapsedTime * 0.25) * 3 + 5
      orb2Ref.current.position.y = Math.sin(state.clock.elapsedTime * 0.35) * 2 - 1
    }
    if (orb3Ref.current) {
      orb3Ref.current.position.x = Math.sin(state.clock.elapsedTime * 0.2) * 2
      orb3Ref.current.position.y = Math.cos(state.clock.elapsedTime * 0.3) * 1.5 - 2
    }
  })

  return (
    <>
      <mesh ref={orb1Ref} position={[-5, 1, -3]}>
        <sphereGeometry args={[1.2, 32, 32]} />
        <meshBasicMaterial color="#ba3d3d" transparent opacity={0.12} />
      </mesh>
      <mesh ref={orb2Ref} position={[5, -1, -3]}>
        <sphereGeometry args={[1.5, 32, 32]} />
        <meshBasicMaterial color="#8a2e2e" transparent opacity={0.08} />
      </mesh>
      <mesh ref={orb3Ref} position={[0, -2, -4]}>
        <sphereGeometry args={[2, 32, 32]} />
        <meshBasicMaterial color="#ba3d3d" transparent opacity={0.06} />
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

  if (!mounted) {
    return null
  }

  return (
    <div className="absolute inset-0 -z-10 overflow-hidden">
      <Canvas
        gl={{ antialias: true, alpha: true }}
        camera={{ position: [0, 0, 10], fov: 50 }}
        style={{ background: 'transparent' }}
      >
        <Scene />
      </Canvas>
      
      {/* Gradient background */}
      <div 
        className="absolute inset-0 -z-20"
        style={{
          background: 'linear-gradient(135deg, #ffffff 0%, #fff5f5 25%, #ffe8e8 50%, #ffd4d4 100%)',
        }}
      />
      
      {/* Subtle grid pattern */}
      <div 
        className="absolute inset-0 -z-10 pointer-events-none opacity-30"
        style={{
          backgroundImage: `
            linear-gradient(rgba(186, 61, 61, 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(186, 61, 61, 0.05) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />
    </div>
  )
}
