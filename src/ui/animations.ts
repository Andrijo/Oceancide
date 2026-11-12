import gsap from "gsap"
import { resolveReducedMotion, type ReduceMotionChoice } from "@core/settings"

/** Clase en <html> con la que el CSS apaga las animaciones decorativas. */
export const REDUCE_MOTION_CLASS = "reduce-motion"

const reduceMotionQuery =
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : null

let reduceMotionChoice: ReduceMotionChoice = "system"

/** ¿Hay que reducir el movimiento (ajuste del jugador o, si no, el del sistema)? */
export function prefersReducedMotion(): boolean {
  return resolveReducedMotion(
    reduceMotionChoice,
    reduceMotionQuery?.matches ?? false,
  )
}

function syncReduceMotionClass(): void {
  if (typeof document === "undefined") return
  document.documentElement.classList.toggle(
    REDUCE_MOTION_CLASS,
    prefersReducedMotion(),
  )
}

/** Fija el ajuste "Reducir movimiento" y lo aplica al momento. */
export function setReduceMotionChoice(choice: ReduceMotionChoice): void {
  reduceMotionChoice = choice
  syncReduceMotionClass()
}

// En "system", seguir los cambios de la preferencia sin recargar.
reduceMotionQuery?.addEventListener?.("change", syncReduceMotionClass)
syncReduceMotionClass()

/**
 * Congela o reanuda todas las animaciones GSAP.
 *
 * El bucle de simulación se pausa por separado en `Game.setPaused`. GSAP
 * corre en tiempo real de pared, así que sin esto los tweens seguirían
 * avanzando mientras el juego está en pausa.
 */
export function setAnimationsPaused(paused: boolean): void {
  if (paused) {
    gsap.globalTimeline.pause()
  } else {
    gsap.globalTimeline.resume()
  }
}

/**
 * Revelado escalonado de las cartas a elegir.
 *
 * Desactiva la `transition` de CSS durante el tween (si no, la transición
 * suaviza cada fotograma de GSAP y el efecto se ve con retraso) y la restaura
 * al terminar. Con el movimiento reducido las cartas aparecen ya colocadas.
 */
export function revealCards(
  targets: Element[],
): ReturnType<typeof gsap.timeline> {
  const timeline = gsap.timeline()
  const els = targets.filter(
    (el): el is HTMLElement => el instanceof HTMLElement,
  )

  if (els.length === 0 || prefersReducedMotion()) return timeline

  for (const el of els) {
    el.dataset.revealTransition = el.style.transition
    el.style.transition = "none"
  }

  return timeline.from(els, {
    opacity: 0,
    y: 56,
    scale: 0.86,
    duration: 0.5,
    ease: "back.out(1.5)",
    stagger: 0.09,
    clearProps: "transform",
    onComplete: () => {
      for (const el of els) {
        el.style.transition = el.dataset.revealTransition ?? ""
        delete el.dataset.revealTransition
      }
    },
  })
}
