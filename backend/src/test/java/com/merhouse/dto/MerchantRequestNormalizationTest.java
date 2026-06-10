package com.merhouse.dto;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.merhouse.entity.OrderImportMode;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class MerchantRequestNormalizationTest {
    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void merchantInventoryAndInboundRequestsTrimCopiedTextBeforeValidation() {
        UUID merchantId = UUID.randomUUID();
        UUID relationshipId = UUID.randomUUID();
        UUID warehouseId = UUID.randomUUID();
        UUID itemId = UUID.randomUUID();

        var createItem = new CreateInventoryItemRequest(merchantId, " SKU-2 ", " Merchant Item ", null);
        var updateItem = new UpdateInventoryItemRequest(" SKU-3 ", " Updated Item ", null, false);
        var relationship = new CreateMerchantWarehouseRelationshipRequest(merchantId, UUID.randomUUID(), " Fragile handling ");
        var inbound = new CreateInboundStockRequest(relationshipId, warehouseId, itemId, 3, " ASN-2 ", " Arrives Tuesday ");

        assertTrue(validator.validate(createItem).isEmpty());
        assertEquals("SKU-2", createItem.sku());
        assertEquals("Merchant Item", createItem.name());
        assertTrue(validator.validate(updateItem).isEmpty());
        assertEquals("SKU-3", updateItem.sku());
        assertEquals("Updated Item", updateItem.name());
        assertTrue(validator.validate(relationship).isEmpty());
        assertEquals("Fragile handling", relationship.serviceNotes());
        assertTrue(validator.validate(inbound).isEmpty());
        assertEquals("ASN-2", inbound.merchantReference());
        assertEquals("Arrives Tuesday", inbound.merchantNote());
    }

    @Test
    void merchantOrderAndImportRequestsTrimCopiedCustomerTextBeforeValidation() {
        UUID merchantId = UUID.randomUUID();
        UUID itemId = UUID.randomUUID();

        var order = new CreateOrderRequest(merchantId, " Giza Customer ", List.of(new CreateOrderItemRequest(itemId, 2)));
        var contact = new CreateCustomerContactRequest(merchantId, " Giza Ship-To ", " Giza Buyer ", " 0100 ", " Giza Customer ");
        var row = new ImportOrderRowRequest(" merchant-paste-1 ", " SKU-1 ", 2, " Giza Customer ", " Giza Buyer ", " 0100 ");
        var batch = new CreateOrderImportRequest(merchantId, OrderImportMode.PARTIAL_ACCEPT, " Merchant pasted order rows ", List.of(row));

        assertTrue(validator.validate(order).isEmpty());
        assertEquals("Giza Customer", order.customerAddress());
        assertTrue(validator.validate(contact).isEmpty());
        assertEquals("Giza Ship-To", contact.label());
        assertEquals("Giza Buyer", contact.contactName());
        assertEquals("0100", contact.phone());
        assertEquals("Giza Customer", contact.address());
        assertTrue(validator.validate(batch).isEmpty());
        assertEquals("Merchant pasted order rows", batch.sourceLabel());
        assertEquals("merchant-paste-1", row.merchantOrderReference());
        assertEquals("SKU-1", row.sku());
        assertEquals("Giza Customer", row.customerAddress());
        assertEquals("Giza Buyer", row.customerName());
        assertEquals("0100", row.customerPhone());
    }
}
