import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { calculateRunway, TransactionInput, IncomeEventInput } from './runwayCalculator';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Autonomous Runway Computation Engine for Cloud Functions.
 * Scoped strictly to the authenticated userId provided by the trigger context.
 */
export async function computeAndPersistCanonicalRunway(userId: string): Promise<void> {
  if (!userId || typeof userId !== 'string') {
    console.warn('computeAndPersistCanonicalRunway aborted: invalid userId');
    return;
  }

  try {
    // 1. Fetch User Profile
    const userDocRef = db.doc(`users/${userId}`);
    const userSnap = await userDocRef.get();
    const userData = userSnap.exists ? userSnap.data() || {} : {};
    const currentBalance = Math.max(0, Number(userData.initialBalance) || 1250);

    // 2. Fetch User Transactions (scoped strictly to userId subcollection)
    const txSnap = await db.collection(`users/${userId}/transactions`).get();
    const transactions: TransactionInput[] = txSnap.docs.map((d) => {
      const data = d.data();
      return {
        amount: data.amount,
        type: data.type,
        isRecurring: data.isRecurring,
        status: data.status,
      };
    });

    // 3. Fetch User Income Events (scoped strictly to userId subcollection)
    const incSnap = await db.collection(`users/${userId}/incomeEvents`).get();
    const incomeEvents: IncomeEventInput[] = incSnap.docs.map((d) => {
      const data = d.data();
      return {
        amount: data.amount,
        expectedDate: data.expectedDate,
        source: data.source,
        type: data.type,
        status: data.status,
      };
    });

    // 4. Calculate deterministic financial metrics using shared calculator
    const result = calculateRunway({
      currentBalance,
      transactions,
      incomeEvents,
      referenceDate: new Date(),
    });

    // Validate result values against NaN or corruption
    if (
      isNaN(result.runwayDays) || 
      isNaN(result.safeToSpendToday) || 
      isNaN(result.totalFixedExpenses)
    ) {
      console.error(`Invalid runway calculation result for user ${userId}:`, result);
      return;
    }

    // 5. Canonical write to users/{userId}/computed/runway
    const computedRef = db.doc(`users/${userId}/computed/runway`);
    await computedRef.set(
      {
        runwayDays: result.runwayDays,
        safeToSpendToday: result.safeToSpendToday,
        projectedBurnPerDay: result.projectedBurnPerDay,
        currentBalance: result.currentBalance,
        daysUntilNextIncome: result.daysUntilNextIncome,
        nextIncomeAmount: result.nextIncomeAmount,
        nextIncomeDate: result.nextIncomeDate || null,
        nextIncomeSource: result.nextIncomeSource || null,
        totalFixedExpenses: result.totalFixedExpenses,
        lastComputedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    console.log(`Successfully computed canonical runway for user ${userId}: ${result.runwayDays} days, safeToSpend=${result.safeToSpendToday}`);
  } catch (error) {
    // Graceful error logging to Cloud Logging without throwing unhandled rejection
    console.error(`Error computing canonical runway for user ${userId}:`, error);
  }
}

/**
 * Cloud Function Trigger: on write to transactions subcollection
 * Path: users/{userId}/transactions/{transactionId}
 */
export const onTransactionWritten = functions.firestore
  .document('users/{userId}/transactions/{transactionId}')
  .onWrite(async (change, context) => {
    const userId = context.params.userId;
    await computeAndPersistCanonicalRunway(userId);
  });

/**
 * Cloud Function Trigger: on write to incomeEvents subcollection
 * Path: users/{userId}/incomeEvents/{incomeEventId}
 */
export const onIncomeEventWritten = functions.firestore
  .document('users/{userId}/incomeEvents/{incomeEventId}')
  .onWrite(async (change, context) => {
    const userId = context.params.userId;
    await computeAndPersistCanonicalRunway(userId);
  });

/**
 * Cloud Function Trigger: on user document initialBalance update
 * Path: users/{userId}
 */
export const onUserWritten = functions.firestore
  .document('users/{userId}')
  .onWrite(async (change, context) => {
    const userId = context.params.userId;
    const before = change.before.exists ? change.before.data() : null;
    const after = change.after.exists ? change.after.data() : null;

    if (!after) return; // Ignore user deletion

    // Recompute if balance or relevant settings changed
    if (!before || before.initialBalance !== after.initialBalance || before.onboardingCompleted !== after.onboardingCompleted) {
      await computeAndPersistCanonicalRunway(userId);
    }
  });
