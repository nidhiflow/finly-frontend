export function getBudgetAlerts(budgets) {
  if (!Array.isArray(budgets) || budgets.length === 0) {
    return { alerts: [], warningAlerts: [], criticalAlerts: [], hasAlerts: false };
  }

  const alerts = [];

  budgets.forEach((b) => {
    const amount = parseFloat(b.amount || 0);
    const spent = parseFloat(b.spent || 0);
    if (!amount || amount <= 0) return;

    const pctRaw = spent / amount;
    const pct = pctRaw * 100;

    if (pctRaw >= 1) {
      alerts.push({
        id: b.id,
        level: 'critical',
        pct,
        amount,
        spent,
        name: b.category_name,
        icon: b.category_icon,
      });
    } else if (pctRaw >= 0.9) {
      alerts.push({
        id: b.id,
        level: 'warning',
        pct,
        amount,
        spent,
        name: b.category_name,
        icon: b.category_icon,
      });
    }
  });

  const warningAlerts = alerts.filter((a) => a.level === 'warning');
  const criticalAlerts = alerts.filter((a) => a.level === 'critical');

  return {
    alerts,
    warningAlerts,
    criticalAlerts,
    hasAlerts: alerts.length > 0,
  };
}

