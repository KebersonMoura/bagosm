import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { Ingredient, Order, OrderStatus, SaleRecord, CustomizerStep, ReadyProduct, CashRegisterSession, CashTransaction, User, PurchaseRecord, PurchaseInvoice, PurchaseInvoiceItem, Coupon, StoreInfo, CardMachine } from './src/types';
import { testDbConnection, getDbStatus, query } from './src/db/mysql';
import { 
  initDatabaseTables, 
  dbGetIngredients, 
  dbSaveIngredient, 
  dbDeleteIngredient, 
  dbUpdateStock, 
  dbGetReadyProducts, 
  dbSaveReadyProduct, 
  dbDeleteReadyProduct, 
  dbGetOrders, 
  dbSaveOrder, 
  dbUpdateOrderStatus, 
  dbUpdateOrder,
  dbDeleteOrder,
  dbAuthenticateUser,
  dbGetUsers,
  dbSaveUser,
  dbDeleteUser,
  dbSavePurchaseRecord,
  dbGetPurchaseHistory,
  dbSavePurchaseInvoice,
  dbGetPurchaseInvoices,
  dbDeletePurchaseInvoice,
  dbSaveCashSession,
  dbGetCashSessions,
  dbGetStoreSettings,
  dbSaveStoreSettings,
  dbGetCoupons,
  dbSaveCoupon,
  dbDeleteCoupon,
  dbIncrementCouponUsage,
  dbGetStoreInfo,
  dbSaveStoreInfo,
  dbGetCustomerByPhone,
  dbSaveCustomer,
  dbGenerateUniqueOrderCode,
  dbGetDeliveriesTable,
  dbGetCardMachines,
  dbSaveCardMachine,
  dbDeleteCardMachine,
  defaultCardMachinesSeed
} from './src/db/repository';
import { DEFAULT_DELIVERY_SETTINGS, StoreDeliverySettings, checkDeliveryOpeningStatus } from './src/utils/deliverySettings';

// Default In-Memory Users Fallback
let systemUsers: User[] = [
  { id: 'usr-admin', username: 'admin', name: 'Administrador Bagô', role: 'admin' },
  { id: 'usr-cozinha', username: 'cozinha', name: 'Equipe da Cozinha', role: 'cozinha' },
  { id: 'usr-balcao', username: 'balcao', name: 'Atendimento Balcão', role: 'balcao' },
  { id: 'usr-emp1', username: 'joao.silva', name: 'João Silva', role: 'balcao' },
  { id: 'usr-emp2', username: 'maria.souza', name: 'Maria Souza', role: 'balcao' },
  { id: 'usr-emp3', username: 'carlos.oliveira', name: 'Carlos Oliveira', role: 'balcao' }
];

// Cash Register State
let activeCashRegister: CashRegisterSession | null = null;
let cashRegisterHistory: CashRegisterSession[] = [];

// Store & Delivery Settings State
let storeDeliverySettings: StoreDeliverySettings = { ...DEFAULT_DELIVERY_SETTINGS };
let storeLogoUrl: string = '';
let cardMachines: CardMachine[] = [...defaultCardMachinesSeed];
let storeInfo: StoreInfo = {
  city: 'São Miguel - RN',
  phone: '(84) 99999-9999',
  instagram: 'https://instagram.com/',
  address: 'Rua Principal, Centro',
  openingHours: 'Segunda a Domingo: 15:00 às 23:00',
  paymentMethods: 'Pix, Cartão de Crédito, Cartão de Débito, Dinheiro',
  openingTime: 'Aberto • 15:00 às 23:00',
  showOnHomePage: true,
  latitude: '',
  longitude: ''
};

// Load settings from DB if available on boot
(async () => {
  try {
    const connResult = await testDbConnection();
    if (connResult.success) {
      await initDatabaseTables();
      const dbSettings = await dbGetStoreSettings('delivery_settings');
      if (dbSettings) {
        storeDeliverySettings = { ...DEFAULT_DELIVERY_SETTINGS, ...dbSettings };
        console.log('[Server] Loaded store delivery settings from MySQL database:', storeDeliverySettings.storeAddress);
      }
      const dbLogo = await dbGetStoreSettings('store_logo');
      if (dbLogo && typeof dbLogo === 'object' && typeof dbLogo.logoUrl === 'string') {
        storeLogoUrl = dbLogo.logoUrl;
        console.log('[Server] Loaded store logo from MySQL database:', storeLogoUrl);
      } else if (typeof dbLogo === 'string') {
        storeLogoUrl = dbLogo;
      }
      const dbInfo = await dbGetStoreInfo();
      if (dbInfo) {
        storeInfo = { ...storeInfo, ...dbInfo };
        console.log('[Server] Loaded store info from MySQL database:', storeInfo.city);
      } else {
        const fallbackInfo = await dbGetStoreSettings('store_info');
        if (fallbackInfo) {
          storeInfo = { ...storeInfo, ...fallbackInfo };
        }
      }
    } else {
      console.log('[Server] Operating in local high-performance in-memory mode.');
    }
  } catch (err) {
    console.warn('[Server] Notice loading delivery settings/logo/info from DB:', err);
  }
})();

