package com.merhouse.service;

import com.merhouse.entity.InventoryItem;
import com.merhouse.entity.Warehouse;

public record AllocationReservation(Warehouse warehouse, InventoryItem inventoryItem, int quantity) {
}
