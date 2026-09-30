// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Poster, posterUrl } from './Poster.jsx';

afterEach(cleanup);

const img = () => document.querySelector('img');
const placeholder = () => document.querySelector('.prod__poster--placeholder');

describe('posterUrl', () => {
  it('leaves the first attempt completely alone', () => {
    // Every other venue's posters load first time; none of them get rewritten,
    // so none of them lose their cacheability to this.
    expect(posterUrl('https://cndb.ro/a.jpg', 0)).toBe('https://cndb.ro/a.jpg');
    expect(posterUrl('https://cndb.ro/a.jpg', -1)).toBe('https://cndb.ro/a.jpg');
  });

  it('busts the cache on a retry, or the retry is not a retry', () => {
    // The browser is holding the FAILED response for this exact URL — a 12KB
    // bot-check page served as text/html. Asking for the same URL again would
    // be answered from cache without a request, and fail instantly.
    expect(posterUrl('https://cndb.ro/a.jpg', 1)).toBe('https://cndb.ro/a.jpg?mq-retry=1');
    expect(posterUrl('https://cndb.ro/a.jpg', 2)).toBe('https://cndb.ro/a.jpg?mq-retry=2');
  });

  it('appends to an existing query rather than assuming there is none', () => {
    // iabilet's posters come through imgcdn with sizing parameters already on.
    expect(posterUrl('https://imgcdn3.iabilet.ro/x.jpg?w=260', 1))
      .toBe('https://imgcdn3.iabilet.ro/x.jpg?w=260&mq-retry=1');
  });

  it('passes a missing src straight through', () => {
    expect(posterUrl(null, 2)).toBe(null);
    expect(posterUrl('', 1)).toBe('');
  });
});

describe('Poster', () => {
  it('shows the outline when there is no poster at all', () => {
    render(<Poster src={null} />);
    expect(img()).toBeNull();
    expect(placeholder()).not.toBeNull();
  });

  it('retries twice before giving up', () => {
    render(<Poster src="https://cndb.ro/a.jpg" />);
    expect(img().getAttribute('src')).toBe('https://cndb.ro/a.jpg');

    fireEvent.error(img());
    expect(img().getAttribute('src')).toBe('https://cndb.ro/a.jpg?mq-retry=1');

    fireEvent.error(img());
    expect(img().getAttribute('src')).toBe('https://cndb.ro/a.jpg?mq-retry=2');

    // Three requests in total, then the slot stops asking.
    fireEvent.error(img());
    expect(img()).toBeNull();
    expect(placeholder()).not.toBeNull();
  });

  it('keeps the poster once any attempt succeeds', () => {
    // No success event is needed: an attempt that does not error simply stays
    // on screen. This pins that a retry does not itself blank anything.
    render(<Poster src="https://cndb.ro/a.jpg" />);
    fireEvent.error(img());
    expect(img()).not.toBeNull();
    expect(placeholder()).toBeNull();
  });

  it('does not hand one production’s exhaustion to the next', () => {
    // React keeps the instance alive across a re-ordered list. Without the
    // reset, a slot that had used up its retries would show the OUTLINE for
    // whatever production took its place — a blank poster no reload could fix.
    const { rerender } = render(<Poster src="https://cndb.ro/a.jpg" />);
    fireEvent.error(img());
    fireEvent.error(img());
    fireEvent.error(img());
    expect(img()).toBeNull();

    rerender(<Poster src="https://cndb.ro/b.jpg" />);
    expect(img()).not.toBeNull();
    expect(img().getAttribute('src')).toBe('https://cndb.ro/b.jpg');
  });

  it('carries the frame class it was given, placeholder or not', () => {
    // PosterGrid's tiles and Programme's rows size the same component
    // differently in CSS.
    const { rerender } = render(<Poster src="https://cndb.ro/a.jpg" className="poster-tile__art" />);
    expect(document.querySelector('.poster-tile__art')).not.toBeNull();
    rerender(<Poster src={null} className="poster-tile__art" />);
    expect(document.querySelector('.poster-tile__art--placeholder')).not.toBeNull();
  });

  it('stays out of the accessibility tree either way', () => {
    render(<Poster src="https://cndb.ro/a.jpg" />);
    expect(img().getAttribute('aria-hidden')).toBe('true');
    expect(img().getAttribute('alt')).toBe('');
    expect(screen.queryAllByRole('img')).toHaveLength(0);
  });
});
