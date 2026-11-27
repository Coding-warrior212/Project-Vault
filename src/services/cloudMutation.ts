/** Fail closed when PostgREST reports no affected rows without returning an error. */
export function assertAffectedRows<T>(
  rows: readonly T[] | null | undefined,
  message: string,
): asserts rows is readonly T[] {
  if (!rows?.length) throw new Error(message);
}
