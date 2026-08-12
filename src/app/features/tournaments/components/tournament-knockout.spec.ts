import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ConfirmationService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';
import { PRIMENG_IT } from '../../../core/i18n/primeng-it';
import { Tournament } from '../models/tournament.model';
import { TournamentsStore } from '../store/tournaments.store';
import { TournamentKnockout } from './tournament-knockout';

describe('TournamentKnockout podium', () => {
  let fixture: ComponentFixture<TournamentKnockout>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TournamentKnockout],
      providers: [
        ConfirmationService,
        provideNoopAnimations(),
        providePrimeNG({ translation: PRIMENG_IT }),
        { provide: TournamentsStore, useValue: { saving: signal(false) } },
      ],
    });
    fixture = TestBed.createComponent(TournamentKnockout);
  });

  it('contiene e tronca una coppia con nomi molto lunghi', async () => {
    const longTeam = {
      id: 'team-long', tournament_id: 'tournament', status: 'confirmed' as const,
      seed: null, waitlist_position: null,
      members: [
        { profile_id: 'one', status: 'accepted' as const, profile: { id: 'one', nome: 'Michelangelo Alessandro', cognome: 'Castelli Della Rovere', livello: 4, lato_preferito: 'sinistra', avatar_url: null } },
        { profile_id: 'two', status: 'accepted' as const, profile: { id: 'two', nome: 'Francesco Sebastiano', cognome: 'Gentile Di Monteverde', livello: 4, lato_preferito: 'destra', avatar_url: null } },
      ],
    };
    const tournament = {
      id: 'tournament', groups_closed_at: null, groups: [], games: [], brackets: [],
      teams: [longTeam], courts: [], champion_team_id: longTeam.id,
      runner_up_team_id: null, third_place_team_id: null,
    } as unknown as Tournament;

    fixture.componentRef.setInput('tournament', tournament);
    fixture.componentRef.setInput('canManage', true);
    fixture.nativeElement.style.display = 'block';
    fixture.nativeElement.style.width = '340px';
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const slot = fixture.nativeElement.querySelector('.podium-slot') as HTMLElement;
    const select = slot.querySelector('.p-select') as HTMLElement;
    const label = slot.querySelector('.p-select-label') as HTMLElement;
    const slotBox = slot.getBoundingClientRect();
    const selectBox = select.getBoundingClientRect();

    expect(selectBox.left).toBeGreaterThanOrEqual(slotBox.left);
    expect(selectBox.right).toBeLessThanOrEqual(slotBox.right + 1);
    expect(label.textContent).toContain('Michelangelo Alessandro');
    expect(getComputedStyle(label).overflow).toBe('hidden');
    expect(getComputedStyle(label).whiteSpace).toBe('nowrap');
    expect(getComputedStyle(label).textOverflow).toBe('ellipsis');
  });
});
