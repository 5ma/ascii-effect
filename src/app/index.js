import '../styles/globals.css';
import '../styles/globals.scss';

import Three from './three';

document.addEventListener('DOMContentLoaded', () => {});

window.addEventListener('load', async () => {
  const container = document.querySelector('#container');
  if (container) {
    const three = new Three(container);
    await three.init();
    return three;
  }
});
