import { useEffect, useState } from 'react'

/** Basis der Skala: die Wurzelschriftgröße, für die das Layout entworfen ist. */
const BASE_FONT_PX = 16

/** Liest den aktuellen Skalierungsfaktor aus der Wurzelschriftgröße. */
function readScale(): number {
  if (typeof window === 'undefined') return 1
  const px = parseFloat(getComputedStyle(document.documentElement).fontSize)
  return Number.isFinite(px) && px > 0 ? px / BASE_FONT_PX : 1
}

/**
 * Aktueller UI-Skalierungsfaktor (1 = HD-Laptop, ~1.6 auf dem 4K-Wandmonitor).
 *
 * Das Layout skaliert von selbst, weil es rem-basiert ist — recharts nimmt seine
 * Achsen-, Schrift- und Balkenmaße aber als **nackte Zahlen in px** entgegen und
 * bliebe sonst auf dem großen Monitor winzig. Diese Zahlen werden deshalb mit
 * dem hier gelieferten Faktor multipliziert.
 *
 * Quelle ist bewusst die tatsächlich berechnete Schriftgröße und nicht die
 * Fensterbreite: So bleibt die `clamp()`-Formel in `index.css` die einzige
 * Stelle, an der die Skalierung definiert ist.
 */
export function useUiScale(): number {
  const [scale, setScale] = useState(readScale)

  useEffect(() => {
    const update = () => setScale(readScale())
    // Nach dem ersten Paint noch einmal messen (Schriften/Layout stehen dann).
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  return scale
}
