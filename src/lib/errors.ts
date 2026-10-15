/* ------------------------------------------------------------------ */
/*  MANEJO DE ERRORES ESTRUCTURADO                                     */
/*  Todo error operativo del sistema se clasifica, registra y          */
/*  retorna con contexto suficiente para que el humano sepa qué hacer. */
/*  El principio es: el sistema nunca deja al humano sin salida (R11). */
/* ------------------------------------------------------------------ */

export type ErrorCode =
  | "VALIDATION_ERROR"     // Input inválido del cliente
  | "NOT_FOUND"            // Entidad no encontrada
  | "PRECONDITION_FAILED"  // Estado actual no permite la operación
  | "CONFLICT_BLOCKED"     // Escritura bloqueada por conflicto abierto (R3)
  | "RULE_VIOLATION"       // Regla innegociable violada (R1-R12)
  | "EXPIRED"              // Propuesta/acción caducada
  | "SUPERSEDED"           // Condición cambió, propuesta obsoleta
  | "DUPLICATE"            // Entidad ya existe (idempotencia)
  | "SYSTEM_ERROR"         // Error interno no controlado
  | "DEGRADED_MODE";       // El sistema no está disponible (R11)

export class OperationalError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = "OperationalError";
  }
}

/** Valida que un valor no sea vacío/null/undefined */
export function requireParam(name: string, value: unknown): asserts value is string | number {
  if (value === undefined || value === null || value === "") {
    throw new OperationalError("VALIDATION_ERROR", `Parámetro requerido: "${name}".`, { param: name });
  }
}

/** Valida que un valor sea un entero positivo */
export function requireId(name: string, value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1 || n !== Math.floor(n)) {
    throw new OperationalError("VALIDATION_ERROR", `"${name}" debe ser un entero positivo.`, { param: name, value });
  }
  return n;
}

/** Valida que un valor sea una de las opciones permitidas */
export function requireOneOf<T extends string>(name: string, value: unknown, allowed: T[]): T {
  if (!allowed.includes(value as T)) {
    throw new OperationalError("VALIDATION_ERROR", `"${name}" debe ser uno de: ${allowed.join(", ")}. Recibido: "${value}".`, { param: name, value, allowed });
  }
  return value as T;
}

/** Convierte errores no controlados en respuesta de modo degradado (R11) */
export function toDegradedResponse(error: unknown): { ok: false; message: string; tone: "error"; code: ErrorCode } {
  if (error instanceof OperationalError) {
    return {
      ok: false,
      message: error.message,
      tone: "error",
      code: error.code,
    };
  }
  const msg = error instanceof Error ? error.message : "Error desconocido";
  return {
    ok: false,
    message: `Error del sistema (${msg.slice(0, 120)}). MODO DEGRADADO: sigue operando con la hoja del turno; al volver, el registro recompone lo ocurrido sin duplicar acciones (R11).`,
    tone: "error",
    code: "DEGRADED_MODE",
  };
}
