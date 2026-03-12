import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';

interface HeroCompositionProps {
  title: string;
  subtitle: string;
}

/**
 * Remotion composition for hero text animation
 * 5-second sequence with character-by-character build and spring physics
 */
export const HeroComposition: React.FC<HeroCompositionProps> = ({
  title,
  subtitle,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Spring animations for various elements
  const titleProgress = spring({
    frame: frame - 10,
    fps,
    config: {
      damping: 100,
      stiffness: 200,
    },
  });

  const subtitleProgress = spring({
    frame: frame - 40,
    fps,
    config: {
      damping: 100,
      stiffness: 150,
    },
  });

  const backgroundProgress = spring({
    frame,
    fps,
    config: {
      damping: 200,
    },
  });

  // Calculate character reveal
  const titleCharsToShow = Math.floor(
    interpolate(titleProgress, [0, 1], [0, title.length])
  );
  const subtitleCharsToShow = Math.floor(
    interpolate(subtitleProgress, [0, 1], [0, subtitle.length])
  );

  // Background gradient animation
  const gradientOpacity = interpolate(backgroundProgress, [0, 1], [0, 0.3]);
  const gradientScale = interpolate(backgroundProgress, [0, 1], [0.8, 1]);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'transparent',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Animated background gradient */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: `translate(-50%, -50%) scale(${gradientScale})`,
          width: '600px',
          height: '600px',
          background:
            'radial-gradient(circle, rgba(6, 182, 212, 0.3) 0%, transparent 70%)',
          opacity: gradientOpacity,
          filter: 'blur(60px)',
        }}
      />

      {/* Title text with character reveal */}
      <div
        style={{
          fontSize: '4rem',
          fontWeight: 'bold',
          color: 'white',
          textAlign: 'center',
          fontFamily: 'Inter, sans-serif',
          marginBottom: '1rem',
          opacity: titleProgress,
        }}
      >
        {title.split('').map((char, index) => (
          <span
            key={index}
            style={{
              opacity: index < titleCharsToShow ? 1 : 0,
              display: char === ' ' ? 'inline' : 'inline-block',
              transform: `translateY(${
                index < titleCharsToShow ? 0 : 20
              }px) scale(${index < titleCharsToShow ? 1 : 0.8})`,
              transition: 'all 0.1s ease-out',
            }}
          >
            {char === ' ' ? '\u00A0' : char}
          </span>
        ))}
      </div>

      {/* Subtitle text with character reveal */}
      <div
        style={{
          fontSize: '1.5rem',
          color: 'rgba(255, 255, 255, 0.8)',
          textAlign: 'center',
          fontFamily: 'Inter, sans-serif',
          maxWidth: '800px',
          opacity: subtitleProgress,
        }}
      >
        {subtitle.split('').map((char, index) => (
          <span
            key={index}
            style={{
              opacity: index < subtitleCharsToShow ? 1 : 0,
              display: char === ' ' ? 'inline' : 'inline-block',
              transform: `translateY(${
                index < subtitleCharsToShow ? 0 : 10
              }px)`,
              transition: 'all 0.05s ease-out',
            }}
          >
            {char === ' ' ? '\u00A0' : char}
          </span>
        ))}
      </div>
    </div>
  );
};
