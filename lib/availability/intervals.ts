import type { TimeInterval } from "./types";

/**
 * Comprueba si un intervalo de tiempo es válido.
 * Un intervalo es válido si ambas fechas son objetos Date válidos con tiempos finitos
 * y la fecha de fin es estrictamente posterior a la fecha de inicio.
 *
 * @param interval - Intervalo semiabierto a verificar.
 * @returns true si el intervalo es válido, false en caso contrario.
 */
export function isValidInterval(interval: TimeInterval): boolean {
  if (!interval || typeof interval !== "object") {
    return false;
  }

  const { startAt, endAt } = interval;
  if (!(startAt instanceof Date) || !(endAt instanceof Date)) {
    return false;
  }

  const startTime = startAt.getTime();
  const endTime = endAt.getTime();

  if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) {
    return false;
  }

  return endTime > startTime;
}

/**
 * Valida un intervalo y lanza un error explicativo si no cumple las reglas.
 *
 * @param interval - Intervalo a verificar.
 * @param contextName - Nombre de contexto para el mensaje de error.
 * @throws {Error} Si el intervalo es inválido o no es un objeto.
 */
export function assertValidInterval(
  interval: TimeInterval,
  contextName = "intervalo"
): void {
  if (!isValidInterval(interval)) {
    throw new Error(
      `Error de validación temporal en ${contextName}: las fechas deben ser instancias Date válidas con valores finitos y endAt debe ser estrictamente posterior a startAt.`
    );
  }
}

/**
 * Ordena y fusiona una lista de intervalos semiabiertos.
 * Los intervalos contiguos (donde el inicio de uno coincide con el fin de otro)
 * o solapados se combinan en un único intervalo continuo.
 *
 * Valida todos los elementos del array de entrada antes de procesarlos.
 *
 * Ejemplo: [09:00, 13:00) y [12:30, 18:00) -> [09:00, 18:00)
 * Ejemplo: [09:00, 13:00) y [13:00, 18:00) -> [09:00, 18:00)
 *
 * @param intervals - Lista de intervalos a fusionar.
 * @returns Lista ordenada de intervalos disjuntos y no contiguos.
 * @throws {Error} Si intervals no es un array o contiene elementos inválidos.
 */
export function mergeIntervals(intervals: TimeInterval[]): TimeInterval[] {
  if (!Array.isArray(intervals)) {
    throw new Error("intervals debe ser un array.");
  }

  // Validar exhaustivamente todos los elementos
  for (let i = 0; i < intervals.length; i++) {
    assertValidInterval(intervals[i], `intervals[${i}]`);
  }

  if (intervals.length === 0) {
    return [];
  }

  // Ordenar cronológicamente por inicio ascendente; ante empate, por fin ascendente
  const sorted = [...intervals].sort((a, b) => {
    const diffStart = a.startAt.getTime() - b.startAt.getTime();
    if (diffStart !== 0) return diffStart;
    return a.endAt.getTime() - b.endAt.getTime();
  });

  const merged: TimeInterval[] = [];
  let current = {
    startAt: new Date(sorted[0].startAt.getTime()),
    endAt: new Date(sorted[0].endAt.getTime()),
  };

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];
    const currentEndTime = current.endAt.getTime();
    const nextStartTime = next.startAt.getTime();
    const nextEndTime = next.endAt.getTime();

    // Si el siguiente intervalo se solapa o es contiguo (nextStart <= currentEnd)
    if (nextStartTime <= currentEndTime) {
      if (nextEndTime > currentEndTime) {
        current.endAt = new Date(nextEndTime);
      }
    } else {
      merged.push(current);
      current = {
        startAt: new Date(next.startAt.getTime()),
        endAt: new Date(nextEndTime),
      };
    }
  }

  merged.push(current);
  return merged;
}

/**
 * Sustrae un conjunto de intervalos (sustraendos) de un conjunto base de intervalos.
 * Modela la resta de conjuntos de intervalos semiabiertos: Base - ⋃ Sustraendos.
 *
 * Valida siempre ambos conjuntos de entrada de forma explícita antes de cualquier
 * retorno temprano, garantizando robustez independientemente del llamador.
 *
 * @param sourceIntervals - Intervalos base disponibles (ej. franjas laborales).
 * @param subtrahendIntervals - Intervalos que ocupan agenda (ej. bloqueos y reservas).
 * @returns Lista ordenada de intervalos libres resultantes.
 * @throws {Error} Si alguno de los parámetros no es un array o contiene elementos inválidos.
 */
export function subtractIntervals(
  sourceIntervals: TimeInterval[],
  subtrahendIntervals: TimeInterval[]
): TimeInterval[] {
  if (!Array.isArray(sourceIntervals)) {
    throw new Error("sourceIntervals debe ser un array.");
  }

  if (!Array.isArray(subtrahendIntervals)) {
    throw new Error("subtrahendIntervals debe ser un array.");
  }

  // Validación explícita de todos los elementos de ambos conjuntos
  for (let i = 0; i < sourceIntervals.length; i++) {
    assertValidInterval(sourceIntervals[i], `sourceIntervals[${i}]`);
  }

  for (let i = 0; i < subtrahendIntervals.length; i++) {
    assertValidInterval(subtrahendIntervals[i], `subtrahendIntervals[${i}]`);
  }

  const mergedSource = mergeIntervals(sourceIntervals);
  const mergedSubtrahends = mergeIntervals(subtrahendIntervals);

  if (mergedSource.length === 0) {
    return [];
  }

  if (mergedSubtrahends.length === 0) {
    return mergedSource;
  }

  const result: TimeInterval[] = [];

  for (const base of mergedSource) {
    let pieces: TimeInterval[] = [
      {
        startAt: new Date(base.startAt.getTime()),
        endAt: new Date(base.endAt.getTime()),
      },
    ];

    for (const sub of mergedSubtrahends) {
      const subStart = sub.startAt.getTime();
      const subEnd = sub.endAt.getTime();
      const nextPieces: TimeInterval[] = [];

      for (const piece of pieces) {
        const pieceStart = piece.startAt.getTime();
        const pieceEnd = piece.endAt.getTime();

        // Caso 1: No hay intersección (el sustraendo está totalmente a la izquierda o derecha)
        if (subEnd <= pieceStart || subStart >= pieceEnd) {
          nextPieces.push(piece);
          continue;
        }

        // Caso 2: El sustraendo cubre completamente la pieza
        if (subStart <= pieceStart && subEnd >= pieceEnd) {
          continue; // La pieza queda totalmente eliminada
        }

        // Caso 3: El sustraendo corta el inicio de la pieza
        if (subStart <= pieceStart && subEnd < pieceEnd) {
          nextPieces.push({
            startAt: new Date(subEnd),
            endAt: new Date(pieceEnd),
          });
          continue;
        }

        // Caso 4: El sustraendo corta el final de la pieza
        if (subStart > pieceStart && subEnd >= pieceEnd) {
          nextPieces.push({
            startAt: new Date(pieceStart),
            endAt: new Date(subStart),
          });
          continue;
        }

        // Caso 5: El sustraendo cae estrictamente dentro de la pieza, dividiéndola en dos
        if (subStart > pieceStart && subEnd < pieceEnd) {
          nextPieces.push({
            startAt: new Date(pieceStart),
            endAt: new Date(subStart),
          });
          nextPieces.push({
            startAt: new Date(subEnd),
            endAt: new Date(pieceEnd),
          });
          continue;
        }
      }

      pieces = nextPieces;
    }

    result.push(...pieces);
  }

  return result;
}
