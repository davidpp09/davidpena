export function normalize(value) {
  return String(value ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function words(value) {
  return normalize(value).match(/[a-z0-9]+/g) || [];
}

export function stem(value) {
  let word = normalize(value);
  if (word.length > 3 && word.endsWith('s')) word = word.slice(0, -1);
  if (word.length > 4 && /[aeo]$/.test(word)) word = word.slice(0, -1);
  return word;
}

export function lev(a, b) {
  const left = String(a);
  const right = String(b);
  let previous = Array.from({ length: right.length + 1 }, (_, i) => i);
  for (let i = 1; i <= left.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= right.length; j += 1) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1)
      );
    }
    previous = current;
  }
  return previous[right.length];
}

export const STOP = new Set([
  'a', 'al', 'con', 'de', 'del', 'el', 'la', 'las', 'lo', 'los', 'en', 'es', 'y', 'o',
  'que', 'se', 'si', 'un', 'una', 'uno', 'me', 'mi', 'por', 'para', 'pa', 'como', 'cuanto',
  'cuanta', 'puedo', 'pueden', 'hay', 'tienen', 'tiene', 'dan', 'son', 'ya', 'algo', 'hola',
  'oye', 'favor', 'buen', 'buena', 'buenas', 'quiero', 'necesito', 'pido',
  'venden', 'vender', 'mismo', 'partir', 'aplica'
]);
