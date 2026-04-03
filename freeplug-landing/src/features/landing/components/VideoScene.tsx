'use client'

import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useVideoTexture } from '@react-three/drei'
import { Suspense, useRef, useEffect, useState, useMemo } from 'react'
import * as THREE from 'three'

function VideoCharacter() {
  const meshRef = useRef<THREE.Mesh>(null)
  const materialRef = useRef<THREE.MeshBasicMaterial>(null)
  const { viewport } = useThree()
  const [scrollY, setScrollY] = useState(0)

  const texture = useVideoTexture('/hero-video.mp4', {
    muted: true,
    loop: true,
    start: true,
  })

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useFrame((state) => {
    if (!meshRef.current || !materialRef.current) return
    
    const scrollProgress = Math.min(scrollY / 600, 1)
    
    // Gentle float animation
    meshRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.1 - scrollProgress * 2
    
    // Scale down on scroll
    const scale = 1 - scrollProgress * 0.3
    meshRef.current.scale.setScalar(scale)
    
    // Fade on scroll
    materialRef.current.opacity = 1 - scrollProgress * 0.8
  })

  // Size the video plane
  const height = Math.min(viewport.height * 0.8, 8)
  const width = height * (16 / 9)
  
  // Position on the right side
  const xPos = viewport.width * 0.22

  return (
    <mesh ref={meshRef} position={[xPos, 0, 0]}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial
        ref={materialRef}
        map={texture}
        transparent
        opacity={1}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

function FloatingParticles() {
  const particlesRef = useRef<THREE.Points>(null)
  const count = 50

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 20
      positions[i * 3 + 1] = (Math.random() - 0.5) * 12
      positions[i * 3 + 2] = (Math.random() - 0.5) * 5 - 2
      
      const isAccent = Math.random() > 0.8
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
    particlesRef.current.rotation.y = state.clock.elapsedTime * 0.01
  })

  return (
    <points ref={particlesRef} geometry={geometry}>
      <pointsMaterial
        size={0.04}
        vertexColors
        transparent
        opacity={0.3}
        sizeAttenuation
      />
    </points>
  )
}

function Scene() {
  return (
    <>
      <ambientLight intensity={1} />
      <Suspense fallback={null}>
        <VideoCharacter />
        <FloatingParticles />
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
    <div className="absolute inset-0 z-5 pointer-events-none">
      <Canvas
        gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
        camera={{ position: [0, 0, 10], fov: 50 }}
        style={{ background: 'transparent' }}
      >
        <Scene />
      </Canvas>
    </div>
  )
}
