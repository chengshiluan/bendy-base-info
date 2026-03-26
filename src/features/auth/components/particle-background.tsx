'use client';

import { useEffect, useRef } from 'react';

type Particle = {
  alpha: number;
  size: number;
  speedX: number;
  speedY: number;
  x: number;
  y: number;
};

const PARTICLE_COUNT = 42;
const LINK_DISTANCE = 140;

function createParticle(width: number, height: number): Particle {
  return {
    alpha: 0.28 + Math.random() * 0.42,
    size: 0.8 + Math.random() * 2.2,
    speedX: (Math.random() - 0.5) * 0.22,
    speedY: (Math.random() - 0.5) * 0.22,
    x: Math.random() * width,
    y: Math.random() * height
  };
}

export function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let animationFrame = 0;
    let particles: Particle[] = [];
    let width = 0;
    let height = 0;

    const getParticleColor = () =>
      document.documentElement.classList.contains('dark')
        ? '255, 255, 255'
        : '17, 24, 39';

    const resizeCanvas = () => {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      particles = Array.from({ length: PARTICLE_COUNT }, () =>
        createParticle(width, height)
      );
    };

    const renderFrame = (animate: boolean) => {
      const color = getParticleColor();

      context.clearRect(0, 0, width, height);

      particles.forEach((particle, index) => {
        particle.x += particle.speedX;
        particle.y += particle.speedY;

        if (particle.x <= 0 || particle.x >= width) {
          particle.speedX *= -1;
        }

        if (particle.y <= 0 || particle.y >= height) {
          particle.speedY *= -1;
        }

        context.beginPath();
        context.fillStyle = `rgba(${color}, ${particle.alpha})`;
        context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        context.fill();

        for (
          let nextIndex = index + 1;
          nextIndex < particles.length;
          nextIndex += 1
        ) {
          const nextParticle = particles[nextIndex];
          const deltaX = particle.x - nextParticle.x;
          const deltaY = particle.y - nextParticle.y;
          const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

          if (distance > LINK_DISTANCE) {
            continue;
          }

          context.beginPath();
          context.strokeStyle = `rgba(${color}, ${(1 - distance / LINK_DISTANCE) * 0.16})`;
          context.lineWidth = 0.8;
          context.moveTo(particle.x, particle.y);
          context.lineTo(nextParticle.x, nextParticle.y);
          context.stroke();
        }
      });

      if (animate) {
        animationFrame = window.requestAnimationFrame(() => renderFrame(true));
      }
    };

    const handleResize = () => {
      resizeCanvas();
      if (reduceMotion) {
        renderFrame(false);
      }
    };

    resizeCanvas();
    window.addEventListener('resize', handleResize);

    if (reduceMotion) {
      renderFrame(false);
      return () => {
        window.removeEventListener('resize', handleResize);
      };
    }

    animationFrame = window.requestAnimationFrame(() => renderFrame(true));

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden='true'
      className='pointer-events-none absolute inset-0 h-full w-full'
    />
  );
}