// Initialize state
let ingredients: Ingredient[] = [
  // Breads (Pães)
  { id: 'pao-italiano', name: 'Italiano Integral', category: 'bread', stock: 120, minStock: 20, unit: 'unidades', price: 0, image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&auto=format&fit=crop&q=80' },
  { id: 'pao-3-queijos', name: 'Três Queijos', category: 'bread', stock: 80, minStock: 15, unit: 'unidades', price: 2.00, image: 'https://images.unsplash.com/photo-1549931319-a545dcf3bc73?w=400&auto=format&fit=crop&q=80' },
  { id: 'pao-parmesao', name: 'Parmesão e Orégano', category: 'bread', stock: 100, minStock: 15, unit: 'unidades', price: 2.00, image: 'https://images.unsplash.com/photo-1586444248902-2f64eddc13df?w=400&auto=format&fit=crop&q=80' },
  { id: 'pao-9-graos', name: 'Nove Grãos', category: 'bread', stock: 90, minStock: 15, unit: 'unidades', price: 0, image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&auto=format&fit=crop&q=80' },

  // Proteins (Proteínas)
  { id: 'prot-frango-teriyaki', name: 'Frango Teriyaki', category: 'protein', stock: 50, minStock: 10, unit: 'porções', price: 14.50, image: 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=400&auto=format&fit=crop&q=80' },
  { id: 'prot-carne-defumada', name: 'Carne Defumada (Costela)', category: 'protein', stock: 40, minStock: 8, unit: 'porções', price: 17.00, image: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=400&auto=format&fit=crop&q=80' },
  { id: 'prot-bife-carne', name: 'Bife de Carne', category: 'protein', stock: 45, minStock: 10, unit: 'porções', price: 16.00, image: 'https://images.unsplash.com/photo-1558030006-450675393462?w=400&auto=format&fit=crop&q=80' },
  { id: 'prot-atum', name: 'Atum Cremoso', category: 'protein', stock: 30, minStock: 5, unit: 'porções', price: 13.50, image: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=400&auto=format&fit=crop&q=80' },
  { id: 'prot-vegano', name: 'Falafel Vegano', category: 'protein', stock: 35, minStock: 5, unit: 'porções', price: 12.00, image: 'https://images.unsplash.com/photo-1593001874117-c99c800e3eb7?w=400&auto=format&fit=crop&q=80' },

  // Cheeses (Queijos)
  { id: 'queijo-prato', name: 'Queijo Prato', category: 'cheese', stock: 150, minStock: 30, unit: 'fatias', price: 0, image: 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=400&auto=format&fit=crop&q=80' },
  { id: 'queijo-cheddar', name: 'Cheddar Cremoso', category: 'cheese', stock: 120, minStock: 25, unit: 'fatias', price: 1.50, image: 'https://images.unsplash.com/photo-1618160702438-9b02ab6515c9?w=400&auto=format&fit=crop&q=80' },
  { id: 'queijo-suico', name: 'Suíço', category: 'cheese', stock: 80, minStock: 15, unit: 'fatias', price: 1.50, image: 'https://images.unsplash.com/photo-1452195100486-9cc805987862?w=400&auto=format&fit=crop&q=80' },
  { id: 'queijo-nenhum', name: 'Sem Queijo', category: 'cheese', stock: 99999, minStock: 0, unit: 'porções', price: 0 },

  // Vegetables (Vegetais)
  { id: 'veg-alface', name: 'Alface Americana', category: 'vegetable', stock: 200, minStock: 30, unit: 'porções', price: 0, image: 'https://images.unsplash.com/photo-1556801712-76c8eb07bbc9?w=400&auto=format&fit=crop&q=80' },
  { id: 'veg-tomate', name: 'Tomate Fatiado', category: 'vegetable', stock: 180, minStock: 25, unit: 'porções', price: 0, image: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=400&auto=format&fit=crop&q=80' },
  { id: 'veg-pepino', name: 'Pepino', category: 'vegetable', stock: 150, minStock: 20, unit: 'porções', price: 0, image: 'https://images.unsplash.com/photo-1449300079323-02e209d9d3a6?w=400&auto=format&fit=crop&q=80' },
  { id: 'veg-cebola', name: 'Cebola Roxa', category: 'vegetable', stock: 140, minStock: 15, unit: 'porções', price: 0, image: 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cf?w=400&auto=format&fit=crop&q=80' },
  { id: 'veg-azeitona', name: 'Azeitona Preta', category: 'vegetable', stock: 120, minStock: 10, unit: 'porções', price: 0, image: 'https://images.unsplash.com/photo-1563822249510-04678c787311?w=400&auto=format&fit=crop&q=80' },
  { id: 'veg-picles', name: 'Picles', category: 'vegetable', stock: 100, minStock: 10, unit: 'porções', price: 0, image: 'https://images.unsplash.com/photo-1582169296194-e4d644c48063?w=400&auto=format&fit=crop&q=80' },

  // Sauces (Molhos)
  { id: 'molho-maionese', name: 'Maionese Bagô', category: 'sauce', stock: 300, minStock: 30, unit: 'porções', price: 0, image: 'https://images.unsplash.com/photo-1570197788417-0e82375c9371?w=400&auto=format&fit=crop&q=80' },
  { id: 'molho-mostarda-mel', name: 'Mostarda e Mel', category: 'sauce', stock: 250, minStock: 25, unit: 'porções', price: 0, image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&auto=format&fit=crop&q=80' },
  { id: 'molho-barbecue', name: 'Barbecue Defumado', category: 'sauce', stock: 250, minStock: 25, unit: 'porções', price: 0, image: 'https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?w=400&auto=format&fit=crop&q=80' },
  { id: 'molho-chipotle', name: 'Chipotle Picante', category: 'sauce', stock: 200, minStock: 20, unit: 'porções', price: 0, image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&auto=format&fit=crop&q=80' },
  { id: 'molho-parmesao', name: 'Parmesão', category: 'sauce', stock: 180, minStock: 15, unit: 'porções', price: 0, image: 'https://images.unsplash.com/photo-1570197788417-0e82375c9371?w=400&auto=format&fit=crop&q=80' },
  { id: 'molho-azeite', name: 'Azeite de Oliva', category: 'sauce', stock: 400, minStock: 40, unit: 'porções', price: 0, image: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400&auto=format&fit=crop&q=80' },

  // Extras (Adicionais)
  { id: 'ext-bacon', name: 'Bacon Crocante', category: 'extra', stock: 60, minStock: 10, unit: 'fatias', price: 5.00, image: 'https://images.unsplash.com/photo-1528607929212-2636ec44253e?w=400&auto=format&fit=crop&q=80' },
  { id: 'ext-cream-cheese', name: 'Cream Cheese', category: 'extra', stock: 50, minStock: 8, unit: 'porções', price: 4.00, image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&auto=format&fit=crop&q=80' },
  { id: 'ext-dobro-queijo', name: 'Dobro de Queijo', category: 'extra', stock: 100, minStock: 15, unit: 'fatias', price: 3.00, image: 'https://images.unsplash.com/photo-1618160702438-9b02ab6515c9?w=400&auto=format&fit=crop&q=80' },
  { id: 'ext-pepperoni', name: 'Pepperoni', category: 'extra', stock: 70, minStock: 10, unit: 'fatias', price: 4.50, image: 'https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?w=400&auto=format&fit=crop&q=80' },

  // Drinks and Desserts (Bebidas e Cookies)
  { id: 'sob-coca', name: 'Coca-Cola Lata', category: 'drink_cookie', stock: 100, minStock: 15, unit: 'unidades', price: 6.50, image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400&auto=format&fit=crop&q=80' },
  { id: 'sob-guarana', name: 'Guaraná Antarctica', category: 'drink_cookie', stock: 85, minStock: 15, unit: 'unidades', price: 6.00, image: 'https://images.unsplash.com/photo-1581006852262-e4307cf6283a?w=400&auto=format&fit=crop&q=80' },
  { id: 'sob-agua', name: 'Água Mineral', category: 'drink_cookie', stock: 120, minStock: 10, unit: 'unidades', price: 4.00, image: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=400&auto=format&fit=crop&q=80' },
  { id: 'sob-cookie-choc', name: 'Cookie Triple Chocolate', category: 'drink_cookie', stock: 60, minStock: 10, unit: 'unidades', price: 5.50, image: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=400&auto=format&fit=crop&q=80' },
  { id: 'sob-cookie-macadamia', name: 'Cookie Macadâmia', category: 'drink_cookie', stock: 40, minStock: 8, unit: 'unidades', price: 6.00, image: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400&auto=format&fit=crop&q=80' },

  // Juices, Vitamins & Smoothies (Sucos, Vitaminas e Smoothies)
  { id: 'suc-laranja', name: 'Suco Natural de Laranja (500ml)', category: 'juice', stock: 80, minStock: 15, unit: 'unidades', price: 9.00, image: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=400&auto=format&fit=crop&q=80' },
  { id: 'suc-detox', name: 'Suco Detox Verde (Hortelã, Couve e Abacaxi)', category: 'juice', stock: 60, minStock: 10, unit: 'unidades', price: 11.50, image: 'https://images.unsplash.com/photo-1610970881699-44a5587cabec?w=400&auto=format&fit=crop&q=80' },
  { id: 'vit-morango-banana', name: 'Vitamina de Morango e Banana', category: 'vitamin', stock: 50, minStock: 10, unit: 'porções', price: 12.00, image: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=400&auto=format&fit=crop&q=80' },
  { id: 'vit-acai', name: 'Vitamina de Açaí Cremosa com Leite', category: 'vitamin', stock: 45, minStock: 10, unit: 'porções', price: 14.00, image: 'https://images.unsplash.com/photo-1590301157890-4810ed352733?w=400&auto=format&fit=crop&q=80' },
  { id: 'smoothie-tropical', name: 'Smoothie Tropical de Manga e Maracujá', category: 'smoothie', stock: 40, minStock: 8, unit: 'porções', price: 13.50, image: 'https://images.unsplash.com/photo-1502741224143-90386d7f8c82?w=400&auto=format&fit=crop&q=80' },
  { id: 'smoothie-frutas-vermelhas', name: 'Smoothie Super Berry (Frutas Vermelhas)', category: 'smoothie', stock: 35, minStock: 8, unit: 'porções', price: 15.00, image: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=400&auto=format&fit=crop&q=80' },

  // Kitchen / Internal Supplies (Estoque da Cozinha / Uso Interno - Não exibe no PDV)
  { id: 'coz-acucar', name: 'Açúcar Refinado', category: 'kitchen', subcategory: 'Insumos Básicos', purchasePrice: 4.50, stock: 50, minStock: 10, unit: 'kg', price: 0, image: 'https://images.unsplash.com/photo-1581441363689-1f3c3c414635?w=400&auto=format&fit=crop&q=80' },
  { id: 'coz-sal', name: 'Sal Refinado', category: 'kitchen', subcategory: 'Temperos', purchasePrice: 2.20, stock: 30, minStock: 5, unit: 'kg', price: 0, image: 'https://images.unsplash.com/photo-1518110168401-f2878ea56f91?w=400&auto=format&fit=crop&q=80' },
  { id: 'coz-oleo', name: 'Óleo de Soja', category: 'kitchen', subcategory: 'Óleos e Líquidos', purchasePrice: 7.90, stock: 40, minStock: 8, unit: 'litros', price: 0, image: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400&auto=format&fit=crop&q=80' },
  { id: 'coz-vinagre', name: 'Vinagre de Maçã', category: 'kitchen', subcategory: 'Temperos', purchasePrice: 5.50, stock: 25, minStock: 5, unit: 'litros', price: 0, image: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=400&auto=format&fit=crop&q=80' },
  { id: 'coz-guardanapo', name: 'Guardanapo de Papel', category: 'kitchen', subcategory: 'Embalagens e Descartáveis', purchasePrice: 3.80, stock: 100, minStock: 20, unit: 'pacotes', price: 0, image: 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=400&auto=format&fit=crop&q=80' }
];

let purchaseHistory: PurchaseRecord[] = [];

let purchaseInvoices: PurchaseInvoice[] = [];

let orders: Order[] = [];

let customizerSteps: CustomizerStep[] = [
  { id: 1, name: 'Pão', description: 'Escolha a base ideal para seu sanduíche.', active: true },
  { 
    id: 2, 
    name: 'Tamanho', 
    description: 'Tamanho padrão do sanduíche.', 
    active: true,
    options: [
      { id: 'opt-15cm', label: 'Sub 15cm (Tamanho Padrão)', value: '15cm', description: 'Tamanho Individual Padrão', priceAdd: 0 }
    ]
  },
  { id: 3, name: 'Proteína', description: 'Selecione o sabor principal.', active: true },
  { id: 4, name: 'Queijo', description: 'Escolha o queijo perfeito.', active: true },
  { 
    id: 5, 
    name: 'Tostado', 
    description: 'Quer seu pão quentinho e crocante?', 
    active: true,
    options: [
      { id: 'opt-toast-yes', label: 'Quero Tostado (Quentinho)', value: 'true', description: 'Pão levado ao forno com o queijo derretido', priceAdd: 0 },
      { id: 'opt-toast-no', label: 'Não Tostar (Natural)', value: 'false', description: 'Pão em temperatura ambiente', priceAdd: 0 }
    ]
  },
  { id: 6, name: 'Vegetais', description: 'Adicione frescor com nossas saladas.', active: true },
  { id: 7, name: 'Molhos', description: 'Escolha os molhos para finalizar.', active: true },
  { id: 8, name: 'Adicionais', description: 'Turbine com adicionais deliciosos.', active: true },
  { id: 9, name: 'Bebidas & Cookies', description: 'Complete seu pedido com um acompanhamento.', active: true },
  { id: 10, name: 'Identificação', description: 'Identifique e confirme seu pedido.', active: true }
];

let readyProducts: ReadyProduct[] = [
  {
    id: 'prod-combo-start',
    name: 'COMBO START',
    description: 'Combo irresistível com dois subs Bagô, anéis de cebola crocantes, batata rústica e molho especial.',
    price: 49.90,
    originalPrice: 58.00,
    isPopular: true,
    isPromo: true,
    badgeText: 'MAIS PEDIDO',
    image: 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=600&auto=format&fit=crop&q=80',
    category: 'sandwich',
    sandwichConfig: {
      bread: 'Parmesão e Orégano',
      size: '15cm',
      protein: 'Carne Defumada (Costela)',
      cheese: 'Cheddar Cremoso',
      toasted: true,
      veggies: ['Alface Americana', 'Tomate Fatiado'],
      sauces: ['Chipotle Picante', 'Barbecue Defumado'],
      extras: ['Bacon Crocante'],
      drinksAndCookies: ['Coca-Cola Lata']
    }
  },
  {
    id: 'prod-bago-classic',
    name: 'Bagô Classic Costela',
    description: 'Pão Parmesão e Orégano, Carne Defumada de Costela, Queijo Cheddar, Alface, Tomate e Molho Chipotle.',
    price: 33.50,
    originalPrice: 38.00,
    isPopular: true,
    isPromo: true,
    badgeText: 'DESTAQUE',
    image: 'https://images.unsplash.com/photo-1509722747041-616f39b57569?w=600&auto=format&fit=crop&q=80',
    category: 'sandwich',
    sandwichConfig: {
      bread: 'Parmesão e Orégano',
      size: '15cm',
      protein: 'Carne Defumada (Costela)',
      cheese: 'Cheddar Cremoso',
      toasted: true,
      veggies: ['Alface Americana', 'Tomate Fatiado'],
      sauces: ['Chipotle Picante'],
      extras: [],
      drinksAndCookies: []
    }
  },
  {
    id: 'prod-bago-frango',
    name: 'Bagô Frango Teriyaki',
    description: 'Pão Italiano Integral, Frango Teriyaki, Queijo Prato, Alface, Tomate, Pepino e Molho Mostarda e Mel.',
    price: 26.50,
    originalPrice: 29.90,
    isPopular: true,
    badgeText: 'RECOMENDADO',
    image: 'https://images.unsplash.com/photo-1553909489-cd47e0907980?w=600&auto=format&fit=crop&q=80',
    category: 'sandwich',
    sandwichConfig: {
      bread: 'Italiano Integral',
      size: '15cm',
      protein: 'Frango Teriyaki',
      cheese: 'Queijo Prato',
      toasted: true,
      veggies: ['Alface Americana', 'Tomate Fatiado', 'Pepino'],
      sauces: ['Mostarda e Mel'],
      extras: [],
      drinksAndCookies: []
    }
  },
  {
    id: 'prod-bago-carne-sol',
    name: 'Bagô de Carne de Sol',
    description: 'Delicioso pão 3 Queijos, Suculenta Carne de Sol desfiada, Queijo Coalho, Alface, Tomate, Vinagrete e Molho Especial.',
    price: 34.90,
    originalPrice: 39.90,
    isPopular: true,
    badgeText: 'NOVIDADE',
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&auto=format&fit=crop&q=80',
    category: 'sandwich',
    sandwichConfig: {
      bread: '3 Queijos',
      size: '15cm',
      protein: 'Carne Defumada (Costela)',
      cheese: 'Queijo Prato',
      toasted: true,
      veggies: ['Alface Americana', 'Tomate Fatiado', 'Cebola Roxa'],
      sauces: ['Chipotle Picante', 'Barbecue Defumado'],
      extras: [],
      drinksAndCookies: []
    }
  },
  {
    id: 'prod-salada-caesar',
    name: 'Salada Caesar com Frango',
    description: 'Alface americana crocante, tiras de frango grelhado, queijo parmesão, croutons e molho Caesar.',
    price: 28.90,
    originalPrice: 32.00,
    isPromo: true,
    badgeText: 'FIT & FRESCO',
    image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&auto=format&fit=crop&q=80',
    category: 'salad',
    sandwichConfig: {
      bread: '',
      size: '15cm',
      protein: 'Frango Teriyaki',
      cheese: 'Queijo Prato',
      toasted: false,
      veggies: ['Alface Americana', 'Tomate Fatiado'],
      sauces: ['Maionese Temperada'],
      extras: [],
      drinksAndCookies: []
    }
  },
  {
    id: 'prod-salada-bago-fresh',
    name: 'Salada Bagô Tropical',
    description: 'Mix de folhas verdes, tomate cereja, cenoura ralada, peito de peru, queijo minas e molho mostarda e mel.',
    price: 26.90,
    category: 'salad',
    sandwichConfig: {
      bread: '',
      size: '15cm',
      protein: 'Peito de Peru',
      cheese: 'Queijo Prato',
      toasted: false,
      veggies: ['Alface Americana', 'Tomate Fatiado', 'Cenoura Ralada'],
      sauces: ['Mostarda e Mel'],
      extras: [],
      drinksAndCookies: []
    },
    image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&auto=format&fit=crop&q=80'
  },
  {
    id: 'prod-addon-batata',
    name: 'Batata Rústica Bagô',
    description: 'Porção de batatas assadas e temperadas com ervas finas e sal marinho.',
    price: 9.90,
    originalPrice: 12.00,
    badgeText: 'CROCANTE',
    category: 'addon',
    image: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=600&auto=format&fit=crop&q=80'
  },
  {
    id: 'prod-coca',
    name: 'Coca-Cola Lata 350ml',
    description: 'Refrigerante gelado Coca-Cola original 350ml.',
    price: 6.50,
    image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=600&auto=format&fit=crop&q=80',
    category: 'drink',
    linkedIngredientId: 'sob-coca'
  },
  {
    id: 'prod-guarana',
    name: 'Guaraná Antarctica 350ml',
    description: 'Refrigerante gelado Guaraná Antarctica 350ml.',
    price: 6.00,
    image: 'https://images.unsplash.com/photo-1527960656306-ff37c5699f4b?w=600&auto=format&fit=crop&q=80',
    category: 'drink',
    linkedIngredientId: 'sob-guarana'
  },
  {
    id: 'prod-suco-laranja',
    name: 'Suco Natural de Laranja 500ml',
    description: 'Suco 100% natural de laranja espremida na hora, gelado e sem adição de conservantes.',
    price: 9.00,
    isPopular: true,
    badgeText: 'NATURAL',
    image: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=600&auto=format&fit=crop&q=80',
    category: 'drink',
    linkedIngredientId: 'suc-laranja'
  },
  {
    id: 'prod-suco-detox',
    name: 'Suco Detox Verde 500ml',
    description: 'Suco revigorante com couve, abacaxi, maçã verde e hortelã fresca.',
    price: 11.50,
    badgeText: 'FIT',
    image: 'https://images.unsplash.com/photo-1610970881699-44a5587cabec?w=600&auto=format&fit=crop&q=80',
    category: 'drink',
    linkedIngredientId: 'suc-detox'
  },
  {
    id: 'prod-vitamina-morango',
    name: 'Vitamina de Morango e Banana',
    description: 'Vitamina cremosa de morangos selecionados e banana com leite bem gelado.',
    price: 12.00,
    badgeText: 'CREMOSA',
    image: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=600&auto=format&fit=crop&q=80',
    category: 'drink',
    linkedIngredientId: 'vit-morango-banana'
  },
  {
    id: 'prod-smoothie-tropical',
    name: 'Smoothie Tropical de Manga e Maracujá',
    description: 'Smoothie refrescante feito com manga, calda de maracujá e iogurte natural.',
    price: 13.50,
    isPopular: true,
    badgeText: 'POPULAR',
    image: 'https://images.unsplash.com/photo-1502741224143-90386d7f8c82?w=600&auto=format&fit=crop&q=80',
    category: 'drink',
    linkedIngredientId: 'smoothie-tropical'
  },
  {
    id: 'prod-smoothie-berry',
    name: 'Smoothie Super Berry (Frutas Vermelhas)',
    description: 'Smoothie super nutritivo com amora, mirtilo, morango e toque de mel.',
    price: 15.00,
    badgeText: 'NOVIDADE',
    image: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=600&auto=format&fit=crop&q=80',
    category: 'drink',
    linkedIngredientId: 'smoothie-frutas-vermelhas'
  },
  {
    id: 'prod-cookie-triple',
    name: 'Cookie Triple Chocolate',
    description: 'Cookie artesanal Bagô super recheado com gotas de chocolate ao leite e amargo.',
    price: 5.50,
    originalPrice: 7.00,
    isPromo: true,
    badgeText: 'SOBREMESA',
    image: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=600&auto=format&fit=crop&q=80',
    category: 'cookie',
    linkedIngredientId: 'sob-cookie-choc'
  },
  {
    id: 'prod-pao-parmesao',
    name: 'Pão Parmesão e Orégano (Avulso)',
    description: 'Baguete artesanal crocante com crosta de parmesão gratinado e orégano.',
    price: 4.50,
    badgeText: 'PÃO ARTESANAL',
    image: 'https://images.unsplash.com/photo-1586444248902-2f64eddc13df?w=600&auto=format&fit=crop&q=80',
    category: 'bread',
    linkedIngredientId: 'pao-parmesao'
  },
  {
    id: 'prod-pao-3queijos',
    name: 'Pão Três Queijos (Avulso)',
    description: 'Baguete assada com mix macio e saboroso de três queijos derretidos.',
    price: 4.50,
    badgeText: 'PÃO ARTESANAL',
    image: 'https://images.unsplash.com/photo-1549931319-a545dcf3bc73?w=600&auto=format&fit=crop&q=80',
    category: 'bread',
    linkedIngredientId: 'pao-3-queijos'
  },
  {
    id: 'prod-pao-italiano',
    name: 'Pão Italiano Integral (Avulso)',
    description: 'Baguete leve, integral e super fresca para acompanhar seu pedido.',
    price: 4.00,
    badgeText: 'PÃO ARTESANAL',
    image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&auto=format&fit=crop&q=80',
    category: 'bread',
    linkedIngredientId: 'pao-italiano'
  },
  {
    id: 'prod-pao-9graos',
    name: 'Pão Nove Grãos (Avulso)',
    description: 'Baguete artesanal rica em fibras e sementes selecionadas.',
    price: 4.00,
    badgeText: 'PÃO ARTESANAL',
    image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&auto=format&fit=crop&q=80',
    category: 'bread',
    linkedIngredientId: 'pao-9-graos'
  }
];

let sales: SaleRecord[] = [];

// Server-Sent Events clients
let sseClients: any[] = [];

function broadcastEvent(type: string, data: any) {
  const payload = `data: ${JSON.stringify({ type, data })}\n\n`;
  sseClients = sseClients.filter((client) => {
    try {
      client.res.write(payload);
      if (typeof client.res.flush === 'function') {
        client.res.flush();
      }
      return true;
    } catch (e) {
      return false;
    }
  });
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Test MySQL DB Connection on server startup
  testDbConnection().then(async (res) => {
    if (res.success) {
      console.log(`[MySQL] Connection verified to host ${res.host} (Database: ${res.database})`);
      await initDatabaseTables();
      const dbIngs = await dbGetIngredients();
      if (dbIngs !== null) ingredients = dbIngs;
      const dbProds = await dbGetReadyProducts();
      if (dbProds !== null) readyProducts = dbProds;
      const dbOrds = await dbGetOrders();
      if (dbOrds !== null) {
        orders = dbOrds;
        sales = dbOrds.map(o => ({
          orderId: o.id,
          date: o.createdAt,
          amount: Number(o.totalPrice) || 0,
          itemsCount: o.items ? o.items.length : 1
        }));
      }
      const dbUsrs = await dbGetUsers();
      if (dbUsrs !== null && dbUsrs.length > 0) systemUsers = dbUsrs;
      const dbHistory = await dbGetPurchaseHistory();
      if (dbHistory !== null && dbHistory.length > 0) purchaseHistory = dbHistory;
      const dbInvoices = await dbGetPurchaseInvoices();
      if (dbInvoices !== null && dbInvoices.length > 0) purchaseInvoices = dbInvoices;
      const dbCashSessions = await dbGetCashSessions();
      if (dbCashSessions !== null && dbCashSessions.length > 0) {
        cashRegisterHistory = dbCashSessions.filter(s => s.status === 'closed');
        activeCashRegister = dbCashSessions.find(s => s.status === 'open') || null;
        if (activeCashRegister) {
          syncCashRegisterOrders(activeCashRegister);
        }
      }
      const dbCpns = await dbGetCoupons();
      if (dbCpns !== null) {
        inMemoryCoupons = dbCpns;
      }
      const dbMachs = await dbGetCardMachines();
      if (dbMachs !== null && dbMachs.length > 0) {
        cardMachines = dbMachs;
      }
    } else {
      console.warn(`[MySQL] Startup ping warning: ${res.message}`);
    }
  });

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // MySQL DB Status Endpoint
  app.get('/api/db/status', (req, res) => {
    const status = getDbStatus();
    res.json(status);
  });

  // MySQL DB Manual Ping Test Endpoint
  app.post('/api/db/test', async (req, res) => {
    const result = await testDbConnection();
    res.json(result);
  });

  // Real-time Event Stream (SSE)
  app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const clientId = Date.now().toString();
    const newClient = { id: clientId, res };
    sseClients.push(newClient);

    // Initial greeting event
    res.write(`data: ${JSON.stringify({ type: 'CONNECTED', data: { clientId, timestamp: Date.now() } })}\n\n`);
    if (typeof (res as any).flush === 'function') {
      (res as any).flush();
    }

    // Ping every 10s to keep connection alive across proxies
    const pingInterval = setInterval(() => {
      try {
        res.write(': ping\n\n');
        if (typeof (res as any).flush === 'function') {
          (res as any).flush();
        }
      } catch (e) {
        clearInterval(pingInterval);
      }
    }, 10000);

    req.on('close', () => {
      clearInterval(pingInterval);
      sseClients = sseClients.filter(c => c.id !== clientId);
    });
  });

  // Database Authentication Login
  app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Informe o usuário e a senha.' });
    }

    // Authenticate strictly against database records
    const dbUser = await dbAuthenticateUser(username, password);
    if (dbUser) {
      return res.json({ success: true, user: dbUser });
    }

    return res.status(401).json({ success: false, message: 'Usuário ou senha incorretos!' });
  });

  // Get all users (Admin)
  app.get('/api/users', async (req, res) => {
    const dbUsers = await dbGetUsers();
    if (dbUsers && dbUsers.length > 0) {
      systemUsers = dbUsers;
    }
    res.json(systemUsers);
  });

  // GET Store & Delivery Settings (Initial Point, Address, Fees, Tiers)
  app.get('/api/settings/delivery', async (req, res) => {
    try {
      const dbSettings = await dbGetStoreSettings('delivery_settings');
      if (dbSettings) {
        storeDeliverySettings = { ...DEFAULT_DELIVERY_SETTINGS, ...dbSettings };
      }
    } catch (err) {
      console.warn('Error fetching store settings from DB:', err);
    }
    res.json(storeDeliverySettings);
  });

  // POST Store & Delivery Settings (Save to Database)
  app.post('/api/settings/delivery', async (req, res) => {
    try {
      const newSettings = req.body;
      if (!newSettings || typeof newSettings !== 'object') {
        return res.status(400).json({ error: 'Configurações inválidas' });
      }

      storeDeliverySettings = {
        ...DEFAULT_DELIVERY_SETTINGS,
        ...newSettings
      };

      const savedInDb = await dbSaveStoreSettings(storeDeliverySettings, 'delivery_settings');

      // Broadcast update to connected SSE clients
      broadcastEvent('DELIVERY_SETTINGS_UPDATED', storeDeliverySettings);

      res.json({
        success: true,
        savedInDb,
        settings: storeDeliverySettings,
        message: savedInDb
          ? 'Ponto inicial e configurações de entrega salvos no banco de dados com sucesso!'
          : 'Configurações salvas localmente.'
      });
    } catch (err: any) {
      console.error('Error saving delivery settings:', err);
      res.status(500).json({ error: 'Erro ao salvar configurações no banco de dados: ' + (err.message || err) });
    }
  });

  // GET Store Logo
  app.get('/api/settings/logo', async (req, res) => {
    try {
      const dbLogo = await dbGetStoreSettings('store_logo');
      if (dbLogo) {
        storeLogoUrl = typeof dbLogo === 'object' ? (dbLogo.logoUrl || '') : String(dbLogo);
      }
    } catch (err) {
      console.warn('Error fetching store logo from DB:', err);
    }
    res.json({ logoUrl: storeLogoUrl });
  });

  // POST Store Logo (Save to Database)
  app.post('/api/settings/logo', async (req, res) => {
    try {
      const { logoUrl } = req.body || {};
      storeLogoUrl = typeof logoUrl === 'string' ? logoUrl.trim() : '';

      const savedInDb = await dbSaveStoreSettings({ logoUrl: storeLogoUrl }, 'store_logo');

      // Broadcast event to connected SSE clients
      broadcastEvent('STORE_LOGO_UPDATED', { logoUrl: storeLogoUrl });

      res.json({
        success: true,
        savedInDb,
        logoUrl: storeLogoUrl,
        message: savedInDb
          ? 'Logo da marca salva no banco de dados com sucesso!'
          : 'Logo atualizada localmente.'
      });
    } catch (err: any) {
      console.error('Error saving store logo:', err);
      res.status(500).json({ error: 'Erro ao salvar logo no banco de dados: ' + (err.message || err) });
    }
  });

  // GET Store Info
  app.get('/api/settings/info', async (req, res) => {
    try {
      const dbInfo = await dbGetStoreInfo();
      if (dbInfo) {
        storeInfo = { ...storeInfo, ...dbInfo };
      } else {
        const fallback = await dbGetStoreSettings('store_info');
        if (fallback) {
          storeInfo = { ...storeInfo, ...fallback };
        }
      }
    } catch (err) {
      console.warn('Error fetching store info from DB:', err);
    }
    res.json(storeInfo);
  });

  // POST Store Info (Save to Database)
  app.post('/api/settings/info', async (req, res) => {
    try {
      const newInfo = req.body || {};
      storeInfo = {
        city: typeof newInfo.city === 'string' ? newInfo.city : storeInfo.city,
        phone: typeof newInfo.phone === 'string' ? newInfo.phone : storeInfo.phone,
        instagram: typeof newInfo.instagram === 'string' ? newInfo.instagram : storeInfo.instagram,
        address: typeof newInfo.address === 'string' ? newInfo.address : storeInfo.address,
        openingHours: typeof newInfo.openingHours === 'string' ? newInfo.openingHours : storeInfo.openingHours,
        paymentMethods: typeof newInfo.paymentMethods === 'string' ? newInfo.paymentMethods : storeInfo.paymentMethods,
        openingTime: typeof newInfo.openingTime === 'string' ? newInfo.openingTime : storeInfo.openingTime,
        showOnHomePage: newInfo.showOnHomePage !== undefined ? Boolean(newInfo.showOnHomePage) : storeInfo.showOnHomePage,
        latitude: typeof newInfo.latitude === 'string' ? newInfo.latitude : storeInfo.latitude,
        longitude: typeof newInfo.longitude === 'string' ? newInfo.longitude : storeInfo.longitude
      };

      const savedInDb = await dbSaveStoreInfo(storeInfo);
      await dbSaveStoreSettings(storeInfo, 'store_info');

      // Broadcast event to connected SSE clients
      broadcastEvent('STORE_INFO_UPDATED', storeInfo);

      res.json({
        success: true,
        savedInDb,
        info: storeInfo,
        message: savedInDb
          ? 'Informações da empresa salvas no banco de dados com sucesso!'
          : 'Informações salvas localmente.'
      });
    } catch (err: any) {
      console.error('Error saving store info:', err);
      res.status(500).json({ error: 'Erro ao salvar informações no banco de dados: ' + (err.message || err) });
    }
  });

  // ==================== CARD MACHINES (MAQUININHAS DE CARTÃO) API ROUTES ====================
  // GET Card Machines
  app.get('/api/card-machines', async (req, res) => {
    try {
      const dbMachs = await dbGetCardMachines();
      if (Array.isArray(dbMachs)) {
        cardMachines = dbMachs;
      }
    } catch (err) {
      console.warn('Error fetching card machines from DB:', err);
    }
    res.json(cardMachines);
  });

  // POST / PUT Card Machine (Create or Update)
  app.post('/api/card-machines', async (req, res) => {
    try {
      const { id, name, model, active } = req.body || {};
      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Nome/Operadora da maquininha é obrigatório.' });
      }

      const machineId = id || `mach-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const index = cardMachines.findIndex(m => m.id === machineId);
      const targetMachine: CardMachine = {
        id: machineId,
        name: name.trim(),
        model: model !== undefined && model !== null ? String(model).trim() : undefined,
        active: active !== undefined ? Boolean(active) : true,
        createdAt: index !== -1 ? cardMachines[index].createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      if (index !== -1) {
        cardMachines[index] = targetMachine;
      } else {
        cardMachines.push(targetMachine);
      }

      const savedInDb = await dbSaveCardMachine(targetMachine);
      await dbSaveStoreSettings(cardMachines, 'card_machines');

      broadcastEvent('CARD_MACHINES_UPDATED', cardMachines);

      res.json({
        success: true,
        machine: targetMachine,
        cardMachines,
        savedInDb,
        message: savedInDb
          ? 'Maquininha de cartão salva no banco de dados com sucesso!'
          : 'Maquininha atualizada localmente.'
      });
    } catch (err: any) {
      console.error('Error saving card machine:', err);
      res.status(500).json({ error: 'Erro ao salvar maquininha de cartão: ' + (err.message || err) });
    }
  });

  // DELETE Card Machine
  const handleCardMachineDelete = async (req: express.Request, res: express.Response) => {
    try {
      const { id } = req.params;
      cardMachines = cardMachines.filter(m => String(m.id) !== String(id));
      const deletedInDb = await dbDeleteCardMachine(id);
      await dbSaveStoreSettings(cardMachines, 'card_machines');

      broadcastEvent('CARD_MACHINES_UPDATED', cardMachines);

      res.json({
        success: true,
        cardMachines,
        deletedInDb,
        message: 'Maquininha de cartão excluída com sucesso!'
      });
    } catch (err: any) {
      console.error('Error deleting card machine:', err);
      res.status(500).json({ error: 'Erro ao excluir maquininha: ' + (err.message || err) });
    }
  };

  app.delete('/api/card-machines/:id', handleCardMachineDelete);
  app.post('/api/card-machines/:id/delete', handleCardMachineDelete);

  // ==================== COUPONS API ROUTES ====================
  let inMemoryCoupons: Coupon[] = [];

  // GET Coupons
  app.get('/api/coupons', async (req, res) => {
    try {
      if (getDbStatus().isConnected) {
        inMemoryCoupons = await dbGetCoupons();
      }
      res.json(inMemoryCoupons);
    } catch (err) {
      console.error('Error getting coupons:', err);
      res.json(inMemoryCoupons);
    }
  });

  // POST Create/Save Coupon
  app.post('/api/coupons', async (req, res) => {
    try {
      const couponData = req.body;
      if (!couponData || !couponData.code || !couponData.value) {
        return res.status(400).json({ error: 'Código e valor do cupom são obrigatórios.' });
      }

      const formattedCode = String(couponData.code).trim().toUpperCase();
      const existingIndex = inMemoryCoupons.findIndex(c => c.id === couponData.id || c.code.toUpperCase() === formattedCode);
      const existingCoupon = existingIndex >= 0 ? inMemoryCoupons[existingIndex] : null;
      const couponId = couponData.id || (existingCoupon ? existingCoupon.id : `cpn-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`);

      const coupon: Coupon = {
        id: couponId,
        code: formattedCode,
        type: couponData.type === 'percentage' ? 'percentage' : 'fixed',
        value: Number(couponData.value) || 0,
        minOrderValue: Number(couponData.minOrderValue) || 0,
        maxUses: couponData.maxUses ? Number(couponData.maxUses) : undefined,
        usedCount: couponData.usedCount !== undefined ? Number(couponData.usedCount) : (existingCoupon ? existingCoupon.usedCount : 0),
        active: couponData.active !== undefined ? Boolean(couponData.active) : true,
        createdAt: couponData.createdAt || (existingCoupon ? existingCoupon.createdAt : new Date().toISOString()),
        createdBy: couponData.createdBy || (existingCoupon ? existingCoupon.createdBy : 'Administrador'),
        description: couponData.description || (existingCoupon ? existingCoupon.description : '')
      };

      if (existingIndex >= 0) {
        inMemoryCoupons[existingIndex] = coupon;
      } else {
        inMemoryCoupons.unshift(coupon);
      }

      const savedInDb = await dbSaveCoupon(coupon);

      res.json({
        success: true,
        savedInDb,
        coupon,
        message: savedInDb
          ? `Cupom ${coupon.code} salvo com sucesso no banco de dados!`
          : `Cupom ${coupon.code} salvo localmente.`
      });
    } catch (err: any) {
      console.error('Error saving coupon:', err);
      res.status(500).json({ error: 'Erro ao salvar cupom no banco de dados: ' + (err.message || err) });
    }
  });

  // DELETE Coupon
  app.delete('/api/coupons/:id', async (req, res) => {
    try {
      const { id } = req.params;
      inMemoryCoupons = inMemoryCoupons.filter(c => String(c.id) !== String(id) && String(c.code).toUpperCase() !== String(id).toUpperCase());
      const deletedInDb = await dbDeleteCoupon(id);
      res.json({ success: true, deletedInDb });
    } catch (err: any) {
      console.error('Error deleting coupon:', err);
      res.status(500).json({ error: 'Erro ao deletar cupom: ' + (err.message || err) });
    }
  });

  // POST Fallback for DELETE Coupon
  app.post('/api/coupons/:id/delete', async (req, res) => {
    try {
      const { id } = req.params;
      inMemoryCoupons = inMemoryCoupons.filter(c => String(c.id) !== String(id) && String(c.code).toUpperCase() !== String(id).toUpperCase());
      const deletedInDb = await dbDeleteCoupon(id);
      res.json({ success: true, deletedInDb });
    } catch (err: any) {
      console.error('Error deleting coupon:', err);
      res.status(500).json({ error: 'Erro ao deletar cupom: ' + (err.message || err) });
    }
  });

  // POST Validate Coupon
  app.post('/api/coupons/validate', async (req, res) => {
    try {
      const { code, subtotal } = req.body;
      if (!code) {
        return res.status(400).json({ valid: false, message: 'Informe o código do cupom.' });
      }

      let allCoupons = inMemoryCoupons;
      const dbCoupons = await dbGetCoupons();
      if (dbCoupons && dbCoupons.length > 0) {
        allCoupons = dbCoupons;
      }

      const formattedCode = String(code).trim().toUpperCase();
      const found = allCoupons.find(c => c.code.toUpperCase() === formattedCode);

      if (!found) {
        return res.status(404).json({ valid: false, message: 'Cupom inválido ou inexistente.' });
      }

      if (!found.active) {
        return res.status(400).json({ valid: false, message: 'Este cupom está inativo no momento.' });
      }

      if (found.maxUses && found.usedCount >= found.maxUses) {
        return res.status(400).json({ valid: false, message: 'Este cupom já atingiu o limite máximo de utilizações.' });
      }

      const orderSubtotal = Number(subtotal) || 0;
      if (found.minOrderValue && orderSubtotal < found.minOrderValue) {
        return res.status(400).json({
          valid: false,
          message: `Este cupom exige um pedido mínimo de R$ ${found.minOrderValue.toFixed(2).replace('.', ',')}.`
        });
      }

      let discountAmount = 0;
      if (found.type === 'percentage') {
        discountAmount = (orderSubtotal * found.value) / 100;
      } else {
        discountAmount = found.value;
      }

      if (discountAmount > orderSubtotal) {
        discountAmount = orderSubtotal;
      }

      res.json({
        valid: true,
        coupon: found,
        discountAmount,
        message: `Cupom ${found.code} aplicado com sucesso! Desconto de R$ ${discountAmount.toFixed(2).replace('.', ',')}`
      });
    } catch (err: any) {
      console.error('Error validating coupon:', err);
      res.status(500).json({ valid: false, message: 'Erro ao validar cupom.' });
    }
  });

  // Create or Update user (Admin)
  app.post('/api/users', async (req, res) => {
    const { id, username, name, role, password, logoUrl, requesterRole } = req.body;

    if (requesterRole !== 'admin') {
      return res.status(403).json({ error: 'Apenas administradores podem gerenciar usuários.' });
    }

    if (!username || !name || !role) {
      return res.status(400).json({ error: 'Preencha todos os campos obrigatórios (nome, usuário e permissão).' });
    }

    const dbResult = await dbSaveUser({ id, username, name, role, password, logoUrl });
    if (!dbResult.success) {
      return res.status(400).json({ error: dbResult.error });
    }

    // Update local fallback list
    const existingIndex = systemUsers.findIndex(u => u.id === dbResult.user?.id || u.username === username);
    if (existingIndex !== -1) {
      systemUsers[existingIndex] = dbResult.user!;
    } else if (dbResult.user) {
      systemUsers.push(dbResult.user);
    }

    broadcastEvent('USERS_REFRESH', systemUsers);
    res.json({ success: true, user: dbResult.user, users: systemUsers });
  });

  // Delete user (Admin)
  app.delete('/api/users/:id', async (req, res) => {
    const { requesterRole } = req.query;

    if (requesterRole !== 'admin') {
      return res.status(403).json({ error: 'Apenas administradores podem remover usuários.' });
    }

    const userId = req.params.id;
    if (userId === 'usr-admin') {
      return res.status(400).json({ error: 'O usuário administrador principal não pode ser removido.' });
    }

    await dbDeleteUser(userId);
    systemUsers = systemUsers.filter(u => u.id !== userId);

    broadcastEvent('USERS_REFRESH', systemUsers);
    res.json({ success: true, users: systemUsers });
  });

  // Get all ingredients
  app.get('/api/ingredients', async (req, res) => {
    const dbIngredients = await dbGetIngredients();
    if (dbIngredients !== null) {
      ingredients = dbIngredients;
    }
    res.json(ingredients);
  });

  // Create or update an ingredient in stock (Admin)
  app.post('/api/ingredients', async (req, res) => {
    const { ingredient, role } = req.body;

    if (role !== 'admin') {
      return res.status(403).json({ error: 'Não autorizado.' });
    }

    if (!ingredient || !ingredient.name || ingredient.stock === undefined) {
      return res.status(400).json({ error: 'Dados do ingrediente inválidos.' });
    }

    let targetIng: Ingredient;
    const existingIndex = ingredients.findIndex(i => i.id === ingredient.id);
    if (existingIndex !== -1) {
      targetIng = {
        ...ingredients[existingIndex],
        ...ingredient,
        subcategory: ingredient.subcategory !== undefined ? ingredient.subcategory : ingredients[existingIndex].subcategory,
        purchasePrice: ingredient.purchasePrice !== undefined ? Number(ingredient.purchasePrice) : ingredients[existingIndex].purchasePrice,
        stock: Number(ingredient.stock),
        minStock: Number(ingredient.minStock),
        price: Number(ingredient.price),
        image: ingredient.image !== undefined ? ingredient.image : ingredients[existingIndex].image,
        showOnHome: ingredient.showOnHome !== undefined ? Boolean(ingredient.showOnHome) : (ingredients[existingIndex].showOnHome !== false),
        trackStock: ingredient.trackStock !== undefined ? Boolean(ingredient.trackStock) : (ingredients[existingIndex].trackStock !== false)
      };
      ingredients[existingIndex] = targetIng;
    } else {
      targetIng = {
        id: ingredient.id || `ing-${Date.now()}`,
        name: ingredient.name,
        category: ingredient.category || 'extra',
        subcategory: ingredient.subcategory || undefined,
        purchasePrice: ingredient.purchasePrice !== undefined ? Number(ingredient.purchasePrice) : 0,
        stock: Number(ingredient.stock) || 0,
        minStock: Number(ingredient.minStock) || 10,
        unit: ingredient.unit || 'porções',
        price: Number(ingredient.price) || 0,
        image: ingredient.image || '',
        showOnHome: ingredient.showOnHome !== undefined ? Boolean(ingredient.showOnHome) : true,
        trackStock: ingredient.trackStock !== undefined ? Boolean(ingredient.trackStock) : true
      };
      ingredients.push(targetIng);
    }

    await dbSaveIngredient(targetIng);

    broadcastEvent('STOCKS_REFRESH', ingredients);
    res.json({ success: true, ingredients });
  });

  // Delete an ingredient (Admin)
  app.delete('/api/ingredients/:id', async (req, res) => {
    const { role } = req.query;

    if (role !== 'admin') {
      return res.status(403).json({ error: 'Não autorizado.' });
    }

    const ingId = req.params.id;
    ingredients = ingredients.filter(i => i.id !== ingId);
    await dbDeleteIngredient(ingId);

    broadcastEvent('STOCKS_REFRESH', ingredients);
    res.json({ success: true, ingredients });
  });

  // Restock an ingredient with purchase details modal support (Admin)
  app.post('/api/ingredients/restock', async (req, res) => {
    const { ingredientId, amount, purchasePrice, restockDate, expirationDate, role } = req.body;

    if (role !== 'admin') {
      return res.status(403).json({ error: 'Não autorizado.' });
    }

    const ingredient = ingredients.find(ing => ing.id === ingredientId);
    if (!ingredient) {
      return res.status(404).json({ error: 'Ingrediente não encontrado.' });
    }

    const restockQty = Number(amount);
    const unitCost = purchasePrice !== undefined ? Number(purchasePrice) : (ingredient.purchasePrice || 0);

    ingredient.stock += restockQty;
    if (purchasePrice !== undefined && Number(purchasePrice) >= 0) {
      ingredient.purchasePrice = Number(purchasePrice);
    }
    await dbSaveIngredient(ingredient);

    // Record purchase history
    const dateStr = restockDate || new Date().toISOString().split('T')[0];
    const newRecord: PurchaseRecord = {
      id: `pur-${Date.now()}`,
      ingredientId: ingredient.id,
      ingredientName: ingredient.name,
      date: dateStr,
      quantity: restockQty,
      unit: ingredient.unit,
      unitPrice: unitCost,
      totalCost: Number((restockQty * unitCost).toFixed(2)),
      expirationDate: expirationDate || undefined,
      createdAt: new Date().toISOString()
    };

    purchaseHistory.unshift(newRecord);
    await dbSavePurchaseRecord(newRecord);

    broadcastEvent('STOCK_UPDATE', { id: ingredient.id, stock: ingredient.stock, purchasePrice: ingredient.purchasePrice });
    broadcastEvent('STOCKS_REFRESH', ingredients);
    broadcastEvent('PURCHASE_HISTORY_UPDATE', newRecord);
    res.json({ success: true, ingredient, historyRecord: newRecord });
  });

  // Get Purchase History (All or by Ingredient ID)
  app.get('/api/ingredients/history', async (req, res) => {
    const dbHistory = await dbGetPurchaseHistory();
    if (dbHistory !== null) {
      purchaseHistory = dbHistory;
    }
    res.json(purchaseHistory);
  });

  app.get('/api/ingredients/history/:ingredientId', async (req, res) => {
    const { ingredientId } = req.params;
    const dbHistory = await dbGetPurchaseHistory(ingredientId);
    if (dbHistory !== null) {
      return res.json(dbHistory);
    }
    const filtered = purchaseHistory.filter(p => p.ingredientId === ingredientId);
    res.json(filtered);
  });

  // Get all purchase invoices / notas fiscais
  app.get('/api/invoices', async (req, res) => {
    const dbInvoices = await dbGetPurchaseInvoices();
    if (dbInvoices !== null) {
      purchaseInvoices = dbInvoices;
    }
    res.json(purchaseInvoices);
  });

  // Get single invoice by ID
  app.get('/api/invoices/:id', (req, res) => {
    const { id } = req.params;
    const inv = purchaseInvoices.find(i => i.id === id);
    if (!inv) {
      return res.status(404).json({ error: 'Nota fiscal não encontrada.' });
    }
    res.json(inv);
  });

  // Create / Launch new purchase invoice (Lançar Nota Fiscal em Lote)
  app.post('/api/invoices', async (req, res) => {
    const { invoiceNumber, supplier, purchaseDate, totalAmount, notes, items, role } = req.body;

    if (role !== 'admin') {
      return res.status(403).json({ error: 'Não autorizado.' });
    }

    if (!invoiceNumber || !purchaseDate || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Por favor, informe o número da nota, data e ao menos um item.' });
    }

    const processedItems: PurchaseInvoiceItem[] = [];

    for (const item of items) {
      if (!item.ingredientId || !item.quantity || Number(item.quantity) <= 0) continue;

      const ingredient = ingredients.find(ing => ing.id === item.ingredientId);
      if (ingredient) {
        const qty = Number(item.quantity);
        const uPrice = item.unitPrice !== undefined && Number(item.unitPrice) >= 0 ? Number(item.unitPrice) : (ingredient.purchasePrice || 0);
        const tCost = item.totalCost !== undefined && Number(item.totalCost) >= 0 ? Number(item.totalCost) : Number((qty * uPrice).toFixed(2));

        ingredient.stock += qty;
        if (uPrice > 0) {
          ingredient.purchasePrice = uPrice;
        }
        await dbSaveIngredient(ingredient);

        // Record individual item purchase history
        const rec: PurchaseRecord = {
          id: `pur-${Date.now()}-${Math.floor(Math.random()*1000)}`,
          ingredientId: ingredient.id,
          ingredientName: ingredient.name,
          date: purchaseDate,
          quantity: qty,
          unit: ingredient.unit,
          unitPrice: uPrice,
          totalCost: tCost,
          expirationDate: item.expirationDate || undefined,
          createdAt: new Date().toISOString()
        };
        purchaseHistory.unshift(rec);
        await dbSavePurchaseRecord(rec);

        processedItems.push({
          ingredientId: ingredient.id,
          ingredientName: ingredient.name,
          quantity: qty,
          unit: ingredient.unit,
          unitPrice: uPrice,
          totalCost: tCost,
          expirationDate: item.expirationDate || undefined
        });
      }
    }

    if (processedItems.length === 0) {
      return res.status(400).json({ error: 'Nenhum ingrediente válido foi selecionado na nota.' });
    }

    const calculatedTotal = processedItems.reduce((sum, it) => sum + Number(it.totalCost || 0), 0);
    const finalTotalAmount = totalAmount !== undefined && Number(totalAmount) > 0 ? Number(totalAmount) : calculatedTotal;

    const newInvoice: PurchaseInvoice = {
      id: `inv-${Date.now()}`,
      invoiceNumber: String(invoiceNumber).trim(),
      supplier: supplier ? String(supplier).trim() : '',
      purchaseDate,
      totalAmount: Number(finalTotalAmount.toFixed(2)),
      items: processedItems,
      notes: notes ? String(notes).trim() : '',
      createdAt: new Date().toISOString()
    };

    purchaseInvoices.unshift(newInvoice);
    await dbSavePurchaseInvoice(newInvoice);

    broadcastEvent('STOCKS_REFRESH', ingredients);
    broadcastEvent('INVOICE_ADDED', newInvoice);

    res.json({ success: true, invoice: newInvoice, ingredients });
  });

  // Delete invoice and reverse stock addition
  app.delete('/api/invoices/:id', async (req, res) => {
    const { id } = req.params;
    const role = (req.body && req.body.role) || req.query.role;

    if (role && role !== 'admin') {
      return res.status(403).json({ error: 'Não autorizado.' });
    }

    const index = purchaseInvoices.findIndex(i => i.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Nota fiscal não encontrada.' });
    }

    const invoiceToDelete = purchaseInvoices[index];

    // Subtract/reverse the stock added by this invoice
    if (Array.isArray(invoiceToDelete.items)) {
      for (const item of invoiceToDelete.items) {
        if (!item.ingredientId || !item.quantity) continue;
        const ingredient = ingredients.find(ing => ing.id === item.ingredientId);
        if (ingredient) {
          const qty = Number(item.quantity || 0);
          ingredient.stock = Math.max(0, ingredient.stock - qty);
          await dbSaveIngredient(ingredient);
        }
      }
    }

    purchaseInvoices.splice(index, 1);
    await dbDeletePurchaseInvoice(id);

    broadcastEvent('STOCKS_REFRESH', ingredients);
    broadcastEvent('INVOICE_DELETED', { id });

    res.json({ success: true, message: 'Nota fiscal excluída e itens removidos do estoque com sucesso.', ingredients });
  });

  app.post('/api/invoices/:id/delete', async (req, res) => {
    const { id } = req.params;
    const { role } = req.body || {};

    if (role && role !== 'admin') {
      return res.status(403).json({ error: 'Não autorizado.' });
    }

    const index = purchaseInvoices.findIndex(i => i.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Nota fiscal não encontrada.' });
    }

    const invoiceToDelete = purchaseInvoices[index];

    // Subtract/reverse the stock added by this invoice
    if (Array.isArray(invoiceToDelete.items)) {
      for (const item of invoiceToDelete.items) {
        if (!item.ingredientId || !item.quantity) continue;
        const ingredient = ingredients.find(ing => ing.id === item.ingredientId);
        if (ingredient) {
          const qty = Number(item.quantity || 0);
          ingredient.stock = Math.max(0, ingredient.stock - qty);
          await dbSaveIngredient(ingredient);
        }
      }
    }

    purchaseInvoices.splice(index, 1);
    await dbDeletePurchaseInvoice(id);

    broadcastEvent('STOCKS_REFRESH', ingredients);
    broadcastEvent('INVOICE_DELETED', { id });

    res.json({ success: true, message: 'Nota fiscal excluída e itens removidos do estoque com sucesso.', ingredients });
  });

  // Get customizer steps
  app.get('/api/steps', (req, res) => {
    res.json(customizerSteps);
  });

  // Update customizer steps (Admin only)
  app.post('/api/steps', (req, res) => {
    const { steps, role } = req.body;
    if (role !== 'admin') {
      return res.status(403).json({ error: 'Não autorizado.' });
    }
    if (!Array.isArray(steps)) {
      return res.status(400).json({ error: 'Etapas inválidas.' });
    }
    customizerSteps = steps;
    broadcastEvent('STEPS_REFRESH', customizerSteps);
    res.json({ success: true, steps: customizerSteps });
  });

  // Get ready products
  app.get('/api/ready-products', async (req, res) => {
    const dbProds = await dbGetReadyProducts();
    if (dbProds !== null) {
      readyProducts = dbProds;
    }
    res.json(readyProducts);
  });

  // Create or update ready product (Admin only)
  app.post('/api/ready-products', async (req, res) => {
    const { product, role } = req.body;
    if (role !== 'admin') {
      return res.status(403).json({ error: 'Não autorizado.' });
    }
    if (!product || !product.name || !product.price) {
      return res.status(400).json({ error: 'Dados do produto inválidos.' });
    }

    const index = readyProducts.findIndex(p => p.id === product.id);
    const isCombo = Boolean(product.isCombo || product.category === 'combo' || product.displaySection === 'combo');
    const targetProd: ReadyProduct = {
      ...product,
      isCombo,
      comboItems: Array.isArray(product.comboItems) ? product.comboItems : [],
      showInComboSection: Boolean(product.showInComboSection),
      skipIngredients: product.skipIngredients !== undefined ? Boolean(product.skipIngredients) : (isCombo ? true : false),
      showOnHome: product.showOnHome !== undefined ? Boolean(product.showOnHome) : (index !== -1 ? readyProducts[index].showOnHome !== false : true)
    };
    if (index !== -1) {
      readyProducts[index] = targetProd;
    } else {
      targetProd.id = product.id || `prod-${Date.now()}`;
      readyProducts.push(targetProd);
    }

    await dbSaveReadyProduct(targetProd);

    broadcastEvent('READY_PRODUCTS_REFRESH', readyProducts);
    res.json({ success: true, product: targetProd });
  });

  // Delete ready product (Admin only)
  app.delete('/api/ready-products/:id', async (req, res) => {
    const { role } = req.query;
    if (role !== 'admin') {
      return res.status(403).json({ error: 'Não autorizado.' });
    }
    const prodId = req.params.id;
    readyProducts = readyProducts.filter(p => p.id !== prodId);
    await dbDeleteReadyProduct(prodId);

    broadcastEvent('READY_PRODUCTS_REFRESH', readyProducts);
    res.json({ success: true });
  });

  // Lookup customer by phone number
  app.get('/api/customers/lookup', async (req, res) => {
    const phone = String(req.query.phone || '');
    if (!phone.trim()) {
      return res.json({ customer: null });
    }
    try {
      const customer = await dbGetCustomerByPhone(phone);
      res.json({ customer });
    } catch (err) {
      console.error('[Server] Error looking up customer:', err);
      res.status(500).json({ error: 'Erro ao buscar cliente.' });
    }
  });

  // Save/Update customer profile
  app.post('/api/customers', async (req, res) => {
    const { phone, name, street, number, neighborhood, city, state, complement, reference, lat, lng } = req.body;
    if (!phone || !phone.trim() || !name || !name.trim()) {
      return res.status(400).json({ error: 'Telefone e Nome são obrigatórios.' });
    }
    try {
      const success = await dbSaveCustomer({
        phone,
        name,
        street,
        number,
        neighborhood,
        city,
        state,
        complement,
        reference,
        lat,
        lng
      });
      res.json({ success });
    } catch (err) {
      console.error('[Server] Error saving customer:', err);
      res.status(500).json({ error: 'Erro ao salvar cliente.' });
    }
  });

  // Resolve ingredient usage for custom sandwiches and ready products with ultra-robust matching
  function calculateIngredientUsage(items: any[]): { [ingredientId: string]: { ingredient: Ingredient; qty: number } } {
    const usage: { [ingredientId: string]: { ingredient: Ingredient; qty: number } } = {};

    const addUsage = (ing: Ingredient, qty: number) => {
      if (!ing || qty <= 0) return;
      if (!usage[ing.id]) {
        usage[ing.id] = { ingredient: ing, qty: 0 };
      }
      usage[ing.id].qty += qty;
    };

    const normalize = (str: string) => {
      return String(str || '')
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    };

    const findIngByNameOrId = (nameOrId: string, category?: string): Ingredient | undefined => {
      if (!nameOrId) return undefined;
      let clean = String(nameOrId).trim();
      if (!clean) return undefined;

      const normRaw = normalize(clean);
      if (
        normRaw.startsWith('sem ') || 
        normRaw === 'sem queijo' || 
        normRaw === 'sem pao' || 
        normRaw === 'sem molho' || 
        normRaw === 'sem salada' || 
        normRaw.includes('tigela de salada')
      ) {
        return undefined;
      }

      // Clean common prefixes and notes in parentheses
      clean = clean
        .replace(/^(proteina\s+extra|queijo\s+extra|molho\s+extra|salada\s+extra|bebida\s+extra|adicional\s+de|extra\s+de|proteina\s+adicional|queijo\s+adicional|molho\s+adicional|item\s+adicional|adicional|extra|item)\s*:\s*/i, '')
        .replace(/^(proteina\s+extra|queijo\s+extra|molho\s+extra|salada\s+extra|bebida\s+extra|adicional\s+de|extra\s+de|proteina\s+adicional|queijo\s+adicional|molho\s+adicional)\s+/i, '')
        .replace(/\s*\([^)]*\)\s*$/g, '')
        .trim();

      // 1. Direct ID match
      let found = ingredients.find(i => i.id === clean || i.id.toLowerCase() === clean.toLowerCase());
      if (found) return found;

      let normClean = normalize(clean);
      if (!normClean) return undefined;

      // Normalization aliases for common Portuguese variations
      const aliasMap: Record<string, string> = {
        'teriyaki': 'frango teriaki',
        'frango teriyaki': 'frango teriaki',
        'peperonni': 'peperoni',
        'pepperoni': 'peperoni',
        'almondega': 'almodega',
        'almondegas': 'almodega',
        'almodegas': 'almodega',
        'mussarela': 'queijo mussarela',
        'mozzarella': 'queijo mussarela',
        'coalho': 'queijo coalho',
        'carne de sol desf': 'carne de sol',
        'carne de sol desfiada': 'carne de sol',
        'file mignon': 'file mignon',
        'frango crocante': 'frango',
        'frango defumado': 'frango',
        'frango grelhado': 'frango grelhado',
        'pao 3 queijos': 'tres queijos',
        'pao tres queijos': 'tres queijos',
        '3 queijos': 'tres queijos',
        'tres queijos': 'tres queijos',
        'pao ciabatta': 'ciabatta',
        'ciabatta': 'ciabatta',
        'pao parmesao oregano': 'parmesao e oregano',
        'pao parmesao e oregano': 'parmesao e oregano',
        'parmesao oregano': 'parmesao e oregano',
        'parmesao e oregano': 'parmesao e oregano',
        'pao italiano': 'italiano integral',
        'pao italiano integral': 'italiano integral',
        'italiano integral': 'italiano integral',
        'pao integral': 'italiano integral',
        'pao 9 graos': 'nove graos',
        'pao nove graos': 'nove graos',
        '9 graos': 'nove graos',
        'nove graos': 'nove graos',
        'pao australiano': 'australiano',
        'australiano': 'australiano',
        'pao brioche': 'brioche',
        'brioche': 'brioche',
        'pao frances': 'frances',
        'frances': 'frances',
        'alface americana': 'alface',
        'tomate fresco': 'tomate',
        'azeitonas pretas': 'azeitona',
        'azeitona preta': 'azeitona',
        'azeitonas': 'azeitona',
        'pepino crocante': 'pepino',
        'pimenta jalapeno': 'pimentao',
        'jalapeno': 'pimentao',
        'maionese da casa': 'maionese de cebola caramelizada',
        'barbecue artesanal': 'molho barbecue',
        'barbecue': 'molho barbecue',
        'chipotle picante': 'molho chipotle',
        'chipotle': 'molho chipotle',
        'ranch': 'molho ranch',
        'coca cola lata 350ml': 'coca cola 350ml',
        'coca cola zero lata 350ml': 'coca cola zero 350ml',
        'guarana antarctica 350ml': 'guarana antartica 350ml',
        'guarana antarctica zero 350ml': 'guarana antartica zero 350ml',
        'agua mineral sem gas 500ml': 'agua sem gas',
        'agua mineral com gas 500ml': 'agua com gas',
        'agua sem gas 500ml': 'agua sem gas',
        'agua com gas 500ml': 'agua com gas',
        'agua mineral sem gas': 'agua sem gas',
        'agua mineral com gas': 'agua com gas'
      };

      if (aliasMap[normClean]) {
        normClean = aliasMap[normClean];
      }

      // Sort candidate ingredients by length descending to prioritize more specific matches (e.g. FRANGO TERIAKI before FRANGO)
      const sortedIngredients = [...ingredients].sort((a, b) => b.name.length - a.name.length);

      // 2. Exact normalized name match within category
      if (category) {
        found = sortedIngredients.find(i => i.category === category && normalize(i.name) === normClean);
        if (found) return found;
      }

      // 3. Exact normalized name match across all
      found = sortedIngredients.find(i => normalize(i.name) === normClean);
      if (found) return found;

      // 4. Substring / StartsWith matching within category
      if (category) {
        found = sortedIngredients.find(i => i.category === category && (normalize(i.name) === normClean || normalize(i.name).startsWith(normClean) || normClean.startsWith(normalize(i.name))));
        if (found) return found;
        found = sortedIngredients.find(i => i.category === category && (normalize(i.name).includes(normClean) || normClean.includes(normalize(i.name))));
        if (found) return found;
      }

      // 5. Substring / StartsWith matching across all
      found = sortedIngredients.find(i => normalize(i.name) === normClean || normalize(i.name).startsWith(normClean) || normClean.startsWith(normalize(i.name)));
      if (found) return found;
      found = sortedIngredients.find(i => normalize(i.name).includes(normClean) || normClean.includes(normalize(i.name)));
      if (found) return found;

      // 6. Token / Keyword overlap matching
      const cleanTokens = normClean.split(' ').filter(t => t.length > 2 && !/^\d+/.test(t) && t !== 'adicional' && t !== 'extra');
      if (cleanTokens.length > 0) {
        if (category) {
          found = sortedIngredients.find(i => i.category === category && cleanTokens.every(tok => normalize(i.name).includes(tok)));
          if (found) return found;
          found = sortedIngredients.find(i => i.category === category && cleanTokens.some(tok => normalize(i.name).includes(tok)));
          if (found) return found;
        }
        found = sortedIngredients.find(i => cleanTokens.every(tok => normalize(i.name).includes(tok)));
        if (found) return found;
        found = sortedIngredients.find(i => cleanTokens.some(tok => normalize(i.name).includes(tok)));
        if (found) return found;
      }

      return undefined;
    };

    for (const item of items || []) {
      const q = Math.max(1, Number(item.quantity) || 1);
      const sw = item.sandwich || item.sandwichConfig;

      if (sw) {
        const is30cm = String(sw.size || '').toLowerCase().includes('30');
        const sizeMult = is30cm ? 2 : 1;

        if (sw.bread && !String(sw.bread).toLowerCase().includes('sem pão') && !String(sw.bread).toLowerCase().includes('sem pao') && !String(sw.bread).toLowerCase().includes('tigela de salada')) {
          const b = findIngByNameOrId(sw.bread, 'bread');
          if (b) addUsage(b, sizeMult * q);
        }
        if (sw.protein && !String(sw.protein).toLowerCase().includes('sem prote') && !String(sw.protein).toLowerCase().includes('nenhuma')) {
          const proteinList = String(sw.protein).split(',').map(s => s.trim()).filter(Boolean);
          for (const pr of proteinList) {
            const p = findIngByNameOrId(pr, 'protein');
            if (p) addUsage(p, sizeMult * q);
          }
        }
        if (sw.cheese && !String(sw.cheese).toLowerCase().includes('sem queijo') && !String(sw.cheese).toLowerCase().includes('nenhum')) {
          const cheeseList = String(sw.cheese).split(',').map(s => s.trim()).filter(Boolean);
          for (const ch of cheeseList) {
            const c = findIngByNameOrId(ch, 'cheese');
            if (c) addUsage(c, sizeMult * q);
          }
        }
        if (Array.isArray(sw.veggies)) {
          for (const veg of sw.veggies) {
            if (!String(veg).toLowerCase().includes('sem salada') && !String(veg).toLowerCase().includes('nenhuma')) {
              const v = findIngByNameOrId(veg, 'vegetable');
              if (v) addUsage(v, q);
            }
          }
        }
        if (Array.isArray(sw.sauces)) {
          for (const sauce of sw.sauces) {
            if (!String(sauce).toLowerCase().includes('sem molho') && !String(sauce).toLowerCase().includes('nenhum')) {
              const s = findIngByNameOrId(sauce, 'sauce');
              if (s) addUsage(s, q);
            }
          }
        }
        if (Array.isArray(sw.extras)) {
          for (const extra of sw.extras) {
            if (/^dobra\s+de\s+prote[ií]na/i.test(extra)) {
              if (sw.protein) {
                const p = findIngByNameOrId(sw.protein, 'protein');
                if (p) addUsage(p, q);
              }
            } else if (/^dobra\s+de\s+queijo/i.test(extra)) {
              if (sw.cheese && !String(sw.cheese).toLowerCase().includes('sem queijo')) {
                const c = findIngByNameOrId(sw.cheese, 'cheese');
                if (c) addUsage(c, q);
              }
            } else if (/^prote[ií]na\s+(adicional|extra)\s*:\s*/i.test(extra)) {
              const cleanExtra = extra.replace(/^prote[ií]na\s+(adicional|extra)\s*:\s*/i, '').trim();
              const p = findIngByNameOrId(cleanExtra, 'protein') || findIngByNameOrId(cleanExtra);
              if (p) addUsage(p, q);
            } else if (/^queijo\s+(adicional|extra)\s*:\s*/i.test(extra)) {
              const cleanExtra = extra.replace(/^queijo\s+(adicional|extra)\s*:\s*/i, '').trim();
              const c = findIngByNameOrId(cleanExtra, 'cheese') || findIngByNameOrId(cleanExtra);
              if (c) addUsage(c, q);
            } else if (/^molho\s+(adicional|extra)\s*:\s*/i.test(extra)) {
              const cleanExtra = extra.replace(/^molho\s+(adicional|extra)\s*:\s*/i, '').trim();
              const s = findIngByNameOrId(cleanExtra, 'sauce') || findIngByNameOrId(cleanExtra);
              if (s) addUsage(s, q);
            } else {
              const e = findIngByNameOrId(extra, 'extra') || findIngByNameOrId(extra);
              if (e) addUsage(e, q);
            }
          }
        }
        if (Array.isArray(sw.drinksAndCookies)) {
          for (const dc of sw.drinksAndCookies) {
            const d = findIngByNameOrId(dc, 'drink_cookie') || findIngByNameOrId(dc);
            if (d) addUsage(d, q);
          }
        }
      } else {
        const rawName = String(item.productName || item.name || '').trim();
        const cleanRawName = rawName.replace(/\s*\([^)]*\)\s*$/g, '').trim();

        const matchedProd = (readyProducts || []).find(p => 
          (item.productId && p.id === item.productId) ||
          (item.id && p.id === item.id) ||
          (p.name && normalize(p.name) === normalize(rawName)) ||
          (p.name && normalize(p.name) === normalize(cleanRawName)) ||
          (p.name && normalize(rawName).includes(normalize(p.name))) ||
          (p.name && normalize(cleanRawName).includes(normalize(p.name)))
        );

        if (matchedProd?.sandwichConfig) {
          const pSw = matchedProd.sandwichConfig;
          if (pSw.bread && !String(pSw.bread).toLowerCase().includes('sem pão') && !String(pSw.bread).toLowerCase().includes('sem pao')) {
            const b = findIngByNameOrId(pSw.bread, 'bread');
            if (b) addUsage(b, q);
          }
          if (pSw.protein) {
            const proteinList = String(pSw.protein).split(',').map(s => s.trim()).filter(Boolean);
            for (const pr of proteinList) {
              const p = findIngByNameOrId(pr, 'protein');
              if (p) addUsage(p, q);
            }
          }
          if (pSw.cheese) {
            const cheeseList = String(pSw.cheese).split(',').map(s => s.trim()).filter(Boolean);
            for (const ch of cheeseList) {
              const c = findIngByNameOrId(ch, 'cheese');
              if (c) addUsage(c, q);
            }
          }
          if (Array.isArray(pSw.veggies)) {
            for (const veg of pSw.veggies) {
              const v = findIngByNameOrId(veg, 'vegetable');
              if (v) addUsage(v, q);
            }
          }
          if (Array.isArray(pSw.sauces)) {
            for (const sauce of pSw.sauces) {
              const s = findIngByNameOrId(sauce, 'sauce');
              if (s) addUsage(s, q);
            }
          }
          if (Array.isArray(pSw.extras)) {
            for (const extra of pSw.extras) {
              const e = findIngByNameOrId(extra, 'extra') || findIngByNameOrId(extra);
              if (e) addUsage(e, q);
            }
          }
          if (Array.isArray(pSw.drinksAndCookies)) {
            for (const dc of pSw.drinksAndCookies) {
              const d = findIngByNameOrId(dc, 'drink_cookie') || findIngByNameOrId(dc);
              if (d) addUsage(d, q);
            }
          }
        } else if (matchedProd?.linkedIngredientId) {
          const ing = ingredients.find(i => i.id === matchedProd.linkedIngredientId);
          if (ing) addUsage(ing, q);
        } else {
          // Resolve direct ingredient (beverages, juices, desserts, cookies, etc.)
          let ing: Ingredient | undefined = undefined;
          if (item.productId && !String(item.productId).startsWith('item-') && !String(item.productId).startsWith('cart-')) {
            ing = findIngByNameOrId(item.productId);
          }
          if (!ing && item.id && !String(item.id).startsWith('item-') && !String(item.id).startsWith('cart-')) {
            ing = findIngByNameOrId(item.id);
          }
          if (!ing) {
            ing = findIngByNameOrId(cleanRawName) || findIngByNameOrId(rawName);
          }
          if (ing) {
            addUsage(ing, q);
          }
        }
      }
    }

    return usage;
  }

  // Deduct stock for order and persist directly to MySQL database
  async function deductStockForOrder(items: any[]): Promise<void> {
    const dbIngs = await dbGetIngredients();
    if (dbIngs !== null && dbIngs.length > 0) {
      ingredients = dbIngs;
    }
    const dbProds = await dbGetReadyProducts();
    if (dbProds !== null && dbProds.length > 0) {
      readyProducts = dbProds;
    }
    const usage = calculateIngredientUsage(items);
    console.log('[Stock] Deducting stock for order. Items:', (items || []).length, 'Usage count:', Object.keys(usage).length);
    for (const { ingredient, qty } of Object.values(usage)) {
      const targetIng = ingredients.find(i => i.id === ingredient.id || i.name.toLowerCase() === ingredient.name.toLowerCase()) || ingredient;
      targetIng.stock = Math.max(0, targetIng.stock - qty);
      const updateOk = await dbUpdateStock(targetIng.id, targetIng.stock, targetIng.name);
      console.log(`[Stock] Deducted ${qty} of "${targetIng.name}" (${targetIng.id}). New Stock: ${targetIng.stock} (DB: ${updateOk})`);
    }

    // Refresh ingredients to guarantee accurate synchronized state
    const freshIngs = await dbGetIngredients();
    if (freshIngs !== null && freshIngs.length > 0) {
      ingredients = freshIngs;
    }

    // Broadcast stock updates to all connected clients immediately
    broadcastEvent('STOCKS_REFRESH', ingredients);
  }

  // Restore stock for order and persist directly to MySQL database
  async function restoreStockForOrder(items: any[]): Promise<void> {
    const dbIngs = await dbGetIngredients();
    if (dbIngs !== null && dbIngs.length > 0) {
      ingredients = dbIngs;
    }
    const dbProds = await dbGetReadyProducts();
    if (dbProds !== null && dbProds.length > 0) {
      readyProducts = dbProds;
    }
    const usage = calculateIngredientUsage(items);
    console.log('[Stock] Restoring stock for order. Items:', (items || []).length, 'Usage count:', Object.keys(usage).length);
    for (const { ingredient, qty } of Object.values(usage)) {
      const targetIng = ingredients.find(i => i.id === ingredient.id || i.name.toLowerCase() === ingredient.name.toLowerCase()) || ingredient;
      targetIng.stock = targetIng.stock + qty;
      const updateOk = await dbUpdateStock(targetIng.id, targetIng.stock, targetIng.name);
      console.log(`[Stock] Restored ${qty} of "${targetIng.name}" (${targetIng.id}). New Stock: ${targetIng.stock} (DB: ${updateOk})`);
    }

    // Refresh ingredients to guarantee accurate synchronized state
    const freshIngs = await dbGetIngredients();
    if (freshIngs !== null && freshIngs.length > 0) {
      ingredients = freshIngs;
    }

    // Broadcast stock updates to all connected clients immediately
    broadcastEvent('STOCKS_REFRESH', ingredients);
  }

  // Create new order (Client / POS)
  app.post('/api/orders', async (req, res) => {
    const { 
      customerName, 
      customerPhone,
      items, 
      deliveryType, 
      deliveryAddress,
      customerType,
      paymentMethod,
      cashReceived,
      changeAmount,
      isPosOrder,
      tableNumber,
      cardProvider,
      machineModel,
      needChange,
      changeForAmount,
      printReceipt,
      paymentSplits
    } = req.body;

    if (!customerName || !items || items.length === 0) {
      return res.status(400).json({ error: 'Dados do pedido inválidos.' });
    }

    const sanitizedItems = (items || []).map((item: any, idx: number) => {
      let pName = item.productName || item.name;
      const sw = item.sandwich || item.sandwichConfig;
      if (!pName || pName === 'null' || pName.trim() === '') {
        if (sw) {
          pName = sw.protein ? `BAGÔ ${sw.protein}` : 'Monte seu Bagô';
        } else {
          pName = 'Produto';
        }
      }
      return {
        id: item.id || `item-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 6)}`,
        productId: item.productId || item.id,
        productName: pName,
        isReadyProduct: item.isReadyProduct !== undefined ? Boolean(item.isReadyProduct) : !sw,
        sandwich: sw || undefined,
        price: Number(item.price) || 0,
        quantity: Number(item.quantity) || 1
      };
    });

    // Check if store / delivery receiving is blocked for online customer orders
    if (!isPosOrder) {
      const deliveryOpeningStatus = checkDeliveryOpeningStatus(storeDeliverySettings);
      if (deliveryOpeningStatus.isBlocked) {
        return res.status(400).json({ error: `🚫 Recebimento de pedidos suspenso: ${deliveryOpeningStatus.reason}` });
      }
      if (storeDeliverySettings.pickupOnly && deliveryType === 'entrega') {
        return res.status(400).json({ error: '🚫 No momento estamos aceitando apenas pedidos para Retirada no Balcão. O serviço de entrega (Delivery) está temporariamente indisponível.' });
      }
    }

    // Check stock availability before proceeding
    const usage = calculateIngredientUsage(sanitizedItems);
    for (const { ingredient, qty } of Object.values(usage)) {
      if (ingredient.stock < qty) {
        return res.status(400).json({ error: `Estoque insuficiente para o item/ingrediente: ${ingredient.name} (Disponível: ${ingredient.stock}, Solicitado: ${qty})` });
      }
    }

    // Deduct stock in memory and persist in MySQL database
    await deductStockForOrder(sanitizedItems);

    // Generate unique 8-digit pickup code (e.g. BG-34567890) preventing collisions in MySQL and memory
    let orderCode = await dbGenerateUniqueOrderCode();
    while (orders.some(o => o.code === orderCode)) {
      orderCode = await dbGenerateUniqueOrderCode();
    }

    const calculatedDeliveryFee = deliveryType === 'entrega' ? (Number(req.body.deliveryFee) || 0) : 0;
    const itemsSubtotal = sanitizedItems.reduce((acc: number, item: any) => acc + (Number(item.price) || 0) * (Number(item.quantity) || 1), 0);
    const orderDiscountAmount = Math.max(0, Number(req.body.discountAmount) || 0);
    const calculatedTotalPrice = Math.max(0, itemsSubtotal + calculatedDeliveryFee - orderDiscountAmount);

    const newOrder: Order = {
      id: `ord-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      code: orderCode,
      customerName,
      customerPhone,
      items: sanitizedItems,
      totalPrice: calculatedTotalPrice,
      couponCode: req.body.couponCode ? String(req.body.couponCode).trim().toUpperCase() : undefined,
      discountAmount: orderDiscountAmount > 0 ? orderDiscountAmount : undefined,
      status: 'pendente',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      estimatedMinutes: 15,
      deliveryType,
      deliveryAddress,
      deliveryFee: calculatedDeliveryFee,
      deliveryDistanceKm: req.body.deliveryDistanceKm || 0,
      deliveryLat: req.body.deliveryLat,
      deliveryLng: req.body.deliveryLng,
      customerType,
      paymentMethod,
      cashReceived,
      changeAmount,
      isPosOrder,
      tableNumber,
      cardProvider,
      machineModel,
      needChange,
      changeForAmount,
      printReceipt,
      paymentSplits,
      sellerName: req.body.sellerName || req.body.createdBy || req.body.userName || (isPosOrder ? 'Atendimento Balcão' : 'Loja Online'),
      createdBy: req.body.createdBy || req.body.sellerName || req.body.userName || (isPosOrder ? 'Atendimento Balcão' : 'Loja Online')
    };

    orders.unshift(newOrder); // Add to beginning

    // Save order in MySQL database
    await dbSaveOrder(newOrder);

    // Save/update customer profile in MySQL database if phone & name are present
    if (customerPhone && customerName) {
      try {
        await dbSaveCustomer({
          phone: customerPhone,
          name: customerName,
          street: req.body.addressStreet || req.body.street,
          number: req.body.addressNumber || req.body.number,
          neighborhood: req.body.addressNeighborhood || req.body.neighborhood,
          city: req.body.addressCity || req.body.city,
          state: req.body.addressState || req.body.state,
          complement: req.body.addressComplement || req.body.complement,
          reference: req.body.addressReference || req.body.reference,
          lat: req.body.deliveryLat,
          lng: req.body.deliveryLng
        });
      } catch (custErr) {
        console.warn('[Server] Notice saving customer profile on order creation:', custErr);
      }
    }

    if (newOrder.couponCode) {
      await dbIncrementCouponUsage(newOrder.couponCode);
      const cIndex = inMemoryCoupons.findIndex(c => c.code.toUpperCase() === newOrder.couponCode?.toUpperCase());
      if (cIndex >= 0) {
        inMemoryCoupons[cIndex].usedCount = (inMemoryCoupons[cIndex].usedCount || 0) + 1;
      }
    }

    // Also register sale immediately or when finished? Let's register when created (since it's paid on order)
    sales.push({
      orderId: newOrder.id,
      date: newOrder.createdAt,
      amount: newOrder.totalPrice,
      itemsCount: newOrder.items.length
    });

    // If there is an active cash register open, sync transactions
    if (activeCashRegister && activeCashRegister.status === 'open') {
      syncCashRegisterOrders(activeCashRegister);
      broadcastEvent('CASH_REGISTER_UPDATE', activeCashRegister);
    }

    // Notify all kitchen/admin clients of the new order
    broadcastEvent('NEW_ORDER', newOrder);
    // Broadcast stock updates
    broadcastEvent('STOCKS_REFRESH', ingredients);

    res.status(201).json({ success: true, order: newOrder, ingredients, ...newOrder });
  });

  // Helper to normalize payment method string
  function normalizePaymentMethodStr(pm?: string): 'dinheiro' | 'debito' | 'credito' | 'pix' | 'vr' {
    if (!pm) return 'debito';
    const clean = String(pm).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    if (clean.includes('dinheiro') || clean.includes('cash') || clean.includes('especie')) return 'dinheiro';
    if (clean.includes('pix')) return 'pix';
    if (clean.includes('credito') || clean.includes('credit')) return 'credito';
    if (clean.includes('refeicao') || clean.includes('vale') || clean.includes('vr') || clean.includes('alelo') || clean.includes('sodexo') || clean.includes('ticket')) return 'vr';
    if (clean.includes('debito') || clean.includes('debit')) return 'debito';
    return 'debito';
  }

  // Helper to sync all sales made during an open cash register session
  function syncCashRegisterOrders(session: CashRegisterSession | null) {
    if (!session || session.status !== 'open') return;
    if (!session.transactions) session.transactions = [];

    // Calculate earliest timestamp for this shift:
    // If the register was opened today, include all orders made today (or after the last closed register session)
    let minAllowedTime = new Date(session.openedAt).getTime();
    const openDateObj = new Date(session.openedAt);
    const dayStartObj = new Date(openDateObj.getFullYear(), openDateObj.getMonth(), openDateObj.getDate(), 0, 0, 0, 0);
    const dayStartTime = dayStartObj.getTime();

    // Check if there is a previously closed session on the same day
    const lastClosed = (cashRegisterHistory || []).find(h => h.status === 'closed' && h.closedAt);
    if (lastClosed && lastClosed.closedAt) {
      const lastClosedTime = new Date(lastClosed.closedAt).getTime();
      minAllowedTime = Math.max(lastClosedTime, dayStartTime);
    } else {
      minAllowedTime = Math.min(minAllowedTime, dayStartTime);
    }

    let modified = false;

    // 1. Identify all valid, non-cancelled orders
    const validOrders = orders.filter(o => o.status !== 'cancelado');
    const validOrderIds = new Set(validOrders.map(o => o.id));
    const validOrderCodes = new Set(validOrders.map(o => o.code).filter(Boolean));

    // 2. Remove transactions for orders that have been cancelled, deleted, or are missing from active orders
    const initialCount = session.transactions.length;
    session.transactions = session.transactions.filter(tx => {
      // Keep manual non-sale entries like opening, sangria, suprimento
      if (tx.type === 'opening' || tx.type === 'sangria' || tx.type === 'suprimento') return true;

      if (tx.type === 'sale') {
        // If it was generated from an order, strictly require that order to exist and be non-cancelled
        if (tx.orderId && !validOrderIds.has(tx.orderId)) return false;
        if (tx.orderCode && !validOrderCodes.has(tx.orderCode)) return false;
        if (tx.id && tx.id.startsWith('tx-ord-')) {
          const matched = Array.from(validOrderIds).some(id => tx.id.includes(id));
          if (!matched) return false;
        }
      }
      return true;
    });

    if (session.transactions.length !== initialCount) {
      modified = true;
    }

    // 3. Find all valid non-cancelled orders created in this shift
    const sessionOrders = validOrders.filter(o => {
      const orderTime = new Date(o.createdAt).getTime();
      return orderTime >= minAllowedTime;
    });

    for (const order of sessionOrders) {
      const existing = session.transactions.some(tx => tx.orderId === order.id || (tx.id && tx.id.includes(order.id)));
      if (!existing) {
        const isDelivery = order.deliveryType === 'entrega';
        const channel: 'delivery' | 'balcao' = isDelivery ? 'delivery' : 'balcao';
        const channelLabel = isDelivery ? 'Delivery' : (order.isPosOrder ? 'Balcão PDV' : 'Balcão/Retirada');

        if (order.paymentSplits && order.paymentSplits.length > 0) {
          order.paymentSplits.forEach((split, idx) => {
            session.transactions.push({
              id: `tx-ord-${order.id}-${idx}`,
              type: 'sale',
              amount: Number(split.amount) || 0,
              description: `Venda ${channelLabel} - Pedido #${order.code}`,
              timestamp: order.createdAt,
              paymentMethod: normalizePaymentMethodStr(split.method || order.paymentMethod),
              cardProvider: split.cardProvider || order.cardProvider,
              machineModel: split.machineModel || order.machineModel,
              orderId: order.id,
              orderCode: order.code,
              deliveryType: order.deliveryType,
              deliveryFee: isDelivery ? (Number(order.deliveryFee) || 0) : 0,
              isPosOrder: order.isPosOrder,
              channel: channel
            });
          });
        } else {
          session.transactions.push({
            id: `tx-ord-${order.id}`,
            type: 'sale',
            amount: Number(order.totalPrice) || 0,
            description: `Venda ${channelLabel} - Pedido #${order.code}`,
            timestamp: order.createdAt,
            paymentMethod: normalizePaymentMethodStr(order.paymentMethod),
            cardProvider: order.cardProvider,
            machineModel: order.machineModel,
            orderId: order.id,
            orderCode: order.code,
            deliveryType: order.deliveryType,
            deliveryFee: isDelivery ? (Number(order.deliveryFee) || 0) : 0,
            isPosOrder: order.isPosOrder,
            channel: channel
          });
        }
        modified = true;
      }
    }

    if (modified) {
      dbSaveCashSession(session).catch(e => console.error('[MySQL] Error saving synced cash session:', e));
    }
  }

  // ===================== DELIVERIES DETAILED TABLE API ROUTE ===================== //
  app.get('/api/deliveries-table', async (req, res) => {
    try {
      const { search, startDate, endDate, deliveryType, status } = req.query;
      const rows = await dbGetDeliveriesTable({
        search: search ? String(search) : undefined,
        startDate: startDate ? String(startDate) : undefined,
        endDate: endDate ? String(endDate) : undefined,
        deliveryType: deliveryType ? String(deliveryType) : undefined,
        status: status ? String(status) : undefined
      });
      res.json(rows || []);
    } catch (err) {
      console.error('[API] Error fetching deliveries table:', err);
      res.status(500).json({ error: 'Erro ao buscar tabela de entregas.' });
    }
  });

  // ===================== CASH REGISTER API ROUTES ===================== //
  // Get active cash register session and history
  app.get('/api/cash-register/current', async (req, res) => {
    try {
      const dbSessions = await dbGetCashSessions();
      if (dbSessions && Array.isArray(dbSessions)) {
        const closed = dbSessions.filter(s => s.status === 'closed');
        if (closed.length > 0) {
          cashRegisterHistory = closed;
        }
        const dbActive = dbSessions.find(s => s.status === 'open');
        if (dbActive && (!activeCashRegister || activeCashRegister.id === dbActive.id)) {
          activeCashRegister = dbActive;
        }
      }
    } catch (e) {
      console.error('[API] Error syncing cash sessions from DB:', e);
    }

    if (activeCashRegister) {
      syncCashRegisterOrders(activeCashRegister);
    }

    res.json({
      activeSession: activeCashRegister,
      history: cashRegisterHistory
    });
  });

  // Get full cash register history
  app.get('/api/cash-register/history', async (req, res) => {
    try {
      const dbSessions = await dbGetCashSessions();
      if (dbSessions && Array.isArray(dbSessions)) {
        const closed = dbSessions.filter(s => s.status === 'closed');
        cashRegisterHistory = closed;
      }
    } catch (e) {
      console.error('[API] Error fetching cash register history:', e);
    }

    res.json({
      history: cashRegisterHistory,
      activeSession: activeCashRegister
    });
  });

  // Open cash register (Abertura / Fundo de Caixa)
  app.post('/api/cash-register/open', async (req, res) => {
    const { initialCash, openedBy, notes } = req.body;

    if (activeCashRegister && activeCashRegister.status === 'open') {
      return res.status(400).json({ error: 'O caixa já está aberto!', activeSession: activeCashRegister });
    }

    const initAmount = Number(initialCash) || 0;
    const session: CashRegisterSession = {
      id: `cx-${Date.now()}`,
      openedAt: new Date().toISOString(),
      openedBy: openedBy || 'Operador',
      initialCash: initAmount,
      status: 'open',
      notes: notes || '',
      transactions: [
        {
          id: `tx-open-${Date.now()}`,
          type: 'opening',
          amount: initAmount,
          description: 'Abertura de Caixa (Fundo Inicial)',
          timestamp: new Date().toISOString()
        }
      ]
    };

    activeCashRegister = session;
    syncCashRegisterOrders(activeCashRegister);
    await dbSaveCashSession(activeCashRegister);
    broadcastEvent('CASH_REGISTER_OPENED', activeCashRegister);
    res.json({ success: true, session: activeCashRegister });
  });

  // Cash transaction (Suprimento ou Sangria)
  app.post('/api/cash-register/transaction', async (req, res) => {
    if (!activeCashRegister || activeCashRegister.status !== 'open') {
      return res.status(400).json({ error: 'O caixa está fechado. Abra o caixa primeiro.' });
    }

    const { type, amount, description } = req.body;
    if (!type || !['suprimento', 'sangria'].includes(type) || !amount || amount <= 0) {
      return res.status(400).json({ error: 'Valores ou tipo de movimentação inválidos.' });
    }

    const tx: CashTransaction = {
      id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type: type as 'suprimento' | 'sangria',
      amount: Number(amount),
      description: description || (type === 'suprimento' ? 'Entrada de troco / Suprimento' : 'Retirada de caixa / Sangria'),
      timestamp: new Date().toISOString()
    };

    if (!activeCashRegister.transactions) activeCashRegister.transactions = [];
    activeCashRegister.transactions.push(tx);

    await dbSaveCashSession(activeCashRegister);
    broadcastEvent('CASH_REGISTER_UPDATE', activeCashRegister);
    res.json({ success: true, session: activeCashRegister, transaction: tx });
  });

  // Close cash register (Fechamento de Caixa)
  app.post('/api/cash-register/close', async (req, res) => {
    if (!activeCashRegister || activeCashRegister.status !== 'open') {
      return res.status(400).json({ error: 'Nenhum caixa aberto para fechar.' });
    }

    syncCashRegisterOrders(activeCashRegister);

    const { actualCashInDrawer, closedBy, notes } = req.body;
    const actualCash = Number(actualCashInDrawer) || 0;

    const cancelledOrders = orders.filter(o => o.status === 'cancelado');
    const cancelledOrderIds = new Set(cancelledOrders.map(o => o.id));
    const cancelledOrderCodes = new Set(cancelledOrders.map(o => o.code).filter(Boolean));

    const txs = (activeCashRegister.transactions || []).filter(tx => {
      if (tx.orderId && cancelledOrderIds.has(tx.orderId)) return false;
      if (tx.orderCode && cancelledOrderCodes.has(tx.orderCode)) return false;
      if (tx.id && Array.from(cancelledOrderIds).some(id => id && tx.id.includes(id))) return false;
      if (tx.description && Array.from(cancelledOrderCodes).some(code => code && tx.description.includes(code))) return false;
      return true;
    });
    activeCashRegister.transactions = txs;
    
    // Calculate totals
    const initial = activeCashRegister.initialCash || 0;
    const cashSales = txs
      .filter(t => t.type === 'sale' && t.paymentMethod === 'dinheiro')
      .reduce((sum, t) => sum + t.amount, 0);

    const suprimentos = txs
      .filter(t => t.type === 'suprimento')
      .reduce((sum, t) => sum + t.amount, 0);

    const sangrias = txs
      .filter(t => t.type === 'sangria')
      .reduce((sum, t) => sum + t.amount, 0);

    const expectedCashInDrawer = initial + cashSales + suprimentos - sangrias;
    const cashDifference = actualCash - expectedCashInDrawer;

    activeCashRegister.status = 'closed';
    activeCashRegister.closedAt = new Date().toISOString();
    activeCashRegister.closedBy = closedBy || 'Operador';
    activeCashRegister.expectedCashInDrawer = expectedCashInDrawer;
    activeCashRegister.actualCashInDrawer = actualCash;
    activeCashRegister.cashDifference = cashDifference;
    if (notes) activeCashRegister.notes = (activeCashRegister.notes ? activeCashRegister.notes + ' | ' : '') + notes;

    const closedSession = { ...activeCashRegister };
    await dbSaveCashSession(closedSession);
    cashRegisterHistory.unshift(closedSession);
    activeCashRegister = null;

    broadcastEvent('CASH_REGISTER_CLOSED', closedSession);
    res.json({ success: true, closedSession });
  });

  // Get all orders
  app.get('/api/orders', async (req, res) => {
    const dbOrders = await dbGetOrders();
    if (dbOrders !== null) {
      orders = dbOrders;
      sales = dbOrders.map(o => ({
        orderId: o.id,
        date: o.createdAt,
        amount: Number(o.totalPrice) || 0,
        itemsCount: o.items ? o.items.length : 1
      }));
    }
    res.json(orders);
  });

  // Get order by id (for tracking)
  app.get('/api/orders/:id', (req, res) => {
    const order = orders.find(o => o.id === req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Pedido não encontrado.' });
    }
    res.json(order);
  });

  // Update order status (Kitchen/Admin)
  app.patch('/api/orders/:id/status', async (req, res) => {
    const { status } = req.body;
    const order = orders.find(o => o.id === req.params.id);

    if (!order) {
      return res.status(404).json({ error: 'Pedido não encontrado.' });
    }

    const previousStatus = order.status;
    order.status = status as OrderStatus;
    order.updatedAt = new Date().toISOString();

    if (order.status === 'preparo') {
      order.estimatedMinutes = 8;
    } else if (order.status === 'finalizado') {
      order.estimatedMinutes = 2; // Ready for pickup
    } else if (order.status === 'entregue') {
      order.estimatedMinutes = 0;
    }

    // If order was cancelled, restore items back to stock
    if (status === 'cancelado' && previousStatus !== 'cancelado') {
      await restoreStockForOrder(order.items || []);
    } else if (previousStatus === 'cancelado' && status !== 'cancelado') {
      // If order was uncanceled, deduct stock again
      await deductStockForOrder(order.items || []);
    }

    await dbUpdateOrderStatus(order.id, order.status, order.estimatedMinutes);

    if (activeCashRegister && activeCashRegister.status === 'open') {
      syncCashRegisterOrders(activeCashRegister);
      broadcastEvent('CASH_REGISTER_UPDATE', activeCashRegister);
    }

    broadcastEvent('ORDER_STATUS_UPDATE', order);
    res.json(order);
  });

  // Update complete order (POS / Admin edit order)
  app.put('/api/orders/:id', async (req, res) => {
    const { id } = req.params;
    const index = orders.findIndex(o => o.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Pedido não encontrado.' });
    }

    const updatedData = req.body;
    const currentOrder = orders[index];

    const rawItems = updatedData.items ? updatedData.items : currentOrder.items;
    const newItems = (rawItems || []).map((item: any, idx: number) => {
      let pName = item.productName || item.name;
      const sw = item.sandwich || item.sandwichConfig;
      if (!pName || pName === 'null' || pName.trim() === '') {
        if (sw) {
          pName = sw.protein ? `BAGÔ ${sw.protein}` : 'Monte seu Bagô';
        } else {
          pName = 'Produto';
        }
      }
      return {
        id: `item-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 6)}`,
        productName: pName,
        isReadyProduct: item.isReadyProduct !== undefined ? Boolean(item.isReadyProduct) : !sw,
        sandwich: sw || undefined,
        price: Number(item.price) || 0,
        quantity: Number(item.quantity) || 1
      };
    });

    const finalDeliveryType = updatedData.deliveryType ?? currentOrder.deliveryType;
    const finalDeliveryFee = updatedData.deliveryFee !== undefined ? Number(updatedData.deliveryFee) : (currentOrder.deliveryFee || 0);
    const finalDiscountAmount = updatedData.discountAmount !== undefined ? Number(updatedData.discountAmount) : (currentOrder.discountAmount || 0);

    let newTotalPrice: number;
    if (updatedData.totalPrice !== undefined) {
      newTotalPrice = Number(updatedData.totalPrice);
    } else if (updatedData.items) {
      const itemsSum = newItems.reduce((acc: number, item: any) => acc + (Number(item.price) * Number(item.quantity)), 0);
      newTotalPrice = Math.max(0, itemsSum + (finalDeliveryType === 'entrega' ? finalDeliveryFee : 0) - finalDiscountAmount);
    } else {
      newTotalPrice = currentOrder.totalPrice;
    }

    const updatedOrder: Order = {
      ...currentOrder,
      customerName: updatedData.customerName ?? currentOrder.customerName,
      customerPhone: updatedData.customerPhone ?? currentOrder.customerPhone,
      customerType: updatedData.customerType ?? currentOrder.customerType,
      tableNumber: updatedData.tableNumber ?? currentOrder.tableNumber,
      paymentMethod: updatedData.paymentMethod ?? currentOrder.paymentMethod,
      status: updatedData.status ?? currentOrder.status,
      items: newItems,
      totalPrice: newTotalPrice,
      deliveryType: finalDeliveryType,
      deliveryFee: finalDeliveryFee,
      deliveryAddress: updatedData.deliveryAddress !== undefined ? updatedData.deliveryAddress : currentOrder.deliveryAddress,
      paymentSplits: updatedData.paymentSplits !== undefined ? updatedData.paymentSplits : currentOrder.paymentSplits,
      discountAmount: finalDiscountAmount > 0 ? finalDiscountAmount : undefined,
      couponCode: updatedData.couponCode !== undefined ? updatedData.couponCode : currentOrder.couponCode,
      cardProvider: updatedData.cardProvider ?? currentOrder.cardProvider,
      machineModel: updatedData.machineModel ?? currentOrder.machineModel,
      cashReceived: updatedData.cashReceived !== undefined ? updatedData.cashReceived : currentOrder.cashReceived,
      changeAmount: updatedData.changeAmount !== undefined ? updatedData.changeAmount : currentOrder.changeAmount,
      updatedAt: new Date().toISOString()
    };

    orders[index] = updatedOrder;

    // If items were updated, restore old stock and deduct new items stock
    if (updatedData.items) {
      await restoreStockForOrder(currentOrder.items || []);
      await deductStockForOrder(newItems);
      broadcastEvent('STOCKS_REFRESH', ingredients);
    }

    await dbUpdateOrder(updatedOrder);

    if (activeCashRegister && activeCashRegister.status === 'open') {
      syncCashRegisterOrders(activeCashRegister);
      broadcastEvent('CASH_REGISTER_UPDATE', activeCashRegister);
    }

    broadcastEvent('ORDER_STATUS_UPDATE', updatedOrder);
    res.json({ success: true, order: updatedOrder, ingredients });
  });

  // Delete order and restore constituent items/ingredients to stock (POS / Admin)
  app.delete('/api/orders/:id', async (req, res) => {
    const { id } = req.params;
    const index = orders.findIndex(o => o.id === id);

    let orderToDelete: Order | undefined = undefined;

    if (index !== -1) {
      orderToDelete = orders[index];
      orders.splice(index, 1);
    } else {
      const dbOrders = await dbGetOrders();
      orderToDelete = dbOrders?.find(o => o.id === id);
    }

    if (!orderToDelete) {
      return res.status(404).json({ error: 'Pedido não encontrado.' });
    }

    // 1. Restore constituent items/ingredients to stock and persist in MySQL
    await restoreStockForOrder(orderToDelete.items || []);

    // 2. Delete from MySQL database
    await dbDeleteOrder(orderToDelete.id);

    // 3. Remove from sales records
    sales = sales.filter(s => s.orderId !== orderToDelete?.id);

    // 4. Update cash register session if active
    if (activeCashRegister && activeCashRegister.status === 'open') {
      syncCashRegisterOrders(activeCashRegister);
      broadcastEvent('CASH_REGISTER_UPDATE', activeCashRegister);
    }

    // 5. Broadcast deletion and updated stock to all dashboards
    broadcastEvent('ORDER_DELETED', { id: orderToDelete.id, code: orderToDelete.code });
    broadcastEvent('STOCKS_REFRESH', ingredients);

    res.json({ 
      success: true, 
      message: `Pedido #${orderToDelete.code} excluído com sucesso e todos os itens foram retornados ao estoque!`,
      ingredients
    });
  });

  // Get sales reports (Admin)
  app.get('/api/reports/sales', async (req, res) => {
    try {
      const { role, startDate, endDate, startHour, endHour, seller } = req.query;

      if (role !== 'admin') {
        return res.status(403).json({ error: 'Acesso negado.' });
      }

      try {
        const dbOrders = await dbGetOrders();
        if (dbOrders !== null) {
          orders = dbOrders;
        }
      } catch (dbErr) {
        console.warn('[Server] Notice getting orders from DB for report, using in-memory state:', dbErr);
      }

      // Helper to resolve clean seller name
      const getSellerName = (o: Order) => {
        let s = o.sellerName || o.createdBy;
        if (!s || s === 'Balcão / Caixa PDV') {
          s = o.isPosOrder ? 'Atendimento Balcão' : 'Loja Online';
        }
        return s;
      };

      // Extract all unique available sellers across ALL orders + registered system users
      const availableSellersSet = new Set<string>();
      (orders || []).forEach(o => {
        const sName = getSellerName(o);
        if (sName) availableSellersSet.add(sName);
      });
      (systemUsers || []).forEach(u => {
        const name = u.name || u.username;
        if (name) availableSellersSet.add(name);
      });
      const availableSellers = Array.from(availableSellersSet).sort();

      // Helper to safely extract YYYY-MM-DD from order createdAt timestamp in America/Sao_Paulo timezone
      const formatOrderDateStr = (rawDate: any): string => {
        if (!rawDate) return '';
        try {
          const d = new Date(rawDate);
          if (!isNaN(d.getTime())) {
            try {
              return d.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
            } catch (e) {
              const y = d.getFullYear();
              const m = String(d.getMonth() + 1).padStart(2, '0');
              const day = String(d.getDate()).padStart(2, '0');
              return `${y}-${m}-${day}`;
            }
          }
        } catch (e) {}
        if (typeof rawDate === 'string') {
          const clean = rawDate.split('T')[0].split(' ')[0];
          if (clean.length === 10 && clean.includes('-')) {
            return clean;
          }
        }
        return String(rawDate).substring(0, 10);
      };

      // Helper to convert time string ("00:00", "23:59", "08", "8h", etc.) to minute of day (0..1439)
      const parseTimeToMinutes = (val: string, isEnd: boolean): number | null => {
        if (!val) return null;
        const clean = val.trim().toLowerCase().replace('h', '');
        if (clean === '' || clean === 'all') return null;

        if (clean.includes(':')) {
          const [hStr, mStr] = clean.split(':');
          const h = parseInt(hStr, 10);
          let m = parseInt(mStr, 10);
          if (isNaN(h)) return null;
          if (isNaN(m)) m = isEnd ? 59 : 0;
          return Math.min(1439, Math.max(0, h * 60 + m));
        } else {
          const h = parseInt(clean, 10);
          if (isNaN(h)) return null;
          return Math.min(1439, Math.max(0, isEnd ? h * 60 + 59 : h * 60));
        }
      };

      // Helper to get order's local minute of day in Sao Paulo
      const getOrderMinuteOfDay = (rawDate: any): number | null => {
        if (!rawDate) return null;
        const d = new Date(rawDate);
        if (isNaN(d.getTime())) return null;

        try {
          const parts = new Intl.DateTimeFormat('pt-BR', {
            timeZone: 'America/Sao_Paulo',
            hour: 'numeric',
            minute: 'numeric',
            hour12: false
          }).formatToParts(d);

          let h = 0;
          let m = 0;
          for (const p of parts) {
            if (p.type === 'hour') h = parseInt(p.value, 10);
            if (p.type === 'minute') m = parseInt(p.value, 10);
          }
          if (h === 24) h = 0;
          return h * 60 + m;
        } catch (e) {
          return d.getHours() * 60 + d.getMinutes();
        }
      };

      // Filter orders by date range if provided
      let filteredOrders = orders || [];
      const startStr = typeof startDate === 'string' ? startDate : '';
      const endStr = typeof endDate === 'string' ? endDate : '';
      const startHourStr = typeof startHour === 'string' ? startHour : '';
      const endHourStr = typeof endHour === 'string' ? endHour : '';
      const sellerFilter = typeof seller === 'string' ? seller : '';

      if (startStr || endStr) {
        filteredOrders = filteredOrders.filter(o => {
          if (!o.createdAt) return false;
          const dStr = formatOrderDateStr(o.createdAt);
          if (startStr && dStr < startStr) return false;
          if (endStr && dStr > endStr) return false;
          return true;
        });
      }

      // Filter orders by hour range if provided
      const startMin = parseTimeToMinutes(startHourStr, false);
      const endMin = parseTimeToMinutes(endHourStr, true);

      if (startMin !== null || endMin !== null) {
        filteredOrders = filteredOrders.filter(o => {
          if (!o.createdAt) return false;
          const orderMin = getOrderMinuteOfDay(o.createdAt);
          if (orderMin === null) return false;
          if (startMin !== null && orderMin < startMin) return false;
          if (endMin !== null && orderMin > endMin) return false;
          return true;
        });
      }

      // Filter orders by seller if provided
      if (sellerFilter && sellerFilter !== 'all') {
        filteredOrders = filteredOrders.filter(o => getSellerName(o) === sellerFilter);
      }

      // Summary KPIs
      const totalRevenue = filteredOrders.reduce((sum, o) => sum + (Number(o.totalPrice) || 0), 0);
      const totalDeliveryFee = filteredOrders.reduce((sum, o) => sum + (Number(o.deliveryFee) || 0), 0);
      const totalOrdersCount = filteredOrders.length;
      const completedOrdersCount = filteredOrders.filter(o => o.status === 'entregue' || o.status === 'finalizado').length;

      // Daily revenue chart
      const dailyRevenue: { [key: string]: { amount: number; count: number } } = {};

      if (!startStr && !endStr) {
        // Default to last 7 days
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const dateString = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
          dailyRevenue[dateString] = { amount: 0, count: 0 };
        }
      }

      filteredOrders.forEach((o) => {
        if (!o.createdAt) return;
        const saleDate = new Date(o.createdAt);
        if (isNaN(saleDate.getTime())) return;
        const dateString = saleDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        if (!dailyRevenue[dateString]) {
          dailyRevenue[dateString] = { amount: 0, count: 0 };
        }
        dailyRevenue[dateString].amount += Number(o.totalPrice) || 0;
        dailyRevenue[dateString].count += 1;
      });

      const revenueChart = Object.keys(dailyRevenue).map(key => ({
        name: key,
        Faturamento: Number(dailyRevenue[key].amount.toFixed(2)),
        Pedidos: dailyRevenue[key].count
      }));

      // 1) Faturamento por Vendedor
      const sellerMap: {
        [sellerName: string]: {
          sellerName: string;
          totalRevenue: number;
          ordersCount: number;
          paymentMethods: { [method: string]: number };
        }
      } = {};

      filteredOrders.forEach(o => {
        const sName = getSellerName(o);
        if (!sellerMap[sName]) {
          sellerMap[sName] = {
            sellerName: sName,
            totalRevenue: 0,
            ordersCount: 0,
            paymentMethods: {}
          };
        }
        const sellerObj = sellerMap[sName];
        sellerObj.totalRevenue += Number(o.totalPrice) || 0;
        sellerObj.ordersCount += 1;

        if (o.paymentSplits && o.paymentSplits.length > 0) {
          o.paymentSplits.forEach(s => {
            const pm = (s.method || 'outro').toLowerCase();
            sellerObj.paymentMethods[pm] = (sellerObj.paymentMethods[pm] || 0) + Number(s.amount || 0);
          });
        } else {
          const pm = (o.paymentMethod || 'outro').toLowerCase();
          sellerObj.paymentMethods[pm] = (sellerObj.paymentMethods[pm] || 0) + Number(o.totalPrice || 0);
        }
      });

      const sellerBreakdown = Object.values(sellerMap).sort((a, b) => b.totalRevenue - a.totalRevenue);

      // 2) Low Stock Alert
      const lowStockIngredients = (ingredients || [])
        .filter(ing => (ing.trackStock !== false) && ing.stock <= (ing.minStock !== undefined ? ing.minStock : 5))
        .map(ing => ({
          id: ing.id,
          name: ing.name,
          stock: ing.stock,
          unit: ing.unit,
          minStock: ing.minStock || 5,
          category: ing.category
        }));

      // 3) Products and Ingredients Sold
      const soldProductsMap: { [key: string]: { name: string; category: string; quantity: number; totalRevenue: number } } = {};
      const ingredientCounts: { [key: string]: number } = {};

      // 5 & 6) Lanches vs Saladas
      let totalLanchesCount = 0;
      let totalLanchesRevenue = 0;
      let totalSaladasCount = 0;
      let totalSaladasRevenue = 0;

      const lanchesMap: { [key: string]: { name: string; count: number; revenue: number } } = {};
      const saladasMap: { [key: string]: { name: string; count: number; revenue: number } } = {};

      // Fetch latest ready products to accurately cross-reference categories
      try {
        const dbProds = await dbGetReadyProducts();
        if (dbProds && dbProds.length > 0) {
          readyProducts = dbProds;
        }
      } catch (e) {
        // Fallback to in-memory readyProducts
      }

      filteredOrders.forEach((o) => {
        (o.items || []).forEach((item: any) => {
          const q = Math.max(1, Number(item.quantity) || 1);
          const price = (Number(item.price) || 0) * q;
          const sw = item.sandwich || item.sandwichConfig;

          let rawName = String(item.productName || item.name || '').trim();
          if (!rawName || rawName === 'null' || rawName === 'undefined') {
            if (sw) {
              rawName = sw.protein ? `BAGÔ ${sw.protein}` : 'Monte seu Bagô';
            } else {
              rawName = 'Produto';
            }
          }

          let itemName = rawName;
          let itemCat = 'outro';

          // Try matching against registered ready products
          const lowerRawName = rawName.toLowerCase();
          const matchedProd = (readyProducts || []).find(p => 
            (item.id && p.id === item.id) ||
            (p.name && p.name.trim().toLowerCase() === lowerRawName)
          );

          // Salada detection:
          const isSaladFromSw = Boolean(
            sw && (
              String(sw.bread || '').toLowerCase().includes('salada') ||
              String(sw.bread || '').toLowerCase().includes('sem pão') ||
              String(sw.bread || '').toLowerCase().includes('sem pao') ||
              String(sw.bread || '').toLowerCase().includes('tigela') ||
              String(sw.size || '').toLowerCase().includes('salada')
            )
          );
          const isSaladFromName = lowerRawName.includes('salada');
          const isSaladFromCategory = Boolean(
            matchedProd && (
              matchedProd.category === 'salad' ||
              String((matchedProd as any).subcategory || '').toLowerCase().includes('salada')
            )
          );

          if (isSaladFromSw || isSaladFromName || isSaladFromCategory) {
            itemCat = 'saladas';
            if (lowerRawName === 'produto' || lowerRawName === 'monte seu bagô' || lowerRawName === 'monte seu bago' || lowerRawName === 'salada' || lowerRawName.startsWith('monte seu bagô:')) {
              if (sw?.protein) {
                itemName = `Salada ${sw.protein}`;
              } else if (lowerRawName.includes(':')) {
                itemName = `Salada ${rawName.split(':')[1].trim()}`;
              }
            }
          } else {
            // Check Bebidas
            const isDrinkFromCategory = Boolean(
              matchedProd && (
                matchedProd.category === 'drink' ||
                (matchedProd as any).category === 'bebida' ||
                (matchedProd as any).category === 'vitamin' ||
                String((matchedProd as any).subcategory || '').toLowerCase().includes('bebida') ||
                String((matchedProd as any).subcategory || '').toLowerCase().includes('vitamina') ||
                String((matchedProd as any).subcategory || '').toLowerCase().includes('suco')
              )
            );
            const isDrinkFromName = /refrigerante|suco|água|agua|vitamina|coca|guaran|fanta|sprite|cerveja|chá|cha|café|cafe|red bull|monster|h2oh|matte|bebida|tônica|tonica|del valle|aquarius/i.test(lowerRawName);

            // Check Sobremesas
            const isDessertFromCategory = Boolean(
              matchedProd && (
                matchedProd.category === 'dessert' ||
                (matchedProd as any).category === 'sobremesa' ||
                String((matchedProd as any).subcategory || '').toLowerCase().includes('sobremesa') ||
                String((matchedProd as any).subcategory || '').toLowerCase().includes('doce')
              )
            );
            const isDessertFromName = /cookie|sobremesa|brownie|torta|pudim|bolo|chocolate|brigadeiro|açaí|acai|sorvete|mousse|alfajor|palha italiana/i.test(lowerRawName);

            // Check Acompanhamentos / Porções
            const isSideFromCategory = Boolean(
              matchedProd && (
                matchedProd.category === 'side' ||
                (matchedProd as any).category === 'porcao' ||
                (matchedProd as any).category === 'acompanhamento'
              )
            );
            const isSideFromName = /batata|rustica|rústica|anel|aneis|anéis|nugget|cebola|chips|porção|porcao|molho extra/i.test(lowerRawName);

            if ((isDrinkFromCategory || isDrinkFromName) && !sw) {
              itemCat = 'bebidas';
            } else if ((isDessertFromCategory || isDessertFromName) && !sw) {
              itemCat = 'sobremesas';
            } else if ((isSideFromCategory || isSideFromName) && !sw) {
              itemCat = 'acompanhamentos';
            } else {
              // Lanches / Subs / Sanduíches
              const isLancheFromSw = Boolean(sw);
              const isLancheFromCategory = Boolean(
                matchedProd && (
                  matchedProd.category === 'sandwich' ||
                  matchedProd.category === 'combo' ||
                  String((matchedProd as any).subcategory || '').toLowerCase().includes('lanche') ||
                  String((matchedProd as any).subcategory || '').toLowerCase().includes('sandu') ||
                  String((matchedProd as any).subcategory || '').toLowerCase().includes('sub')
                )
              );
              const isLancheFromName = /bagô|bago|sub|sandu|lanche|misto|burger|hambúrguer|hamburguer|wrap|tostex|panini|dog|bauru|croissant|combo|costela|frango|picanha|carne|queijo|teriyaki|calabresa|pernil|bife|parmesão|parmesao|italiano|integral|3 queijos|9 grãos|9 graos/i.test(lowerRawName);

              if (isLancheFromSw || isLancheFromCategory || isLancheFromName || (!isDrinkFromName && !isDessertFromName && !isSideFromName)) {
                itemCat = 'lanches';
                if ((lowerRawName === 'produto' || lowerRawName === 'monte seu bagô' || lowerRawName === 'monte seu bago' || lowerRawName === 'sub' || lowerRawName === 'sanduíche' || lowerRawName.startsWith('monte seu bagô:')) && sw?.protein) {
                  const sizeStr = sw.size ? ` (${sw.size})` : '';
                  itemName = `Sub ${sw.protein}${sizeStr}`;
                }
              }
            }
          }

          // Track ingredients
          if (sw) {
            const veggies = Array.isArray(sw.veggies) ? sw.veggies : [];
            const sauces = Array.isArray(sw.sauces) ? sw.sauces : [];
            const extras = Array.isArray(sw.extras) ? sw.extras : [];
            const drinksCookies = Array.isArray(sw.drinksAndCookies) ? sw.drinksAndCookies : [];

            [sw.bread, sw.protein, sw.cheese, ...veggies, ...sauces, ...extras, ...drinksCookies].forEach((ingName) => {
              if (ingName && ingName !== 'Sem Queijo' && !ingName.startsWith('Sem ')) {
                ingredientCounts[ingName] = (ingredientCounts[ingName] || 0) + q;
              }
            });
          } else {
            ingredientCounts[itemName] = (ingredientCounts[itemName] || 0) + q;
          }

          // Add to soldProductsMap
          if (!soldProductsMap[itemName]) {
            soldProductsMap[itemName] = { name: itemName, category: itemCat, quantity: 0, totalRevenue: 0 };
          }
          soldProductsMap[itemName].quantity += q;
          soldProductsMap[itemName].totalRevenue += price;

          // Categorize for Lanches vs Saladas
          if (itemCat === 'saladas') {
            totalSaladasCount += q;
            totalSaladasRevenue += price;
            if (!saladasMap[itemName]) {
              saladasMap[itemName] = { name: itemName, count: 0, revenue: 0 };
            }
            saladasMap[itemName].count += q;
            saladasMap[itemName].revenue += price;
          } else if (itemCat === 'lanches') {
            totalLanchesCount += q;
            totalLanchesRevenue += price;
            if (!lanchesMap[itemName]) {
              lanchesMap[itemName] = { name: itemName, count: 0, revenue: 0 };
            }
            lanchesMap[itemName].count += q;
            lanchesMap[itemName].revenue += price;
          }
        });
      });

      const allSoldProducts = Object.values(soldProductsMap).sort((a, b) => b.quantity - a.quantity || b.totalRevenue - a.totalRevenue);
      const topIngredients = Object.keys(ingredientCounts)
        .map(name => ({ name, count: ingredientCounts[name] }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      const topLanches = Object.values(lanchesMap)
        .sort((a, b) => b.count - a.count || b.revenue - a.revenue)
        .slice(0, 5);
      const topSaladas = Object.values(saladasMap)
        .sort((a, b) => b.count - a.count || b.revenue - a.revenue)
        .slice(0, 5);

      res.json({
        summary: {
          totalRevenue,
          totalDeliveryFee: Number(totalDeliveryFee.toFixed(2)),
          totalOrdersCount,
          completedOrdersCount,
          averageTicket: totalOrdersCount > 0 ? Number((totalRevenue / totalOrdersCount).toFixed(2)) : 0
        },
        revenueChart,
        sellerBreakdown,
        lowStockIngredients,
        allSoldProducts,
        topIngredients,
        availableSellers,
        sandwichAndSaladStats: {
          totalLanchesCount,
          totalLanchesRevenue,
          totalSaladasCount,
          totalSaladasRevenue,
          topLanches,
          topSaladas
        }
      });
    } catch (err) {
      console.error('Erro ao gerar relatório de vendas:', err);
      res.status(500).json({ error: 'Erro ao processar relatório de vendas: ' + (err as Error).message });
    }
  });

  // Serve static assets or mount Vite dev server
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // Support client-side routing fallback in production
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Bagô Fullstack Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
