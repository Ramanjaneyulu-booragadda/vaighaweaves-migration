/**
 * Shared utility helpers for the stock-events module.
 *
 * Extracted here so both subscribers and the admin API route use identical
 * inventory-lookup logic without duplication (DRY).
 */

// ─────────────────────────────────────────────────────────────────────────────
// getVariantStock
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch the current `stocked_quantity` from Medusa's inventory_level table
 * for a given variant SKU.
 *
 * Returns 0 (best-effort fallback) if the inventory item or level is not found
 * or any error occurs — so the audit trail is still written even when the
 * inventory lookup fails.
 *
 * @param inventoryModule  Resolved Medusa INVENTORY module instance
 * @param sku              Product variant SKU (maps 1:1 to an InventoryItem)
 */
export async function getVariantStock(
  inventoryModule: any,
  sku: string | undefined
): Promise<number> {
  if (!sku) return 0

  try {
    const inventoryItems = await inventoryModule.listInventoryItems(
      { sku },
      {}
    )

    if (!inventoryItems.length) return 0

    const levels = await inventoryModule.listInventoryLevels(
      { inventory_item_id: inventoryItems[0].id },
      {}
    )

    if (!levels.length) return 0

    return (levels[0] as any).stocked_quantity ?? 0
  } catch {
    // Inventory lookup is best-effort
    return 0
  }
}
