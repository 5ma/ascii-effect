import {
  attribute,
  color,
  cross,
  dot,
  float,
  Fn,
  Loop,
  mx_noise_float,
  positionLocal,
  sign,
  step,
  texture,
  transformNormalToView,
  uniform,
  uv,
  varying,
  vec2,
  vec3,
  vec4
} from 'three/tsl';
import * as THREE from 'three/webgpu';

import portrait from '../assets/images/025Pikachu.webp?url';

export default function getMaterial() {
  const textureLoader = new THREE.TextureLoader();
  let uTexture = textureLoader.load(portrait);

  let material = new THREE.NodeMaterial({
    // wireframe: true,
    // side: THREE.DoubleSide
  });

  const ascii = Fn(() => {
    const textureColor = texture(uTexture, attribute('aPixelUV'));
    return textureColor;
    // return texture(uTexture, uv());
    // return vec4(attribute('aPixelUV').x, attribute('aPixelUV').y, 0, 1);
  });

  // material.wireframe = true;
  material.side = THREE.DoubleSide;
  material.colorNode = vec4(1, 0, 0, 1);
  material.outputNode = ascii();

  return material;
}
