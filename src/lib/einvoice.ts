import { isEInvoiceEnabled, submitInvoice } from "./lhdn";

interface EInvoicePayload {
  supplierName: string;
  supplierTin: string;
  buyerName: string;
  buyerId: string;
  items: Array<{ description: string; quantity: number; unitPrice: number; taxPercent: number }>;
  totalAmount: number;
}

export function buildEInvoicePayload(data: EInvoicePayload): any {
  return {
    _D: "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2",
    _A: "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
    _B: "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
    Invoice: [
      {
        ID: [{ _: `INV-${Date.now()}` }],
        IssueDate: [{ _: new Date().toISOString().slice(0, 10) }],
        InvoiceTypeCode: [{ _: "01" }], // Tax invoice
        DocumentCurrencyCode: [{ _: "MYR" }],
        AccountingSupplierParty: [
          {
            Party: [
              {
                PartyLegalEntity: [{ RegistrationName: [{ _: data.supplierName }] }],
                PartyIdentification: [{ ID: [{ _: data.supplierTin, schemeID: "TIN" }] }],
              },
            ],
          },
        ],
        AccountingCustomerParty: [
          {
            Party: [
              {
                PartyLegalEntity: [{ RegistrationName: [{ _: data.buyerName }] }],
                PartyIdentification: [{ ID: [{ _: data.buyerId, schemeID: "NRIC" }] }],
              },
            ],
          },
        ],
        TaxTotal: [
          {
            TaxAmount: [{ _: { currencyID: "MYR", _: 0 } }],
          },
        ],
        LegalMonetaryTotal: [
          {
            TaxExclusiveAmount: [{ _: { currencyID: "MYR", _: data.totalAmount } }],
            TaxInclusiveAmount: [{ _: { currencyID: "MYR", _: data.totalAmount } }],
            PayableAmount: [{ _: { currencyID: "MYR", _: data.totalAmount } }],
          },
        ],
        InvoiceLine: data.items.map((item, i) => ({
          ID: [{ _: String(i + 1) }],
          InvoicedQuantity: [{ _: { unitCode: "C62", _: item.quantity } }],
          LineExtensionAmount: [{ _: { currencyID: "MYR", _: item.unitPrice * item.quantity } }],
          Item: [
            {
              Description: [{ _: item.description }],
              ClassifiedTaxCategory: [
                {
                  ID: [{ _: "E" }], // Exempt
                  Percent: [{ _: item.taxPercent }],
                },
              ],
            },
          ],
          Price: [{ PriceAmount: [{ _: { currencyID: "MYR", _: item.unitPrice } }] }],
        })),
      },
    ],
  };
}

export async function generateAndSubmitEInvoice(payload: EInvoicePayload) {
  if (!isEInvoiceEnabled()) {
    return { success: false, error: "e-Invoice is disabled" };
  }

  const invoicePayload = buildEInvoicePayload(payload);
  const result = await submitInvoice(invoicePayload);

  return { success: true, result };
}
