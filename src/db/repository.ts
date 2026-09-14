import { query, getDbStatus } from './mysql';
import { Ingredient, Order, OrderStatus, ReadyProduct, CustomizerStep, CashRegisterSession, CashTransaction, User, PurchaseRecord, PurchaseInvoice, PurchaseInvoiceItem, DeliveryTableRow, CustomSandwich, CardMachine } from '../types';

/**
 * Safely converts datetime from MySQL (which is stored in Brasília time UTC-3) into a standard ISO-8601 string with Brasília offset
 */
export function parseSqlDatetimeToIso(val: any): string {
  if (!val) return new Date().toISOString();
  if (val instanceof Date) return isNaN(val.getTime()) ? new Date().toISOString() : val.toISOString();
  if (typeof val === 'string') {
    const s = val.trim();
    if (!s) return new Date().toISOString();
    if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(s)) {
      const iso = s.replace(' ', 'T') + '-03:00';
      const d = new Date(iso);
      if (!isNaN(d.getTime())) return d.toISOString();
    }
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  return new Date().toISOString();
}

// ==============================================================================
// INITIALIZE DATABASE TABLES & SEED DATA IF NEEDED
// ==============================================================================
export async function initDatabaseTables(): Promise<boolean> {
  const status = getDbStatus();
  if (!status.isConnected) {
    console.log('[MySQL Repository] Skipping auto-init: MySQL connection is not active.');
    return false;
  }

  try {
    // Check if ingredients table exists
    const tables: any = await query(`SHOW TABLES LIKE 'ingredients'`);
    if (tables && tables.length > 0) {
      console.log('[MySQL Repository] Tables verified in database:', status.config.database);
      try {
        await query(`ALTER TABLE ingredients MODIFY COLUMN category VARCHAR(50) NOT NULL DEFAULT 'extra'`);
      } catch (e) {
        console.warn('[MySQL Repository] Notice modifying ingredients category column:', e);
      }
      try {
        await query(`ALTER TABLE ingredients ADD COLUMN subcategory VARCHAR(100) DEFAULT NULL`);
      } catch (e) {
        // Column may already exist
      }
      try {
        await query(`ALTER TABLE ingredients ADD COLUMN purchase_price DECIMAL(10,2) DEFAULT 0.00`);
      } catch (e) {
        // Column may already exist
      }
      try {
        await query(`ALTER TABLE ingredients ADD COLUMN show_on_home TINYINT(1) NOT NULL DEFAULT 1`);
      } catch (e) {
        // Column may already exist
      }
      try {
        await query(`ALTER TABLE ingredients ADD COLUMN track_stock TINYINT(1) NOT NULL DEFAULT 1`);
      } catch (e) {
        // Column may already exist
      }
      try {
        await query(`ALTER TABLE ready_products ADD COLUMN subcategory VARCHAR(100) DEFAULT NULL`);
      } catch (e) {
        // Column may already exist
      }
      try {
        await query(`ALTER TABLE ready_products ADD COLUMN show_on_home TINYINT(1) NOT NULL DEFAULT 1`);
      } catch (e) {
        // Column may already exist
      }
      try {
        await query(`ALTER TABLE ready_products ADD COLUMN is_combo TINYINT(1) NOT NULL DEFAULT 0`);
      } catch (e) {
        // Column may already exist
      }
      try {
        await query(`ALTER TABLE ready_products ADD COLUMN combo_items_json JSON DEFAULT NULL`);
      } catch (e) {
        // Column may already exist
      }
      try {
        await query(`ALTER TABLE ready_products ADD COLUMN show_in_combo_section TINYINT(1) NOT NULL DEFAULT 0`);
      } catch (e) {
        // Column may already exist
      }
      try {
        await query(`ALTER TABLE ready_products ADD COLUMN skip_ingredients TINYINT(1) NOT NULL DEFAULT 0`);
      } catch (e) {
        // Column may already exist
      }
      try {
        await query(`ALTER TABLE ready_products MODIFY COLUMN display_section VARCHAR(50) NOT NULL DEFAULT 'cardapio'`);
      } catch (e) {
        // Column may already be varchar
      }
      try {
        await query(`ALTER TABLE orders MODIFY COLUMN code VARCHAR(50) NOT NULL`);
      } catch (e) {
        // Column may already exist
      }
      try {
        await query(`ALTER TABLE orders ADD COLUMN delivery_fee DECIMAL(10,2) DEFAULT 0.00`);
      } catch (e) {
        // Column may already exist
      }
      try {
        await query(`ALTER TABLE orders ADD COLUMN delivery_distance_km DECIMAL(10,2) DEFAULT 0.00`);
      } catch (e) {
        // Column may already exist
      }
      try {
        await query(`ALTER TABLE orders ADD COLUMN coupon_code VARCHAR(50) DEFAULT NULL`);
      } catch (e) {
        // Column may already exist
      }
      try {
        await query(`ALTER TABLE orders ADD COLUMN discount_amount DECIMAL(10,2) DEFAULT 0.00`);
      } catch (e) {
        // Column may already exist
      }
      try {
        await query(`
          CREATE TABLE IF NOT EXISTS purchase_history (
            id VARCHAR(50) PRIMARY KEY,
            ingredient_id VARCHAR(50) NOT NULL,
            ingredient_name VARCHAR(100) DEFAULT NULL,
            purchase_date VARCHAR(20) NOT NULL,
            quantity DECIMAL(10,2) NOT NULL,
            unit VARCHAR(20) DEFAULT 'unidades',
            unit_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            total_cost DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            expiration_date VARCHAR(20) DEFAULT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX (ingredient_id)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
      } catch (e) {
        console.warn('[MySQL Repository] Notice creating purchase_history table:', e);
      }
      try {
        await query(`
          CREATE TABLE IF NOT EXISTS purchase_invoices (
            id VARCHAR(50) PRIMARY KEY,
            invoice_number VARCHAR(100) NOT NULL,
            supplier VARCHAR(100) DEFAULT NULL,
            purchase_date VARCHAR(20) NOT NULL,
            total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            items_json LONGTEXT DEFAULT NULL,
            notes TEXT DEFAULT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX (purchase_date)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
      } catch (e) {
        console.warn('[MySQL Repository] Notice creating purchase_invoices table:', e);
      }
      try {
        await ensureCashRegisterSessionsTable();
      } catch (e) {
        console.warn('[MySQL Repository] Notice creating/migrating cash_register_sessions table:', e);
      }
      try {
        await ensureStoreSettingsTable();
      } catch (e) {
        console.warn('[MySQL Repository] Notice creating store_settings table:', e);
      }
      try {
        await ensureDefaultUsersInDb();
      } catch (e) {
        console.warn('[MySQL Repository] Notice ensuring default users:', e);
      }
      try {
        await ensureCouponsTable();
      } catch (e) {
        console.warn('[MySQL Repository] Notice creating coupons table:', e);
      }
      try {
        await ensureCustomersTable();
      } catch (e) {
        console.warn('[MySQL Repository] Notice creating customers table:', e);
      }
      try {
        await ensureDeliveriesTable();
      } catch (e) {
        console.warn('[MySQL Repository] Notice creating deliveries table:', e);
      }
      try {
        await ensureCardMachinesTable();
      } catch (e) {
        console.warn('[MySQL Repository] Notice creating card_machines table:', e);
      }
      return true;
    }

    console.log('[MySQL Repository] Initializing table schemas in MySQL...');
    
    await query(`
      CREATE TABLE IF NOT EXISTS ingredients (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        category VARCHAR(50) NOT NULL DEFAULT 'extra',
        subcategory VARCHAR(100) DEFAULT NULL,
        purchase_price DECIMAL(10,2) DEFAULT 0.00,
        stock DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        min_stock DECIMAL(10,2) NOT NULL DEFAULT 10.00,
        unit VARCHAR(20) NOT NULL DEFAULT 'unidades',
        price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        image VARCHAR(500) DEFAULT NULL,
        track_stock TINYINT(1) NOT NULL DEFAULT 1,
        is_active TINYINT(1) NOT NULL DEFAULT 1
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS orders (
        id VARCHAR(50) PRIMARY KEY,
        code VARCHAR(20) NOT NULL UNIQUE,
        customer_name VARCHAR(100) NOT NULL,
        customer_phone VARCHAR(30) DEFAULT NULL,
        total_price DECIMAL(10,2) NOT NULL,
        status ENUM('pendente', 'preparo', 'finalizado', 'entregue', 'cancelado') NOT NULL DEFAULT 'pendente',
        estimated_minutes INT NOT NULL DEFAULT 15,
        delivery_type ENUM('retirada', 'entrega') NOT NULL DEFAULT 'retirada',
        delivery_address TEXT DEFAULT NULL,
        delivery_fee DECIMAL(10,2) DEFAULT 0.00,
        delivery_distance_km DECIMAL(10,2) DEFAULT 0.00,
        customer_type ENUM('cliente', 'funcionario') NOT NULL DEFAULT 'cliente',
        payment_method ENUM('debito', 'credito', 'pix', 'dinheiro') DEFAULT NULL,
        cash_received DECIMAL(10,2) DEFAULT NULL,
        change_amount DECIMAL(10,2) DEFAULT NULL,
        need_change TINYINT(1) DEFAULT 0,
        change_for_amount DECIMAL(10,2) DEFAULT NULL,
        print_receipt TINYINT(1) DEFAULT 0,
        is_pos_order TINYINT(1) DEFAULT 0,
        table_number VARCHAR(20) DEFAULT NULL,
        card_provider VARCHAR(50) DEFAULT NULL,
        machine_model VARCHAR(50) DEFAULT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id VARCHAR(50) PRIMARY KEY,
        order_id VARCHAR(50) NOT NULL,
        product_name VARCHAR(150) DEFAULT NULL,
        is_ready_product TINYINT(1) NOT NULL DEFAULT 0,
        price DECIMAL(10,2) NOT NULL,
        quantity INT NOT NULL DEFAULT 1,
        sandwich_details_json JSON DEFAULT NULL,
        INDEX (order_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ready_products (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT DEFAULT NULL,
        price DECIMAL(10,2) NOT NULL,
        original_price DECIMAL(10,2) DEFAULT NULL,
        is_popular TINYINT(1) NOT NULL DEFAULT 0,
        is_promo TINYINT(1) NOT NULL DEFAULT 0,
        badge_text VARCHAR(50) DEFAULT NULL,
        image VARCHAR(500) DEFAULT NULL,
        category VARCHAR(50) NOT NULL DEFAULT 'sandwich',
        subcategory VARCHAR(100) DEFAULT NULL,
        display_section VARCHAR(50) NOT NULL DEFAULT 'cardapio',
        linked_ingredient_id VARCHAR(50) DEFAULT NULL,
        sandwich_config_json JSON DEFAULT NULL,
        show_on_home TINYINT(1) NOT NULL DEFAULT 1,
        is_combo TINYINT(1) NOT NULL DEFAULT 0,
        combo_items_json JSON DEFAULT NULL,
        show_in_combo_section TINYINT(1) NOT NULL DEFAULT 0,
        skip_ingredients TINYINT(1) NOT NULL DEFAULT 0
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(50) PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        name VARCHAR(100) NOT NULL,
        role ENUM('admin', 'cozinha', 'balcao') NOT NULL DEFAULT 'balcao',
        password_hash VARCHAR(255) DEFAULT NULL,
        logo_url TEXT DEFAULT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    try {
      await query(`ALTER TABLE users ADD COLUMN logo_url TEXT DEFAULT NULL`);
    } catch (e) {
      // Column may already exist
    }

    await query(`
      CREATE TABLE IF NOT EXISTS purchase_history (
        id VARCHAR(50) PRIMARY KEY,
        ingredient_id VARCHAR(50) NOT NULL,
        ingredient_name VARCHAR(100) DEFAULT NULL,
        purchase_date VARCHAR(20) NOT NULL,
        quantity DECIMAL(10,2) NOT NULL,
        unit VARCHAR(20) DEFAULT 'unidades',
        unit_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        total_cost DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        expiration_date VARCHAR(20) DEFAULT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX (ingredient_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS purchase_invoices (
        id VARCHAR(50) PRIMARY KEY,
        invoice_number VARCHAR(100) NOT NULL,
        supplier VARCHAR(100) DEFAULT NULL,
        purchase_date VARCHAR(20) NOT NULL,
        total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        items_json LONGTEXT DEFAULT NULL,
        notes TEXT DEFAULT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX (purchase_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log('[MySQL Repository] Database tables successfully created!');
    await ensureDefaultUsersInDb();
    await ensureCouponsTable();
    return true;
  } catch (err) {
    console.warn('[MySQL Repository] Table auto-creation notice:', err);
    return false;
  }
}

// ==============================================================================
// INGREDIENTS REPOSITORY
// ==============================================================================
export async function dbGetIngredients(): Promise<Ingredient[] | null> {
  try {
    const rows: any[] = await query(`
      SELECT id, name, category, subcategory, purchase_price as purchasePrice, stock, min_stock as minStock, unit, price, image, show_on_home as showOnHome, track_stock as trackStock 
      FROM ingredients 
      WHERE is_active = 1
    `);
    if (!rows) return null;
    return rows.map(r => ({
      id: r.id,
      name: r.name,
      category: r.category,
      subcategory: r.subcategory || undefined,
      purchasePrice: r.purchasePrice ? Number(r.purchasePrice) : undefined,
      stock: Number(r.stock),
      minStock: Number(r.minStock),
      unit: r.unit,
      price: Number(r.price),
      image: r.image || '',
      showOnHome: r.showOnHome !== undefined && r.showOnHome !== null ? Boolean(r.showOnHome) : true,
      trackStock: r.trackStock !== undefined && r.trackStock !== null ? Boolean(r.trackStock) : true
    }));
  } catch (err) {
    // Fallback if subcategory/purchase_price/track_stock columns don't exist yet on older schema
    try {
      const rows: any[] = await query(`
        SELECT id, name, category, stock, min_stock as minStock, unit, price, image, show_on_home as showOnHome 
        FROM ingredients 
        WHERE is_active = 1
      `);
      if (!rows) return null;
      return rows.map(r => ({
        id: r.id,
        name: r.name,
        category: r.category,
        stock: Number(r.stock),
        minStock: Number(r.minStock),
        unit: r.unit,
        price: Number(r.price),
        image: r.image || '',
        showOnHome: r.showOnHome !== undefined && r.showOnHome !== null ? Boolean(r.showOnHome) : true,
        trackStock: true
      }));
    } catch {
      return null;
    }
  }
}

export async function dbSaveIngredient(ing: Ingredient): Promise<boolean> {
  const showOnHomeVal = ing.showOnHome !== false ? 1 : 0;
  const trackStockVal = ing.trackStock !== false ? 1 : 0;
  try {
    await query(`
      INSERT INTO ingredients (id, name, category, subcategory, purchase_price, stock, min_stock, unit, price, image, show_on_home, track_stock)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        category = VALUES(category),
        subcategory = VALUES(subcategory),
        purchase_price = VALUES(purchase_price),
        stock = VALUES(stock),
        min_stock = VALUES(min_stock),
        unit = VALUES(unit),
        price = VALUES(price),
        image = VALUES(image),
        show_on_home = VALUES(show_on_home),
        track_stock = VALUES(track_stock)
    `, [ing.id, ing.name, ing.category, ing.subcategory || null, ing.purchasePrice || 0, ing.stock, ing.minStock, ing.unit, ing.price, ing.image || '', showOnHomeVal, trackStockVal]);
    return true;
  } catch (err) {
    // Fallback without track_stock
    try {
      await query(`
        INSERT INTO ingredients (id, name, category, subcategory, purchase_price, stock, min_stock, unit, price, image, show_on_home)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          name = VALUES(name),
          category = VALUES(category),
          subcategory = VALUES(subcategory),
          purchase_price = VALUES(purchase_price),
          stock = VALUES(stock),
          min_stock = VALUES(min_stock),
          unit = VALUES(unit),
          price = VALUES(price),
          image = VALUES(image),
          show_on_home = VALUES(show_on_home)
      `, [ing.id, ing.name, ing.category, ing.subcategory || null, ing.purchasePrice || 0, ing.stock, ing.minStock, ing.unit, ing.price, ing.image || '', showOnHomeVal]);
      return true;
    } catch (err2) {
      // Fallback without subcategory & purchase_price
      try {
        await query(`
          INSERT INTO ingredients (id, name, category, stock, min_stock, unit, price, image, show_on_home)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            name = VALUES(name),
            category = VALUES(category),
            stock = VALUES(stock),
            min_stock = VALUES(min_stock),
            unit = VALUES(unit),
            price = VALUES(price),
            image = VALUES(image),
            show_on_home = VALUES(show_on_home)
        `, [ing.id, ing.name, ing.category, ing.stock, ing.minStock, ing.unit, ing.price, ing.image || '', showOnHomeVal]);
        return true;
      } catch (e) {
        console.warn('[MySQL] Error saving ingredient:', e);
        return false;
      }
    }
  }
}

export async function dbUpdateStock(id: string, newStock: number, name?: string): Promise<boolean> {
  try {
    const cleanId = String(id || '').trim();
    const cleanName = String(name || '').trim();
    
    // 1. Try direct ID update
    if (cleanId) {
      const resById: any = await query(`UPDATE ingredients SET stock = ? WHERE id = ?`, [newStock, cleanId]);
      if (resById && resById.affectedRows > 0) {
        console.log(`[MySQL] Stock updated by ID "${cleanId}" -> ${newStock} (affectedRows: ${resById.affectedRows})`);
        return true;
      }
    }

    // 2. Try by exact name (case-insensitive)
    if (cleanName) {
      const resByName: any = await query(`UPDATE ingredients SET stock = ? WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))`, [newStock, cleanName]);
      if (resByName && resByName.affectedRows > 0) {
        console.log(`[MySQL] Stock updated by exact name "${cleanName}" -> ${newStock} (affectedRows: ${resByName.affectedRows})`);
        return true;
      }

      // 3. Try by substring / like matching
      const resByLike: any = await query(`UPDATE ingredients SET stock = ? WHERE LOWER(name) LIKE LOWER(CONCAT('%', ?, '%'))`, [newStock, cleanName]);
      if (resByLike && resByLike.affectedRows > 0) {
        console.log(`[MySQL] Stock updated by LIKE "${cleanName}" -> ${newStock} (affectedRows: ${resByLike.affectedRows})`);
        return true;
      }
    }

    console.warn(`[MySQL] Stock update query executed for ${cleanId} / "${cleanName}", but 0 rows affected.`);
    return true;
  } catch (err) {
    console.warn(`[MySQL] Error updating stock for ingredient ${id}:`, err);
    return false;
  }
}

export async function dbDeleteIngredient(id: string): Promise<boolean> {
  try {
    await query(`DELETE FROM ingredients WHERE id = ?`, [id]);
    return true;
  } catch (err) {
    return false;
  }
}

// ==============================================================================
// READY PRODUCTS REPOSITORY
// ==============================================================================
export async function dbGetReadyProducts(): Promise<ReadyProduct[] | null> {
  try {
    const rows: any[] = await query(`
      SELECT id, name, description, price, original_price as originalPrice, 
             is_popular as isPopular, is_promo as isPromo, badge_text as badgeText, 
             image, category, subcategory, display_section as displaySection, 
             linked_ingredient_id as linkedIngredientId, sandwich_config_json,
             show_on_home as showOnHome,
             is_combo as isCombo, combo_items_json as comboItemsJson,
             show_in_combo_section as showInComboSection,
             skip_ingredients as skipIngredients
      FROM ready_products
    `);
    if (!rows) return null;
    return rows.map(r => ({
      id: r.id,
      name: r.name,
      description: r.description || '',
      price: Number(r.price),
      originalPrice: r.originalPrice ? Number(r.originalPrice) : undefined,
      isPopular: Boolean(r.isPopular),
      isPromo: Boolean(r.isPromo),
      badgeText: r.badgeText || undefined,
      image: r.image || '',
      category: r.category || 'sandwich',
      subcategory: r.subcategory || undefined,
      displaySection: r.displaySection || 'cardapio',
      linkedIngredientId: r.linkedIngredientId || undefined,
      sandwichConfig: r.sandwich_config_json ? (typeof r.sandwich_config_json === 'string' ? JSON.parse(r.sandwich_config_json) : r.sandwich_config_json) : undefined,
      showOnHome: r.showOnHome !== undefined && r.showOnHome !== null ? Boolean(r.showOnHome) : true,
      isCombo: Boolean(r.isCombo),
      comboItems: r.comboItemsJson ? (typeof r.comboItemsJson === 'string' ? JSON.parse(r.comboItemsJson) : r.comboItemsJson) : [],
      showInComboSection: Boolean(r.showInComboSection),
      skipIngredients: r.skipIngredients !== undefined && r.skipIngredients !== null ? Boolean(r.skipIngredients) : (Boolean(r.isCombo))
    }));
  } catch (err) {
    // Fallback if combo columns don't exist yet on older schema
    try {
      const rows: any[] = await query(`
        SELECT id, name, description, price, original_price as originalPrice, 
               is_popular as isPopular, is_promo as isPromo, badge_text as badgeText, 
               image, category, subcategory, display_section as displaySection, 
               linked_ingredient_id as linkedIngredientId, sandwich_config_json,
               show_on_home as showOnHome
        FROM ready_products
      `);
      if (!rows) return null;
      return rows.map(r => ({
        id: r.id,
        name: r.name,
        description: r.description || '',
        price: Number(r.price),
        originalPrice: r.originalPrice ? Number(r.originalPrice) : undefined,
        isPopular: Boolean(r.isPopular),
        isPromo: Boolean(r.isPromo),
        badgeText: r.badgeText || undefined,
        image: r.image || '',
        category: r.category || 'sandwich',
        subcategory: r.subcategory || undefined,
        displaySection: r.displaySection || 'cardapio',
        linkedIngredientId: r.linkedIngredientId || undefined,
        sandwichConfig: r.sandwich_config_json ? (typeof r.sandwich_config_json === 'string' ? JSON.parse(r.sandwich_config_json) : r.sandwich_config_json) : undefined,
        showOnHome: r.showOnHome !== undefined && r.showOnHome !== null ? Boolean(r.showOnHome) : true
      }));
    } catch {
      return null;
    }
  }
}

export async function dbSaveReadyProduct(prod: ReadyProduct): Promise<boolean> {
  const showOnHomeVal = prod.showOnHome !== false ? 1 : 0;
  const isComboVal = prod.isCombo ? 1 : 0;
  const comboItemsVal = prod.comboItems && prod.comboItems.length > 0 ? JSON.stringify(prod.comboItems) : null;
  const showInComboSectionVal = prod.showInComboSection ? 1 : 0;
  const skipIngredientsVal = prod.skipIngredients !== undefined ? (prod.skipIngredients ? 1 : 0) : (prod.isCombo ? 1 : 0);

  try {
    await query(`
      INSERT INTO ready_products (
        id, name, description, price, original_price, is_popular, is_promo, badge_text, 
        image, category, subcategory, display_section, linked_ingredient_id, sandwich_config_json, 
        show_on_home, is_combo, combo_items_json, show_in_combo_section, skip_ingredients
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        description = VALUES(description),
        price = VALUES(price),
        original_price = VALUES(original_price),
        is_popular = VALUES(is_popular),
        is_promo = VALUES(is_promo),
        badge_text = VALUES(badge_text),
        image = VALUES(image),
        category = VALUES(category),
        subcategory = VALUES(subcategory),
        display_section = VALUES(display_section),
        linked_ingredient_id = VALUES(linked_ingredient_id),
        sandwich_config_json = VALUES(sandwich_config_json),
        show_on_home = VALUES(show_on_home),
        is_combo = VALUES(is_combo),
        combo_items_json = VALUES(combo_items_json),
        show_in_combo_section = VALUES(show_in_combo_section),
        skip_ingredients = VALUES(skip_ingredients)
    `, [
      prod.id,
      prod.name,
      prod.description || '',
      prod.price,
      prod.originalPrice || null,
      prod.isPopular ? 1 : 0,
      prod.isPromo ? 1 : 0,
      prod.badgeText || null,
      prod.image || '',
      prod.category || 'sandwich',
      prod.subcategory || null,
      prod.displaySection || 'cardapio',
      prod.linkedIngredientId || null,
      prod.sandwichConfig ? JSON.stringify(prod.sandwichConfig) : null,
      showOnHomeVal,
      isComboVal,
      comboItemsVal,
      showInComboSectionVal,
      skipIngredientsVal
    ]);
    return true;
  } catch (err) {
    // Fallback without combo columns
    try {
      await query(`
        INSERT INTO ready_products (id, name, description, price, original_price, is_popular, is_promo, badge_text, image, category, subcategory, display_section, linked_ingredient_id, sandwich_config_json, show_on_home)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          name = VALUES(name),
          description = VALUES(description),
          price = VALUES(price),
          original_price = VALUES(original_price),
          is_popular = VALUES(is_popular),
          is_promo = VALUES(is_promo),
          badge_text = VALUES(badge_text),
          image = VALUES(image),
          category = VALUES(category),
          subcategory = VALUES(subcategory),
          display_section = VALUES(display_section),
          linked_ingredient_id = VALUES(linked_ingredient_id),
          sandwich_config_json = VALUES(sandwich_config_json),
          show_on_home = VALUES(show_on_home)
      `, [
        prod.id,
        prod.name,
        prod.description || '',
        prod.price,
        prod.originalPrice || null,
        prod.isPopular ? 1 : 0,
        prod.isPromo ? 1 : 0,
        prod.badgeText || null,
        prod.image || '',
        prod.category || 'sandwich',
        prod.subcategory || null,
        prod.displaySection || 'cardapio',
        prod.linkedIngredientId || null,
        prod.sandwichConfig ? JSON.stringify(prod.sandwichConfig) : null,
        showOnHomeVal
      ]);
      return true;
    } catch (e) {
      console.error('[MySQL Repository] Failed to save ready product:', e);
      return false;
    }
  }
}

export async function dbDeleteReadyProduct(id: string): Promise<boolean> {
  try {
    await query(`DELETE FROM ready_products WHERE id = ?`, [id]);
    return true;
  } catch (err) {
    return false;
  }
}

// ==============================================================================
// ORDERS REPOSITORY
// ==============================================================================
export async function dbGetOrders(): Promise<Order[] | null> {
  try {
    const rows: any[] = await query(`
      SELECT * FROM orders ORDER BY created_at DESC
    `);
    if (!rows) return null;
    if (rows.length === 0) return [];

    // Batch load all order items in a single query instead of N+1 queries
    let allItems: any[] = [];
    try {
      allItems = await query(`SELECT * FROM order_items`);
    } catch (e) {
      console.warn('[MySQL] Error loading all order_items in batch:', e);
    }

    const itemsByOrderId = new Map<string, any[]>();
    for (const item of (allItems || [])) {
      const orderId = String(item.order_id);
      if (!itemsByOrderId.has(orderId)) {
        itemsByOrderId.set(orderId, []);
      }
      itemsByOrderId.get(orderId)!.push(item);
    }

    const ordersList: Order[] = rows.map(r => {
      const itemsRows = itemsByOrderId.get(String(r.id)) || [];
      const items = itemsRows.map(item => {
        let sw: any = undefined;
        if (item.sandwich_details_json) {
          try {
            sw = typeof item.sandwich_details_json === 'string' ? JSON.parse(item.sandwich_details_json) : item.sandwich_details_json;
          } catch (e) {}
        }
        let pName = item.product_name;
        if (!pName || pName === 'null' || pName.trim() === '') {
          if (sw) {
            pName = sw.protein ? `BAGÔ ${sw.protein}` : 'Monte seu Bagô';
          } else {
            pName = 'Item do Pedido';
          }
        }
        return {
          id: item.id,
          productName: pName,
          isReadyProduct: Boolean(item.is_ready_product),
          price: Number(item.price),
          quantity: Number(item.quantity),
          sandwich: sw
        };
      });

      return {
        id: r.id,
        code: r.code,
        customerName: r.customer_name,
        customerPhone: r.customer_phone || undefined,
        totalPrice: Number(r.total_price),
        status: r.status as OrderStatus,
        createdAt: parseSqlDatetimeToIso(r.created_at),
        updatedAt: parseSqlDatetimeToIso(r.updated_at),
        estimatedMinutes: Number(r.estimated_minutes || 15),
        deliveryType: r.delivery_type || 'retirada',
        deliveryAddress: r.delivery_address || undefined,
        deliveryFee: r.delivery_fee !== null && r.delivery_fee !== undefined ? Number(r.delivery_fee) : 0,
        deliveryDistanceKm: r.delivery_distance_km !== null && r.delivery_distance_km !== undefined ? Number(r.delivery_distance_km) : 0,
        customerType: r.customer_type || 'cliente',
        paymentMethod: r.payment_method || undefined,
        cashReceived: r.cash_received ? Number(r.cash_received) : undefined,
        changeAmount: r.change_amount ? Number(r.change_amount) : undefined,
        isPosOrder: Boolean(r.is_pos_order),
        tableNumber: r.table_number || undefined,
        cardProvider: r.card_provider || undefined,
        machineModel: r.machine_model || undefined,
        needChange: Boolean(r.need_change),
        changeForAmount: r.change_for_amount ? Number(r.change_for_amount) : undefined,
        printReceipt: Boolean(r.print_receipt),
        couponCode: r.coupon_code || undefined,
        discountAmount: r.discount_amount ? Number(r.discount_amount) : undefined,
        items
      };
    });

    return ordersList;
  } catch (err) {
    console.warn('[MySQL] Error in dbGetOrders:', err);
    return null;
  }
}

async function executeSaveOrder(order: Order): Promise<boolean> {
  await query(`
    INSERT INTO orders (
      id, code, customer_name, customer_phone, total_price, status, estimated_minutes, 
      delivery_type, delivery_address, delivery_fee, delivery_distance_km, customer_type, payment_method, cash_received, 
      change_amount, need_change, change_for_amount, print_receipt, is_pos_order, 
      table_number, card_provider, machine_model, coupon_code, discount_amount, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    ON DUPLICATE KEY UPDATE
      customer_name = VALUES(customer_name),
      customer_phone = VALUES(customer_phone),
      total_price = VALUES(total_price),
      status = VALUES(status),
      estimated_minutes = VALUES(estimated_minutes),
      delivery_type = VALUES(delivery_type),
      delivery_address = VALUES(delivery_address),
      delivery_fee = VALUES(delivery_fee),
      delivery_distance_km = VALUES(delivery_distance_km),
      customer_type = VALUES(customer_type),
      payment_method = VALUES(payment_method),
      cash_received = VALUES(cash_received),
      change_amount = VALUES(change_amount),
      need_change = VALUES(need_change),
      change_for_amount = VALUES(change_for_amount),
      print_receipt = VALUES(print_receipt),
      is_pos_order = VALUES(is_pos_order),
      table_number = VALUES(table_number),
      card_provider = VALUES(card_provider),
      machine_model = VALUES(machine_model),
      coupon_code = VALUES(coupon_code),
      discount_amount = VALUES(discount_amount),
      updated_at = NOW()
  `, [
    order.id,
    order.code,
    order.customerName,
    order.customerPhone || null,
    order.totalPrice,
    order.status,
    order.estimatedMinutes || 15,
    order.deliveryType || 'retirada',
    order.deliveryAddress || null,
    order.deliveryFee || 0,
    order.deliveryDistanceKm || 0,
    order.customerType || 'cliente',
    order.paymentMethod || null,
    order.cashReceived || null,
    order.changeAmount || null,
    order.needChange ? 1 : 0,
    order.changeForAmount || null,
    order.printReceipt ? 1 : 0,
    order.isPosOrder ? 1 : 0,
    order.tableNumber || null,
    order.cardProvider || null,
    order.machineModel || null,
    order.couponCode || null,
    order.discountAmount || 0
  ]);

  // Clean old items for this order to ensure fresh state
  await query(`DELETE FROM order_items WHERE order_id = ?`, [order.id]);

  // Insert order items in a single batch query
  if (order.items && order.items.length > 0) {
    const placeholders: string[] = [];
    const values: any[] = [];
    for (let idx = 0; idx < order.items.length; idx++) {
      const item = order.items[idx];
      let pName = item.productName || (item as any).name;
      const sw = item.sandwich || (item as any).sandwichConfig;
      if (!pName || pName === 'null' || pName.trim() === '') {
        if (sw) {
          pName = sw.protein ? `BAGÔ ${sw.protein}` : 'Monte seu Bagô';
        } else {
          pName = 'Item do Pedido';
        }
      }
      const itemId = `item-${order.id}-${idx}-${Math.random().toString(36).substr(2, 6)}`;
      const swJson = sw ? (typeof sw === 'string' ? sw : JSON.stringify(sw)) : null;
      placeholders.push('(?, ?, ?, ?, ?, ?, ?)');
      values.push(
        itemId,
        order.id,
        pName,
        item.isReadyProduct ? 1 : 0,
        Number(item.price) || 0,
        Number(item.quantity) || 1,
        swJson
      );
    }
    await query(`
      INSERT INTO order_items (id, order_id, product_name, is_ready_product, price, quantity, sandwich_details_json)
      VALUES ${placeholders.join(', ')}
    `, values);
  }

  // Keep entregas_detalhadas table in sync in background (non-blocking for fast sales response)
  syncOrderToDeliveriesTable(order).catch(err => {
    console.warn('[MySQL] Notice during background sync to entregas_detalhadas:', err);
  });

  return true;
}

export async function dbSaveOrder(order: Order): Promise<boolean> {
  try {
    return await executeSaveOrder(order);
  } catch (err) {
    console.warn('[MySQL] Error saving order, attempting table init & retry...', err);
    try {
      await initDatabaseTables();
      return await executeSaveOrder(order);
    } catch (retryErr) {
      console.error('[MySQL] Retry error saving order:', retryErr);
      return false;
    }
  }
}

export async function dbUpdateOrderStatus(orderId: string, status: OrderStatus, estimatedMinutes?: number): Promise<boolean> {
  try {
    await query(`
      UPDATE orders 
      SET status = ?, estimated_minutes = COALESCE(?, estimated_minutes), updated_at = NOW() 
      WHERE id = ?
    `, [status, estimatedMinutes || null, orderId]);
    
    try {
      await query(`UPDATE entregas_detalhadas SET status_pedido = ? WHERE order_id = ?`, [status, orderId]);
    } catch (e) {}

    return true;
  } catch (err) {
    return false;
  }
}

export async function dbUpdateOrder(order: Order): Promise<boolean> {
  try {
    await query(`
      UPDATE orders
      SET customer_name = ?,
          customer_phone = ?,
          total_price = ?,
          status = ?,
          estimated_minutes = ?,
          delivery_type = ?,
          delivery_address = ?,
          delivery_fee = ?,
          delivery_distance_km = ?,
          customer_type = ?,
          payment_method = ?,
          cash_received = ?,
          change_amount = ?,
          need_change = ?,
          change_for_amount = ?,
          print_receipt = ?,
          is_pos_order = ?,
          table_number = ?,
          card_provider = ?,
          machine_model = ?,
          updated_at = NOW()
      WHERE id = ?
    `, [
      order.customerName,
      order.customerPhone || null,
      order.totalPrice,
      order.status,
      order.estimatedMinutes || 15,
      order.deliveryType || 'retirada',
      order.deliveryAddress || null,
      order.deliveryFee || 0,
      order.deliveryDistanceKm || 0,
      order.customerType || 'cliente',
      order.paymentMethod || null,
      order.cashReceived || null,
      order.changeAmount || null,
      order.needChange ? 1 : 0,
      order.changeForAmount || null,
      order.printReceipt ? 1 : 0,
      order.isPosOrder ? 1 : 0,
      order.tableNumber || null,
      order.cardProvider || null,
      order.machineModel || null,
      order.id
    ]);

    // Replace items
    await query(`DELETE FROM order_items WHERE order_id = ?`, [order.id]);
    if (order.items && order.items.length > 0) {
      for (let idx = 0; idx < order.items.length; idx++) {
        const item = order.items[idx];
        let pName = item.productName || (item as any).name;
        const sw = item.sandwich || (item as any).sandwichConfig;
        if (!pName || pName === 'null' || pName.trim() === '') {
          if (sw) {
            pName = sw.protein ? `BAGÔ ${sw.protein}` : 'Monte seu Bagô';
          } else {
            pName = 'Item do Pedido';
          }
        }
        const itemId = `item-${order.id}-${idx}-${Math.random().toString(36).substr(2, 6)}`;
        const swJson = sw ? (typeof sw === 'string' ? sw : JSON.stringify(sw)) : null;
        await query(`
          INSERT INTO order_items (id, order_id, product_name, is_ready_product, price, quantity, sandwich_details_json)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          itemId,
          order.id,
          pName,
          item.isReadyProduct ? 1 : 0,
          Number(item.price) || 0,
          Number(item.quantity) || 1,
          swJson
        ]);
      }
    }

    // Keep entregas_detalhadas in sync
    await syncOrderToDeliveriesTable(order);

    return true;
  } catch (err) {
    console.warn('[MySQL] Error updating order:', err);
    return false;
  }
}

export async function dbDeleteOrder(orderId: string): Promise<boolean> {
  try {
    try {
      await query(`DELETE FROM entregas_detalhadas WHERE order_id = ?`, [orderId]);
    } catch (e) {}
    await query(`DELETE FROM order_items WHERE order_id = ?`, [orderId]);
    await query(`DELETE FROM orders WHERE id = ?`, [orderId]);
    return true;
  } catch (err) {
    console.error('[MySQL] Error deleting order:', err);
    return false;
  }
}

// ==============================================================================
// UNIQUE ORDER CODE GENERATION (8-DIGIT UNIQUE CODE EX: BG-34567890)
// ==============================================================================
export async function dbGenerateUniqueOrderCode(): Promise<string> {
  const status = getDbStatus();

  // Try generating a random 8-digit code (10000000 to 99999999)
  for (let attempt = 0; attempt < 50; attempt++) {
    const randNum = Math.floor(10000000 + Math.random() * 90000000);
    const candidate = `BG-${randNum}`;

    if (status.isConnected) {
      try {
        const rows: any = await query(`SELECT id FROM orders WHERE code = ? LIMIT 1`, [candidate]);
        if (rows && rows.length > 0) {
          continue; // Duplicate found in DB, retry
        }
        return candidate;
      } catch (e) {
        // Query error fallback
      }
    }
    return candidate;
  }

  // Absolute fallback using timestamp-based 8 digits to ensure uniqueness
  const fallbackNum = (Date.now() % 90000000) + 10000000;
  return `BG-${fallbackNum}`;
}

// ==============================================================================
// DELIVERIES & DETAILED ORDER ITEMS TABLE (entregas_detalhadas)
// ==============================================================================
export function formatSandwichIngredientDetails(sw?: any, isReady?: boolean, description?: string): string {
  if (!sw) {
    return description || 'Produto sem customização';
  }
  const parts: string[] = [];
  if (sw.size) parts.push(`Tamanho: ${sw.size}`);
  if (sw.bread && !String(sw.bread).toLowerCase().includes('sem pão') && !String(sw.bread).toLowerCase().includes('sem pao')) {
    parts.push(`Pão: ${sw.bread}`);
  }
  if (sw.protein && !String(sw.protein).toLowerCase().includes('sem prote') && !String(sw.protein).toLowerCase().includes('nenhuma')) {
    parts.push(`Proteína: ${sw.protein}`);
  }
  if (sw.cheese && !String(sw.cheese).toLowerCase().includes('sem queijo') && !String(sw.cheese).toLowerCase().includes('nenhum')) {
    parts.push(`Queijo: ${sw.cheese}`);
  }
  if (sw.toasted !== undefined) {
    parts.push(sw.toasted ? 'Tostado' : 'Frio');
  }
  if (Array.isArray(sw.veggies) && sw.veggies.length > 0) {
    const vList = sw.veggies.filter((v: string) => !String(v).toLowerCase().includes('sem salada') && !String(v).toLowerCase().includes('nenhuma')).join(', ');
    if (vList) parts.push(`Saladas: ${vList}`);
  }
  if (Array.isArray(sw.sauces) && sw.sauces.length > 0) {
    const sList = sw.sauces.filter((s: string) => !String(s).toLowerCase().includes('sem molho') && !String(s).toLowerCase().includes('nenhum')).join(', ');
    if (sList) parts.push(`Molhos: ${sList}`);
  }
  if (Array.isArray(sw.extras) && sw.extras.length > 0) {
    parts.push(`Adicionais: ${sw.extras.join(', ')}`);
  }
  if (Array.isArray(sw.drinksAndCookies) && sw.drinksAndCookies.length > 0) {
    parts.push(`Bebidas/Sobremesas: ${sw.drinksAndCookies.join(', ')}`);
  }
  return parts.join(' | ') || (description || 'Sanduíche Customizado');
}

export async function ensureDeliveriesTable(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS entregas_detalhadas (
      id VARCHAR(80) PRIMARY KEY,
      order_id VARCHAR(50) NOT NULL,
      codigo_pedido VARCHAR(50) NOT NULL,
      telefone VARCHAR(50) DEFAULT NULL,
      cliente VARCHAR(150) NOT NULL,
      comanda VARCHAR(50) DEFAULT NULL,
      produto VARCHAR(255) NOT NULL,
      quantidade INT NOT NULL DEFAULT 1,
      preco_unitario DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      subtotal DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      detalhes_ingredientes TEXT DEFAULT NULL,
      tipo_entrega VARCHAR(50) NOT NULL DEFAULT 'entrega',
      endereco_entrega TEXT DEFAULT NULL,
      taxa_entrega DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      forma_pagamento VARCHAR(50) DEFAULT NULL,
      status_pedido VARCHAR(50) NOT NULL DEFAULT 'pendente',
      data_hora DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX (codigo_pedido),
      INDEX (order_id),
      INDEX (data_hora),
      INDEX (tipo_entrega)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Backfill existing orders if entregas_detalhadas is empty
  try {
    const countRes: any[] = await query(`SELECT COUNT(*) as count FROM entregas_detalhadas`);
    const count = countRes && countRes[0] ? Number(countRes[0].count) : 0;
    if (count === 0) {
      console.log('[MySQL Repository] Sincronizando tabela de entregas_detalhadas a partir de pedidos existentes...');
      const orders = await dbGetOrders();
      if (orders && orders.length > 0) {
        for (const ord of orders) {
          await syncOrderToDeliveriesTable(ord);
        }
        console.log(`[MySQL Repository] ${orders.length} pedidos sincronizados com sucesso na tabela entregas_detalhadas!`);
      }
    }
  } catch (e) {
    console.warn('[MySQL Repository] Notice on deliveries table initial sync:', e);
  }
}

export async function syncOrderToDeliveriesTable(order: Order): Promise<void> {
  try {
    if (!order || !order.id) return;
    if (!order.items || order.items.length === 0) {
      await query(`DELETE FROM entregas_detalhadas WHERE order_id = ?`, [order.id]);
      return;
    }

    // First delete existing items for this order to avoid stale rows if items were removed
    try {
      await query(`DELETE FROM entregas_detalhadas WHERE order_id = ?`, [order.id]);
    } catch (delErr) {
      // Continue even if delete had warning
    }

    const placeholders: string[] = [];
    const values: any[] = [];

    for (let idx = 0; idx < order.items.length; idx++) {
      const item = order.items[idx];
      let pName = item.productName || (item as any).name || 'Produto';
      const sw = item.sandwich || (item as any).sandwichConfig;
      if (!pName || pName === 'null' || pName.trim() === '') {
        if (sw) {
          pName = sw.protein ? `BAGÔ ${sw.protein}` : 'Monte seu Bagô';
        } else {
          pName = 'Item do Pedido';
        }
      }
      const rowId = `ent-${order.id}-${idx}`;
      const comanda = order.tableNumber || (order.isPosOrder ? 'Balcão' : (order.deliveryType === 'entrega' ? 'Delivery' : 'Retirada'));
      const q = Number(item.quantity) || 1;
      const unitPrice = Number(item.price) || 0;
      const subtotal = q * unitPrice;
      const details = formatSandwichIngredientDetails(sw, item.isReadyProduct);

      let orderDate = order.createdAt ? new Date(order.createdAt) : new Date();
      if (isNaN(orderDate.getTime())) orderDate = new Date();

      placeholders.push('(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())');
      values.push(
        rowId,
        order.id,
        order.code,
        order.customerPhone || null,
        order.customerName,
        comanda,
        pName,
        q,
        unitPrice,
        subtotal,
        details,
        order.deliveryType || 'retirada',
        order.deliveryAddress || null,
        order.deliveryFee || 0,
        order.paymentMethod || null,
        order.status,
        orderDate
      );
    }

    if (placeholders.length > 0) {
      await query(`
        REPLACE INTO entregas_detalhadas (
          id, order_id, codigo_pedido, telefone, cliente, comanda,
          produto, quantidade, preco_unitario, subtotal, detalhes_ingredientes,
          tipo_entrega, endereco_entrega, taxa_entrega, forma_pagamento,
          status_pedido, data_hora, created_at
        ) VALUES ${placeholders.join(', ')}
      `, values);
    }
  } catch (err) {
    console.warn('[MySQL] Error syncing order to entregas_detalhadas:', err);
  }
}

export async function dbGetDeliveriesTable(filters?: {
  search?: string;
  startDate?: string;
  endDate?: string;
  deliveryType?: string;
  status?: string;
}): Promise<DeliveryTableRow[]> {
  try {
    let sql = `SELECT * FROM entregas_detalhadas WHERE 1=1`;
    const params: any[] = [];

    if (filters?.search && filters.search.trim()) {
      const s = `%${filters.search.trim()}%`;
      sql += ` AND (codigo_pedido LIKE ? OR cliente LIKE ? OR telefone LIKE ? OR comanda LIKE ? OR produto LIKE ? OR detalhes_ingredientes LIKE ?)`;
      params.push(s, s, s, s, s, s);
    }

    if (filters?.startDate) {
      sql += ` AND data_hora >= ?`;
      params.push(`${filters.startDate} 00:00:00`);
    }

    if (filters?.endDate) {
      sql += ` AND data_hora <= ?`;
      params.push(`${filters.endDate} 23:59:59`);
    }

    if (filters?.deliveryType && filters.deliveryType !== 'all' && filters.deliveryType !== 'todos') {
      sql += ` AND tipo_entrega = ?`;
      params.push(filters.deliveryType);
    }

    if (filters?.status && filters.status !== 'all' && filters.status !== 'todos') {
      sql += ` AND status_pedido = ?`;
      params.push(filters.status);
    }

    sql += ` ORDER BY data_hora DESC`;

    const rows: any[] = await query(sql, params);
    if (!rows) return [];

    return rows.map(r => ({
      id: r.id,
      order_id: r.order_id,
      codigo_pedido: r.codigo_pedido,
      telefone: r.telefone || undefined,
      cliente: r.cliente,
      comanda: r.comanda || undefined,
      produto: r.produto,
      quantidade: Number(r.quantidade),
      preco_unitario: Number(r.preco_unitario),
      subtotal: Number(r.subtotal),
      detalhes_ingredientes: r.detalhes_ingredientes || undefined,
      tipo_entrega: r.tipo_entrega || undefined,
      endereco_entrega: r.endereco_entrega || undefined,
      taxa_entrega: r.taxa_entrega ? Number(r.taxa_entrega) : 0,
      forma_pagamento: r.forma_pagamento || undefined,
      status_pedido: r.status_pedido || undefined,
      data_hora: r.data_hora ? parseSqlDatetimeToIso(r.data_hora) : undefined,
      created_at: r.created_at ? parseSqlDatetimeToIso(r.created_at) : undefined
    }));
  } catch (err) {
    console.warn('[MySQL] Error in dbGetDeliveriesTable:', err);
    return [];
  }
}

// ==============================================================================
// USER & AUTHENTICATION REPOSITORY
// ==============================================================================
export async function ensureDefaultUsersInDb(): Promise<void> {
  try {
    try {
      await query(`ALTER TABLE users ADD COLUMN logo_url TEXT DEFAULT NULL`);
    } catch {
      // Column may already exist
    }

    const existingUsers: any[] = await query(`SELECT COUNT(*) as count FROM users`);
    const count = existingUsers && existingUsers[0] ? Number(existingUsers[0].count) : 0;
    
    if (count === 0) {
      console.log('[MySQL Repository] Seeding default initial users into database...');
      const defaultUsers = [
        { id: 'usr-admin', username: 'admin', name: 'Administrador Bagô', role: 'admin', password_hash: 'bagoadmin' },
        { id: 'usr-cozinha', username: 'cozinha', name: 'Equipe da Cozinha', role: 'cozinha', password_hash: 'bagocozinha' },
        { id: 'usr-balcao', username: 'balcao', name: 'Atendimento Balcão', role: 'balcao', password_hash: 'bagobalcao' },
        { id: 'usr-emp1', username: 'joao.silva', name: 'João Silva', role: 'balcao', password_hash: '123456' },
        { id: 'usr-emp2', username: 'maria.souza', name: 'Maria Souza', role: 'balcao', password_hash: '123456' },
        { id: 'usr-emp3', username: 'carlos.oliveira', name: 'Carlos Oliveira', role: 'balcao', password_hash: '123456' }
      ];

      for (const u of defaultUsers) {
        await query(`
          INSERT INTO users (id, username, name, role, password_hash)
          VALUES (?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE username=username
        `, [u.id, u.username, u.name, u.role, u.password_hash]);
      }
    }
  } catch (err) {
    console.warn('[MySQL Repository] Notice seeding default users:', err);
  }
}

export async function dbGetUsers(): Promise<User[] | null> {
  try {
    const rows: any[] = await query(`
      SELECT id, username, name, role, logo_url as logoUrl 
      FROM users 
      ORDER BY name ASC
    `);
    if (!rows) return null;
    return rows.map(r => ({
      id: r.id,
      username: r.username,
      name: r.name,
      role: r.role,
      logoUrl: r.logoUrl || undefined
    }));
  } catch (err) {
    try {
      const rows: any[] = await query(`
        SELECT id, username, name, role 
        FROM users 
        ORDER BY name ASC
      `);
      if (!rows) return null;
      return rows.map(r => ({
        id: r.id,
        username: r.username,
        name: r.name,
        role: r.role
      }));
    } catch {
      return null;
    }
  }
}

export async function dbSaveUser(usr: { id?: string; username: string; name: string; role: string; password?: string; logoUrl?: string }): Promise<{ success: boolean; user?: User; error?: string }> {
  const userId = usr.id || `usr-${Date.now()}`;
  const logoVal = usr.logoUrl || null;

  try {
    await query(`ALTER TABLE users ADD COLUMN logo_url TEXT DEFAULT NULL`);
  } catch {
    // Ignore if column already exists
  }

  const saveAction = async (includeLogo: boolean) => {
    if (includeLogo) {
      if (usr.password && usr.password.trim() !== '') {
        await query(`
          INSERT INTO users (id, username, name, role, logo_url, password_hash)
          VALUES (?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            username = VALUES(username),
            name = VALUES(name),
            role = VALUES(role),
            logo_url = VALUES(logo_url),
            password_hash = VALUES(password_hash)
        `, [userId, usr.username, usr.name, usr.role, logoVal, usr.password]);
      } else {
        await query(`
          INSERT INTO users (id, username, name, role, logo_url)
          VALUES (?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            username = VALUES(username),
            name = VALUES(name),
            role = VALUES(role),
            logo_url = VALUES(logo_url)
        `, [userId, usr.username, usr.name, usr.role, logoVal]);
      }
    } else {
      if (usr.password && usr.password.trim() !== '') {
        await query(`
          INSERT INTO users (id, username, name, role, password_hash)
          VALUES (?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            username = VALUES(username),
            name = VALUES(name),
            role = VALUES(role),
            password_hash = VALUES(password_hash)
        `, [userId, usr.username, usr.name, usr.role, usr.password]);
      } else {
        await query(`
          INSERT INTO users (id, username, name, role)
          VALUES (?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            username = VALUES(username),
            name = VALUES(name),
            role = VALUES(role)
        `, [userId, usr.username, usr.name, usr.role]);
      }
    }
  };

  try {
    try {
      await saveAction(true);
    } catch (err: any) {
      if (err?.message?.includes('logo_url') || err?.code === 'ER_BAD_FIELD_ERROR') {
        console.warn('[MySQL] logo_url column missing, trying fallback without logo_url...');
        await saveAction(false);
      } else {
        throw err;
      }
    }

    return {
      success: true,
      user: {
        id: userId,
        username: usr.username,
        name: usr.name,
        role: usr.role as any,
        logoUrl: usr.logoUrl || undefined
      }
    };
  } catch (err: any) {
    console.warn('[MySQL] Error saving user:', err);
    if (err?.code === 'ER_DUP_ENTRY') {
      return { success: false, error: 'O nome de usuário já está em uso.' };
    }
    return { success: false, error: err?.message || 'Erro ao salvar usuário no banco.' };
  }
}

export async function dbDeleteUser(userId: string): Promise<boolean> {
  try {
    await query(`DELETE FROM users WHERE id = ?`, [userId]);
    return true;
  } catch (err) {
    console.warn('[MySQL] Error deleting user:', err);
    return false;
  }
}

export async function dbAuthenticateUser(username: string, pass: string): Promise<any | null> {
  try {
    let rows: any[] = [];
    try {
      rows = await query(`
        SELECT id, username, name, role, logo_url as logoUrl, password_hash 
        FROM users 
        WHERE username = ?
      `, [username]);
    } catch {
      rows = await query(`
        SELECT id, username, name, role, password_hash 
        FROM users 
        WHERE username = ?
      `, [username]);
    }

    if (rows && rows.length > 0) {
      const u = rows[0];
      // Compare password hash strictly from database
      if (u.password_hash === pass) {
        return {
          id: u.id,
          username: u.username,
          name: u.name,
          role: u.role,
          logoUrl: u.logoUrl || undefined
        };
      }
    }
    return null;
  } catch (err) {
    return null;
  }
}

// ==============================================================================
// PURCHASE / RESTOCK HISTORY REPOSITORY
// ==============================================================================
export async function ensurePurchaseHistoryTable(): Promise<void> {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS purchase_history (
        id VARCHAR(50) PRIMARY KEY,
        ingredient_id VARCHAR(50) NOT NULL,
        ingredient_name VARCHAR(100) DEFAULT NULL,
        purchase_date VARCHAR(20) NOT NULL,
        quantity DECIMAL(10,2) NOT NULL,
        unit VARCHAR(20) DEFAULT 'unidades',
        unit_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        total_cost DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        expiration_date VARCHAR(20) DEFAULT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX (ingredient_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  } catch (e) {
    // Ignore if table creation warning
  }
}

export async function dbSavePurchaseRecord(record: PurchaseRecord): Promise<boolean> {
  try {
    await query(`
      INSERT INTO purchase_history (
        id, ingredient_id, ingredient_name, purchase_date, quantity, unit, unit_price, total_cost, expiration_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      record.id,
      record.ingredientId,
      record.ingredientName || null,
      record.date,
      record.quantity,
      record.unit || 'unidades',
      record.unitPrice,
      record.totalCost,
      record.expirationDate || null
    ]);
    return true;
  } catch (err) {
    console.warn('[MySQL] Error saving purchase record, attempting to create table and retry...', err);
    await ensurePurchaseHistoryTable();
    try {
      await query(`
        INSERT INTO purchase_history (
          id, ingredient_id, ingredient_name, purchase_date, quantity, unit, unit_price, total_cost, expiration_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        record.id,
        record.ingredientId,
        record.ingredientName || null,
        record.date,
        record.quantity,
        record.unit || 'unidades',
        record.unitPrice,
        record.totalCost,
        record.expirationDate || null
      ]);
      return true;
    } catch (retryErr) {
      console.error('[MySQL] Retry error saving purchase record:', retryErr);
      return false;
    }
  }
}

export async function dbGetPurchaseHistory(ingredientId?: string): Promise<PurchaseRecord[] | null> {
  try {
    let sql = `
      SELECT 
        id, 
        ingredient_id as ingredientId, 
        ingredient_name as ingredientName, 
        purchase_date as date, 
        quantity, 
        unit, 
        unit_price as unitPrice, 
        total_cost as totalCost, 
        expiration_date as expirationDate, 
        created_at as createdAt
      FROM purchase_history
    `;
    const params: any[] = [];
    if (ingredientId) {
      sql += ` WHERE ingredient_id = ?`;
      params.push(ingredientId);
    }
    sql += ` ORDER BY created_at DESC, purchase_date DESC`;

    let rows: any[] = await query(sql, params);
    if (!rows) return null;
    return rows.map(r => ({
      id: r.id,
      ingredientId: r.ingredientId,
      ingredientName: r.ingredientName || undefined,
      date: r.date,
      quantity: Number(r.quantity),
      unit: r.unit,
      unitPrice: Number(r.unitPrice),
      totalCost: Number(r.totalCost),
      expirationDate: r.expirationDate || undefined,
      createdAt: r.createdAt
    }));
  } catch (err) {
    console.warn('[MySQL] Error fetching purchase history, attempting to create table and retry...', err);
    await ensurePurchaseHistoryTable();
    try {
      let sql = `
        SELECT 
          id, 
          ingredient_id as ingredientId, 
          ingredient_name as ingredientName, 
          purchase_date as date, 
          quantity, 
          unit, 
          unit_price as unitPrice, 
          total_cost as totalCost, 
          expiration_date as expirationDate, 
          created_at as createdAt
        FROM purchase_history
      `;
      const params: any[] = [];
      if (ingredientId) {
        sql += ` WHERE ingredient_id = ?`;
        params.push(ingredientId);
      }
      sql += ` ORDER BY created_at DESC, purchase_date DESC`;

      const rows: any[] = await query(sql, params);
      if (!rows) return null;
      return rows.map(r => ({
        id: r.id,
        ingredientId: r.ingredientId,
        ingredientName: r.ingredientName || undefined,
        date: r.date,
        quantity: Number(r.quantity),
        unit: r.unit,
        unitPrice: Number(r.unitPrice),
        totalCost: Number(r.totalCost),
        expirationDate: r.expirationDate || undefined,
        createdAt: r.createdAt
      }));
    } catch (retryErr) {
      console.error('[MySQL] Retry error fetching purchase history:', retryErr);
      return null;
    }
  }
}

// ==============================================================================
// PURCHASE INVOICES (NOTAS FISCAIS / COMPRAS EM LOTE) REPOSITORY
// ==============================================================================
export async function ensurePurchaseInvoicesTable(): Promise<void> {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS purchase_invoices (
        id VARCHAR(50) PRIMARY KEY,
        invoice_number VARCHAR(100) NOT NULL,
        supplier VARCHAR(100) DEFAULT NULL,
        purchase_date VARCHAR(20) NOT NULL,
        total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        items_json LONGTEXT DEFAULT NULL,
        notes TEXT DEFAULT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX (purchase_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  } catch (e) {
    // Ignore warning
  }
}

export async function dbSavePurchaseInvoice(invoice: PurchaseInvoice): Promise<boolean> {
  try {
    await query(`
      INSERT INTO purchase_invoices (
        id, invoice_number, supplier, purchase_date, total_amount, items_json, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      invoice.id,
      invoice.invoiceNumber,
      invoice.supplier || null,
      invoice.purchaseDate,
      invoice.totalAmount,
      JSON.stringify(invoice.items || []),
      invoice.notes || null
    ]);
    return true;
  } catch (err) {
    console.warn('[MySQL] Error saving purchase invoice, attempting to create table and retry...', err);
    await ensurePurchaseInvoicesTable();
    try {
      await query(`
        INSERT INTO purchase_invoices (
          id, invoice_number, supplier, purchase_date, total_amount, items_json, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        invoice.id,
        invoice.invoiceNumber,
        invoice.supplier || null,
        invoice.purchaseDate,
        invoice.totalAmount,
        JSON.stringify(invoice.items || []),
        invoice.notes || null
      ]);
      return true;
    } catch (retryErr) {
      console.error('[MySQL] Retry error saving purchase invoice:', retryErr);
      return false;
    }
  }
}

export async function dbGetPurchaseInvoices(): Promise<PurchaseInvoice[] | null> {
  try {
    const sql = `
      SELECT 
        id, 
        invoice_number as invoiceNumber, 
        supplier, 
        purchase_date as purchaseDate, 
        total_amount as totalAmount, 
        items_json as itemsJson, 
        notes, 
        created_at as createdAt
      FROM purchase_invoices
      ORDER BY created_at DESC, purchase_date DESC
    `;

    const rows: any[] = await query(sql, []);
    if (!rows) return null;
    return rows.map(r => {
      let parsedItems: PurchaseInvoiceItem[] = [];
      try {
        if (r.itemsJson) {
          parsedItems = typeof r.itemsJson === 'string' ? JSON.parse(r.itemsJson) : r.itemsJson;
        }
      } catch (e) {
        parsedItems = [];
      }

      return {
        id: r.id,
        invoiceNumber: r.invoiceNumber,
        supplier: r.supplier || undefined,
        purchaseDate: r.purchaseDate,
        totalAmount: Number(r.totalAmount || 0),
        items: parsedItems,
        notes: r.notes || undefined,
        createdAt: r.createdAt
      };
    });
  } catch (err) {
    console.warn('[MySQL] Error fetching purchase invoices, attempting to create table and retry...', err);
    await ensurePurchaseInvoicesTable();
    try {
      const sql = `
        SELECT 
          id, 
          invoice_number as invoiceNumber, 
          supplier, 
          purchase_date as purchaseDate, 
          total_amount as totalAmount, 
          items_json as itemsJson, 
          notes, 
          created_at as createdAt
        FROM purchase_invoices
        ORDER BY created_at DESC, purchase_date DESC
      `;

      const rows: any[] = await query(sql, []);
      if (!rows) return null;
      return rows.map(r => {
        let parsedItems: PurchaseInvoiceItem[] = [];
        try {
          if (r.itemsJson) {
            parsedItems = typeof r.itemsJson === 'string' ? JSON.parse(r.itemsJson) : r.itemsJson;
          }
        } catch (e) {
          parsedItems = [];
        }

        return {
          id: r.id,
          invoiceNumber: r.invoiceNumber,
          supplier: r.supplier || undefined,
          purchaseDate: r.purchaseDate,
          totalAmount: Number(r.totalAmount || 0),
          items: parsedItems,
          notes: r.notes || undefined,
          createdAt: r.createdAt
        };
      });
    } catch (retryErr) {
      console.error('[MySQL] Retry error fetching purchase invoices:', retryErr);
      return null;
    }
  }
}

export async function dbDeletePurchaseInvoice(id: string): Promise<boolean> {
  try {
    await query(`DELETE FROM purchase_invoices WHERE id = ?`, [id]);
    return true;
  } catch (err) {
    console.error('[MySQL] Error deleting purchase invoice:', err);
    return false;
  }
}

// ==============================================================================
// CASH REGISTER REPOSITORY
// ==============================================================================
export async function ensureCashRegisterSessionsTable(): Promise<void> {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS cash_register_sessions (
        id VARCHAR(50) PRIMARY KEY,
        opened_at VARCHAR(50) NOT NULL,
        opened_by VARCHAR(100) NOT NULL,
        closed_at VARCHAR(50) DEFAULT NULL,
        closed_by VARCHAR(100) DEFAULT NULL,
        initial_cash DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        expected_cash DECIMAL(10,2) DEFAULT NULL,
        actual_cash DECIMAL(10,2) DEFAULT NULL,
        cash_difference DECIMAL(10,2) DEFAULT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'open',
        notes TEXT DEFAULT NULL,
        transactions_json LONGTEXT DEFAULT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX (status),
        INDEX (opened_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  } catch (e) {
    // Ignore warning
  }

  // Ensure missing columns exist for pre-existing tables
  const cols = [
    { name: 'expected_cash', type: 'DECIMAL(10,2) DEFAULT NULL' },
    { name: 'actual_cash', type: 'DECIMAL(10,2) DEFAULT NULL' },
    { name: 'cash_difference', type: 'DECIMAL(10,2) DEFAULT NULL' },
    { name: 'notes', type: 'TEXT DEFAULT NULL' },
    { name: 'transactions_json', type: 'LONGTEXT DEFAULT NULL' },
    { name: 'created_at', type: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP' }
  ];

  for (const col of cols) {
    try {
      await query(`ALTER TABLE cash_register_sessions ADD COLUMN ${col.name} ${col.type}`);
    } catch (e) {
      // Column likely already exists
    }
  }
}

export async function dbSaveCashSession(session: CashRegisterSession): Promise<boolean> {
  const doSave = async () => {
    const txJson = JSON.stringify(session.transactions || []);
    await query(`
      INSERT INTO cash_register_sessions (
        id, opened_at, opened_by, closed_at, closed_by, initial_cash,
        expected_cash, actual_cash, cash_difference, status, notes, transactions_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        closed_at = VALUES(closed_at),
        closed_by = VALUES(closed_by),
        expected_cash = VALUES(expected_cash),
        actual_cash = VALUES(actual_cash),
        cash_difference = VALUES(cash_difference),
        status = VALUES(status),
        notes = VALUES(notes),
        transactions_json = VALUES(transactions_json)
    `, [
      session.id,
      session.openedAt,
      session.openedBy,
      session.closedAt || null,
      session.closedBy || null,
      session.initialCash,
      session.expectedCashInDrawer ?? null,
      session.actualCashInDrawer ?? null,
      session.cashDifference ?? null,
      session.status,
      session.notes || null,
      txJson
    ]);
  };

  try {
    await doSave();
    return true;
  } catch (err) {
    console.warn('[MySQL] Error saving cash register session, attempting to create/migrate table and retry...', err);
    await ensureCashRegisterSessionsTable();
    try {
      await doSave();
      return true;
    } catch (retryErr) {
      console.error('[MySQL] Retry error saving cash register session:', retryErr);
      return false;
    }
  }
}

export async function dbGetCashSessions(): Promise<CashRegisterSession[] | null> {
  const fetchRows = async () => {
    const rows: any[] = await query(`
      SELECT 
        id,
        opened_at as openedAt,
        opened_by as openedBy,
        closed_at as closedAt,
        closed_by as closedBy,
        initial_cash as initialCash,
        expected_cash as expectedCashInDrawer,
        actual_cash as actualCashInDrawer,
        cash_difference as cashDifference,
        status,
        notes,
        transactions_json as transactionsJson
      FROM cash_register_sessions
      ORDER BY opened_at DESC
    `, []);

    if (!rows) return null;

    return rows.map(r => {
      let txs = [];
      try {
        if (r.transactionsJson) {
          txs = typeof r.transactionsJson === 'string' ? JSON.parse(r.transactionsJson) : r.transactionsJson;
        }
      } catch (e) {
        txs = [];
      }

      return {
        id: r.id,
        openedAt: r.openedAt,
        openedBy: r.openedBy,
        closedAt: r.closedAt || undefined,
        closedBy: r.closedBy || undefined,
        initialCash: Number(r.initialCash || 0),
        expectedCashInDrawer: r.expectedCashInDrawer !== null ? Number(r.expectedCashInDrawer) : undefined,
        actualCashInDrawer: r.actualCashInDrawer !== null ? Number(r.actualCashInDrawer) : undefined,
        cashDifference: r.cashDifference !== null ? Number(r.cashDifference) : undefined,
        status: r.status as 'open' | 'closed',
        notes: r.notes || undefined,
        transactions: txs
      };
    });
  };

  try {
    return await fetchRows();
  } catch (err) {
    console.warn('[MySQL] Error getting cash register sessions, attempting table migration and retry...', err);
    await ensureCashRegisterSessionsTable();
    try {
      return await fetchRows();
    } catch (retryErr) {
      console.error('[MySQL] Retry error getting cash register sessions:', retryErr);
      return null;
    }
  }
}

// ==============================================================================
// STORE SETTINGS TABLE & REPOSITORY
// ==============================================================================
export async function ensureStoreSettingsTable(): Promise<void> {
  const status = getDbStatus();
  if (!status.isConnected) return;
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS store_settings (
        setting_key VARCHAR(100) PRIMARY KEY,
        setting_value LONGTEXT NOT NULL,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  } catch (e) {
    console.warn('[MySQL Repository] Notice creating store_settings table:', e);
  }
}

export async function dbGetStoreSettings(key = 'delivery_settings'): Promise<any | null> {
  const status = getDbStatus();
  if (!status.isConnected) return null;
  try {
    await ensureStoreSettingsTable();
    const rows: any = await query(`SELECT setting_value FROM store_settings WHERE setting_key = ?`, [key]);
    if (rows && rows.length > 0 && rows[0].setting_value) {
      return typeof rows[0].setting_value === 'string' ? JSON.parse(rows[0].setting_value) : rows[0].setting_value;
    }
    return null;
  } catch (err) {
    console.error('[MySQL Repository] Error getting store setting:', err);
    return null;
  }
}

export async function dbSaveStoreSettings(value: any, key = 'delivery_settings'): Promise<boolean> {
  const status = getDbStatus();
  if (!status.isConnected) return false;
  try {
    await ensureStoreSettingsTable();
    const jsonStr = JSON.stringify(value);
    await query(`
      INSERT INTO store_settings (setting_key, setting_value)
      VALUES (?, ?)
      ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = CURRENT_TIMESTAMP
    `, [key, jsonStr]);
    return true;
  } catch (err) {
    console.error('[MySQL Repository] Error saving store setting:', err);
    return false;
  }
}

// ==============================================================================
// Coupons DB Table & Repository Functions
// ==============================================================================
export async function ensureCouponsTable(): Promise<void> {
  const status = getDbStatus();
  if (!status.isConnected) return;
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS coupons (
        id VARCHAR(100) PRIMARY KEY,
        code VARCHAR(50) NOT NULL UNIQUE,
        type VARCHAR(20) NOT NULL DEFAULT 'fixed',
        value DECIMAL(10,2) NOT NULL,
        min_order_value DECIMAL(10,2) DEFAULT 0,
        max_uses INT DEFAULT NULL,
        used_count INT DEFAULT 0,
        active TINYINT(1) DEFAULT 1,
        description VARCHAR(255) DEFAULT '',
        created_by VARCHAR(100) DEFAULT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    try {
      await query(`ALTER TABLE coupons ADD COLUMN created_by VARCHAR(100) DEFAULT NULL`);
    } catch (e) {
      // Column may already exist
    }
  } catch (e) {
    console.warn('[MySQL Repository] Notice creating coupons table:', e);
  }
}

export async function dbGetCoupons(): Promise<any[]> {
  const status = getDbStatus();
  if (!status.isConnected) return [];
  try {
    await ensureCouponsTable();
    const rows: any = await query(`SELECT * FROM coupons ORDER BY created_at DESC`);
    if (Array.isArray(rows)) {
      return rows.map((r: any) => ({
        id: String(r.id),
        code: String(r.code).toUpperCase(),
        type: r.type === 'percentage' ? 'percentage' : 'fixed',
        value: Number(r.value) || 0,
        minOrderValue: Number(r.min_order_value) || 0,
        maxUses: r.max_uses !== null && r.max_uses !== undefined ? Number(r.max_uses) : undefined,
        usedCount: Number(r.used_count) || 0,
        active: Boolean(r.active),
        description: r.description || '',
        createdBy: r.created_by || '',
        createdAt: parseSqlDatetimeToIso(r.created_at)
      }));
    }
    return [];
  } catch (err) {
    console.error('[MySQL Repository] Error getting coupons:', err);
    return [];
  }
}

export async function dbSaveCoupon(coupon: any): Promise<boolean> {
  const status = getDbStatus();
  if (!status.isConnected) return false;
  try {
    await ensureCouponsTable();
    await query(`
      INSERT INTO coupons (id, code, type, value, min_order_value, max_uses, used_count, active, description, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        code = VALUES(code),
        type = VALUES(type),
        value = VALUES(value),
        min_order_value = VALUES(min_order_value),
        max_uses = VALUES(max_uses),
        used_count = VALUES(used_count),
        active = VALUES(active),
        description = VALUES(description),
        created_by = COALESCE(VALUES(created_by), created_by)
    `, [
      coupon.id,
      String(coupon.code).trim().toUpperCase(),
      coupon.type || 'fixed',
      coupon.value || 0,
      coupon.minOrderValue || 0,
      coupon.maxUses !== undefined && coupon.maxUses !== null ? coupon.maxUses : null,
      coupon.usedCount || 0,
      coupon.active ? 1 : 0,
      coupon.description || '',
      coupon.createdBy || null
    ]);
    return true;
  } catch (err) {
    console.error('[MySQL Repository] Error saving coupon:', err);
    return false;
  }
}

export async function dbDeleteCoupon(id: string): Promise<boolean> {
  const status = getDbStatus();
  if (!status.isConnected) return false;
  try {
    await ensureCouponsTable();
    await query(`DELETE FROM coupons WHERE id = ? OR UPPER(code) = UPPER(?)`, [id, id]);
    return true;
  } catch (err) {
    console.error('[MySQL Repository] Error deleting coupon:', err);
    return false;
  }
}

export async function dbIncrementCouponUsage(code: string): Promise<boolean> {
  const status = getDbStatus();
  if (!status.isConnected) return false;
  try {
    await ensureCouponsTable();
    await query(`UPDATE coupons SET used_count = used_count + 1 WHERE UPPER(code) = UPPER(?)`, [code.trim()]);
    return true;
  } catch (err) {
    console.error('[MySQL Repository] Error incrementing coupon usage:', err);
    return false;
  }
}

// ==============================================================================
// Store Info DB Table & Functions
// ==============================================================================

export async function ensureStoreInfoTable(): Promise<void> {
  const status = getDbStatus();
  if (!status.isConnected) return;
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS store_info (
        id VARCHAR(50) PRIMARY KEY DEFAULT 'default',
        city VARCHAR(255) DEFAULT '',
        phone VARCHAR(100) DEFAULT '',
        instagram VARCHAR(255) DEFAULT '',
        address TEXT,
        opening_hours TEXT,
        payment_methods TEXT,
        opening_time VARCHAR(100) DEFAULT '',
        show_on_home_page TINYINT(1) DEFAULT 1,
        latitude VARCHAR(100) DEFAULT '',
        longitude VARCHAR(100) DEFAULT '',
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    // Ensure columns exist if table was previously created without them
    try { await query(`ALTER TABLE store_info ADD COLUMN latitude VARCHAR(100) DEFAULT ''`); } catch (_) {}
    try { await query(`ALTER TABLE store_info ADD COLUMN longitude VARCHAR(100) DEFAULT ''`); } catch (_) {}
  } catch (e) {
    console.warn('[MySQL Repository] Notice creating store_info table:', e);
  }
}

export async function dbGetStoreInfo(): Promise<any | null> {
  const status = getDbStatus();
  if (!status.isConnected) return null;
  try {
    await ensureStoreInfoTable();
    const rows: any = await query(`SELECT * FROM store_info WHERE id = 'default' LIMIT 1`);
    if (rows && rows.length > 0) {
      const r = rows[0];
      return {
        city: r.city || '',
        phone: r.phone || '',
        instagram: r.instagram || '',
        address: r.address || '',
        openingHours: r.opening_hours || '',
        paymentMethods: r.payment_methods || '',
        openingTime: r.opening_time || '',
        showOnHomePage: Boolean(r.show_on_home_page),
        latitude: r.latitude || '',
        longitude: r.longitude || ''
      };
    }
    return null;
  } catch (err) {
    console.error('[MySQL Repository] Error getting store_info:', err);
    return null;
  }
}

export async function dbSaveStoreInfo(info: any): Promise<boolean> {
  const status = getDbStatus();
  if (!status.isConnected) return false;
  try {
    await ensureStoreInfoTable();
    await query(`
      INSERT INTO store_info (id, city, phone, instagram, address, opening_hours, payment_methods, opening_time, show_on_home_page, latitude, longitude)
      VALUES ('default', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        city = VALUES(city),
        phone = VALUES(phone),
        instagram = VALUES(instagram),
        address = VALUES(address),
        opening_hours = VALUES(opening_hours),
        payment_methods = VALUES(payment_methods),
        opening_time = VALUES(opening_time),
        show_on_home_page = VALUES(show_on_home_page),
        latitude = VALUES(latitude),
        longitude = VALUES(longitude),
        updated_at = CURRENT_TIMESTAMP
    `, [
      info.city || '',
      info.phone || '',
      info.instagram || '',
      info.address || '',
      info.openingHours || '',
      info.paymentMethods || '',
      info.openingTime || '',
      info.showOnHomePage ? 1 : 0,
      info.latitude || '',
      info.longitude || ''
    ]);
    return true;
  } catch (err) {
    console.error('[MySQL Repository] Error saving store_info:', err);
    return false;
  }
}

// ==============================================================================
// CUSTOMER REPOSITORY (Lookup & Save by Phone)
// ==============================================================================
export async function ensureCustomersTable(): Promise<void> {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS customers (
        id VARCHAR(50) PRIMARY KEY,
        phone VARCHAR(50) NOT NULL UNIQUE,
        name VARCHAR(100) NOT NULL,
        street VARCHAR(150) DEFAULT NULL,
        number VARCHAR(30) DEFAULT NULL,
        neighborhood VARCHAR(100) DEFAULT NULL,
        city VARCHAR(100) DEFAULT NULL,
        state VARCHAR(20) DEFAULT NULL,
        complement VARCHAR(100) DEFAULT NULL,
        reference VARCHAR(250) DEFAULT NULL,
        lat DECIMAL(10,7) DEFAULT NULL,
        lng DECIMAL(10,7) DEFAULT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_phone (phone)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  } catch (e) {
    console.warn('[MySQL Repository] Notice creating customers table:', e);
  }
}

export async function dbGetCustomerByPhone(phone: string): Promise<any | null> {
  if (!phone || !phone.trim()) return null;
  const raw = phone.trim();
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 6) return null;

  try {
    await ensureCustomersTable();
    const rows: any[] = await query(`
      SELECT * FROM customers 
      WHERE phone = ? 
         OR REPLACE(REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '(', ''), ')', '') = ?
      ORDER BY updated_at DESC LIMIT 1
    `, [raw, digits]);

    if (rows && rows.length > 0) {
      const c = rows[0];
      return {
        id: c.id,
        phone: c.phone,
        name: c.name,
        street: c.street || '',
        number: c.number || '',
        neighborhood: c.neighborhood || '',
        city: c.city || '',
        state: c.state || '',
        complement: c.complement || '',
        reference: c.reference || '',
        lat: c.lat ? Number(c.lat) : undefined,
        lng: c.lng ? Number(c.lng) : undefined
      };
    }
    return null;
  } catch (err) {
    console.error('[MySQL Repository] Error looking up customer by phone:', err);
    return null;
  }
}

export async function dbSaveCustomer(data: {
  phone: string;
  name: string;
  street?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  complement?: string;
  reference?: string;
  lat?: number;
  lng?: number;
}): Promise<boolean> {
  if (!data.phone || !data.phone.trim()) return false;
  const rawPhone = data.phone.trim();
  const digits = rawPhone.replace(/\D/g, '');
  if (!digits) return false;
  const id = `cust-${digits}`;

  try {
    await ensureCustomersTable();
    const existing = await dbGetCustomerByPhone(rawPhone);
    if (existing) {
      await query(`
        UPDATE customers SET
          name = COALESCE(NULLIF(?, ''), name),
          street = COALESCE(NULLIF(?, ''), street),
          number = COALESCE(NULLIF(?, ''), number),
          neighborhood = COALESCE(NULLIF(?, ''), neighborhood),
          city = COALESCE(NULLIF(?, ''), city),
          state = COALESCE(NULLIF(?, ''), state),
          complement = COALESCE(?, complement),
          reference = COALESCE(?, reference),
          lat = COALESCE(?, lat),
          lng = COALESCE(?, lng),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ? OR phone = ?
      `, [
        data.name || '',
        data.street || null,
        data.number || null,
        data.neighborhood || null,
        data.city || null,
        data.state || null,
        data.complement || null,
        data.reference || null,
        data.lat || null,
        data.lng || null,
        existing.id,
        rawPhone
      ]);
    } else {
      await query(`
        INSERT INTO customers (
          id, phone, name, street, number, neighborhood, city, state, complement, reference, lat, lng, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `, [
        id,
        rawPhone,
        data.name || '',
        data.street || null,
        data.number || null,
        data.neighborhood || null,
        data.city || null,
        data.state || null,
        data.complement || null,
        data.reference || null,
        data.lat || null,
        data.lng || null
      ]);
    }
    return true;
  } catch (err) {
    console.error('[MySQL Repository] Error saving customer:', err);
    return false;
  }
}

// ==============================================================================
// CARD MACHINES (MAQUININHAS DE CARTÃO) REPOSITORY
// ==============================================================================
export const defaultCardMachinesSeed: CardMachine[] = [
  { id: 'mach-stone', name: 'Stone', model: 'Stone Smart POS', active: true, createdAt: new Date().toISOString() },
  { id: 'mach-santander', name: 'Santander', model: 'Getnet Smart', active: true, createdAt: new Date().toISOString() },
  { id: 'mach-cielo', name: 'Cielo', model: 'Cielo LIO / Smart', active: true, createdAt: new Date().toISOString() },
  { id: 'mach-outro', name: 'Outra', model: 'POS Genérica', active: true, createdAt: new Date().toISOString() }
];

let cardMachinesInitialized = false;

export async function ensureCardMachinesTable(): Promise<void> {
  const status = getDbStatus();
  if (!status.isConnected) return;
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS card_machines (
        id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        model VARCHAR(150) DEFAULT NULL,
        active TINYINT(1) NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    if (!cardMachinesInitialized) {
      const checkRows: any = await query(`SELECT COUNT(*) as count FROM card_machines`);
      const count = checkRows && checkRows[0] ? Number(checkRows[0].count) : 0;
      // Only seed on initial virgin run if table is completely empty and no settings exist
      const setting: any = await query(`SELECT setting_value FROM store_settings WHERE setting_key = 'card_machines_seeded' LIMIT 1`);
      const wasSeeded = setting && setting.length > 0;
      if (count === 0 && !wasSeeded) {
        for (const mach of defaultCardMachinesSeed) {
          await query(`
            INSERT IGNORE INTO card_machines (id, name, model, active, created_at)
            VALUES (?, ?, ?, ?, NOW())
          `, [mach.id, mach.name, mach.model || null, mach.active ? 1 : 0]);
        }
        await query(`
          INSERT INTO store_settings (setting_key, setting_value)
          VALUES ('card_machines_seeded', '1')
          ON DUPLICATE KEY UPDATE setting_value = '1'
        `);
      }
      cardMachinesInitialized = true;
    }
  } catch (e) {
    console.warn('[MySQL Repository] Notice creating card_machines table:', e);
  }
}

export async function dbGetCardMachines(): Promise<CardMachine[]> {
  const status = getDbStatus();
  if (!status.isConnected) {
    return defaultCardMachinesSeed;
  }
  try {
    await ensureCardMachinesTable();
    const rows: any = await query(`SELECT * FROM card_machines ORDER BY created_at ASC`);
    if (Array.isArray(rows)) {
      return rows.map((r: any) => ({
        id: String(r.id),
        name: String(r.name),
        model: r.model ? String(r.model) : undefined,
        active: Boolean(r.active),
        createdAt: parseSqlDatetimeToIso(r.created_at),
        updatedAt: r.updated_at ? parseSqlDatetimeToIso(r.updated_at) : undefined
      }));
    }
    return [];
  } catch (err) {
    console.error('[MySQL Repository] Error getting card machines:', err);
    return [];
  }
}

export async function dbSaveCardMachine(machine: CardMachine): Promise<boolean> {
  const status = getDbStatus();
  if (!status.isConnected) return false;
  try {
    await ensureCardMachinesTable();
    await query(`
      INSERT INTO card_machines (id, name, model, active, created_at)
      VALUES (?, ?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        model = VALUES(model),
        active = VALUES(active),
        updated_at = NOW()
    `, [
      machine.id,
      machine.name.trim(),
      machine.model ? machine.model.trim() : null,
      machine.active ? 1 : 0
    ]);
    return true;
  } catch (err) {
    console.error('[MySQL Repository] Error saving card machine:', err);
    return false;
  }
}

export async function dbDeleteCardMachine(id: string): Promise<boolean> {
  const status = getDbStatus();
  if (!status.isConnected) return true;
  try {
    await ensureCardMachinesTable();
    await query(`DELETE FROM card_machines WHERE id = ?`, [id]);
    return true;
  } catch (err) {
    console.error('[MySQL Repository] Error deleting card machine:', err);
    return false;
  }
}




