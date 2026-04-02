import Dexie, { type EntityTable } from 'dexie'
import type {
  SalesTransaction,
  CategoryOverride,
  RestockLog,
  ProductCostData,
  StoreEvent,
  ProductBundle,
  CatalogueProduct,
} from '../types/models'

class WalleysDB extends Dexie {
  salesTransactions!: EntityTable<SalesTransaction, 'id'>
  categoryOverrides!: EntityTable<CategoryOverride, 'id'>
  restockLogs!: EntityTable<RestockLog, 'id'>
  productCostData!: EntityTable<ProductCostData, 'id'>
  storeEvents!: EntityTable<StoreEvent, 'id'>
  productBundles!: EntityTable<ProductBundle, 'id'>
  catalogueProducts!: EntityTable<CatalogueProduct, 'id'>

  constructor() {
    super('WalleysDB')
    this.version(1).stores({
      salesTransactions: '++id, &transactionID, date, staffName, paymentMethod, dayOfWeek, hour',
      categoryOverrides: '++id, &productName',
      restockLogs: '++id, productName, date',
      productCostData: '++id, &productName',
      storeEvents: '++id, startDate, endDate',
      productBundles: '++id, name',
      catalogueProducts: '++id, &name, sku, category, enabled',
    })
  }
}

export const db = new WalleysDB()
