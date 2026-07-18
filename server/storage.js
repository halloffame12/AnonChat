/**
 * Storage Abstraction Layer
 * Swap between in-memory (dev) and Redis (prod) without changing business logic.
 *
 * Usage:
 *   const store = require('./storage');
 *   await store.init();                     // auto-detect Redis from REDIS_URL
 *   await store.set('key', value);
 *   const val = await store.get('key');
 *
 * All stores implement the same IStorage interface:
 *   get(key), set(key, value, ttlMs?), delete(key), has(key),
 *   keys(pattern?), size(), clear(), sadd(key, member), srem(key, member),
 *   smembers(key), hset(key, field, value), hget(key, field), hdel(key, field),
 *   hgetall(key), expire(key, ttlMs)
 */

const crypto = require('crypto');
const NS_PER_SEC = 1e9;

// ===================================================================================
// IN-MEMORY STORE (default for development)
// ===================================================================================

class MemoryStore {
  constructor() {
    this._data = new Map();
    this._sets = new Map();
    this._hashes = new Map();
    this._ttls = new Map();
    this._ttlCheckInterval = null;
  }

  _startTTLCleanup() {
    if (this._ttlCheckInterval) return;
    this._ttlCheckInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, expiry] of this._ttls.entries()) {
        if (now >= expiry) {
          this._data.delete(key);
          this._sets.delete(key);
          this._hashes.delete(key);
          this._ttls.delete(key);
        }
      }
    }, 10000);
  }

  _checkTTL(key) {
    const expiry = this._ttls.get(key);
    if (expiry && Date.now() >= expiry) {
      this._data.delete(key);
      this._sets.delete(key);
      this._hashes.delete(key);
      this._ttls.delete(key);
      return false;
    }
    return true;
  }

  async init() { this._startTTLCleanup(); }

  async get(key) {
    if (!this._checkTTL(key)) return null;
    return this._data.get(key) ?? null;
  }

  async set(key, value, ttlMs) {
    this._data.set(key, value);
    if (ttlMs) {
      this._ttls.set(key, Date.now() + ttlMs);
    } else {
      this._ttls.delete(key);
    }
  }

  async delete(key) {
    this._data.delete(key);
    this._sets.delete(key);
    this._hashes.delete(key);
    this._ttls.delete(key);
  }

  async has(key) {
    if (!this._checkTTL(key)) return false;
    return this._data.has(key);
  }

  async keys(pattern) {
    const all = Array.from(this._data.keys());
    if (!pattern) return all;
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return all.filter(k => regex.test(k));
  }

  async size() { return this._data.size; }

  async clear() {
    this._data.clear();
    this._sets.clear();
    this._hashes.clear();
    this._ttls.clear();
  }

  // Set operations
  async sadd(key, member) {
    if (!this._sets.has(key)) this._sets.set(key, new Set());
    this._sets.get(key).add(member);
  }

  async srem(key, member) {
    const set = this._sets.get(key);
    if (set) {
      set.delete(member);
      if (set.size === 0) this._sets.delete(key);
    }
  }

  async smembers(key) {
    const set = this._sets.get(key);
    return set ? Array.from(set) : [];
  }

  // Hash operations
  async hset(key, field, value) {
    if (!this._hashes.has(key)) this._hashes.set(key, new Map());
    this._hashes.get(key).set(field, value);
  }

  async hget(key, field) {
    const hash = this._hashes.get(key);
    return hash ? (hash.get(field) ?? null) : null;
  }

  async hdel(key, field) {
    const hash = this._hashes.get(key);
    if (hash) {
      hash.delete(field);
      if (hash.size === 0) this._hashes.delete(key);
    }
  }

  async hgetall(key) {
    const hash = this._hashes.get(key);
    if (!hash) return null;
    const obj = {};
    for (const [k, v] of hash) obj[k] = v;
    return obj;
  }

  async expire(key, ttlMs) {
    if (this._data.has(key) || this._sets.has(key) || this._hashes.has(key)) {
      this._ttls.set(key, Date.now() + ttlMs);
    }
  }

  async disconnect() {
    if (this._ttlCheckInterval) {
      clearInterval(this._ttlCheckInterval);
      this._ttlCheckInterval = null;
    }
  }
}

// ===================================================================================
// REDIS STORE (production)
// ===================================================================================

class RedisStore {
  constructor(url) {
    this._url = url;
    this._redis = null;
  }

  async init() {
    try {
      const Redis = require('ioredis');
      this._redis = new Redis(this._url, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => Math.min(times * 200, 3000),
        lazyConnect: true
      });
      await this._redis.connect();
      console.log('[STORAGE] Connected to Redis');
    } catch (err) {
      console.error('[STORAGE] Redis connection failed, falling back to in-memory:', err.message);
      throw err;
    }
  }

  async get(key) {
    const val = await this._redis.get(key);
    if (val === null) return null;
    try { return JSON.parse(val); } catch { return val; }
  }

  async set(key, value, ttlMs) {
    const str = typeof value === 'object' ? JSON.stringify(value) : String(value);
    if (ttlMs) {
      await this._redis.set(key, str, 'PX', ttlMs);
    } else {
      await this._redis.set(key, str);
    }
  }

  async delete(key) { await this._redis.del(key); }
  async has(key) { return (await this._redis.exists(key)) === 1; }
  async keys(pattern) { return await this._redis.keys(pattern || '*'); }
  async size() { return await this._redis.dbsize(); }
  async clear() { await this._redis.flushdb(); }

  async sadd(key, member) { await this._redis.sadd(key, member); }
  async srem(key, member) { await this._redis.srem(key, member); }
  async smembers(key) { return await this._redis.smembers(key); }

  async hset(key, field, value) {
    const v = typeof value === 'object' ? JSON.stringify(value) : String(value);
    await this._redis.hset(key, field, v);
  }

  async hget(key, field) {
    const val = await this._redis.hget(key, field);
    if (val === null) return null;
    try { return JSON.parse(val); } catch { return val; }
  }

  async hdel(key, field) { await this._redis.hdel(key, field); }

  async hgetall(key) {
    const result = await this._redis.hgetall(key);
    if (!result) return null;
    for (const [k, v] of Object.entries(result)) {
      try { result[k] = JSON.parse(v); } catch { /* keep as string */ }
    }
    return result;
  }

  async expire(key, ttlMs) { await this._redis.pexpire(key, ttlMs); }
  async disconnect() {
    if (this._redis) { await this._redis.quit(); this._redis = null; }
  }
}

// ===================================================================================
// FACTORY
// ===================================================================================

let _instance = null;

async function createStore() {
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    try {
      const store = new RedisStore(redisUrl);
      await store.init();
      return store;
    } catch (err) {
      console.warn('[STORAGE] Falling back to in-memory store');
    }
  }
  const store = new MemoryStore();
  await store.init();
  return store;
}

module.exports = {
  MemoryStore,
  RedisStore,
  createStore,
  getStore: () => _instance,
  setStore: (s) => { _instance = s; }
};
