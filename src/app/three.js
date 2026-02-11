import GUI from 'lil-gui';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as THREE from 'three/webgpu';

export default class Three {
  constructor(container) {
    this.scene = new THREE.Scene();

    this.container = container;
    this.width = this.container.offsetWidth;
    this.height = this.container.offsetHeight;
    this.renderer = new THREE.WebGPURenderer();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(this.width, this.height);
    this.renderer.setClearColor(0xee_ee_ee, 1);

    this.container.append(this.renderer.domElement);
    this.camera = new THREE.PerspectiveCamera(70, this.width / this.height, 0.01, 1000);

    this.camera.position.set(0, 0, 2);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.time = 0;
    this.clock = new THREE.Clock();
    this.isPlaying = true;

    this.addLights();
    this.addObjects();
    // WebGPU requires an async init before any render calls.
    this.setResize();
  }

  async init() {
    await this.renderer.init();
    this.render();
  }

  setupSettings() {
    this.settings = {
      progress: 0
    };
    this.gui = new GUI();
    this.gui.add(this.settings, 'progress', 0, 1, 0.01).onChange(() => {});
  }

  addLights() {
    const light1 = new THREE.AmbientLight('#666666', 0.5);
    this.scene.add(light1);

    const light2 = new THREE.DirectionalLight('#666666', 0.5);
    light2.position.set(0.5, 0, 0.866);
    this.scene.add(light2);
  }

  addObjects() {
    this.material = new THREE.MeshBasicMaterial({ color: 'red' });

    this.planeGeometry = new THREE.PlaneGeometry(1, 1, 1, 1);

    this.planeMesh = new THREE.Mesh(this.planeGeometry, this.material);
    this.scene.add(this.planeMesh);
  }

  render() {
    if (!this.isPlaying) return;

    const elapsedTime = this.clock.getElapsedTime();
    this.time = elapsedTime;
    // this.material.uniforms.time.value = this.time;

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
