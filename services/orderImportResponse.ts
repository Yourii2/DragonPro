export interface PersistedOrderIdentity {
  order_id: unknown;
  order_number: unknown;
}

export const attachPersistedOrderIdentity = <T>(
  importedOrders: readonly T[],
  createdOrders: readonly PersistedOrderIdentity[]
): Array<Omit<T, 'id' | 'orderNumber'> & { id: number; orderNumber: string }> => {
  if (importedOrders.length !== createdOrders.length) {
    throw new Error('Created order response count does not match imported orders.');
  }

  return importedOrders.map((order, index) => {
    const persistedOrder = createdOrders[index];
    const id = Number(persistedOrder?.order_id);
    const orderNumber = String(persistedOrder?.order_number ?? '').trim();

    if (!Number.isSafeInteger(id) || id <= 0 || !orderNumber) {
      throw new Error(`Created order response is missing a valid identity at index ${index}.`);
    }

    return { ...order, id, orderNumber };
  });
};
