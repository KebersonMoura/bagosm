import mysql from 'mysql2/promise';

// Configuração do Banco de Dados MySQL
export const dbConfig = {
  host: process.env.MYSQL_HOST || '108.179.253.50',
  user: process.env.MYSQL_USER || 'jawsap29_bago',
  password: process.env.MYSQL_PASSWORD || '@K1e3b0e4',
  database: process.env.MYSQL_DATABASE || 'jawsap29_bago_restaurant',
  port: Number(process.env.MYSQL_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 5000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 5000,
  timezone: '-03:00',
  dateStrings: true
};

let pool: mysql.Pool | null = null;
let isConnected = false;
let lastError: string | null = null;

export function resetPool(): void {
  if (pool) {
    try {
      pool.end().catch(() => {});
    } catch (e) {
      // ignore
    }
    pool = null;
  }
}

export function getPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool(dbConfig);
  }
  return pool;
}

// Testa a conexão com o banco de dados MySQL
export async function testDbConnection(): Promise<{ success: boolean; message: string; host: string; database: string }> {
  try {
    const p = getPool();
    const connection = await p.getConnection();
    await connection.ping();
    connection.release();
    isConnected = true;
    lastError = null;
    return {
      success: true,
      message: 'Conectado com sucesso ao MySQL!',
      host: dbConfig.host,
      database: dbConfig.database
    };
  } catch (err: any) {
    isConnected = false;
    lastError = err?.message || String(err);
    console.warn('[MySQL] Erro ao conectar ao MySQL (modo fallback in-memory ativo):', lastError);
    return {
      success: false,
      message: `Falha na conexão: ${lastError}`,
      host: dbConfig.host,
      database: dbConfig.database
    };
  }
}

export function getDbStatus() {
  return {
    isConnected,
    lastError,
    config: {
      host: dbConfig.host,
      user: dbConfig.user,
      database: dbConfig.database,
      port: dbConfig.port
    }
  };
}

// Helper para executar queries SQL no MySQL com auto-reconexão e retry em caso de queda de conexão
export async function query<T = any>(sql: string, params?: any[]): Promise<T> {
  const executeQuery = async (): Promise<T> => {
    if (!isConnected) {
      const retest = await testDbConnection();
      if (!retest.success) {
        throw new Error(`MySQL connection is not active: ${lastError}`);
      }
    }

    try {
      const p = getPool();
      const [results] = await p.query(sql, params);
      return results as T;
    } catch (err: any) {
      const isConnLost = err && (
        err.code === 'PROTOCOL_CONNECTION_LOST' ||
        err.code === 'ECONNRESET' ||
        err.code === 'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR' ||
        err.code === 'ETIMEDOUT' ||
        err.code === 'EPIPE' ||
        (err.message && (
          err.message.includes('Connection lost') ||
          err.message.includes('closed the connection') ||
          err.message.includes('closed socket')
        ))
      );

      if (isConnLost) {
        console.warn('[MySQL] Queda de conexão detectada ao executar query. Reiniciando pool e tentando novamente...', err.message);
        resetPool();
        const retest = await testDbConnection();
        if (retest.success) {
          const p2 = getPool();
          const [retryResults] = await p2.query(sql, params);
          return retryResults as T;
        }
      }
      throw err;
    }
  };

  // Timeout guard of 6 seconds per query to prevent hanging HTTP responses
  let timer: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`MySQL query timeout: ${sql.substring(0, 60)}`));
    }, 6000);
  });

  try {
    return await Promise.race([executeQuery(), timeoutPromise]);
  } finally {
    clearTimeout(timer);
  }
}
