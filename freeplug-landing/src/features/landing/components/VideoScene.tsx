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
    
    // Color spill removal - reduce green tint on edges
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
    
    // Subtle floating animation
    meshRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.8) * 0.15 - scrollProgress * 1.5
    meshRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.05
    
    // Scale down slightly on scroll
    const scale = 1 - scrollProgress * 0.2
    meshRef.current.scale.setScalar(scale)
    
    // Fade on scroll
    material.uniforms.opacity.value = 1 - scrollProgress * 0.7
  })

  // Character size - adjust based on viewport
  const characterHeight = Math.min(viewport.height * 0.7, 8)
  const characterWidth = characterHeight * (9 / 16)

  return (
    <mesh 
      ref={meshRef} 
      position={[viewport.width * 0.25, -0.5, 0]}
      material={material}
    >
      <planeGeometry args={[characterWidth, characterHeight]} />
    </mesh>
  )
}

function FloatingParticles() {
  const particlesRef = useRef<THREE.Points>(null)
  const count = 100

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 25
      positions[i * 3 + 1] = (Math.random() - 0.5) * 15
      positions[i * 3 + 2] = (Math.random() - 0.5) * 8 - 2
      
      // Mix of white and brand red particles
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
  
  useFrame((state) => {
    if (orb1Ref.current) {
      orb1Ref.current.position.x = Math.sin(state.clock.elapsedTime * 0.3) * 2 - 4
      orb1Ref.current.position.y = Math.cos(state.clock.elapsedTime * 0.4) * 1.5 + 1
    }
    if (orb2Ref.current) {
      orb2Ref.current.position.x = Math.cos(state.clock.elapsedTime * 0.25) * 2 + 4
      orb2Ref.current.position.y = Math.sin(state.clock.elapsedTime * 0.35) * 1.5 - 1
    }
  })

  return (
    <>
      <mesh ref={orb1Ref} position={[-4, 1, -3]}>
        <sphereGeometry args={[0.8, 32, 32]} />
        <meshBasicMaterial color="#ba3d3d" transparent opacity={0.15} />
      </mesh>
      <mesh ref={orb2Ref} position={[4, -1, -3]}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial color="#8a2e2e" transparent opacity={0.1} />
      </mesh>
    </>
  )
}

function Scene() {
  return (
    <>
      <ambientLight intensity={1} />
      <Suspense fallback={null}>
        <VideoCharacter />
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
