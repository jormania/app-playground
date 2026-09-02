// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App.jsx';

// A smoke test over the whole app in demo mode — the one thing 3800 unit tests
// could not tell us, which is whether the pieces still mount together. The keep
// sheet has already crashed the app to a white screen once (MARQUEE.md §9.3),
// at the worst possible moment, and nothing here would have caught it.

afterEach(() => { cleanup(); localStorage.clear(); });

describe('Marquee, end to end in demo mode', () => {
  it('mounts on the programme with nothing checked yet', async () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Marquee', level: 1 })).toBeTruthy();
    expect(screen.getByText(/demo · not connected to Notion/)).toBeTruthy();
    expect(screen.getByText(/Nothing checked yet/)).toBeTruthy();
  });

  it('lists the demo venues, every one of them with a working reader', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: /^Venues/ }));
    // Every demo venue must resolve to a reader the client knows about — the
    // shape of an adapter shipped on one side of the registry contract but not
    // the other. (The WRITE half of that drift is notion.test.js's job.)
    await waitFor(() => expect(screen.getByText(/read on each check/)).toBeTruthy());
    expect(screen.queryByText(/no reader/)).toBeNull();
    expect(screen.getByText('Teatrul Național București')).toBeTruthy();
    expect(screen.getByText('Teatrul Unteatru')).toBeTruthy();
  });

  it('opens Settings — which is now only settings, no venue list', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(await screen.findByText('Appearance')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Notify' })).toBeTruthy();
    // "Venue health" showed a strict subset of the Venues tab and moved there.
    expect(screen.queryByText('Venue health')).toBeNull();
  });

  it('opens the add-venue form and resolves a reader from a pasted URL', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: /^Venues/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Add venue' }));
    const url = await screen.findByLabelText(/Programme page URL/);
    fireEvent.change(url, { target: { value: 'https://www.mystage.ro/teatre/unteatru-2' } });
    expect(await screen.findByText(/Read by the mystage.ro venue page reader/)).toBeTruthy();
    // The URL leads: the name fills itself in rather than being typed.
    expect(screen.getByLabelText(/Venue name/).value).toBeTruthy();
  });

  it('keeping a showing offers Undo, and Undo actually reverses the save', async () => {
    // The app's only write, end to end: scan → keep → the toast that follows →
    // pressing Undo really archives the row rather than just closing the toast.
    const user = userEvent.setup();
    const event = {
      key: 'excelsior:2099-01-01T20:00:demo-show',
      venue: 'Teatrul Excelsior',
      title: 'Demo Show',
      date: '2099-01-01',
      time: '20:00',
      ticketState: 'open',
    };
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        scannedAt: new Date().toISOString(),
        venues: [{ venue: 'Teatrul Excelsior', status: 'ok', events: [event] }],
        events: [event],
      }),
    })));

    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Check venues' }));
    await screen.findByText('Demo Show');

    await user.click(screen.getByRole('button', { name: 'Keep' }));
    await screen.findByText('Keep in Wanderlist');
    await user.click(screen.getByRole('button', { name: 'Keep it' }));

    const toast = await screen.findByText(/Kept “Demo Show”\./);
    expect(toast).toBeTruthy();
    // Already reflected on the card, not just claimed by the toast.
    expect(await screen.findByText('in Wanderlist')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(screen.queryByText(/Kept “Demo Show”\./)).toBeNull());
    await waitFor(() => expect(screen.queryByText('in Wanderlist')).toBeNull());

    vi.unstubAllGlobals();
  });

  it('search is on both tabs, and each tab keeps its own query', async () => {
    // Consistency between screens was the point — but a SHARED query would
    // carry a programme search onto the Venues tab and empty it with no
    // visible cause, so each tab owns its own.
    const user = userEvent.setup();
    render(<App />);

    const programmeBox = screen.getByLabelText(/Search the programme/);
    await user.type(programmeBox, 'Tomcat');

    await user.click(await screen.findByRole('button', { name: /^Venues/ }));
    const venueBox = await screen.findByLabelText(/Search your venues/);
    expect(venueBox.value).toBe('');
    // The venue list is intact, not silently emptied by the other tab's query.
    expect(screen.getByText('Teatrul Excelsior')).toBeTruthy();

    await user.type(venueBox, 'grozavesti');
    await waitFor(() => expect(screen.getByText('Quantic')).toBeTruthy());
    expect(screen.queryByText('Teatrul Excelsior')).toBeNull();

    // And back: the programme's own query survived the round trip.
    await user.click(screen.getByRole('button', { name: 'Programme' }));
    expect(screen.getByLabelText(/Search the programme/).value).toBe('Tomcat');
  });

  it('says a venue search matched nothing, rather than "no venues yet"', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: /^Venues/ }));
    await user.type(await screen.findByLabelText(/Search your venues/), 'zzzz');
    expect(await screen.findByText(/Nothing matches/)).toBeTruthy();
    expect(screen.queryByText(/No venues yet/)).toBeNull();
  });

  it('every level of the cascade is on screen at once, and a type scopes the venues under it', async () => {
    // §9.60's core promise: the chain is visible top to leaf rather than
    // revealed one tier at a time, and a venue row under a type contains
    // that type's venues and nothing else.
    const user = userEvent.setup();
    render(<App />);

    // Type AND venue both there from the start — no level you have to
    // unlock something else to see.
    expect(await screen.findByRole('button', { name: 'Theatre' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cinema' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Teatrul Excelsior' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cinema Union' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Theatre' }));
    expect(await screen.findByRole('button', { name: 'Teatrul Excelsior' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Cinema Union' })).toBeNull();
  });

  it('picking a venue never widens its own type back out to every venue', async () => {
    // The reported bug, and the reason the cascade was rebuilt: the venue
    // row used to expand to EVERY active venue the moment one was selected,
    // so three cinemas sat listed under a "Theatre ›" label. A child level
    // must not widen the scope its parent set.
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole('button', { name: 'Theatre' }));
    await user.click(await screen.findByRole('button', { name: 'Teatrul Excelsior' }));

    expect(screen.queryByRole('button', { name: 'Cinema Union' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cinema Europa' })).toBeNull();
    // And the top of the chain is still there, still visibly the thing that
    // scoped this — it used to hide itself entirely at this point.
    expect(screen.getByRole('button', { name: 'Theatre' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('the path says where you are, and its crumbs step back up the chain', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole('button', { name: 'Theatre' }));
    await user.click(await screen.findByRole('button', { name: 'Teatrul Excelsior' }));

    const path = screen.getByRole('navigation', { name: 'Filter the programme' });
    expect(path.textContent).toContain('Theatre');
    expect(path.textContent).toContain('Teatrul Excelsior');

    // A crumb drops the levels BELOW it and keeps its own — back to Theatre
    // means the venue clears and the type stays.
    await user.click(screen.getByRole('button', { name: 'Back to Theatre' }));
    expect(screen.getByRole('button', { name: 'Theatre' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Teatrul Excelsior' }).getAttribute('aria-pressed')).toBe('false');

    // The root crumb clears the whole chain in one tap.
    await user.click(screen.getByRole('button', { name: 'Clear all filters' }));
    expect(screen.getByRole('button', { name: 'Theatre' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('an interdisciplinary venue appears under every category its CURRENT programme spans, not just its own default', async () => {
    // ARCUB's Category Default is 'event', but a real scan can hand back a
    // play and a concert from its own `.tags` markup (arcub.js) — both
    // should surface ARCUB under the matching tab, which the venue's single
    // default alone could never do (programme.js's categoryFor/App.jsx's
    // venuesInCategory, the whole point of this session's change).
    const user = userEvent.setup();
    const play = {
      key: 'arcub:2099-01-02:cineva-are-sa-vina', venue: 'ARCUB', title: 'Cineva are să vină',
      date: '2099-01-02', ticketState: 'open', category: 'play',
    };
    const concert = {
      key: 'arcub:2099-01-03:teodora-brody', venue: 'ARCUB', title: 'Teodora Brody',
      date: '2099-01-03', ticketState: 'open', category: 'concert',
    };
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        scannedAt: new Date().toISOString(),
        venues: [{ venue: 'ARCUB', status: 'ok', events: [play, concert] }],
        events: [play, concert],
      }),
    })));

    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Check venues' }));
    await screen.findByText('Cineva are să vină');

    await user.click(screen.getByRole('button', { name: 'Theatre' }));
    expect(await screen.findByRole('button', { name: 'ARCUB' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'ARCUB' }));

    // Theatre is still the scope, so ARCUB shows its play and not its
    // concert — the row and the label above it agree, which is the whole
    // point of the rebuild (§9.60). It used to clear the type here instead.
    expect(await screen.findByText('Cineva are să vină')).toBeTruthy();
    expect(screen.queryByText('Teodora Brody')).toBeNull();

    // ARCUB is in Concert too, so switching the type above it leaves you
    // standing at ARCUB — an interdisciplinary venue is browsable through
    // the ordinary hierarchy rather than through a mode of its own.
    await user.click(screen.getByRole('button', { name: 'Concert' }));
    expect(await screen.findByText('Teodora Brody')).toBeTruthy();
    expect(screen.queryByText('Cineva are să vină')).toBeNull();
    expect(screen.getByRole('button', { name: 'ARCUB' }).getAttribute('aria-pressed')).toBe('true');

    vi.unstubAllGlobals();
  });

  it('a type the selected venue has nothing in steps back out to that type’s own venues', async () => {
    // The other half of the rule above: keep the venue when the new type
    // still contains it, drop it when it doesn't, rather than leaving the
    // programme filtered by a venue the row no longer offers.
    const user = userEvent.setup();
    const play = {
      key: 'arcub:2099-01-02:cineva-are-sa-vina', venue: 'ARCUB', title: 'Cineva are să vină',
      date: '2099-01-02', ticketState: 'open', category: 'play',
    };
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        scannedAt: new Date().toISOString(),
        venues: [{ venue: 'ARCUB', status: 'ok', events: [play] }],
        events: [play],
      }),
    })));

    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Check venues' }));
    await screen.findByText('Cineva are să vină');

    await user.click(screen.getByRole('button', { name: 'Theatre' }));
    await user.click(await screen.findByRole('button', { name: 'ARCUB' }));
    expect(screen.getByRole('button', { name: 'ARCUB' }).getAttribute('aria-pressed')).toBe('true');

    // ARCUB has nothing under Cinema, so the venue clears rather than
    // stranding the view on it.
    await user.click(screen.getByRole('button', { name: 'Cinema' }));
    expect(screen.queryByRole('button', { name: 'ARCUB' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Cinema' }).getAttribute('aria-pressed')).toBe('true');

    vi.unstubAllGlobals();
  });

  it('no day sections once a specific venue is selected — one flat chronological list', async () => {
    const user = userEvent.setup();
    const play = {
      key: 'arcub:2099-01-02:cineva-are-sa-vina', venue: 'ARCUB', title: 'Cineva are să vină',
      date: '2099-01-02', ticketState: 'open', category: 'play',
    };
    // Both the same type, so the venue selection is the only thing under
    // test here — the cascade keeps its type scope now (§9.60), and a
    // concert would simply be filtered out by the Theatre pick below.
    const concert = {
      key: 'arcub:2099-01-05:teodora-brody', venue: 'ARCUB', title: 'Teodora Brody',
      date: '2099-01-05', ticketState: 'open', category: 'play',
    };
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        scannedAt: new Date().toISOString(),
        venues: [{ venue: 'ARCUB', status: 'ok', events: [play, concert] }],
        events: [play, concert],
      }),
    })));

    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Check venues' }));
    await screen.findByText('Cineva are să vină');
    // Two different dates, so a day-grouped view would render two headings.
    expect(screen.getAllByRole('heading', { level: 2 }).length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Theatre' }));
    await user.click(await screen.findByRole('button', { name: 'ARCUB' }));

    // Both showings still visible, but no date heading divides them.
    expect(await screen.findByText('Teodora Brody')).toBeTruthy();
    expect(screen.getByText('Cineva are să vină')).toBeTruthy();
    expect(screen.queryByRole('heading', { level: 2 })).toBeNull();

    vi.unstubAllGlobals();
  });

  it('the layout toggle appears only where it does something', async () => {
    // Check venues and Settings are always actionable; the List/Posters
    // switch is not — with no programme on screen there is nothing to switch
    // between, and it used to render anyway (including over the Venues tab),
    // silently changing a preference with nothing to show for it.
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByRole('button', { name: 'Check venues' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Settings' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Switch to/ })).toBeNull();

    await user.click(await screen.findByRole('button', { name: /^Venues/ }));
    expect(screen.queryByRole('button', { name: /Switch to/ })).toBeNull();
  });

  it('once a programme is on screen, the toggle switches layout and persists the choice', async () => {
    const user = userEvent.setup();
    const event = {
      key: 'excelsior:2099-01-01T20:00:demo-show',
      venue: 'Teatrul Excelsior',
      title: 'Demo Show',
      date: '2099-01-01',
      time: '20:00',
      ticketState: 'open',
    };
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        scannedAt: new Date().toISOString(),
        venues: [{ venue: 'Teatrul Excelsior', status: 'ok', events: [event] }],
        events: [event],
      }),
    })));

    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Check venues' }));
    await screen.findByText('Demo Show');

    await user.click(await screen.findByRole('button', { name: 'Switch to poster view' }));
    expect(await screen.findByRole('button', { name: 'Switch to list view' })).toBeTruthy();

    // Persisted, not just component state — the same prefs round trip every
    // other Settings toggle already uses.
    expect(JSON.parse(localStorage.getItem('marquee_prefs')).viewMode).toBe('posters');

    vi.unstubAllGlobals();
  });
});

