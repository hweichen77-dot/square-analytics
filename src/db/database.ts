import Dexie from 'dexie'
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
  salesTransactions!: Dexie.Table<SalesTransaction, number>
  categoryOverrides!: Dexie.Table<CategoryOverride, number>
  restockLogs!: Dexie.Table<RestockLog, number>
  productCostData!: Dexie.Table<ProductCostData, number>
  storeEvents!: Dexie.Table<StoreEvent, number>
  productBundles!: Dexie.Table<ProductBundle, number>
  catalogueProducts!: Dexie.Table<CatalogueProduct, number>

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
