import { describe, it, expect, beforeEach } from 'vitest';

// Mock the ReputationSystem and SmartMatchmaking logic
class MockReputationSystem {
  private reputations = new Map<string, { score: number; messageCount: number }>();

  initializeReputation(userId: string) {
    if (!this.reputations.has(userId)) {
      this.reputations.set(userId, { score: 100, messageCount: 0 });
    }
  }

  getReputation(userId: string) {
    return this.reputations.get(userId) || { score: 100, messageCount: 0, skipCount: 0, reportCount: 0, spamScore: 0 };
  }

  isToxic(userId: string) {
    const rep = this.getReputation(userId);
    return rep.score < 30;
  }

  getMatchmakingPriority(userId: string) {
    return Math.floor((this.getReputation(userId).score || 100) / 20);
  }

  recordSkip(userId: string) {
    const rep = this.getReputation(userId);
    rep.score = Math.max(0, rep.score - 3);
  }

  recordReport(userId: string) {
    const rep = this.getReputation(userId);
    rep.score = Math.max(0, rep.score - 15);
  }
}

class SmartMatchmaking {
  public reputation: MockReputationSystem;
  public waitingQueue = new Map<number, Set<string>>();
  public userMetadata = new Map<string, any>();
  public activeMatches = new Map<string, any>();
  public recentlyMatched = new Map<string, number>();
  public SKIP_COOLDOWN = 300000;
  public analytics = { totalSearches: 0, totalMatches: 0, totalSkips: 0, totalWaitTime: 0, matchedWaitTime: 0, totalCancels: 0 };

  constructor(reputation: MockReputationSystem) {
    this.reputation = reputation;
  }

  addToQueue(userId: string) {
    const rep = this.reputation.getReputation(userId);
    if (this.reputation.isToxic(userId)) {
      return { success: false, reason: 'reputation_too_low' };
    }
    const priority = this.reputation.getMatchmakingPriority(userId);
    if (!this.waitingQueue.has(priority)) {
      this.waitingQueue.set(priority, new Set());
    }
    this.waitingQueue.get(priority)!.add(userId);
    this.analytics.totalSearches++;
    this.userMetadata.set(userId, {
      priority,
      joinedAt: Date.now(),
      activityLevel: rep.messageCount < 10 ? 25 : 50,
    });
    return { success: true, priority };
  }

  removeFromQueue(userId: string) {
    const meta = this.userMetadata.get(userId);
    if (meta) {
      const q = this.waitingQueue.get(meta.priority);
      if (q) { q.delete(userId); if (q.size === 0) this.waitingQueue.delete(meta.priority); }
      this.userMetadata.delete(userId);
    }
  }

  findMatch(userId: string) {
    const meta = this.userMetadata.get(userId);
    if (!meta) return null;

    let match = this._findInPriority(userId, meta.priority, meta);
    if (!match && meta.priority > 0) match = this._findInPriority(userId, meta.priority - 1, meta);
    if (!match && meta.priority < 5) match = this._findInPriority(userId, meta.priority + 1, meta);

    if (match) {
      this.removeFromQueue(userId);
      this.removeFromQueue(match);
      const matchId = `match-${Math.random().toString(36).slice(2)}`;
      this.activeMatches.set(matchId, { user1: userId, user2: match, startTime: Date.now() });
      this.analytics.totalMatches++;
      return { matchId, partnerId: match };
    }
    return null;
  }

  private _findInPriority(userId: string, priority: number, _meta: any) {
    const q = this.waitingQueue.get(priority);
    if (!q || q.size < 2) return null;
    const candidates = Array.from(q).filter(id => id !== userId && !this.wasRecentlyMatched(userId, id));
    if (candidates.length === 0) return null;
    return candidates[0];
  }

  wasRecentlyMatched(a: string, b: string) {
    const t = this.recentlyMatched.get(`${a}:${b}`);
    return t ? Date.now() < t : false;
  }

  recordMutualSkip(a: string, b: string) {
    const until = Date.now() + this.SKIP_COOLDOWN;
    this.recentlyMatched.set(`${a}:${b}`, until);
    this.recentlyMatched.set(`${b}:${a}`, until);
  }

