import GUI from 'lil-gui';
import Stats from 'stats-js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as THREE from 'three/webgpu';
import {
  dot,
  float,
  mix,
  normalize,
  normalLocal,
  positionLocal,
  sin,
  cos,
  step,
  uniform,
  vec2,
  vec3
} from 'three/tsl';

import getMaterial from './getMaterial';

const range = (min, max) => Math.random() * (max - min) + min;

export default class Three {
  constructor(container) {
    this.scene = new THREE.Scene();

    this.container = container;
    this.width = this.container.offsetWidth;
    this.height = this.container.offsetHeight;
    this.renderer = new THREE.WebGPURenderer();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(this.width, this.height);
    this.renderer.setClearColor(0x000000, 1);

    this.container.append(this.renderer.domElement);
    this.camera = new THREE.PerspectiveCamera(70, this.width / this.height, 0.01, 1000);

    this.setupStats();

    this.camera.position.set(0, 0, 3.8);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.time = 0;
    this.clock = new THREE.Clock();
    this.isPlaying = true;

    this.anotherScene();
    // this.createASCIITexture();
    this.addLights(this.scene);
    this.addObjects();
    // WebGPU requires an async init before any render calls.
    this.setResize();
  }

  anotherScene() {
    this.scene2 = new THREE.Scene();
    this.camera2 = new THREE.PerspectiveCamera(70, this.width / this.height, 0.01, 400);
    this.camera2.position.set(0, 0, 5.8);
    this.controls2 = new OrbitControls(this.camera2, this.renderer.domElement);
    this.controls2.enableDamping = true;
    this.controls2.target.set(0, 0, 0);
    this.controls2.update();
    this.renderTarget = new THREE.RenderTarget(this.width, this.height);

    const planeSize = 6;
    const thickness = 0.3;
    const segments = 120;
    this.wave = {
      amplitude: 1,
      frequency: 2.0,
      speed: 1.1,
      thickness,
      chop: 0.15
    };

    this.uWaveTime = uniform(0);
    this.uWaveAmplitude = uniform(this.wave.amplitude);
    this.uWaveFrequency = uniform(this.wave.frequency);
    this.uWaveSpeed = uniform(this.wave.speed);
    this.uWaveChop = uniform(this.wave.chop);

    this.waveGroup = new THREE.Group();
    this.waveLayers = [];
    const layers = 4;
    const spacing = thickness * 4;
    const startY = -((layers - 1) * spacing) / 2;
    for (let i = 0; i < layers; i++) {
      const geometry = new THREE.BoxGeometry(planeSize, thickness, planeSize, segments, 1, segments);
      const phase = i * 0.6;
      const material = this.createWaveMaterial(phase);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.y = startY + i * spacing;
      this.waveGroup.add(mesh);
      this.waveLayers.push({ mesh, material });
    }
    this.scene2.add(this.waveGroup);

    this.addLights(this.scene2);
  }

  async init() {
    await this.renderer.init();
    this.setupSettings();
    this.render();
  }

  setupSettings() {
    const defaultPalette = ['#fbf6df', '#f0ff1f', '#ff2975', '#f322ff', '#8c1eff'];
    this.settings = {
      gamma: 0.8,
      charIndex: 0,
      color1: defaultPalette[0],
      color2: defaultPalette[1],
      color3: defaultPalette[2],
      color4: defaultPalette[3],
      color5: defaultPalette[4],
      waveAmplitude: this.wave.amplitude,
      waveFrequency: this.wave.frequency,
      waveSpeed: this.wave.speed,
      waveChop: this.wave.chop
    };
    this.gui = new GUI();
    this.gui.add(this.settings, 'gamma', 0.5, 7, 0.1).onChange((value) => {
      this.uGamma.value = value;
    });
    this.gui.add(this.settings, 'charIndex', 0, this.length - 1, 1).onChange((value) => {
      this.uCharIndex.value = value;
    });
    const colorFolder = this.gui.addFolder('Colors');
    colorFolder.addColor(this.settings, 'color1').onChange((value) => {
      this.uColors[0].value.set(value);
    });
    colorFolder.addColor(this.settings, 'color2').onChange((value) => {
      this.uColors[1].value.set(value);
    });
    colorFolder.addColor(this.settings, 'color3').onChange((value) => {
      this.uColors[2].value.set(value);
    });
    colorFolder.addColor(this.settings, 'color4').onChange((value) => {
      this.uColors[3].value.set(value);
    });
    colorFolder.addColor(this.settings, 'color5').onChange((value) => {
      this.uColors[4].value.set(value);
    });
    const waveFolder = this.gui.addFolder('Wave');
    waveFolder.add(this.settings, 'waveAmplitude', 0, 2, 0.01).onChange((value) => {
      this.uWaveAmplitude.value = value;
    });
    waveFolder.add(this.settings, 'waveFrequency', 0.2, 4, 0.05).onChange((value) => {
      this.uWaveFrequency.value = value;
    });
    waveFolder.add(this.settings, 'waveSpeed', 0, 4, 0.05).onChange((value) => {
      this.uWaveSpeed.value = value;
    });
    waveFolder.add(this.settings, 'waveChop', 0, 1, 0.01).onChange((value) => {
      this.uWaveChop.value = value;
    });
  }

