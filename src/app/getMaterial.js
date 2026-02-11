import {
  attribute,
  color,
  cross,
  dot,
  float,
  Fn,
  Loop,
  mix,
  mx_noise_float,
  positionLocal,
  pow,
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

const palette = ['#ffd31b', '#ff911f', '#ff2975', '#f322ff', '#8c1eff'];

export default function getMaterial() {
  const textureLoader = new THREE.TextureLoader();
  let uTexture = textureLoader.load(portrait);

  let material = new THREE.NodeMaterial({
    // wireframe: true,
    // side: THREE.DoubleSide
  });

  const uColor1 = uniform(color(palette[0]));
  const uColor2 = uniform(color(palette[1]));
  const uColor3 = uniform(color(palette[2]));
  const uColor4 = uniform(color(palette[3]));
  const uColor5 = uniform(color(palette[4]));
  const uGamma = uniform(2.2);

  const ascii = Fn(() => {
    const textureColor = texture(uTexture, attribute('aPixelUV'));
    const brightness = pow(textureColor.r, uGamma);
    let finalColor = uColor1;
    finalColor = mix(finalColor, uColor2, step(0.2, brightness));
    finalColor = mix(finalColor, uColor3, step(0.4, brightness));
    finalColor = mix(finalColor, uColor4, step(0.6, brightness));
    finalColor = mix(finalColor, uColor5, step(0.8, brightness));

    // return textureColor;
    return vec4(finalColor, 1);
    // return vec4(brightness, brightness, brightness, 1);
    // return texture(uTexture, uv());
    // return vec4(attribute('aPixelUV').x, attribute('aPixelUV').y, 0, 1);
  });

  // material.wireframe = true;
  material.side = THREE.DoubleSide;
  material.colorNode = vec4(1, 0, 0, 1);
  material.outputNode = ascii();

  return { material, uGamma };
}