  endMatch(matchId: string) { this.activeMatches.delete(matchId); }
  recordSkip() { this.analytics.totalSkips++; }

  getAnalytics() {
    const a = this.analytics;
    return {
      totalSearches: a.totalSearches,
      totalMatches: a.totalMatches,
      totalSkips: a.totalSkips,
      avgWaitTimeMs: a.totalMatches > 0 ? Math.round(a.matchedWaitTime / a.totalMatches) : 0,
      matchSuccessRate: a.totalSearches > 0 ? Math.round((a.totalMatches / a.totalSearches) * 100) : 0,
      skipRate: a.totalMatches > 0 ? Math.round((a.totalSkips / a.totalMatches) * 100) : 0,
    };
  }
}

describe('SmartMatchmaking', () => {
  let rep: MockReputationSystem;
  let mm: SmartMatchmaking;

  beforeEach(() => {
    rep = new MockReputationSystem();
    mm = new SmartMatchmaking(rep);
  });

  describe('addToQueue', () => {
    it('should add user to queue with correct priority', () => {
      rep.initializeReputation('user1');
      const result = mm.addToQueue('user1');
      expect(result.success).toBe(true);
      expect(result.priority).toBe(5); // score 100 / 20 = 5
    });

    it('should reject toxic users', () => {
      rep.initializeReputation('toxic');
      const r = rep.getReputation('toxic');
      r.score = 20;
      const result = mm.addToQueue('toxic');
      expect(result.success).toBe(false);
      expect(result.reason).toBe('reputation_too_low');
    });
  });

  describe('findMatch', () => {
    it('should match two users in the same priority', () => {
      rep.initializeReputation('user1');
      rep.initializeReputation('user2');
      mm.addToQueue('user1');
      mm.addToQueue('user2');
      const match = mm.findMatch('user1');
      expect(match).not.toBeNull();
      expect(match!.partnerId).toBe('user2');
    });

    it('should return null if only one user in queue', () => {
      rep.initializeReputation('user1');
      mm.addToQueue('user1');
      const match = mm.findMatch('user1');
      expect(match).toBeNull();
    });

    it('should not re-match recently skipped pairs', () => {
      rep.initializeReputation('user1');
      rep.initializeReputation('user2');
      mm.recordMutualSkip('user1', 'user2');
      mm.addToQueue('user1');
      mm.addToQueue('user2');
      const match = mm.findMatch('user1');
      expect(match).toBeNull();
    });
  });

  describe('analytics', () => {
    it('should track search and match counts', () => {
      rep.initializeReputation('u1');
      rep.initializeReputation('u2');
      mm.addToQueue('u1');
      mm.addToQueue('u2');
      mm.findMatch('u1');
      const a = mm.getAnalytics();
      expect(a.totalSearches).toBe(2);
      expect(a.totalMatches).toBe(1);
    });

    it('should track skip rate', () => {
      rep.initializeReputation('u1');
      rep.initializeReputation('u2');
      mm.addToQueue('u1');
      mm.addToQueue('u2');
      mm.findMatch('u1');
      mm.recordSkip();
      const a = mm.getAnalytics();
      expect(a.totalSkips).toBe(1);
      expect(a.skipRate).toBe(100);
    });
  });
});

describe('Reputation System', () => {
  let rep: MockReputationSystem;

  beforeEach(() => {
    rep = new MockReputationSystem();
  });

  it('should initialize with score 100', () => {
    rep.initializeReputation('user1');
    expect(rep.getReputation('user1').score).toBe(100);
  });

  it('should decrease score on skip', () => {
    rep.initializeReputation('user1');
    rep.recordSkip('user1');
    expect(rep.getReputation('user1').score).toBe(97);
  });

  it('should decrease score heavily on report', () => {
    rep.initializeReputation('user1');
    rep.recordReport('user1');
    expect(rep.getReputation('user1').score).toBe(85);
  });

  it('should detect toxic users', () => {
    rep.initializeReputation('toxic');
    const r = rep.getReputation('toxic');
    r.score = 20;
    expect(rep.isToxic('toxic')).toBe(true);
  });
});
