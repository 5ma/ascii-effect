import GUI from 'lil-gui';
import Stats from 'stats-js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as THREE from 'three/webgpu';

import getMaterial from './getMaterial';
import sourceVideo from '../assets/videos/test2.mp4';

export default class Three {
  constructor(container) {
    this.scene = new THREE.Scene();

    this.container = container;
    this.width = this.container.offsetWidth;
    this.height = this.container.offsetHeight;
    this.videoAspect = 1280 / 720;
    this.renderer = new THREE.WebGPURenderer();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(this.width, this.height);
    this.renderer.setClearColor(0x000000, 1);

    this.container.append(this.renderer.domElement);
    this.camera = new THREE.PerspectiveCamera(70, this.width / this.height, 0.01, 1000);

    this.setupStats();

    this.camera.position.set(0, 0, 3.8);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.isPlaying = true;
    this.createVideoTexture();

    // this.createASCIITexture();
    this.addLights(this.scene);
    this.addObjects();
    // WebGPU requires an async init before any render calls.
    this.setResize();
  }

  async init() {
    await this.renderer.init();
    this.setupSettings();
    this.playVideo();
    this.render();
  }

  playVideo() {
    if (!this.video) return;
    const playPromise = this.video.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        const retryPlay = () => {
          this.video.play().catch(() => {});
        };
        window.addEventListener('pointerdown', retryPlay, { once: true });
      });
    }
  }

  setupSettings() {
    const defaultPalette = ['#212121', '#2d2d2d', '#797979', '#bababa', '#6b6b6b'];
    this.settings = {
      gamma: 0.8,
      charIndex: 0,
      color1: defaultPalette[0],
      color2: defaultPalette[1],
      color3: defaultPalette[2],
      color4: defaultPalette[3],
      color5: defaultPalette[4]
    };
    this.gui = new GUI();
    this.gui.add(this.settings, 'gamma', 0.3, 7, 0.1).onChange((value) => {
      this.uGamma.value = value;
    });
    // this.gui.add(this.settings, 'charIndex', 0, this.length - 1, 1).onChange((value) => {
    //   this.uCharIndex.value = value;
    // });
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

  createVideoTexture() {
    this.video = document.createElement('video');
    this.video.src = sourceVideo;
    this.video.crossOrigin = 'anonymous';
    this.video.loop = true;
    this.video.muted = true;
    this.video.autoplay = true;
    this.video.playsInline = true;
    this.video.preload = 'auto';

    this.videoTexture = new THREE.VideoTexture(this.video);
    this.videoTexture.colorSpace = THREE.SRGBColorSpace;
    this.videoTexture.minFilter = THREE.LinearFilter;
    this.videoTexture.magFilter = THREE.LinearFilter;
    this.videoTexture.generateMipmaps = false;
    this.videoTexture.flipY = true;
  }

  getVideoScale() {
    const viewportAspect = this.width / this.height;
    if (viewportAspect > this.videoAspect) {
      return new THREE.Vector2(this.videoAspect / viewportAspect, 1);
    }
    return new THREE.Vector2(1, viewportAspect / this.videoAspect);
  }

  updateVideoScaleUniform() {
    if (!this.uVideoScale) return;
    const scale = this.getVideoScale();
    this.uVideoScale.value.set(scale.x, scale.y);
  }

  createASCIITexture() {
    // let dict = "`.-':_,^=;>▇<+!rc*/z?sLTv)J7(|Fi{C}fI31tlu[neoZ5Yxjya]2ESwqkP6h9d4VpOGbUAKXHm8RD#$Bg0MNWQ%&@";
    let dict = '\\\\\\';
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

    const light2 = new THREE.DirectionalLight('#ffffff', 4);
    light2.position.set(0.5, 6, 0);
    scene.add(light2);
  }

  addObjects() {
    // this.material = new THREE.MeshBasicMaterial({ color: 'red', wireframe: true });
    const asciiTexture = this.createASCIITexture();
    const { material, uGamma, uCharIndex, uVideoScale, uColors } = getMaterial({
      asciiTexture,
      length: this.length,
      scene: this.videoTexture,
      videoScale: this.getVideoScale()
    });
    this.material = material;
    this.uGamma = uGamma;
    this.uCharIndex = uCharIndex;
    this.uVideoScale = uVideoScale;
    this.uColors = uColors;

    let rows = 70;
    let columns = Math.floor(rows / this.camera.aspect);
    let instances = rows * columns;
    let size = 0.08;

    this.geometry = new THREE.PlaneGeometry(size, size, 1, 1);

    this.positions = new Float32Array(instances * 3);
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
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.updateVideoScaleUniform();
  }
}