// §9.63 — the whole watch loop, in the app: press Watch on a sold-out show,
// find it again under the Watching facet, and have it still be there after a
// reload.
describe('Marquee — watching a sold-out show', () => {
  const soldOut = {
    key: 'excelsior:2099-01-01T20:00:demo-show',
    venue: 'Teatrul Excelsior',
    title: 'Demo Show',
    date: '2099-01-01',
    time: '20:00',
    ticketState: 'sold-out',
  };
  const onSale = {
    key: 'excelsior:2099-02-02T20:00:other-show',
    venue: 'Teatrul Excelsior',
    title: 'Other Show',
    date: '2099-02-02',
    time: '20:00',
    ticketState: 'open',
  };

  const stubScan = (events) => vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    json: async () => ({
      scannedAt: new Date().toISOString(),
      venues: [{ venue: 'Teatrul Excelsior', status: 'ok', events }],
      events,
    }),
  })));

  it('watches, filters and remembers', async () => {
    const user = userEvent.setup();
    stubScan([soldOut, onSale]);

    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Check venues' }));
    await screen.findByText('Demo Show');

    // Sold out cuts across the type/venue chain, so it is a facet, not a chip.
    await user.click(screen.getByRole('button', { name: /^Sold out/ }));
    expect(screen.queryByText('Other Show')).toBeNull();
    expect(screen.getByText('Demo Show')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Watch' }));
    await screen.findByText(/Watching “Demo Show”/);
    expect(JSON.parse(localStorage.getItem('marquee_watchlist'))['teatrul excelsior::demo show'].title)
      .toBe('Demo Show');

    await user.click(screen.getByRole('button', { name: /^Watching/ }));
    expect(screen.getByText('Demo Show')).toBeTruthy();
    expect(screen.queryByText('Other Show')).toBeNull();

    // Reload: the watch is storage, not component state.
    cleanup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Check venues' }));
    await screen.findByText('Demo Show');
    await user.click(screen.getByRole('button', { name: /^Watching/ }));
    expect(screen.getByRole('button', { name: /👁 Watching/ })).toBeTruthy();
  });

  it('says so when a watched show comes back on a date nothing has seen', async () => {
    const user = userEvent.setup();
    localStorage.setItem('marquee_watchlist', JSON.stringify({
      'teatrul excelsior::demo show': { title: 'Demo Show', venue: 'Teatrul Excelsior', missedDate: '2099-01-01' },
    }));
    stubScan([soldOut]);
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Check venues' }));
    await screen.findByText('Demo Show');

    // Second check, a new date for the same production — a key the app has
    // never seen, which without a watch would read as a plain new listing.
    const returning = { ...soldOut, key: 'excelsior:2099-03-03T20:00:demo-show', date: '2099-03-03', ticketState: 'open' };
    stubScan([soldOut, returning]);
    await user.click(screen.getByRole('button', { name: 'Check venues' }));
    // The strip says it in a sentence; the card's chip says it in the space a
    // chip has, beside "sold out" and "tickets".
    expect(await screen.findByText(/back — you were watching this/)).toBeTruthy();
    expect(screen.getAllByTitle('back — you were watching this')
      .some((el) => el.className.includes('chip--changed-returned') && el.textContent === 'back')).toBe(true);
  });
});

