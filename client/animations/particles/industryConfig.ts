import type { ISourceOptions } from '@tsparticles/engine';

/**
 * Industry bubble particle configuration
 * Creates connections between industry bubbles for IndustryShowcase
 */
export const industryParticlesConfig: ISourceOptions = {
  background: {
    color: {
      value: 'transparent',
    },
  },
  fpsLimit: 60,
  interactivity: {
    events: {
      onHover: {
        enable: true,
        mode: 'repulse',
      },
      resize: {
        enable: true,
      },
    },
    modes: {
      repulse: {
        distance: 100,
        duration: 0.4,
      },
    },
  },
  particles: {
    color: {
      value: ['#06b6d4', '#84cc16'], // Cyan and lime
    },
    links: {
      color: '#06b6d4',
      distance: 120,
      enable: true,
      opacity: 0.15,
      width: 1,
    },
    move: {
      direction: 'none',
      enable: true,
      outModes: {
        default: 'bounce',
      },
      random: true,
      speed: 0.3,
      straight: false,
    },
    number: {
      density: {
        enable: true,
      },
      value: 40,
    },
    opacity: {
      value: 0.4,
    },
    shape: {
      type: 'circle',
    },
    size: {
      value: { min: 2, max: 4 },
    },
  },
  detectRetina: true,
};