  createWaveMaterial(phase) {
    const material = new THREE.MeshStandardNodeMaterial();
    material.color = new THREE.Color('white');
    material.roughness = 0.4;
    material.metalness = 0.0;
    material.side = THREE.DoubleSide;

    const uPhase = uniform(phase);

    const position = positionLocal;
    const isTop = step(0.0, position.y);
    const xz = vec2(position.x, position.z);
    const time = this.uWaveTime;
    const amplitude = this.uWaveAmplitude;
    const frequency = this.uWaveFrequency;
    const speed = this.uWaveSpeed;
    const chop = this.uWaveChop;
    const twoPi = float(Math.PI * 2);

    const waveComponent = (dir, length, ampBase, speedBase) => {
      const k = twoPi.div(length).mul(frequency);
      const phaseNode = dot(dir, xz)
        .mul(k)
        .add(time.add(uPhase).mul(speed).mul(speedBase));
      const sinP = sin(phaseNode);
      const cosP = cos(phaseNode);
      const amp = float(ampBase).mul(amplitude);
      return {
        height: sinP.mul(amp),
        dhdx: cosP.mul(amp).mul(k).mul(dir.x),
        dhdz: cosP.mul(amp).mul(k).mul(dir.y),
        dispX: cosP.mul(amp).mul(dir.x),
        dispZ: cosP.mul(amp).mul(dir.y)
      };
    };

    const w1 = waveComponent(normalize(vec2(1, 0.25)), 4.8, 0.22, 0.9);
    const w2 = waveComponent(normalize(vec2(-0.4, 0.9)), 2.6, 0.14, 1.2);

    const height = w1.height.add(w2.height);
    const dhdx = w1.dhdx.add(w2.dhdx);
    const dhdz = w1.dhdz.add(w2.dhdz);
    const dispX = w1.dispX.add(w2.dispX);
    const dispZ = w1.dispZ.add(w2.dispZ);

    const displaced = vec3(
      position.x.add(dispX.mul(chop).mul(isTop)),
      position.y.add(height.mul(isTop)),
      position.z.add(dispZ.mul(chop).mul(isTop))
    );
    const normalTop = normalize(vec3(dhdx.negate(), float(1), dhdz.negate()));
    const blendedNormal = normalize(mix(normalLocal, normalTop, isTop));

    material.positionNode = displaced;
    material.normalNode = blendedNormal;

    return material;
  }

  setupStats() {
    this.statsFps = new Stats();
    this.statsFps.showPanel(0);
    this.statsFps.dom.style.left = '0px';
    this.statsFps.dom.style.top = '0px';
    this.statsFps.dom.style.zIndex = '10';
    this.container.append(this.statsFps.dom);

    this.statsMem = new Stats();
    this.statsMem.showPanel(2);
    this.statsMem.dom.style.left = '90px';
    this.statsMem.dom.style.top = '0px';
    this.statsMem.dom.style.zIndex = '10';
    this.container.append(this.statsMem.dom);
  }

