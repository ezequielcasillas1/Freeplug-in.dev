'use client'

import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useVideoTexture, PerspectiveCamera } from '@react-three/drei'
import { Suspense, useRef, useEffect, useState, useMemo } from 'react'
import * as THREE from 'three'

function VideoPlane() {
  const meshRef = useRef<THREE.Mesh>(null)
  const groupRef = useRef<THREE.Group>(null)
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
    if (!groupRef.current || !meshRef.current) return

    const scrollProgress = Math.min(scrollY / 500, 1)
    const scale = 1 - scrollProgress * 0.3
    const rotationX = scrollProgress * 0.2
    const posY = -scrollProgress * 2

    groupRef.current.scale.setScalar(scale)
    groupRef.current.rotation.x = rotationX
    groupRef.current.position.y = posY

    meshRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.02
  })

  const aspectRatio = 16 / 9
  const width = Math.min(viewport.width * 0.85, 12)
  const height = width / aspectRatio

  return (
    <group ref={groupRef}>
      <mesh ref={meshRef} position={[0, 0, 0]}>
        <planeGeometry args={[width, height, 32, 32]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
      
      {/* Frame/Border effect */}
      <mesh position={[0, 0, -0.05]}>
        <planeGeometry args={[width + 0.3, height + 0.3]} />
        <meshBasicMaterial color="#1a1a1a" />
      </mesh>

      {/* Glow effect behind */}
      <mesh position={[0, 0, -0.1]}>
        <planeGeometry args={[width + 1, height + 0.8]} />
        <meshBasicMaterial color="#ba3d3d" transparent opacity={0.15} />
      </mesh>
    </group>
  )
}

function FloatingParticles() {
  const particlesRef = useRef<THREE.Points>(null)
  const count = 50

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 20
      positions[i * 3 + 1] = (Math.random() - 0.5) * 12
      positions[i * 3 + 2] = (Math.random() - 0.5) * 5 - 2
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return geo
  }, [])

  useFrame((state) => {
    if (!particlesRef.current) return
    particlesRef.current.rotation.y = state.clock.elapsedTime * 0.02
    particlesRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.1) * 0.1
  })

  return (
    <points ref={particlesRef} geometry={geometry}>
      <pointsMaterial
        size={0.05}
        color="#ba3d3d"
        transparent
        opacity={0.6}
        sizeAttenuation
      />
    </points>
  )
}

function Scene() {
  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0, 8]} fov={50} />
      <ambientLight intensity={0.5} />
      <Suspense fallback={null}>
        <VideoPlane />
        <FloatingParticles />
      </Suspense>
    </>
  )
}

function LoadingFallback() {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="w-16 h-16 border-4 border-[#ba3d3d]/20 border-t-[#ba3d3d] rounded-full animate-spin" />
    </div>
  )
}

export function VideoScene() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="relative mx-auto max-w-5xl mt-12 h-[300px] sm:h-[400px] lg:h-[450px]">
        <LoadingFallback />
      </div>
    )
  }

  return (
    <div className="relative mx-auto max-w-5xl mt-12 h-[300px] sm:h-[400px] lg:h-[450px]">
      <Canvas
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        <Scene />
      </Canvas>
      
      {/* Shadow beneath */}
      <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-3/4 h-8 bg-black/10 blur-2xl rounded-full" />
    </div>
  )
}
