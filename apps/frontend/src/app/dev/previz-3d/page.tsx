"use client"
import { apiPhotoTo3d, apiPhotoTo3dPoll } from "@/lib/api"

import { useEffect, useRef, useState, useCallback } from "react"
import Link from "next/link"
import { ArrowLeft, Camera, Sun, Box, RotateCcw, Download, Plus, Trash2, Move, Eye, User, Loader2, ImagePlus } from "lucide-react"
import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js"
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js"
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js"
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js"
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js"

/* ── Luminance false-color shader ── */
const LuminanceShader = {
  uniforms: {
    tDiffuse: { value: null },
    mode: { value: 0 }, // 0=luminance heatmap, 1=zones (Ansel Adams), 2=overexposure
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform int mode;
    varying vec2 vUv;

    vec3 heatmap(float t) {
      // cold blue → cyan → green → yellow → red → white
      vec3 c;
      if (t < 0.2) c = mix(vec3(0.0, 0.0, 0.15), vec3(0.0, 0.2, 0.8), t / 0.2);
      else if (t < 0.4) c = mix(vec3(0.0, 0.2, 0.8), vec3(0.0, 0.8, 0.4), (t - 0.2) / 0.2);
      else if (t < 0.6) c = mix(vec3(0.0, 0.8, 0.4), vec3(0.9, 0.9, 0.0), (t - 0.4) / 0.2);
      else if (t < 0.8) c = mix(vec3(0.9, 0.9, 0.0), vec3(1.0, 0.3, 0.0), (t - 0.6) / 0.2);
      else c = mix(vec3(1.0, 0.3, 0.0), vec3(1.0, 1.0, 1.0), (t - 0.8) / 0.2);
      return c;
    }

    vec3 zones(float lum) {
      // 11 zones like Ansel Adams zone system (0-X)
      float zone = floor(lum * 10.0);
      float f = fract(lum * 10.0);
      // alternate dark/light bands with color coding
      float band = mod(zone, 2.0);
      vec3 base = heatmap(lum);
      // add zone grid lines
      float edge = smoothstep(0.0, 0.05, f) * (1.0 - smoothstep(0.95, 1.0, f));
      return mix(base * 0.4, base, edge);
    }

    void main() {
      vec4 tex = texture2D(tDiffuse, vUv);
      float lum = dot(tex.rgb, vec3(0.2126, 0.7152, 0.0722));

      if (mode == 0) {
        // Heatmap
        gl_FragColor = vec4(heatmap(lum), 1.0);
      } else if (mode == 1) {
        // Zone system
        gl_FragColor = vec4(zones(lum), 1.0);
      } else {
        // Overexposure warning — show clipped areas in red
        vec3 col = tex.rgb;
        if (lum > 0.95) col = mix(col, vec3(1.0, 0.0, 0.0), 0.7);
        if (lum < 0.05) col = mix(col, vec3(0.0, 0.0, 1.0), 0.5);
        gl_FragColor = vec4(col, 1.0);
      }
    }
  `,
}

/* ── Simple SSAO-like depth shader ── */
const DepthShader = {
  uniforms: {
    tDiffuse: { value: null },
    tDepth: { value: null },
    cameraNear: { value: 0.1 },
    cameraFar: { value: 100.0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform sampler2D tDepth;
    uniform float cameraNear;
    uniform float cameraFar;
    varying vec2 vUv;

    float readDepth(sampler2D depthSampler, vec2 coord) {
      float fragCoordZ = texture2D(depthSampler, coord).x;
      float viewZ = cameraNear * cameraFar / (cameraFar - fragCoordZ * (cameraFar - cameraNear));
      return viewZ;
    }

    void main() {
      float depth = readDepth(tDepth, vUv);
      float normalized = 1.0 - smoothstep(cameraNear, cameraFar * 0.3, depth);
      // warm depth fog
      vec3 near = vec3(1.0, 0.95, 0.9);
      vec3 far = vec3(0.05, 0.05, 0.12);
      vec3 col = mix(far, near, normalized);
      gl_FragColor = vec4(col, 1.0);
    }
  `,
}

type RenderMode = "standard" | "bloom" | "luminance" | "zones" | "overexposure" | "depth"

/* ── Types ── */
type LightConfig = {
  id: string
  name: string
  type: "directional" | "point" | "spot"
  intensity: number
  color: string
  temperature: number // 2000-10000K
  position: [number, number, number]
}

type SceneObject = {
  id: string
  name: string
  type: "box" | "sphere" | "cylinder" | "plane" | "cone" | "torus" | "glTF"
  mesh: THREE.Mesh | THREE.Group
}

/* ── Helpers ── */
function kelvinToHex(kelvin: number): string {
  const temp = kelvin / 100
  let r: number, g: number, b: number

  if (temp <= 66) {
    r = 255
    g = Math.max(0, Math.min(255, 99.4708025861 * Math.log(temp) - 161.1195681661))
  } else {
    r = Math.max(0, Math.min(255, 329.698727446 * Math.pow(temp - 60, -0.1332047592)))
    g = Math.max(0, Math.min(255, 288.1221695283 * Math.pow(temp - 60, -0.0755148492)))
  }

  if (temp >= 66) {
    b = 255
  } else if (temp <= 19) {
    b = 0
  } else {
    b = Math.max(0, Math.min(255, 138.5177312231 * Math.log(temp - 10) - 305.0447927307))
  }

  return `#${Math.round(r).toString(16).padStart(2, "0")}${Math.round(g).toString(16).padStart(2, "0")}${Math.round(b).toString(16).padStart(2, "0")}`
}

function fovToFocalLength(fov: number, sensorHeight: number = 24): number {
  return sensorHeight / (2 * Math.tan((fov * Math.PI) / 360))
}

function focalLengthToFov(fl: number, sensorHeight: number = 24): number {
  return (2 * Math.atan(sensorHeight / (2 * fl)) * 180) / Math.PI
}

const PRESET_LENSES = [14, 24, 35, 50, 85, 135, 200]

/* ── Component ── */
export default function Previz3DPage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const orbitRef = useRef<OrbitControls | null>(null)
  const transformRef = useRef<TransformControls | null>(null)
  const lightsRef = useRef<Map<string, THREE.Light>>(new Map())
  const helpersRef = useRef<Map<string, THREE.Object3D>>(new Map())
  const objectsRef = useRef<Map<string, THREE.Object3D>>(new Map())
  const animFrameRef = useRef<number>(0)
  const gridRef = useRef<THREE.GridHelper | null>(null)
  const composerRef = useRef<EffectComposer | null>(null)
  const bloomPassRef = useRef<UnrealBloomPass | null>(null)
  const lumaPassRef = useRef<ShaderPass | null>(null)
  const depthPassRef = useRef<ShaderPass | null>(null)
  const depthTargetRef = useRef<THREE.WebGLRenderTarget | null>(null)
  const depthMatRef = useRef<THREE.MeshDepthMaterial | null>(null)

  const [focalLength, setFocalLength] = useState(50)
  const [lights, setLights] = useState<LightConfig[]>([
    { id: "key", name: "Key Light", type: "directional", intensity: 1.5, color: "#ffffff", temperature: 5600, position: [5, 8, 5] },
    { id: "fill", name: "Fill Light", type: "directional", intensity: 0.6, color: "#ffffff", temperature: 6500, position: [-4, 5, 3] },
    { id: "rim", name: "Rim Light", type: "directional", intensity: 0.9, color: "#ffffff", temperature: 7500, position: [0, 6, -6] },
  ])
  const [objects, setObjects] = useState<SceneObject[]>([])
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null)
  const [transformMode, setTransformMode] = useState<"translate" | "rotate" | "scale">("translate")
  const [showGrid, setShowGrid] = useState(true)
  const [showHelpers, setShowHelpers] = useState(true)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [ambientIntensity, setAmbientIntensity] = useState(0.15)
  const [bgColor, setBgColor] = useState("#1a1a1a")
  const [selectedLight, setSelectedLight] = useState<string | null>(null)
  const [renderMode, setRenderMode] = useState<RenderMode>("standard")
  const [bloomStrength, setBloomStrength] = useState(0.8)
  const [bloomRadius, setBloomRadius] = useState(0.4)
  const [bloomThreshold, setBloomThreshold] = useState(0.6)
  const [exposure, setExposure] = useState(1.2)
  const [photo3dStatus, setPhoto3dStatus] = useState<"idle" | "uploading" | "generating" | "loading" | "error">("idle")
  const [photo3dProgress, setPhoto3dProgress] = useState(0)
  const [photo3dError, setPhoto3dError] = useState<string | null>(null)
  const [photo3dPreview, setPhoto3dPreview] = useState<string | null>(null)

  /* ── Init Three.js ── */
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(bgColor)
    scene.fog = new THREE.FogExp2(bgColor, 0.015)
    sceneRef.current = scene

    // Camera
    const camera = new THREE.PerspectiveCamera(
      focalLengthToFov(focalLength),
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    )
    camera.position.set(8, 6, 8)
    cameraRef.current = camera

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true,
      alpha: true,
    })
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.2
    container.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // Controls
    const orbit = new OrbitControls(camera, renderer.domElement)
    orbit.enableDamping = true
    orbit.dampingFactor = 0.08
    orbit.target.set(0, 1, 0)
    orbitRef.current = orbit

    // Transform controls
    const transform = new TransformControls(camera, renderer.domElement)
    transform.addEventListener("dragging-changed", (event) => {
      orbit.enabled = !event.value
    })
    scene.add(transform as unknown as THREE.Object3D)
    transformRef.current = transform

    // Grid
    const grid = new THREE.GridHelper(30, 30, 0x444444, 0x222222)
    scene.add(grid)
    gridRef.current = grid

    // Ground plane (shadow receiver)
    const groundGeo = new THREE.PlaneGeometry(30, 30)
    const groundMat = new THREE.ShadowMaterial({ opacity: 0.3 })
    const ground = new THREE.Mesh(groundGeo, groundMat)
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    scene.add(ground)

    // Ambient light
    const ambient = new THREE.AmbientLight(0xffffff, ambientIntensity)
    ambient.name = "__ambient__"
    scene.add(ambient)

    // ── Default scene: mannequin + props ──
    const defaultMat = new THREE.MeshStandardMaterial({ color: 0x999999, roughness: 0.5, metalness: 0.1 })
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.6, metalness: 0.05 })
    const accentMat = new THREE.MeshStandardMaterial({ color: 0xD4A853, roughness: 0.3, metalness: 0.4 })

    // Mannequin
    const mannequin = new THREE.Group()
    mannequin.name = "Mannequin"

    // Torso
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.25, 0.9, 16), defaultMat)
    torso.position.y = 1.25
    torso.castShadow = true
    mannequin.add(torso)

    // Chest
    const chest = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12), defaultMat)
    chest.position.y = 1.55
    chest.scale.set(1, 0.7, 0.8)
    chest.castShadow = true
    mannequin.add(chest)

    // Neck
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.2, 12), defaultMat)
    neck.position.y = 1.8
    neck.castShadow = true
    mannequin.add(neck)

    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 20, 16), defaultMat)
    head.position.y = 2.08
    head.castShadow = true
    mannequin.add(head)

    // Hips
    const hips = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), defaultMat)
    hips.position.y = 0.85
    hips.scale.set(1, 0.6, 0.8)
    hips.castShadow = true
    mannequin.add(hips)

    // Left leg
    const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.8, 12), darkMat)
    legL.position.set(0.12, 0.4, 0)
    legL.castShadow = true
    mannequin.add(legL)

    // Right leg
    const legR = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.8, 12), darkMat)
    legR.position.set(-0.12, 0.4, 0)
    legR.castShadow = true
    mannequin.add(legR)

    // Left arm
    const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.65, 10), defaultMat)
    armL.position.set(0.4, 1.35, 0)
    armL.rotation.z = -0.3
    armL.castShadow = true
    mannequin.add(armL)

    // Right arm
    const armR = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.65, 10), defaultMat)
    armR.position.set(-0.4, 1.35, 0)
    armR.rotation.z = 0.3
    armR.castShadow = true
    mannequin.add(armR)

    // Feet
    const footL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.22), darkMat)
    footL.position.set(0.12, 0.03, 0.04)
    footL.castShadow = true
    mannequin.add(footL)

    const footR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.22), darkMat)
    footR.position.set(-0.12, 0.03, 0.04)
    footR.castShadow = true
    mannequin.add(footR)

    scene.add(mannequin)
    objectsRef.current.set("mannequin", mannequin)

    // Prop: table
    const table = new THREE.Group()
    table.name = "Table"
    const tableTop = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 0.6), darkMat)
    tableTop.position.y = 0.75
    tableTop.castShadow = true
    tableTop.receiveShadow = true
    table.add(tableTop)
    for (const [lx, lz] of [[0.5, 0.22], [-0.5, 0.22], [0.5, -0.22], [-0.5, -0.22]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.75, 8), darkMat)
      leg.position.set(lx, 0.375, lz)
      leg.castShadow = true
      table.add(leg)
    }
    table.position.set(1.5, 0, 0.3)
    scene.add(table)
    objectsRef.current.set("table", table)

    // Prop: golden sphere on table
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.12, 24, 24), accentMat)
    sphere.position.set(1.5, 0.9, 0.3)
    sphere.castShadow = true
    scene.add(sphere)
    objectsRef.current.set("sphere_prop", sphere)

    // Prop: tall column
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 2.5, 16), defaultMat)
    column.position.set(-1.8, 1.25, -1)
    column.castShadow = true
    column.receiveShadow = true
    scene.add(column)
    objectsRef.current.set("column", column)

    // Prop: backdrop wall
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(6, 3.5, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.8, metalness: 0 })
    )
    wall.position.set(0, 1.75, -3)
    wall.receiveShadow = true
    scene.add(wall)
    objectsRef.current.set("backdrop", wall)

    // Set initial objects state
    const initialObjects: SceneObject[] = [
      { id: "mannequin", name: "Mannequin", type: "cylinder" as const, mesh: mannequin as unknown as THREE.Mesh },
      { id: "table", name: "Table", type: "box" as const, mesh: table as unknown as THREE.Mesh },
      { id: "sphere_prop", name: "Golden Sphere", type: "sphere" as const, mesh: sphere },
      { id: "column", name: "Column", type: "cylinder" as const, mesh: column },
      { id: "backdrop", name: "Backdrop Wall", type: "plane" as const, mesh: wall },
    ]
    setObjects(initialObjects)

    // Default lights
    lights.forEach((cfg) => {
      const light = new THREE.DirectionalLight(kelvinToHex(cfg.temperature), cfg.intensity)
      light.position.set(...cfg.position)
      light.castShadow = true
      light.shadow.mapSize.set(2048, 2048)
      light.shadow.camera.near = 0.1
      light.shadow.camera.far = 50
      light.shadow.camera.left = -10
      light.shadow.camera.right = 10
      light.shadow.camera.top = 10
      light.shadow.camera.bottom = -10
      scene.add(light)
      lightsRef.current.set(cfg.id, light)

      const helper = new THREE.DirectionalLightHelper(light, 0.5)
      scene.add(helper)
      helpersRef.current.set(cfg.id, helper)
    })

    // ── Post-processing ──
    const composer = new EffectComposer(renderer)
    composerRef.current = composer

    const renderPass = new RenderPass(scene, camera)
    composer.addPass(renderPass)

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(container.clientWidth, container.clientHeight),
      0.8, 0.4, 0.6
    )
    bloomPass.enabled = false
    composer.addPass(bloomPass)
    bloomPassRef.current = bloomPass

    const lumaPass = new ShaderPass(LuminanceShader)
    lumaPass.enabled = false
    composer.addPass(lumaPass)
    lumaPassRef.current = lumaPass

    // Depth render target
    const depthTarget = new THREE.WebGLRenderTarget(
      container.clientWidth, container.clientHeight,
      { depthTexture: new THREE.DepthTexture(container.clientWidth, container.clientHeight) }
    )
    depthTargetRef.current = depthTarget

    const depthPass = new ShaderPass(DepthShader)
    depthPass.enabled = false
    depthPass.uniforms.cameraNear.value = camera.near
    depthPass.uniforms.cameraFar.value = camera.far
    composer.addPass(depthPass)
    depthPassRef.current = depthPass

    const outputPass = new OutputPass()
    composer.addPass(outputPass)

    // Animation loop
    function animate() {
      animFrameRef.current = requestAnimationFrame(animate)
      orbit.update()

      // For depth mode — render depth to texture first
      if (depthPass.enabled) {
        renderer.setRenderTarget(depthTarget)
        renderer.render(scene, camera)
        renderer.setRenderTarget(null)
        depthPass.uniforms.tDepth.value = depthTarget.depthTexture
        depthPass.uniforms.cameraNear.value = camera.near
        depthPass.uniforms.cameraFar.value = camera.far
      }

      composer.render()
    }
    animate()

    // Resize
    const onResize = () => {
      if (!container) return
      const w = container.clientWidth
      const h = container.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
      composer.setSize(w, h)
      depthTarget.setSize(w, h)
    }
    window.addEventListener("resize", onResize)

    // Raycaster for object picking
    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()

    const onClick = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect()
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(mouse, camera)

      const meshes: THREE.Object3D[] = []
      objectsRef.current.forEach((obj) => {
        obj.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) meshes.push(child)
        })
      })

      const hits = raycaster.intersectObjects(meshes, false)
      if (hits.length > 0) {
        let hitObj = hits[0].object
        // Walk up to find our registered object
        while (hitObj.parent && !Array.from(objectsRef.current.values()).includes(hitObj)) {
          hitObj = hitObj.parent
        }
        const entry = Array.from(objectsRef.current.entries()).find(([, v]) => v === hitObj)
        if (entry) {
          setSelectedObjectId(entry[0])
          transform.attach(hitObj)
        }
      }
    }
    renderer.domElement.addEventListener("dblclick", onClick)

    return () => {
      window.removeEventListener("resize", onResize)
      renderer.domElement.removeEventListener("dblclick", onClick)
      cancelAnimationFrame(animFrameRef.current)
      renderer.dispose()
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ── Sync render mode ── */
  useEffect(() => {
    const bloom = bloomPassRef.current
    const luma = lumaPassRef.current
    const depth = depthPassRef.current
    const renderer = rendererRef.current
    if (!bloom || !luma || !depth || !renderer) return

    bloom.enabled = renderMode === "bloom"
    luma.enabled = renderMode === "luminance" || renderMode === "zones" || renderMode === "overexposure"
    depth.enabled = renderMode === "depth"

    if (luma.enabled) {
      const modeMap: Record<string, number> = { luminance: 0, zones: 1, overexposure: 2 }
      luma.uniforms.mode.value = modeMap[renderMode] ?? 0
    }

    renderer.toneMappingExposure = exposure
  }, [renderMode, exposure])

  /* ── Sync bloom params ── */
  useEffect(() => {
    const bloom = bloomPassRef.current
    if (!bloom) return
    bloom.strength = bloomStrength
    bloom.radius = bloomRadius
    bloom.threshold = bloomThreshold
  }, [bloomStrength, bloomRadius, bloomThreshold])

  /* ── Sync exposure ── */
  useEffect(() => {
    if (rendererRef.current) rendererRef.current.toneMappingExposure = exposure
  }, [exposure])

  /* ── Sync focal length ── */
  useEffect(() => {
    if (cameraRef.current) {
      cameraRef.current.fov = focalLengthToFov(focalLength)
      cameraRef.current.updateProjectionMatrix()
    }
  }, [focalLength])

  /* ── Sync lights ── */
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    lights.forEach((cfg) => {
      let light = lightsRef.current.get(cfg.id) as THREE.DirectionalLight | undefined
      if (!light) {
        light = new THREE.DirectionalLight(kelvinToHex(cfg.temperature), cfg.intensity)
        light.castShadow = true
        light.shadow.mapSize.set(2048, 2048)
        scene.add(light)
        lightsRef.current.set(cfg.id, light)

        const helper = new THREE.DirectionalLightHelper(light, 0.5)
        scene.add(helper)
        helpersRef.current.set(cfg.id, helper)
      }

      light.intensity = cfg.intensity
      light.color.set(kelvinToHex(cfg.temperature))
      light.position.set(...cfg.position)

      const helper = helpersRef.current.get(cfg.id)
      if (helper) {
        helper.visible = showHelpers
        ;(helper as THREE.DirectionalLightHelper).update()
      }
    })
  }, [lights, showHelpers])

  /* ── Sync ambient ── */
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return
    const ambient = scene.getObjectByName("__ambient__") as THREE.AmbientLight | undefined
    if (ambient) ambient.intensity = ambientIntensity
  }, [ambientIntensity])

  /* ── Sync grid ── */
  useEffect(() => {
    if (gridRef.current) gridRef.current.visible = showGrid
  }, [showGrid])

  /* ── Sync background ── */
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.background = new THREE.Color(bgColor)
      if (sceneRef.current.fog) (sceneRef.current.fog as THREE.FogExp2).color.set(bgColor)
    }
  }, [bgColor])

  /* ── Sync transform mode ── */
  useEffect(() => {
    if (transformRef.current) transformRef.current.setMode(transformMode)
  }, [transformMode])

  /* ── Add geometry ── */
  const addGeometry = useCallback((type: SceneObject["type"]) => {
    const scene = sceneRef.current
    if (!scene) return

    let geometry: THREE.BufferGeometry
    const material = new THREE.MeshStandardMaterial({
      color: 0x888888,
      roughness: 0.4,
      metalness: 0.1,
    })

    switch (type) {
      case "box":
        geometry = new THREE.BoxGeometry(1, 1, 1)
        break
      case "sphere":
        geometry = new THREE.SphereGeometry(0.5, 32, 32)
        break
      case "cylinder":
        geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 32)
        break
      case "plane":
        geometry = new THREE.PlaneGeometry(2, 2)
        break
      case "cone":
        geometry = new THREE.ConeGeometry(0.5, 1, 32)
        break
      case "torus":
        geometry = new THREE.TorusGeometry(0.5, 0.2, 16, 48)
        break
      default:
        return
    }

    const mesh = new THREE.Mesh(geometry, material)
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.position.y = 0.5

    const id = `${type}_${Date.now()}`
    const name = `${type.charAt(0).toUpperCase() + type.slice(1)} ${objects.length + 1}`

    scene.add(mesh)
    objectsRef.current.set(id, mesh)

    const newObj: SceneObject = { id, name, type, mesh }
    setObjects((prev) => [...prev, newObj])
    setSelectedObjectId(id)

    if (transformRef.current) {
      transformRef.current.attach(mesh)
    }
  }, [objects.length])

  /* ── Load glTF ── */
  const loadGLTF = useCallback(() => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".glb,.gltf"
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file || !sceneRef.current) return

      const loader = new GLTFLoader()
      const url = URL.createObjectURL(file)

      loader.load(url, (gltf) => {
        const model = gltf.scene
        model.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            child.castShadow = true
            child.receiveShadow = true
          }
        })

        // Auto-scale to fit
        const box = new THREE.Box3().setFromObject(model)
        const size = box.getSize(new THREE.Vector3())
        const maxDim = Math.max(size.x, size.y, size.z)
        if (maxDim > 5) {
          const scale = 5 / maxDim
          model.scale.setScalar(scale)
        }

        const center = box.getCenter(new THREE.Vector3())
        model.position.sub(center)
        model.position.y += size.y / 2

        sceneRef.current!.add(model)

        const id = `gltf_${Date.now()}`
        objectsRef.current.set(id, model)

        setObjects((prev) => [...prev, {
          id,
          name: file.name.replace(/\.(glb|gltf)$/, ""),
          type: "glTF",
          mesh: model as unknown as THREE.Mesh,
        }])
        setSelectedObjectId(id)
        if (transformRef.current) transformRef.current.attach(model)

        URL.revokeObjectURL(url)
      })
    }
    input.click()
  }, [])

  /* ── Load GLB from URL into scene ── */
  const loadGLBFromUrl = useCallback((url: string, name: string) => {
    if (!sceneRef.current) return
    const loader = new GLTFLoader()

    setPhoto3dStatus("loading")

    loader.load(
      url,
      (gltf) => {
        const model = gltf.scene
        model.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            child.castShadow = true
            child.receiveShadow = true
          }
        })

        const box = new THREE.Box3().setFromObject(model)
        const size = box.getSize(new THREE.Vector3())
        const maxDim = Math.max(size.x, size.y, size.z)
        if (maxDim > 3) {
          model.scale.setScalar(3 / maxDim)
        }
        if (maxDim < 0.5) {
          model.scale.setScalar(1.5 / maxDim)
        }

        const center = box.getCenter(new THREE.Vector3())
        model.position.sub(center.multiplyScalar(model.scale.x))
        model.position.y = 0

        sceneRef.current!.add(model)
        const id = `photo3d_${Date.now()}`
        objectsRef.current.set(id, model)

        setObjects((prev) => [...prev, {
          id,
          name: `3D: ${name}`,
          type: "glTF" as const,
          mesh: model as unknown as THREE.Mesh,
        }])
        setSelectedObjectId(id)
        if (transformRef.current) transformRef.current.attach(model)

        setPhoto3dStatus("idle")
        setPhoto3dProgress(0)
        setPhoto3dPreview(null)
      },
      undefined,
      (err) => {
        console.error("GLB load error:", err)
        setPhoto3dStatus("error")
        setPhoto3dError("Failed to load generated model")
      }
    )
  }, [])

  /* ── Photo → 3D pipeline ── */
  const photoTo3D = useCallback(() => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = "image/png,image/jpeg,image/webp"
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      // Preview
      const reader = new FileReader()
      reader.onload = () => setPhoto3dPreview(reader.result as string)
      reader.readAsDataURL(file)

      // Convert to base64
      setPhoto3dStatus("uploading")
      setPhoto3dError(null)
      setPhoto3dProgress(0)

      const toBase64 = (): Promise<string> =>
        new Promise((resolve) => {
          const r = new FileReader()
          r.onload = () => resolve(r.result as string)
          r.readAsDataURL(file)
        })

      try {
        const base64 = await toBase64()

        // Step 1: Create task
        const createRes = await apiPhotoTo3d("/api/photo-to-3d", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: base64 }),
        })

        if (!createRes.ok) {
          const err = await createRes.json()
          throw new Error(err.error || "Upload failed")
        }

        const { taskId } = (await createRes.json()) as { taskId: string }
        setPhoto3dStatus("generating")

        // Step 2: Poll
        const poll = async (): Promise<string> => {
          for (let i = 0; i < 120; i++) {
            await new Promise((r) => setTimeout(r, 3000))

            const pollRes = await apiPhotoTo3dPoll(`/api/photo-to-3d?taskId=${taskId}`)
            if (!pollRes.ok) continue

            const data = (await pollRes.json()) as {
              status: string
              progress: number
              modelUrl?: string
              error?: string
            }

            setPhoto3dProgress(data.progress || 0)

            if (data.status === "success" && data.modelUrl) {
              return data.modelUrl
            }
            if (data.status === "failed") {
              throw new Error(data.error || "Generation failed")
            }
          }
          throw new Error("Timeout — generation took too long")
        }

        const modelUrl = await poll()
        loadGLBFromUrl(modelUrl, file.name.replace(/\.\w+$/, ""))
      } catch (err) {
        setPhoto3dStatus("error")
        setPhoto3dError(err instanceof Error ? err.message : "Unknown error")
      }
    }
    input.click()
  }, [loadGLBFromUrl])

  /* ── Delete object ── */
  const deleteObject = useCallback((id: string) => {
    const obj = objectsRef.current.get(id)
    if (obj && sceneRef.current) {
      if (transformRef.current?.object === obj) transformRef.current.detach()
      sceneRef.current.remove(obj)
      objectsRef.current.delete(id)
    }
    setObjects((prev) => prev.filter((o) => o.id !== id))
    if (selectedObjectId === id) setSelectedObjectId(null)
  }, [selectedObjectId])

  /* ── Capture ── */
  const capture = useCallback(() => {
    const renderer = rendererRef.current
    const scene = sceneRef.current
    const camera = cameraRef.current
    if (!renderer || !scene || !camera) return

    // Hide helpers for clean capture
    helpersRef.current.forEach((h) => { h.visible = false })
    if (gridRef.current) gridRef.current.visible = false
    if (transformRef.current) (transformRef.current as unknown as THREE.Object3D).visible = false

    const composer = composerRef.current
    if (composer) {
      composer.render()
    } else {
      renderer.render(scene, camera)
    }
    const dataUrl = renderer.domElement.toDataURL("image/png")
    setCapturedImage(dataUrl)

    // Restore helpers
    if (showHelpers) helpersRef.current.forEach((h) => { h.visible = true })
    if (showGrid && gridRef.current) gridRef.current.visible = true
    if (transformRef.current) (transformRef.current as unknown as THREE.Object3D).visible = true
  }, [showHelpers, showGrid])

  /* ── Download captured ── */
  const downloadCapture = useCallback(() => {
    if (!capturedImage) return
    const link = document.createElement("a")
    link.href = capturedImage
    link.download = `previz-${Date.now()}.png`
    link.click()
  }, [capturedImage])

  /* ── Reset camera ── */
  const resetCamera = useCallback(() => {
    if (cameraRef.current && orbitRef.current) {
      cameraRef.current.position.set(8, 6, 8)
      orbitRef.current.target.set(0, 1, 0)
      orbitRef.current.update()
    }
  }, [])

  /* ── Update light ── */
  const updateLight = (id: string, patch: Partial<LightConfig>) => {
    setLights((prev) => prev.map((l) => l.id === id ? { ...l, ...patch } : l))
  }

  /* ── Add light ── */
  const addLight = () => {
    const id = `light_${Date.now()}`
    setLights((prev) => [
      ...prev,
      {
        id,
        name: `Light ${prev.length + 1}`,
        type: "directional",
        intensity: 1,
        color: "#ffffff",
        temperature: 5600,
        position: [
          Math.random() * 8 - 4,
          5 + Math.random() * 3,
          Math.random() * 8 - 4,
        ],
      },
    ])
  }

  /* ── Remove light ── */
  const removeLight = (id: string) => {
    const light = lightsRef.current.get(id)
    const helper = helpersRef.current.get(id)
    if (light && sceneRef.current) sceneRef.current.remove(light)
    if (helper && sceneRef.current) sceneRef.current.remove(helper)
    lightsRef.current.delete(id)
    helpersRef.current.delete(id)
    setLights((prev) => prev.filter((l) => l.id !== id))
    if (selectedLight === id) setSelectedLight(null)
  }

  return (
    <main className="flex h-screen bg-[#0E0D0B] text-white overflow-hidden">
      {/* ── Left Panel: Scene Hierarchy + Objects ── */}
      <div className="flex w-72 flex-col border-r border-white/8 bg-[#111110]">
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-white/8 px-3 py-3">
          <Link
            href="/dev"
            className="rounded-lg border border-white/10 bg-white/4 p-1.5 text-white/60 hover:text-white transition"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-sm font-semibold tracking-[0.15em] text-white/90">3D PREVIZ</h1>
        </div>

        {/* Add Geometry */}
        <div className="border-b border-white/8 p-3">
          <div className="mb-2 text-[10px] uppercase tracking-[0.2em] text-white/35">Add Geometry</div>
          <div className="grid grid-cols-3 gap-1.5">
            {(["box", "sphere", "cylinder", "cone", "torus", "plane"] as const).map((type) => (
              <button
                key={type}
                onClick={() => addGeometry(type)}
                className="rounded-lg border border-white/8 bg-white/3 px-2 py-1.5 text-[10px] text-white/60 hover:bg-white/8 hover:text-white transition capitalize"
              >
                {type}
              </button>
            ))}
          </div>
          <div className="mt-2 flex gap-1.5">
            <button
              onClick={loadGLTF}
              className="flex-1 rounded-lg border border-[#D4A853]/25 bg-[#D4A853]/8 px-2 py-1.5 text-[10px] text-[#E6C887] hover:bg-[#D4A853]/15 transition"
            >
              Import glTF
            </button>
          </div>

          {/* Photo → 3D */}
          <div className="mt-3 rounded-lg border border-[#7C4A6F]/25 bg-[#7C4A6F]/5 p-2">
            <div className="mb-2 text-[10px] uppercase tracking-[0.2em] text-[#C58DB2]/60">Photo → 3D Model</div>

            {photo3dStatus === "idle" && (
              <button
                onClick={photoTo3D}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#7C4A6F]/30 bg-[#7C4A6F]/10 px-3 py-2 text-[11px] text-[#C58DB2] hover:bg-[#7C4A6F]/20 transition"
              >
                <User className="h-3.5 w-3.5" />
                Upload Photo → Generate 3D
              </button>
            )}

            {photo3dStatus === "uploading" && (
              <div className="flex items-center gap-2 px-2 py-2 text-[11px] text-[#C58DB2]/70">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Uploading photo...
              </div>
            )}

            {photo3dStatus === "generating" && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[11px] text-[#C58DB2]/70">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Generating 3D model...
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#7C4A6F] to-[#C58DB2] transition-all duration-500"
                    style={{ width: `${Math.max(photo3dProgress, 5)}%` }}
                  />
                </div>
                <div className="text-right text-[9px] font-mono text-white/30">{photo3dProgress}%</div>
                {photo3dPreview && (
                  <img src={photo3dPreview} alt="Source" className="w-full rounded-md border border-white/10 object-cover" style={{ maxHeight: 80 }} />
                )}
              </div>
            )}

            {photo3dStatus === "loading" && (
              <div className="flex items-center gap-2 px-2 py-2 text-[11px] text-[#9DCCBF]">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading model into scene...
              </div>
            )}

            {photo3dStatus === "error" && (
              <div className="space-y-2">
                <div className="rounded-md bg-red-500/10 px-2 py-1.5 text-[10px] text-red-400">
                  {photo3dError}
                </div>
                <button
                  onClick={() => { setPhoto3dStatus("idle"); setPhoto3dError(null) }}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-[10px] text-white/50 hover:text-white transition"
                >
                  Try Again
                </button>
              </div>
            )}

            <div className="mt-2 text-[8px] text-white/20 leading-relaxed">
              Tripo3D API. Upload character/object photo → get 3D GLB model. Takes ~30-60 sec.
            </div>
          </div>
        </div>

        {/* Transform Mode */}
        <div className="border-b border-white/8 p-3">
          <div className="mb-2 text-[10px] uppercase tracking-[0.2em] text-white/35">Transform</div>
          <div className="flex gap-1">
            {([
              { mode: "translate" as const, icon: Move, label: "Move" },
              { mode: "rotate" as const, icon: RotateCcw, label: "Rotate" },
              { mode: "scale" as const, icon: Box, label: "Scale" },
            ]).map(({ mode, icon: Icon, label }) => (
              <button
                key={mode}
                onClick={() => setTransformMode(mode)}
                className={`flex flex-1 items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-[10px] transition ${
                  transformMode === mode
                    ? "border-[#4A7C6F]/40 bg-[#4A7C6F]/15 text-[#9DCCBF]"
                    : "border-white/8 bg-white/3 text-white/50 hover:text-white/80"
                }`}
              >
                <Icon className="h-3 w-3" />
                {label}
              </button>
            ))}
          </div>
          <div className="mt-2 text-[9px] text-white/25">Double-click object to select. W/E/R to switch mode.</div>
        </div>

        {/* Scene Objects */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="mb-2 text-[10px] uppercase tracking-[0.2em] text-white/35">Scene Objects</div>
          {objects.length === 0 ? (
            <div className="rounded-lg border border-dashed border-white/10 px-3 py-4 text-center text-[11px] text-white/25">
              Add geometry or import glTF
            </div>
          ) : (
            <div className="space-y-1">
              {objects.map((obj) => (
                <div
                  key={obj.id}
                  className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 cursor-pointer transition ${
                    selectedObjectId === obj.id
                      ? "border-[#D4A853]/30 bg-[#D4A853]/10 text-[#E6C887]"
                      : "border-white/5 bg-white/2 text-white/60 hover:bg-white/5"
                  }`}
                  onClick={() => {
                    setSelectedObjectId(obj.id)
                    const mesh = objectsRef.current.get(obj.id)
                    if (mesh && transformRef.current) transformRef.current.attach(mesh)
                  }}
                >
                  <Box className="h-3 w-3 shrink-0" />
                  <span className="flex-1 truncate text-[11px]">{obj.name}</span>
                  <span className="text-[9px] text-white/25">{obj.type}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteObject(obj.id) }}
                    className="rounded p-0.5 text-white/20 hover:text-red-400 transition"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Viewport ── */}
      <div className="relative flex-1">
        <div ref={containerRef} className="h-full w-full" />

        {/* Viewport overlay: lens info + render mode */}
        <div className="absolute left-3 top-3 flex items-center gap-2">
          <div className="rounded-lg border border-white/10 bg-black/60 backdrop-blur-sm px-3 py-1.5 text-[11px] text-white/70 font-mono">
            {focalLength}mm &middot; f/{(focalLength / 25).toFixed(1)} &middot; FOV {focalLengthToFov(focalLength).toFixed(1)}&deg;
          </div>
          <div className="flex rounded-lg border border-white/10 bg-black/60 backdrop-blur-sm overflow-hidden">
            {([
              { id: "standard" as RenderMode, label: "STD" },
              { id: "bloom" as RenderMode, label: "BLOOM" },
              { id: "luminance" as RenderMode, label: "LUMA" },
              { id: "zones" as RenderMode, label: "ZONES" },
              { id: "overexposure" as RenderMode, label: "CLIP" },
              { id: "depth" as RenderMode, label: "DEPTH" },
            ]).map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setRenderMode(id)}
                className={`px-2 py-1.5 text-[9px] font-mono uppercase tracking-wider transition ${
                  renderMode === id
                    ? "bg-[#D4A853]/20 text-[#E6C887]"
                    : "text-white/35 hover:text-white/70 hover:bg-white/5"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Viewport overlay: actions */}
        <div className="absolute right-3 top-3 flex items-center gap-2">
          <button
            onClick={resetCamera}
            className="rounded-lg border border-white/10 bg-black/60 backdrop-blur-sm p-2 text-white/60 hover:text-white transition"
            title="Reset Camera"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <button
            onClick={() => setShowGrid(!showGrid)}
            className={`rounded-lg border bg-black/60 backdrop-blur-sm p-2 transition ${
              showGrid ? "border-[#4A7C6F]/40 text-[#9DCCBF]" : "border-white/10 text-white/40"
            }`}
            title="Toggle Grid"
          >
            <Box className="h-4 w-4" />
          </button>
          <button
            onClick={() => setShowHelpers(!showHelpers)}
            className={`rounded-lg border bg-black/60 backdrop-blur-sm p-2 transition ${
              showHelpers ? "border-[#D4A853]/40 text-[#E6C887]" : "border-white/10 text-white/40"
            }`}
            title="Toggle Light Helpers"
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            onClick={capture}
            className="rounded-lg border border-[#D4A853]/40 bg-[#D4A853]/15 backdrop-blur-sm px-3 py-2 text-[11px] font-semibold text-[#E6C887] hover:bg-[#D4A853]/25 transition flex items-center gap-1.5"
          >
            <Camera className="h-4 w-4" />
            Capture
          </button>
        </div>

        {/* Captured preview */}
        {capturedImage && (
          <div className="absolute left-3 bottom-3 group">
            <div className="relative rounded-lg border border-white/15 bg-black/80 backdrop-blur-sm overflow-hidden">
              <img
                src={capturedImage}
                alt="Captured"
                className="h-32 w-auto object-contain"
              />
              <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/60 opacity-0 group-hover:opacity-100 transition">
                <button
                  onClick={downloadCapture}
                  className="rounded-lg border border-white/20 bg-white/10 p-2 text-white hover:bg-white/20 transition"
                  title="Download PNG"
                >
                  <Download className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setCapturedImage(null)}
                  className="rounded-lg border border-white/20 bg-white/10 p-2 text-white hover:bg-white/20 transition"
                  title="Dismiss"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Keyboard shortcuts hint */}
        <div className="absolute left-3 bottom-3 text-[9px] text-white/20 font-mono" style={{ bottom: capturedImage ? "10rem" : "0.75rem" }}>
          Orbit: LMB &middot; Pan: RMB &middot; Zoom: Scroll &middot; Select: DblClick
        </div>
      </div>

      {/* ── Right Panel: Camera + Lighting ── */}
      <div className="flex w-80 flex-col border-l border-white/8 bg-[#111110] overflow-y-auto">
        {/* Camera / Lens */}
        <div className="border-b border-white/8 p-3">
          <div className="flex items-center gap-2 mb-3">
            <Camera className="h-3.5 w-3.5 text-white/40" />
            <div className="text-[10px] uppercase tracking-[0.2em] text-white/35">Camera / Lens</div>
          </div>

          {/* Preset lenses */}
          <div className="flex flex-wrap gap-1 mb-3">
            {PRESET_LENSES.map((fl) => (
              <button
                key={fl}
                onClick={() => setFocalLength(fl)}
                className={`rounded-md border px-2 py-1 text-[10px] font-mono transition ${
                  focalLength === fl
                    ? "border-[#D4A853]/40 bg-[#D4A853]/15 text-[#E6C887]"
                    : "border-white/8 bg-white/3 text-white/50 hover:text-white/80"
                }`}
              >
                {fl}mm
              </button>
            ))}
          </div>

          {/* Focal length slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-white/40">Focal Length</span>
              <span className="text-[11px] font-mono text-white/70">{focalLength}mm</span>
            </div>
            <input
              type="range"
              min={10}
              max={300}
              value={focalLength}
              onChange={(e) => setFocalLength(Number(e.target.value))}
              className="w-full accent-[#D4A853]"
            />
            <div className="flex justify-between text-[9px] text-white/20">
              <span>10mm wide</span>
              <span>300mm tele</span>
            </div>
          </div>
        </div>

        {/* Scene */}
        <div className="border-b border-white/8 p-3">
          <div className="flex items-center gap-2 mb-3">
            <Box className="h-3.5 w-3.5 text-white/40" />
            <div className="text-[10px] uppercase tracking-[0.2em] text-white/35">Scene</div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-white/40">Background</span>
              <input
                type="color"
                value={bgColor}
                onChange={(e) => setBgColor(e.target.value)}
                className="h-6 w-10 cursor-pointer rounded border border-white/10 bg-transparent"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-white/40">Ambient Light</span>
              <span className="text-[10px] font-mono text-white/50">{ambientIntensity.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={ambientIntensity}
              onChange={(e) => setAmbientIntensity(Number(e.target.value))}
              className="w-full accent-[#4A7C6F]"
            />
          </div>
        </div>

        {/* Render */}
        <div className="border-b border-white/8 p-3">
          <div className="flex items-center gap-2 mb-3">
            <Eye className="h-3.5 w-3.5 text-white/40" />
            <div className="text-[10px] uppercase tracking-[0.2em] text-white/35">Render</div>
          </div>

          <div className="space-y-2">
            {/* Exposure */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-white/40">Exposure</span>
                <span className="text-[10px] font-mono text-white/50">{exposure.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min={0.1}
                max={3}
                step={0.1}
                value={exposure}
                onChange={(e) => setExposure(Number(e.target.value))}
                className="w-full accent-[#D4A853]"
              />
            </div>

            {/* Bloom controls — only when bloom active */}
            {renderMode === "bloom" && (
              <>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-white/40">Bloom Strength</span>
                    <span className="text-[10px] font-mono text-white/50">{bloomStrength.toFixed(1)}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={3}
                    step={0.1}
                    value={bloomStrength}
                    onChange={(e) => setBloomStrength(Number(e.target.value))}
                    className="w-full accent-[#E6C887]"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-white/40">Bloom Radius</span>
                    <span className="text-[10px] font-mono text-white/50">{bloomRadius.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={bloomRadius}
                    onChange={(e) => setBloomRadius(Number(e.target.value))}
                    className="w-full accent-[#E6C887]"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-white/40">Bloom Threshold</span>
                    <span className="text-[10px] font-mono text-white/50">{bloomThreshold.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={bloomThreshold}
                    onChange={(e) => setBloomThreshold(Number(e.target.value))}
                    className="w-full accent-[#E6C887]"
                  />
                </div>
              </>
            )}

            {/* Mode description */}
            <div className="rounded-md bg-white/3 px-2 py-1.5 text-[9px] text-white/30">
              {renderMode === "standard" && "Standard PBR render with ACES tone mapping"}
              {renderMode === "bloom" && "Unreal Bloom — glow on bright areas, adjust threshold/strength"}
              {renderMode === "luminance" && "Luminance heatmap — blue=dark, green=mid, red=bright, white=blown"}
              {renderMode === "zones" && "Ansel Adams zone system — 11 zones of exposure with grid bands"}
              {renderMode === "overexposure" && "Clipping warnings — red=overexposed, blue=underexposed"}
              {renderMode === "depth" && "Depth map — warm=near, dark=far. Shows Z-buffer distance"}
            </div>
          </div>
        </div>

        {/* Lighting */}
        <div className="flex-1 p-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sun className="h-3.5 w-3.5 text-white/40" />
              <div className="text-[10px] uppercase tracking-[0.2em] text-white/35">Lights</div>
            </div>
            <button
              onClick={addLight}
              className="rounded-md border border-white/10 bg-white/4 p-1 text-white/50 hover:text-white transition"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>

          <div className="space-y-2">
            {lights.map((light) => (
              <div key={light.id} className="rounded-lg border border-white/8 bg-white/2">
                <div
                  className="flex items-center gap-2 px-2 py-1.5 cursor-pointer"
                  onClick={() => setSelectedLight(selectedLight === light.id ? null : light.id)}
                >
                  <div
                    className="h-2.5 w-2.5 rounded-full border border-white/20"
                    style={{ backgroundColor: kelvinToHex(light.temperature) }}
                  />
                  <span className="flex-1 text-[11px] text-white/70">{light.name}</span>
                  <span className="text-[9px] font-mono text-white/30">{light.temperature}K</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeLight(light.id) }}
                    className="rounded p-0.5 text-white/20 hover:text-red-400 transition"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>

                {selectedLight === light.id && (
                  <div className="border-t border-white/5 px-2 py-2 space-y-2">
                    {/* Intensity */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] text-white/35">Intensity</span>
                        <span className="text-[9px] font-mono text-white/45">{light.intensity.toFixed(1)}</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={5}
                        step={0.1}
                        value={light.intensity}
                        onChange={(e) => updateLight(light.id, { intensity: Number(e.target.value) })}
                        className="w-full accent-[#D4A853]"
                      />
                    </div>

                    {/* Temperature */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] text-white/35">Color Temperature</span>
                        <span className="text-[9px] font-mono text-white/45">{light.temperature}K</span>
                      </div>
                      <input
                        type="range"
                        min={2000}
                        max={10000}
                        step={100}
                        value={light.temperature}
                        onChange={(e) => updateLight(light.id, { temperature: Number(e.target.value) })}
                        className="w-full accent-[#E6C887]"
                        style={{
                          background: `linear-gradient(to right, #ff8a00, #fff5e6, #b4d7ff)`,
                        }}
                      />
                    </div>

                    {/* Position */}
                    <div>
                      <div className="text-[9px] text-white/35 mb-1">Position</div>
                      <div className="grid grid-cols-3 gap-1">
                        {(["X", "Y", "Z"] as const).map((axis, i) => (
                          <div key={axis}>
                            <span className="text-[8px] text-white/25">{axis}</span>
                            <input
                              type="number"
                              step={0.5}
                              value={light.position[i]}
                              onChange={(e) => {
                                const pos = [...light.position] as [number, number, number]
                                pos[i] = Number(e.target.value)
                                updateLight(light.id, { position: pos })
                              }}
                              className="w-full rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-mono text-white/60 outline-none focus:border-[#D4A853]/40"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