// §9.64 — the audit's app-level findings, each one a way the facets and the
// rest of the app disagreed.
describe('Marquee — the status facets, audited', () => {
  const soldOut = {
    key: 'excelsior:2099-01-01T20:00:demo-show', venue: 'Teatrul Excelsior', title: 'Demo Show',
    date: '2099-01-01', time: '20:00', ticketState: 'sold-out',
  };
  const onSale = {
    key: 'excelsior:2099-02-02T20:00:other-show', venue: 'Teatrul Excelsior', title: 'Other Show',
    date: '2099-02-02', time: '20:00', ticketState: 'open',
  };
  const stubScan = (events) => vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    json: async () => ({
      scannedAt: new Date().toISOString(),
      venues: [{ venue: 'Teatrul Excelsior', status: 'ok', events }],
      events,
    }),
  })));

  it('lets the facet override a standing “hide sold out” preference', async () => {
    // The two are the same person disagreeing with themselves. With the
    // preference winning, Sold out read 0 and showed nothing — and Watching
    // lost every card still sold out, which is most of what a watchlist holds.
    const user = userEvent.setup();
    localStorage.setItem('marquee_prefs', JSON.stringify({ hideSoldOut: true }));
    stubScan([soldOut, onSale]);
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Check venues' }));
    await screen.findByText('Other Show');
    expect(screen.queryByText('Demo Show')).toBeNull();

    const facet = screen.getByRole('button', { name: /^Sold out/ });
    expect(facet.textContent).toContain('1');
    await user.click(facet);
    expect(screen.getByText('Demo Show')).toBeTruthy();
  });

  it('clears the facet when you clear all filters', async () => {
    // The crumb says "Clear all filters", and the facet is a filter. It used to
    // survive: pressing it on a Sold-out view cleared the chain above and left
    // you looking at the same short list.
    const user = userEvent.setup();
    stubScan([soldOut, onSale]);
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Check venues' }));
    await screen.findByText('Demo Show');
    await user.click(screen.getByRole('button', { name: /^Teatrul Excelsior/ }));
    await user.click(screen.getByRole('button', { name: /^Sold out/ }));
    expect(screen.queryByText('Other Show')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Clear all filters' }));
    expect(screen.getByText('Other Show')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Everything' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('keeps the facets reachable when the facet itself empties the view', async () => {
    // Rendering them only when something was on screen meant pressing Sold out
    // with nothing sold out took away the control you'd need to undo it.
    const user = userEvent.setup();
    stubScan([onSale]);
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Check venues' }));
    await screen.findByText('Other Show');
    await user.click(screen.getByRole('button', { name: /^Sold out/ }));
    expect(screen.getByText('Nothing here is sold out.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Everything' })).toBeTruthy();
  });

  it('keeps the waiting list inside the venue you are looking at', async () => {
    const user = userEvent.setup();
    localStorage.setItem('marquee_watchlist', JSON.stringify({
      'teatrul odeon::elsewhere': { title: 'Elsewhere', venue: 'Teatrul Odeon', missedDate: '2026-08-30' },
    }));
    stubScan([onSale]);
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Check venues' }));
    await screen.findByText('Other Show');

    await user.click(screen.getByRole('button', { name: /^Watching/ }));
    expect(screen.getByText('Elsewhere')).toBeTruthy();

    // Now narrow to the venue that is actually on: a watch held at another
    // theatre is not part of what you're looking at.
    await user.click(screen.getByRole('button', { name: /^Teatrul Excelsior/ }));
    expect(screen.queryByText('Elsewhere')).toBeNull();
  });
});

