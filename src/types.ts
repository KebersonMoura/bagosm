export type OrderStatus = 'pendente' | 'preparo' | 'finalizado' | 'entregue' | 'cancelado';

export interface CustomSandwich {
  bread: string;
  size: string;
  protein: string;
  cheese: string;
  toasted: boolean;
  veggies: string[];
  sauces: string[];
  extras: string[]; // e.g. 'Bacon', 'Dobro de Queijo'
  drinksAndCookies: string[]; // e.g. 'Refrigerante lata', 'Cookie de Chocolate'
}

export interface OrderItem {
  id: string;
  sandwich?: CustomSandwich;
  productName?: string;
  isReadyProduct?: boolean;
  price: number;
  quantity: number;
}

export interface PaymentSplit {
  method: PaymentMethod | 'vr' | string;
  amount: number;
  cardProvider?: string;
  machineModel?: string;
  cashReceived?: number;
  changeAmount?: number;
}

export interface Order {
  id: string;
  code: string; // Pick-up code (e.g. BAGO-1024)
  customerName: string;
  customerPhone?: string;
  items: OrderItem[];
  totalPrice: number;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  estimatedMinutes: number;
  deliveryType?: 'retirada' | 'entrega';
  deliveryAddress?: string;
  addressStreet?: string;
  addressNumber?: string;
  addressNeighborhood?: string;
  addressCity?: string;
  addressState?: string;
  addressComplement?: string;
  addressReference?: string;
  deliveryFee?: number;
  deliveryDistanceKm?: number;
  deliveryLat?: number;
  deliveryLng?: number;
  customerType?: CustomerType;
  paymentMethod?: PaymentMethod | 'multiplo' | string;
  cashReceived?: number;
  changeAmount?: number;
  needChange?: boolean;
  changeForAmount?: number;
  printReceipt?: boolean;
  isPosOrder?: boolean;
  tableNumber?: string;
  cardProvider?: 'stone' | 'santander' | 'cielo' | 'picpay' | 'outro' | string;
  machineModel?: string;
  paymentSplits?: PaymentSplit[];
  sellerName?: string;
  createdBy?: string;
  couponCode?: string;
  discountAmount?: number;
}

export interface DeliveryTableRow {
  id: string;
  order_id: string;
  codigo_pedido: string;
  telefone?: string;
  cliente: string;
  comanda?: string;
  produto: string;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
  detalhes_ingredientes?: string;
  tipo_entrega?: string;
  endereco_entrega?: string;
  taxa_entrega?: number;
  forma_pagamento?: string;
  status_pedido?: string;
  data_hora?: string;
  created_at?: string;
}

export interface Coupon {
  id: string;
  code: string;
  type: 'fixed' | 'percentage';
  value: number;
  minOrderValue?: number;
  maxUses?: number;
  usedCount: number;
  active: boolean;
  createdAt: string;
  createdBy?: string;
  description?: string;
}

export interface StoreInfo {
  city: string;
  phone: string;
  instagram: string;
  address: string;
  openingHours: string;
  paymentMethods: string;
  openingTime: string;
  showOnHomePage: boolean;
  latitude?: string;
  longitude?: string;
}

export interface StepOption {
  id?: string;
  label: string;
  value: string;
  description?: string;
  priceAdd: number;
}

export interface CustomizerStep {
  id: number;
  name: string;
  active: boolean;
  description: string;
  allowedItems?: string[];
  options?: StepOption[];
}

export interface ReadyProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  isPopular?: boolean;
  isPromo?: boolean;
  badgeText?: string;
  image?: string;
  category: 'sandwich' | 'salad' | 'addon' | 'drink' | 'cookie' | 'other' | string;
  subcategory?: string; // Subcategoria para produtos prontos (ex: Combos, Sucos Naturais, Artesanais, Refrigerantes Lata)
  displaySection?: 'destaques' | 'promocao' | 'cardapio' | 'all' | string;
  linkedIngredientId?: string;
  sandwichConfig?: CustomSandwich;
  showOnHome?: boolean;
}

export interface Ingredient {
  id: string;
  name: string;
  category: 'bread' | 'protein' | 'cheese' | 'vegetable' | 'sauce' | 'extra' | 'drink_cookie' | 'juice' | 'vitamin' | 'smoothie' | 'kitchen' | string;
  subcategory?: string; // Subcategoria para estoque de cozinha ou insumos (ex: Temperos, Limpeza, Grãos)
  purchasePrice?: number; // Preço de compra unitário / Custo
  stock: number;
  minStock: number; // For low-stock alerts
  unit: string;
  price: number; // Base or additional price (usado para cobrança extra no PDV)
  image?: string;
  showOnHome?: boolean;
}

export type CustomerType = 'cliente' | 'funcionario';
export type PaymentMethod = 'debito' | 'credito' | 'pix' | 'dinheiro';

export interface User {
  id: string;
  username: string;
  name: string;
  role: 'admin' | 'cozinha' | 'balcao';
  logoUrl?: string;
}

export interface SaleRecord {
  orderId: string;
  date: string; // ISO String
  amount: number;
  itemsCount: number;
}

export interface CashTransaction {
  id: string;
  type: 'opening' | 'sale' | 'suprimento' | 'sangria';
  amount: number;
  description?: string;
  timestamp: string;
  paymentMethod?: PaymentMethod | string;
  cardProvider?: string;
  machineModel?: string;
  orderId?: string;
  orderCode?: string;
  deliveryType?: 'entrega' | 'retirada' | string;
  deliveryFee?: number;
  isPosOrder?: boolean;
  channel?: 'delivery' | 'balcao';
}

export interface CashRegisterSession {
  id: string;
  openedAt: string;
  openedBy: string;
  initialCash: number; // Fundo de caixa
  status: 'open' | 'closed';
  closedAt?: string;
  closedBy?: string;
  expectedCashInDrawer?: number;
  actualCashInDrawer?: number;
  cashDifference?: number;
  notes?: string;
  transactions?: CashTransaction[];
}

export interface PurchaseRecord {
  id: string;
  ingredientId: string;
  ingredientName?: string;
  date: string; // YYYY-MM-DD or ISO
  quantity: number;
  unit?: string;
  unitPrice: number;
  totalCost: number;
  expirationDate?: string; // Data de vencimento (YYYY-MM-DD)
  createdAt?: string;
}

export interface PurchaseInvoiceItem {
  ingredientId: string;
  ingredientName?: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  totalCost: number;
  expirationDate?: string;
}

export interface PurchaseInvoice {
  id: string;
  invoiceNumber: string; // Número da Nota / Cupom / Comprovante
  supplier?: string; // Fornecedor / Mercado
  purchaseDate: string; // YYYY-MM-DD
  totalAmount: number; // Valor Total Pago
  items: PurchaseInvoiceItem[];
  notes?: string;
  createdAt?: string;
}

export interface CardMachine {
  id: string;
  name: string; // Ex: 'Stone', 'Santander', 'Cielo', 'PagBank', 'Rede', 'Mercado Pago'
  model?: string; // Ex: 'Stone Smart POS', 'Getnet Smart', 'Cielo LIO', 'Moderninha Pro'
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

