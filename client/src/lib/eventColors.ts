// Light mode color palette - professional pastels with strong borders
const lightModeColors = [
  { base: 'rgb(185, 28, 28)', light: 'rgb(254, 226, 226)' },      // Red - crimson border, soft rose bg
  { base: 'rgb(194, 65, 12)', light: 'rgb(255, 237, 213)' },      // Orange - burnt orange border, peach bg
  { base: 'rgb(161, 98, 7)', light: 'rgb(254, 249, 195)' },       // Yellow - gold border, lemon bg
  { base: 'rgb(21, 128, 61)', light: 'rgb(220, 252, 231)' },      // Green - emerald border, mint bg
  { base: 'rgb(3, 105, 161)', light: 'rgb(224, 242, 254)' },      // Blue - cobalt border, sky bg
  { base: 'rgb(109, 40, 217)', light: 'rgb(237, 233, 254)' },     // Purple - indigo border, lavender bg
  { base: 'rgb(190, 24, 93)', light: 'rgb(252, 231, 243)' },      // Pink - magenta border, rose bg
  { base: 'rgb(13, 148, 136)', light: 'rgb(204, 251, 241)' },     // Teal - jade border, aqua bg
  { base: 'rgb(180, 83, 9)', light: 'rgb(255, 243, 224)' },       // Amber - copper border, cream bg
  { base: 'rgb(124, 58, 237)', light: 'rgb(243, 232, 255)' },     // Violet - purple border, pale bg
];

// Dark mode color palette - vibrant colors with deep, rich backgrounds
const darkModeColors = [
  { base: 'rgb(248, 113, 113)', light: 'rgb(69, 10, 10)' },       // Red - coral border, dark wine bg
  { base: 'rgb(251, 146, 60)', light: 'rgb(67, 20, 7)' },         // Orange - tangerine border, dark rust bg
  { base: 'rgb(234, 179, 8)', light: 'rgb(66, 32, 6)' },          // Yellow - bright gold border, dark brown bg
  { base: 'rgb(74, 222, 128)', light: 'rgb(5, 46, 22)' },         // Green - lime border, dark forest bg
  { base: 'rgb(56, 189, 248)', light: 'rgb(7, 89, 133)' },        // Blue - azure border, deep navy bg
  { base: 'rgb(167, 139, 250)', light: 'rgb(55, 48, 163)' },      // Purple - lavender border, royal purple bg
  { base: 'rgb(244, 114, 182)', light: 'rgb(80, 7, 36)' },        // Pink - hot pink border, dark maroon bg
  { base: 'rgb(45, 212, 191)', light: 'rgb(4, 47, 46)' },         // Teal - turquoise border, dark teal bg
  { base: 'rgb(251, 191, 36)', light: 'rgb(69, 26, 3)' },         // Amber - golden border, dark chocolate bg
  { base: 'rgb(196, 181, 253)', light: 'rgb(46, 16, 101)' },      // Violet - periwinkle border, deep violet bg
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

// Detect if user is in dark mode
function isDarkMode(): boolean {
  if (typeof window === 'undefined') return false;
  return document.documentElement.classList.contains('dark');
}

// Get the appropriate color palette based on theme
function getColorPalette() {
  return isDarkMode() ? darkModeColors : lightModeColors;
}

// Get a color index for an event, avoiding the previous event's color and used colors
export function getEventColor(
  eventId: string,
  previousColorIndex?: number,
  usedColors?: Set<number>
): number {
  const eventColors = getColorPalette();
  const hash = hashString(eventId);
  const preferredIndex = hash % eventColors.length;
  
  // If no constraints, use preferred color
  if (previousColorIndex === undefined && (!usedColors || usedColors.size === 0)) {
    return preferredIndex;
  }
  
  // If preferred color is not used and not adjacent to previous, use it
  const isNotUsed = !usedColors || !usedColors.has(preferredIndex);
  const isNotAdjacent = previousColorIndex === undefined || 
    (preferredIndex !== previousColorIndex && Math.abs(preferredIndex - previousColorIndex) > 1);
  
  if (isNotUsed && isNotAdjacent) {
    return preferredIndex;
  }
  
  // Try to find a color that's not used and not adjacent to previous
  for (let offset = 1; offset < eventColors.length; offset++) {
    const tryIndex = (preferredIndex + offset) % eventColors.length;
    const notUsed = !usedColors || !usedColors.has(tryIndex);
    const notAdjacent = previousColorIndex === undefined || 
      (tryIndex !== previousColorIndex && Math.abs(tryIndex - previousColorIndex) > 1);
    
    if (notUsed && notAdjacent) {
      return tryIndex;
    }
  }
  
  // If all unused colors are adjacent, find one that's at least not used
  for (let offset = 1; offset < eventColors.length; offset++) {
    const tryIndex = (preferredIndex + offset) % eventColors.length;
    if (!usedColors || !usedColors.has(tryIndex)) {
      return tryIndex;
    }
  }
  
  // If all colors are used, pick the one furthest from previous
  const furthestIndex = previousColorIndex !== undefined 
    ? (previousColorIndex + Math.floor(eventColors.length / 2)) % eventColors.length
    : preferredIndex;
  return furthestIndex;
}

// Get color values by index
export function getEventColorByIndex(index: number): { base: string; light: string } {
  const eventColors = getColorPalette();
  return eventColors[index % eventColors.length];
}
