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
  const { viewport } = useThree()
  const [scrollY, setScrollY] = useState(0)

  const texture = useVideoTexture('/hero-video.mp4', {
    muted: true,
    loop: true,
    start: true,
  })

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        map: { value: null },
        keyColor: { value: new THREE.Color(0x00ff00) },
        similarity: { value: 0.35 },
        smoothness: { value: 0.12 },
        opacity: { value: 1.0 },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      side: THREE.DoubleSide,
    })
  }, [])

  useEffect(() => {
    if (texture && material) {
      material.uniforms.map.value = texture
    }
  }, [texture, material])

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useFrame((state) => {
    if (!meshRef.current) return
    
    const scrollProgress = Math.min(scrollY / 600, 1)
    
    meshRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.6) * 0.1 - scrollProgress * 1.5
    meshRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.2) * 0.03
    
    const scale = 1 - scrollProgress * 0.2
    meshRef.current.scale.setScalar(scale)
    
    material.uniforms.opacity.value = 1 - scrollProgress * 0.7
  })

  const characterHeight = Math.min(viewport.height * 0.75, 9)
  const characterWidth = characterHeight * (9 / 16)

  return (
    <mesh 
      ref={meshRef} 
      position={[viewport.width * 0.28, -0.8, 0]}
      material={material}
    >
      <planeGeometry args={[characterWidth, characterHeight]} />
    </mesh>
  )
}

function FloatingParticles() {
  const particlesRef = useRef<THREE.Points>(null)
  const count = 60

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 25
      positions[i * 3 + 1] = (Math.random() - 0.5) * 15
      positions[i * 3 + 2] = (Math.random() - 0.5) * 8 - 3
      
      const isAccent = Math.random() > 0.8
      colors[i * 3] = isAccent ? 0.73 : 0.95
      colors[i * 3 + 1] = isAccent ? 0.24 : 0.95
      colors[i * 3 + 2] = isAccent ? 0.24 : 0.98
    }
    
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return geo
  }, [])

  useFrame((state) => {
    if (!particlesRef.current) return
    particlesRef.current.rotation.y = state.clock.elapsedTime * 0.015
    particlesRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.04) * 0.03
  })

  return (
    <points ref={particlesRef} geometry={geometry}>
      <pointsMaterial
        size={0.04}
        vertexColors
        transparent
        opacity={0.4}
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
    <div className="absolute inset-0 -z-10 overflow-hidden">
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
