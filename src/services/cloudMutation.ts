/** Fail closed when PostgREST reports no affected rows without returning an error. */
export function assertAffectedRows<T>(
  rows: readonly T[] | null | undefined,
  message: string,
  expectedCount = 1,
): asserts rows is readonly T[] {
  if (!rows || rows.length !== expectedCount) throw new Error(message);
}
