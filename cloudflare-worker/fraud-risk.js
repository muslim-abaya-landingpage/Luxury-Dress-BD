/**
 * Deterministic, explainable checkout risk scoring.
 *
 * This is a review/challenge signal only: it never rejects an order by itself.
 * Stable device identity, VPN/proxy intelligence and courier history are optional
 * signals and remain inactive until trusted server-side evidence is available.
 */
export function scoreFraudRisk(signals = {}, policy = {}) {
  let score = 0;
  const reasons = [];
  const samePhone = Math.max(0, Number(signals.samePhoneAttempts10m) || 0);
  const ipAttempts = Math.max(0, Number(signals.ipAttempts30m) || 0);
  const distinctPhones = Math.max(0, Number(signals.distinctPhones30m) || 0);
  const sameDevice = Math.max(0, Number(signals.sameDeviceAttempts24h) || 0);

  if (samePhone >= 5) {
    score += 50;
    reasons.push('একই ফোন থেকে ১০ মিনিটে ' + samePhone + 'টি আগের অর্ডার-চেষ্টা');
  } else if (samePhone >= 3) {
    score += 35;
    reasons.push('একই ফোন থেকে ১০ মিনিটে ' + samePhone + 'টি আগের অর্ডার-চেষ্টা');
  } else if (samePhone >= 2) {
    score += 25;
    reasons.push('একই ফোন থেকে ১০ মিনিটে ' + samePhone + 'টি আগের অর্ডার-চেষ্টা');
  }

  if (ipAttempts >= 5 && distinctPhones >= 3) {
    score += 15;
    reasons.push('একই IP থেকে ৩০ মিনিটে ' + ipAttempts + 'টি চেষ্টা ও ' + distinctPhones + 'টি ফোন');
  }

  if (sameDevice >= 5) {
    score += 35;
    reasons.push('একই ডিভাইস থেকে ২৪ ঘণ্টায় ' + sameDevice + 'টি অর্ডার-চেষ্টা');
  } else if (sameDevice >= 3) {
    // Three orders from one signed first-party device merit a soft challenge,
    // not a block; the 30-point threshold keeps the action proportionate.
    score += 30;
    reasons.push('একই ডিভাইস থেকে ২৪ ঘণ্টায় ' + sameDevice + 'টি অর্ডার-চেষ্টা');
  } else if (sameDevice >= 2) {
    score += 15;
    reasons.push('একই ডিভাইস থেকে ২৪ ঘণ্টায় ' + sameDevice + 'টি অর্ডার-চেষ্টা');
  }

  if (signals.vpnOrProxy === true) {
    score += 15;
    reasons.push('VPN বা Proxy ব্যবহারের নির্ভরযোগ্য সংকেত');
  }
  if (signals.hostingNetwork === true) {
    score += 10;
    reasons.push('Hosting/Data-center network-এর সংকেত');
  }

  score = Math.min(100, score);
  const reviewAt = Number.isFinite(Number(policy.reviewAt)) ? Number(policy.reviewAt) : 30;
  const highAt = Number.isFinite(Number(policy.highAt)) ? Number(policy.highAt) : 60;
  return {
    score,
    level: score >= highAt ? 'high' : score >= reviewAt ? 'review' : 'low',
    action: score >= highAt ? 'manual_review' : score >= reviewAt ? 'challenge' : 'allow',
    reasons
  };
}
