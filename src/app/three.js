import GUI from 'lil-gui';
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
    this.camera2.position.set(0, 0, 3.8);
    this.renderTarget = new THREE.RenderTarget(this.width, this.height);

    let num = 50;
    this.cubes = [];
    for (let i = 0; i < num; i++) {
      let size = range(0.5, 0.9);
      let mesh = new THREE.Mesh(
        new THREE.BoxGeometry(size, size, size),
        new THREE.MeshPhysicalMaterial({ color: 'white' })
      );
      mesh.position.set(range(-2, 2), range(-2, 2), range(-2, 2));
      mesh.rotation.set(range(0, Math.PI), range(0, Math.PI), range(0, Math.PI));
      this.scene2.add(mesh);
      this.cubes.push(mesh);
    }

    this.addLights(this.scene2);
  }

  async init() {
    await this.renderer.init();
    this.setupSettings();
    this.render();
  }

  setupSettings() {
    this.settings = {
      gamma: 4.5,
      charIndex: 0
    };
    this.gui = new GUI();
    this.gui.add(this.settings, 'gamma', 0.5, 7, 0.1).onChange((value) => {
      this.uGamma.value = value;
    });
    this.gui.add(this.settings, 'charIndex', 0, this.length - 1, 1).onChange((value) => {
      this.uCharIndex.value = value;
    });
  }

  createASCIITexture() {
    let dict = "`.-':_,^=;><+!rc*/z?sLTv)J7(|Fi{C}fI31tlu[neoZ5Yxjya]2ESwqkP6h9d4VpOGbUAKXHm8RD#$Bg0MNWQ%&@";
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
      if (i > 50) {
        for (let j = 0; j < 6; j++) {
          ctx.filter = `blur(${j * 1}px)`;
          ctx.fillText(dict[i], cellSize * (i + 0.5), 46);
        }
      }
      ctx.filter = 'none';
      ctx.fillText(dict[i], cellSize * (i + 0.5), 46);
    }

    let asciiTexture = new THREE.CanvasTexture(canvas);
    return asciiTexture;
  }

  addLights(scene) {
    const light1 = new THREE.AmbientLight('#666666', 0.5);
    scene.add(light1);

    const light2 = new THREE.DirectionalLight('#666666', 7.5);
    light2.position.set(1, 1, 0.866);
    scene.add(light2);
  }

  addObjects() {
    // this.material = new THREE.MeshBasicMaterial({ color: 'red', wireframe: true });
    const asciiTexture = this.createASCIITexture();
    const { material, uGamma, uCharIndex } = getMaterial({
      asciiTexture,
      length: this.length
    });
    this.material = material;
    this.uGamma = uGamma;
    this.uCharIndex = uCharIndex;

    let rows = 50;
    let columns = 50;
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
        this.instancedMesh.setMatrixAt(index, m);
        index++;
      }
    }
    this.instancedMesh.instanceMatrix.needsUpdate = true;
    this.geometry.setAttribute('aPixelUV', new THREE.InstancedBufferAttribute(uv, 2));
    this.geometry.setAttribute('aRandom', new THREE.InstancedBufferAttribute(random, 1));

    this.scene.add(this.instancedMesh);
    console.log('this.instancedMesh', this.instancedMesh);
  }

  async render() {
    if (!this.isPlaying) return;

    const elapsedTime = this.clock.getElapsedTime();
    this.time = elapsedTime;

    // this.time += 0.01;
    this.cubes.forEach((cube, i) => {
      cube.rotation.x = Math.sin(this.time * cube.position.x);
      cube.rotation.y = Math.sin(this.time * cube.position.y);
      cube.rotation.z = Math.sin(this.time * cube.position.z);
    });
    // this.material.uniforms.time.value = this.time;

    this.renderer.setRenderTarget(this.renderTarget);
    this.renderer.render(this.scene2, this.camera2);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.scene, this.camera);
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
  }
}