// §9.65 — the full facet row, in the app.
describe('Marquee — every state a card can be in has a facet', () => {
  const open = {
    key: 'excelsior:2099-02-02T20:00:on-sale-show', venue: 'Teatrul Excelsior', title: 'On Sale Show',
    date: '2099-02-02', time: '20:00', ticketState: 'open',
  };
  const gone = {
    key: 'excelsior:2099-01-01T20:00:gone-show', venue: 'Teatrul Excelsior', title: 'Gone Show',
    date: '2099-01-01', time: '20:00', ticketState: 'sold-out',
  };
  const stubScan = (events) => vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    json: async () => ({
      scannedAt: new Date().toISOString(),
      venues: [{ venue: 'Teatrul Excelsior', status: 'ok', events }],
      events,
    }),
  })));

  it('draws one chip per state, counted by what pressing it would show', async () => {
    const user = userEvent.setup();
    stubScan([open, gone]);
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Check venues' }));
    await screen.findByText('On Sale Show');

    const count = (name) => screen.getByRole('button', { name }).textContent;
    expect(count(/^On sale/)).toContain('1');
    expect(count(/^Sold out/)).toContain('1');
    expect(count(/^Kept/)).toContain('0');
    expect(count(/^Ignored/)).toContain('0');
    // Nothing changed yet: the first check is a baseline, not news.
    expect(count(/^Changed/)).toContain('0');

    await user.click(screen.getByRole('button', { name: /^On sale/ }));
    expect(screen.getByText('On Sale Show')).toBeTruthy();
    expect(screen.queryByText('Gone Show')).toBeNull();
  });

  it('finds what you ignored without going through Settings', async () => {
    const user = userEvent.setup();
    stubScan([open, gone]);
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Check venues' }));
    await screen.findByText('On Sale Show');

    // The card for the show on sale, not whichever comes first by date.
    const card = screen.getByText('On Sale Show').closest('article');
    await user.click(within(card).getByRole('button', { name: 'Ignore' }));
    // Ignoring hides it, as it always did…
    await waitFor(() => expect(screen.queryByText('On Sale Show')).toBeNull());
    // …and the facet is the one place it comes back, without touching a setting.
    expect(screen.getByRole('button', { name: /^Ignored/ }).textContent).toContain('1');
    await user.click(screen.getByRole('button', { name: /^Ignored/ }));
    expect(screen.getByText('On Sale Show')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Un-ignore' })).toBeTruthy();
  });

  it('shows only what the last check turned up, under Changed', async () => {
    const user = userEvent.setup();
    stubScan([gone]);
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Check venues' }));
    await screen.findByText('Gone Show');

    stubScan([gone, open]);
    await user.click(screen.getByRole('button', { name: 'Check venues' }));
    // Twice over — the "What changed" strip names it as well as the card.
    await screen.findAllByText('On Sale Show');

    await user.click(screen.getByRole('button', { name: /^Changed/ }));
    const cards = () => Array.from(document.querySelectorAll('.prod__title')).map((el) => el.textContent);
    expect(cards()).toEqual(['On Sale Show']);
  });

  it('says which facet emptied the list, in the facet’s own words', async () => {
    const user = userEvent.setup();
    stubScan([open]);
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Check venues' }));
    await screen.findByText('On Sale Show');
    await user.click(screen.getByRole('button', { name: /^Kept/ }));
    expect(screen.getByText(/haven’t kept anything here yet/)).toBeTruthy();
  });
});
