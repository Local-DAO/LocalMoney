import confetti from 'canvas-confetti'

// Local orange colors from tokens.scss
const LOCAL_ORANGE_PRIMARY = '#ef6100'
const LOCAL_ORANGE_SECONDARY = '#fba367'

/**
 * Trigger orange confetti explosion
 */
export function triggerOrangeConfetti(): void {
  const count = 200
  const defaults = {
    origin: { y: 0.7 },
    colors: [LOCAL_ORANGE_PRIMARY, LOCAL_ORANGE_SECONDARY],
  }

  function fire(particleRatio: number, opts: confetti.Options): void {
    confetti({
      ...defaults,
      ...opts,
      particleCount: Math.floor(count * particleRatio),
    })
  }

  // Create explosion effect with multiple bursts
  fire(0.25, {
    spread: 26,
    startVelocity: 55,
  })

  fire(0.2, {
    spread: 60,
  })

  fire(0.35, {
    spread: 100,
    decay: 0.91,
    scalar: 0.8,
  })

  fire(0.1, {
    spread: 120,
    startVelocity: 25,
    decay: 0.92,
    scalar: 1.2,
  })

  fire(0.1, {
    spread: 120,
    startVelocity: 45,
  })
}

/**
 * Composable for using confetti in Vue components
 */
export function useConfetti() {
  return {
    triggerOrangeConfetti,
  }
}
