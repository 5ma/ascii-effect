import GUI from 'lil-gui';
import Stats from 'stats-js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as THREE from 'three/webgpu';

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
      amplitude: 0.35,
      frequency: 1.6,
      speed: 1.2,
      thickness
    };

    this.waveGeometry = new THREE.BoxGeometry(planeSize, thickness, planeSize, segments, 1, segments);
    this.wavePositions = this.waveGeometry.attributes.position;
    this.waveBase = this.wavePositions.array.slice();

    this.waveMesh = new THREE.Mesh(
      this.waveGeometry,
      new THREE.MeshStandardMaterial({
        color: 'white',
        roughness: 0.4,
        metalness: 0.0
      })
    );
    this.scene2.add(this.waveMesh);

    this.addLights(this.scene2);
  }

  async init() {
    await this.renderer.init();
    this.setupSettings();
    this.render();
  }

  setupSettings() {
    const defaultPalette = ['#ffd31b', '#ff911f', '#ff2975', '#f322ff', '#8c1eff'];
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
      waveTwist: 0.6
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
    waveFolder.add(this.settings, 'waveAmplitude', 0, 1.2, 0.01);
    waveFolder.add(this.settings, 'waveFrequency', 0.2, 4, 0.05);
    waveFolder.add(this.settings, 'waveSpeed', 0, 4, 0.05);
    waveFolder.add(this.settings, 'waveTwist', 0, 1, 0.01);
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
    let dict = "`.-':_,^=;>▇<+!rc*/z?sLTv)J7(|Fi{C}fI31tlu[neoZ5Yxjya]2ESwqkP6h9d4VpOGbUAKXHm8RD#$Bg0MNWQ%&@";
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

    // this.time += 0.01;
    const pos = this.wavePositions;
    const base = this.waveBase;
    const { waveAmplitude, waveFrequency, waveSpeed, waveTwist } = this.settings;
    for (let i = 0; i < pos.count; i++) {
      const ix = i * 3;
      const x = base[ix + 0];
      const y = base[ix + 1];
      const z = base[ix + 2];
      const waveA = Math.sin((x * waveFrequency + this.time * waveSpeed));
      const waveB = Math.cos((z * waveFrequency + this.time * waveSpeed * 0.9));
      const wave = waveA * (1 - waveTwist) + waveB * waveTwist;
      if (y > 0) {
        pos.array[ix + 1] = y + wave * waveAmplitude;
      } else {
        pos.array[ix + 1] = y;
      }
    }
    pos.needsUpdate = true;
    this.waveGeometry.computeVertexNormals();
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
