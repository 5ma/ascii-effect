import {
  attribute,
  color,
  Fn,
  mix,
  positionLocal,
  pow,
  step,
  texture,
  uniform,
  uv,
  vec2,
  floor
} from 'three/tsl';
import * as THREE from 'three/webgpu';

// const palette = ['#6b6b6b', '#bababa', '#797979', '#2d2d2d', '#000000'];
const palette = ['#212121', '#2d2d2d', '#797979', '#bababa', '#6b6b6b'];

export default function getMaterial({
  asciiTexture, length, scene, videoScale
}) {
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
  const uVideoScale = uniform(videoScale.clone());

  const positionMath = Fn(() => {
    return positionLocal.add(attribute('aPosition'));
  });

  const ascii = Fn(() => {
    const pixelUv = attribute('aPixelUV');
    const videoUv = pixelUv.sub(vec2(0.5)).div(uVideoScale).add(vec2(0.5));
    const insideX = step(0.0, videoUv.x).mul(step(videoUv.x, 1.0));
    const insideY = step(0.0, videoUv.y).mul(step(videoUv.y, 1.0));
    const inside = insideX.mul(insideY);
    const textureColor = texture(scene, videoUv);
    const brightness = pow(textureColor.g, uGamma).add(attribute('aRandom').mul(0.01)).mul(inside);

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
    return asciiCode.mul(finalColor).mul(inside);
    // return vec4(finalColor, 1);
    // return vec4(brightness, brightness, brightness, 1);
    // return vec4(attribute('aPixelUV').x, attribute('aPixelUV').y, 0, 1);
  });

  // material.wireframe = true;
  material.side = THREE.DoubleSide;
  material.colorNode = ascii();
  material.positionNode = positionMath();
  // material.outputNode = ascii();


  return {
    material,
    uGamma,
    uCharIndex,
    uVideoScale,
    uColors: [uColor1, uColor2, uColor3, uColor4, uColor5]
  };
}
