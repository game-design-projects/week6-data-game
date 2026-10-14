/** "King of England" -> "King of ▇▇▇" ; keeps the rank, hides the place. */
export function redactTitle(t) {
  const m = /^(.*?)\s+(of|de|d'|von|van)\s+.+$/i.exec(t);
  return m ? `${m[1]} ${m[2]} ▇▇▇` : t;
}
