/**
 * NEYRUNWAY — Product Analytics & Milestone Instrumentation
 * Lightweight, privacy-first event tracking for user journey and decision milestones.
 */

export type AnalyticsEventName =
  | 'onboarding_started'
  | 'onboarding_completed'
  | 'first_runway_generated'
  | 'first_safe_to_spend_viewed'
  | 'transaction_added'
  | 'income_added'
  | 'ask_ney_started'
  | 'ask_ney_completed'
  | 'scenario_started'
  | 'scenario_completed'
  | 'scenario_simulated'
  | 'insight_viewed'
  | 'financial_decision_assisted'
  | 'return_day_1'
  | 'return_day_7'
  | 'return_day_30';

export interface AnalyticsEventPayload {
  eventName: AnalyticsEventName;
  timestamp: string;
  userId?: string;
  properties?: Record<string, any>;
}

const STORAGE_EVENTS_KEY = 'neyrunway_analytics_events';
const STORAGE_MILESTONES_KEY = 'neyrunway_completed_milestones';
const STORAGE_CONSENT_KEY = 'neyrunway_analytics_consent';

export type AnalyticsConsentStatus = 'granted' | 'denied' | 'default';

class AnalyticsService {
  private inMemoryEvents: AnalyticsEventPayload[] = [];
  private completedMilestones: Set<string> = new Set();
  private consentStatus: AnalyticsConsentStatus = 'default';

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const savedConsent = localStorage.getItem(STORAGE_CONSENT_KEY) as AnalyticsConsentStatus | null;
        if (savedConsent) {
          this.consentStatus = savedConsent;
        }

        const savedMilestones = localStorage.getItem(STORAGE_MILESTONES_KEY);
        if (savedMilestones) {
          const parsed = JSON.parse(savedMilestones);
          if (Array.isArray(parsed)) {
            this.completedMilestones = new Set(parsed);
          }
        }
      } catch (e) {
        console.warn('Analytics initialization notice:', e);
      }
    }
  }

  /**
   * Check if analytics tracking is allowed
   */
  public isTrackingAllowed(): boolean {
    // If explicitly denied, disable
    if (this.consentStatus === 'denied') return false;
    return true;
  }

  /**
   * Set user consent status
   */
  public setConsent(status: 'granted' | 'denied'): void {
    this.consentStatus = status;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_CONSENT_KEY, status);
        if (status === 'denied') {
          this.clearAllAnalyticsData();
        }
      } catch {}
    }
  }

  /**
   * Get current consent status
   */
  public getConsent(): AnalyticsConsentStatus {
    return this.consentStatus;
  }

  /**
   * GDPR Data Deletion: Completely clear all usage events and milestone tracking from device
   */
  public clearAllAnalyticsData(): void {
    this.inMemoryEvents = [];
    this.completedMilestones.clear();
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_EVENTS_KEY);
        localStorage.removeItem(STORAGE_MILESTONES_KEY);
      } catch {}
    }
  }

  /**
   * Tracks a product milestone or user interaction (Strictly local to browser)
   */
  public track(eventName: AnalyticsEventName, properties?: Record<string, any>, userId?: string): void {
    if (!this.isTrackingAllowed()) return;

    const payload: AnalyticsEventPayload = {
      eventName,
      timestamp: new Date().toISOString(),
      userId,
      properties: {
        ...properties,
        url: typeof window !== 'undefined' ? window.location.pathname : '',
      }
    };

    this.inMemoryEvents.push(payload);

    // Keep memory bounded to last 100 events
    if (this.inMemoryEvents.length > 100) {
      this.inMemoryEvents.shift();
    }

    if (typeof window !== 'undefined') {
      try {
        // Mark milestone if unique
        if (!this.completedMilestones.has(eventName)) {
          this.completedMilestones.add(eventName);
          localStorage.setItem(STORAGE_MILESTONES_KEY, JSON.stringify(Array.from(this.completedMilestones)));
        }

        // Store recent event log
        const stored = localStorage.getItem(STORAGE_EVENTS_KEY);
        const list: AnalyticsEventPayload[] = stored ? JSON.parse(stored) : [];
        list.push(payload);
        if (list.length > 50) list.shift();
        localStorage.setItem(STORAGE_EVENTS_KEY, JSON.stringify(list));
      } catch (err) {
        // Silent catch for localStorage restrictions
      }
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`📊 [NEYRUNWAY Analytics] ${eventName}`, properties || {});
    }
  }

  public hasCompletedMilestone(eventName: AnalyticsEventName): boolean {
    return this.completedMilestones.has(eventName);
  }

  public getRecentEvents(): AnalyticsEventPayload[] {
    return [...this.inMemoryEvents];
  }
}

export const analytics = new AnalyticsService();
