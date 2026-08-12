export type HomeDashboardPanel = 'calendar' | 'weather' | 'matches' | 'tournaments';

export interface HomeDashboardColumns {
  readonly left: readonly HomeDashboardPanel[];
  readonly right: readonly HomeDashboardPanel[];
}

export const HOME_DASHBOARD_ORDER: readonly HomeDashboardPanel[] = [
  'calendar',
  'weather',
  'matches',
  'tournaments',
];

/**
 * Distribuisce ogni pannello nella colonna al momento piu corta. L'ordine
 * calendar/meteo/partite/tornei mantiene le due informazioni principali in
 * alto e lascia risalire le card compatte senza creare buchi verticali.
 */
export function balanceHomeDashboard(
  heights: Readonly<Record<HomeDashboardPanel, number>>,
  gap = 22,
): HomeDashboardColumns {
  const left: HomeDashboardPanel[] = [];
  const right: HomeDashboardPanel[] = [];
  let leftHeight = 0;
  let rightHeight = 0;

  for (const panel of HOME_DASHBOARD_ORDER) {
    const height = Math.max(0, heights[panel] || 0);
    if (leftHeight <= rightHeight) {
      left.push(panel);
      leftHeight += (left.length > 1 ? gap : 0) + height;
    } else {
      right.push(panel);
      rightHeight += (right.length > 1 ? gap : 0) + height;
    }
  }

  return { left, right };
}

export function sameHomeDashboardColumns(
  first: HomeDashboardColumns,
  second: HomeDashboardColumns,
): boolean {
  return first.left.join('|') === second.left.join('|')
    && first.right.join('|') === second.right.join('|');
}
