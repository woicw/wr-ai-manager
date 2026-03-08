const gradientPalette = [
  "bg-gradient-to-br from-sky-400 via-blue-500 to-indigo-500 text-white",
  "bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-500 text-white",
  "bg-gradient-to-br from-fuchsia-400 via-rose-500 to-orange-400 text-white",
  "bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 text-white",
  "bg-gradient-to-br from-violet-400 via-purple-500 to-fuchsia-500 text-white",
  "bg-gradient-to-br from-lime-400 via-emerald-500 to-teal-500 text-white",
  "bg-gradient-to-br from-cyan-400 via-sky-500 to-blue-600 text-white",
  "bg-gradient-to-br from-pink-400 via-rose-500 to-red-500 text-white",
];

function hashName(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function getNameBadgeLabel(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return "?";

  const first = Array.from(trimmed)[0] ?? "?";
  return /[a-z]/i.test(first) ? first.toUpperCase() : first;
}

export function getNameBadgeClassName(name: string) {
  const normalized = name.trim().toLowerCase();
  const index = hashName(normalized || "?") % gradientPalette.length;
  return gradientPalette[index];
}

