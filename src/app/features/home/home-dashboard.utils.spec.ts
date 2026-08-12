import { balanceHomeDashboard } from './home-dashboard.utils';

describe('home dashboard masonry', () => {
  it('porta i tornei sotto le partite quando la colonna del meteo e piu alta', () => {
    const columns = balanceHomeDashboard({
      calendar: 360,
      weather: 640,
      matches: 120,
      tournaments: 180,
    });

    expect(columns.left).toEqual(['calendar', 'matches', 'tournaments']);
    expect(columns.right).toEqual(['weather']);
  });

  it('usa anche la colonna destra quando diventa quella piu corta', () => {
    const columns = balanceHomeDashboard({
      calendar: 620,
      weather: 320,
      matches: 180,
      tournaments: 160,
    });

    expect(columns.left).toEqual(['calendar']);
    expect(columns.right).toEqual(['weather', 'matches', 'tournaments']);
  });
});
