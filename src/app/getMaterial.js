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
  vec4,
  floor
} from 'three/tsl';
import * as THREE from 'three/webgpu';

import portrait from '../assets/images/W14-1542-250713.jpg?url';

const palette = ['#6b6b6b', '#cfdc18', '#ff2975', '#f322ff', '#8c1eff'];

export default function getMaterial({
  asciiTexture, length, scene
}) {
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
  const uGamma = uniform(1);
  const uCharIndex = uniform(0);

  const positionMath = Fn(() => {
    return positionLocal.add(attribute('aPosition'));
  });

  const ascii = Fn(() => {
    const textureColor = texture(scene, attribute('aPixelUV'));
    const brightness = pow(textureColor.r.mul(textureColor.g), uGamma).add(attribute('aRandom').mul(0.01));

    const charIndex = floor(brightness.mul(length));
    const asciiUv = vec2(
      uv().x.div(length).add(charIndex.div(length)),
      uv().y
    );
    const asciiCode = texture(asciiTexture, asciiUv);
    let finalColor = uColor1;
    finalColor = mix(finalColor, uColor2, step(0.2, brightness));
    finalColor = mix(finalColor, uColor3, step(0.4, brightness));
    finalColor = mix(finalColor, uColor4, step(0.6, brightness));
    finalColor = mix(finalColor, uColor5, step(0.8, brightness));

    // return textureColor;
    return asciiCode.mul(finalColor);
    // return vec4(finalColor, 1);
    // return vec4(brightness, brightness, brightness, 1);
    // return texture(uTexture, uv());
    // return vec4(attribute('aPixelUV').x, attribute('aPixelUV').y, 0, 1);
  });

  // material.wireframe = true;
  material.side = THREE.DoubleSide;
  material.colorNode = ascii();
  material.positionNode = positionMath();
  // material.outputNode = ascii();


  return { material, uGamma, uCharIndex, uColors: [uColor1, uColor2, uColor3, uColor4, uColor5] };
}