  createASCIITexture() {
    // let dict = "`.-':_,^=;>▇<+!rc*/z?sLTv)J7(|Fi{C}fI31tlu[neoZ5Yxjya]2ESwqkP6h9d4VpOGbUAKXHm8RD#$Bg0MNWQ%&@";
    let dict = 'TBWA\\HAKUHODO\\';
    // let dict = "\\\\";
    this.length = dict.length;
    const cellSize = 64;
    let canvas = document.createElement('canvas');
    let ctx = canvas.getContext('2d');
    canvas.width = cellSize * this.length;
    canvas.height = cellSize;
    // document.body.append(canvas);

    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    ctx.font = 'bold 40px Menlo';
    ctx.textAlign = 'center';

    for (let i = 0; i < this.length; i++) {
      // if (i > 50) {
      //   for (let j = 0; j < 6; j++) {
      //     ctx.filter = `blur(${j * 1}px)`;
      //     ctx.fillText(dict[i], cellSize * (i + 0.5), 46);
      //   }
      // }
      ctx.filter = 'none';
      ctx.fillText(dict[i], cellSize * (i + 0.5), 46);
    }

    let asciiTexture = new THREE.CanvasTexture(canvas);
    return asciiTexture;
  }

  addLights(scene) {
    const light1 = new THREE.AmbientLight('#ffffff', 0.05);
    scene.add(light1);

    const light2 = new THREE.DirectionalLight('#ffffff', 1.5);
    light2.position.set(1, 0, 0.866);
    scene.add(light2);
  }

  addObjects() {
    // this.material = new THREE.MeshBasicMaterial({ color: 'red', wireframe: true });
    const asciiTexture = this.createASCIITexture();
    const { material, uGamma, uCharIndex, uColors } = getMaterial({
      asciiTexture,
      length: this.length,
      scene: this.renderTarget.texture
    });
    this.material = material;
    this.uGamma = uGamma;
    this.uCharIndex = uCharIndex;
    this.uColors = uColors;

    let rows = 50;
    let columns = Math.floor(rows / this.camera.aspect);
    let instances = rows * columns;
    let size = 0.1;

    this.geometry = new THREE.PlaneGeometry(size, size, 1, 1);

    this.positions = new Float32Array(instances * 3);
    this.colors = new Float32Array(instances * 3);
    let uv = new Float32Array(instances * 2);
    let random = new Float32Array(instances);
    this.instancedMesh = new THREE.InstancedMesh(this.geometry, this.material, instances);

    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < columns; j++) {
        let index = i * columns + j;

        uv[index * 2 + 0] = i / (rows - 1);
        uv[index * 2 + 1] = j / (columns - 1);

        random[index] = Math.pow(Math.random(), 2);

        this.positions[index * 3 + 0] = i * size - (size * (rows - 1)) / 2;
        this.positions[index * 3 + 1] = j * size - (size * (columns - 1)) / 2;
        this.positions[index * 3 + 2] = 0;

        let m = new THREE.Matrix4();
        m.setPosition(
          this.positions[index * 3 + 0],
          this.positions[index * 3 + 1],
          this.positions[index * 3 + 2]
        );
        // this.instancedMesh.setMatrixAt(index, m);
        index++;
      }
    }
    // this.instancedMesh.instanceMatrix.needsUpdate = true;
    this.geometry.setAttribute('aPosition', new THREE.InstancedBufferAttribute(this.positions, 3));
    this.geometry.setAttribute('aPixelUV', new THREE.InstancedBufferAttribute(uv, 2));
    this.geometry.setAttribute('aRandom', new THREE.InstancedBufferAttribute(random, 1));

    this.scene.add(this.instancedMesh);
    console.log('this.instancedMesh', this.instancedMesh);
  }

  async render() {
    if (!this.isPlaying) return;

    this.statsFps.begin();
    this.statsMem.begin();

    const elapsedTime = this.clock.getElapsedTime();
    this.time = elapsedTime;

    this.uWaveTime.value = this.time;
    // this.material.uniforms.time.value = this.time;

    this.controls2.update();
    this.renderer.setRenderTarget(this.renderTarget);
    this.renderer.render(this.scene2, this.camera2);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.scene, this.camera);
    this.statsFps.end();
    this.statsMem.end();
    requestAnimationFrame(this.render.bind(this));
  }

  setResize() {
    window.addEventListener('resize', this.onResize.bind(this));
  }

  onResize() {
    this.width = this.container.offsetWidth;
    this.height = this.container.offsetHeight;
    this.renderer.setSize(this.width, this.height);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.camera2.aspect = this.width / this.height;
    this.camera2.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }
}
