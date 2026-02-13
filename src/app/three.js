import GUI from 'lil-gui';
import Stats from 'stats-js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as THREE from 'three/webgpu';

import sourceVideo from '../assets/videos/test2.mp4';
import getMaterial from './getMaterial';

const DEFAULT_ASCII_CHARS = '\\'.repeat(3);

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
    this.renderer.setClearColor(0x0, 1);

    this.container.append(this.renderer.domElement);
    this.camera = new THREE.PerspectiveCamera(70, this.width / this.height, 0.01, 1000);

    this.setupStats();

    this.camera.position.set(0, 0, 3.8);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.isPlaying = true;
    this.videoObjectUrl = null;
    this.setupVideoInput();
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
      asciiChars: DEFAULT_ASCII_CHARS,
      uploadVideo: () => {
        this.videoInput.click();
      },
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
    this.gui
      .add(this.settings, 'asciiChars')
      .name('ASCII Chars')
      .onFinishChange((value) => {
        this.settings.asciiChars = this.normalizeAsciiChars(value);
        this.updateMaterial();
      });
    this.gui.add(this.settings, 'uploadVideo').name('🎥Upload Video');
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
    this.applySettingsToUniforms();
  }

  setupVideoInput() {
    this.videoInput = document.createElement('input');
    this.videoInput.type = 'file';
    this.videoInput.accept = 'video/*';
    this.videoInput.style.display = 'none';
    this.videoInput.addEventListener('change', this.handleVideoUpload.bind(this));
    this.container.append(this.videoInput);
  }

  handleVideoUpload(event) {
    const [file] = event.target.files || [];
    if (!file) return;
    const uploadedVideoUrl = URL.createObjectURL(file);
    this.createVideoTexture(uploadedVideoUrl, { isObjectUrl: true });
    this.updateMaterial();
    this.playVideo();
    event.target.value = '';
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

  createVideoTexture(src = sourceVideo, { isObjectUrl = false } = {}) {
    if (this.videoTexture) {
      this.videoTexture.dispose();
    }
    if (this.video) {
      this.video.pause();
      this.video.removeAttribute('src');
      this.video.load();
    }
    if (this.videoObjectUrl) {
      URL.revokeObjectURL(this.videoObjectUrl);
      this.videoObjectUrl = null;
    }

    this.video = document.createElement('video');
    this.video.src = src;
    this.video.crossOrigin = 'anonymous';
    this.video.loop = true;
    this.video.muted = true;
    this.video.autoplay = true;
    this.video.playsInline = true;
    this.video.preload = 'auto';
    this.video.addEventListener('loadedmetadata', () => {
      if (!this.video.videoWidth || !this.video.videoHeight) return;
      this.videoAspect = this.video.videoWidth / this.video.videoHeight;
      this.updateVideoScaleUniform();
    });
    if (isObjectUrl) {
      this.videoObjectUrl = src;
    }

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

  normalizeAsciiChars(asciiChars) {
    return typeof asciiChars === 'string' && asciiChars.length > 0
      ? asciiChars
      : DEFAULT_ASCII_CHARS;
  }

  createASCIITexture(asciiChars = DEFAULT_ASCII_CHARS) {
    // let dict = "`.-':_,^=;>▇<+!rc*/z?sLTv)J7(|Fi{C}fI31tlu[neoZ5Yxjya]2ESwqkP6h9d4VpOGbUAKXHm8RD#$Bg0MNWQ%&@";
    const dict = this.normalizeAsciiChars(asciiChars);
    // let dict = "\\\\";
    this.length = dict.length;
    const cellSize = 64;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
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

    return new THREE.CanvasTexture(canvas);
  }

  applySettingsToUniforms() {
    if (!this.settings || !this.uGamma || !this.uColors) return;
    this.uGamma.value = this.settings.gamma;
    this.uColors[0].value.set(this.settings.color1);
    this.uColors[1].value.set(this.settings.color2);
    this.uColors[2].value.set(this.settings.color3);
    this.uColors[3].value.set(this.settings.color4);
    this.uColors[4].value.set(this.settings.color5);
  }

  updateMaterial() {
    const previousMaterial = this.material;
    const previousAsciiTexture = this.asciiTexture;
    this.asciiTexture = this.createASCIITexture(this.settings?.asciiChars);
    const { material, uGamma, uCharIndex, uVideoScale, uColors } = getMaterial({
      asciiTexture: this.asciiTexture,
      length: this.length,
      scene: this.videoTexture,
      videoScale: this.getVideoScale()
    });
    this.material = material;
    this.uGamma = uGamma;
    this.uCharIndex = uCharIndex;
    this.uVideoScale = uVideoScale;
    this.uColors = uColors;
    if (this.instancedMesh) {
      this.instancedMesh.material = this.material;
    }
    this.applySettingsToUniforms();
    if (previousMaterial) {
      previousMaterial.dispose();
    }
    if (previousAsciiTexture) {
      previousAsciiTexture.dispose();
    }
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
    this.updateMaterial();

    let rows = 180;
    let columns = Math.floor(rows / this.camera.aspect);
    let instances = rows * columns;
    let size = 0.05;

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
