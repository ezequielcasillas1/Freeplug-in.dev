'use client'

import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useVideoTexture } from '@react-three/drei'
import { Suspense, useRef, useEffect, useState, useMemo } from 'react'
import * as THREE from 'three'

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = `
  uniform sampler2D map;
  uniform vec3 keyColor;
  uniform float similarity;
  uniform float smoothness;
  uniform float opacity;
  varying vec2 vUv;

  vec2 RGBtoUV(vec3 rgb) {
    return vec2(
      rgb.r * -0.169 + rgb.g * -0.331 + rgb.b * 0.5 + 0.5,
      rgb.r * 0.5 + rgb.g * -0.419 + rgb.b * -0.081 + 0.5
    );
  }

  void main() {
    vec4 texColor = texture2D(map, vUv);
    
    vec2 chromaKey = RGBtoUV(keyColor);
    vec2 chromaPixel = RGBtoUV(texColor.rgb);
    
    float chromaDist = distance(chromaKey, chromaPixel);
    
    float baseMask = chromaDist - similarity;
    float fullMask = pow(clamp(baseMask / smoothness, 0.0, 1.0), 1.5);
    
    texColor.a = fullMask * opacity;
    
    float spillRemoval = 1.0 - smoothstep(similarity, similarity + smoothness * 2.0, chromaDist);
    texColor.rgb = mix(texColor.rgb, texColor.rgb * vec3(1.1, 0.9, 1.1), spillRemoval * 0.5);
    
    gl_FragColor = texColor;
  }
`

function VideoCharacter() {
  const meshRef = useRef<THREE.Mesh>(null)
  const materialRef = useRef<THREE.MeshBasicMaterial>(null)
  const { viewport, size } = useThree()
  const [scrollY, setScrollY] = useState(0)
  const [videoLoaded, setVideoLoaded] = useState(false)

  const texture = useVideoTexture('/hero-video.mp4', {
    muted: true,
    loop: true,
    start: true,
  })

  useEffect(() => {
    if (texture) {
      setVideoLoaded(true)
      console.log('Video texture loaded:', texture)
    }
  }, [texture])

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
    
    meshRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.6) * 0.08 - scrollProgress * 1.5
    
    const scale = 1 - scrollProgress * 0.2
    meshRef.current.scale.setScalar(scale)
    
    materialRef.current.opacity = 1 - scrollProgress * 0.7
  })

  // Calculate size based on viewport
  const height = Math.min(viewport.height * 0.85, 9)
  const width = height * (16 / 9)
  
  // Position to the right
  const xPosition = viewport.width * 0.25

  if (!videoLoaded) return null

  return (
    <mesh 
      ref={meshRef} 
      position={[xPosition, 0, 0]}
    >
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
      positions[i * 3 + 2] = (Math.random() - 0.5) * 6 - 2
      
      const isAccent = Math.random() > 0.8
      colors[i * 3] = isAccent ? 0.73 : 0.9
      colors[i * 3 + 1] = isAccent ? 0.24 : 0.9
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
        opacity={0.35}
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

  if (!mounted) {
    return null
  }

  return (
    <div className="absolute inset-0 z-0 pointer-events-none">
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
