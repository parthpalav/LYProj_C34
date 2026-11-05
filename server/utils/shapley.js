/**
 * Exact Shapley values for a small cooperative game.
 *
 * value(subset) returns an object of numbers (e.g. { total, D1, D2, D3 }) and must
 * return the same keys for the empty subset. Each player's share of every key is
 *   φᵢ = Σ over S ∌ i of |S|!(n−|S|−1)!/n! · (v(S ∪ {i}) − v(S)),
 * so the shares add up to v(all players) − v(∅).
 * Enumerates all 2^n subsets: fine for a family (max 6 members, 64 subsets).
 */
export function shapleyValues(players, value) {
  const n = players.length;
  if (n > 12) throw new Error('shapleyValues: too many players for exact enumeration');
  const fact = [1];
  for (let i = 1; i <= n; i++) fact[i] = fact[i - 1] * i;

  const subsets = 1 << n;
  const v = new Array(subsets);
  for (let mask = 0; mask < subsets; mask++) {
    v[mask] = value(players.filter((_, i) => mask & (1 << i)));
  }
  const keys = Object.keys(v[0]);
  const size = (mask) => { let c = 0; for (let m = mask; m; m &= m - 1) c++; return c; };

  return players.map((_, i) => {
    const share = Object.fromEntries(keys.map((k) => [k, 0]));
    for (let mask = 0; mask < subsets; mask++) {
      if (mask & (1 << i)) continue;
      const s = size(mask);
      const weight = (fact[s] * fact[n - s - 1]) / fact[n];
      for (const k of keys) share[k] += weight * (v[mask | (1 << i)][k] - v[mask][k]);
    }
    return share;
  });
}
