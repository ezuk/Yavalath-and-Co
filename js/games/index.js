// The collection, in the book's order. Rules live in the module of the same id.

const BGG = 'https://boardgamegeek.com/';
const NESTOR = { name: 'Néstor Romeral Andrés', url: BGG + 'boardgamedesigner/9393/nestor-romeral-andres' };
const CAMERON = { name: 'Cameron Browne', url: BGG + 'boardgamedesigner/3541/cameron-browne' };
const DIETER = { name: 'Dieter Stein', url: BGG + 'boardgameartist/3063/dieter-stein' };
const NICK = { name: 'Nick Bentley', url: BGG + 'boardgamedesigner/7958/nick-bentley' };
const STEPHEN = { name: 'Stephen Linhart', url: BGG + 'boardgamedesigner/7857/stephen-linhart' };
const VIKINGUR = { name: 'Víkingur Fjalar Eiríksson', url: BGG + 'boardgamedesigner/12568/vikingur-fjalar-eiriksson' };
const ELANOR = { name: 'Élanor Grace Rodeffer', url: BGG + 'boardgamedesigner/65035/elanor-grace-rodeffer' };

// `by` lists the designers. `via` names the program that evolved the game:
// Yavalath and Pentalath came out of Cameron Browne's Ludi system.

export const GAMES = [
  { id: 'yavalath', name: 'Yavalath', via: 'Ludi', by: [CAMERON], year: 2007,
    blurb: 'Four in a row wins. Three in a row loses.' },
  { id: 'pentalath', name: 'Pentalath', via: 'Ludi', by: [CAMERON], year: 2007,
    blurb: 'Five in a row, with surrounded stones captured.' },
  { id: 'yavalanchor', name: 'Yavalanchor', by: [NESTOR], year: 2012,
    blurb: 'Build your five around shared red anchors.' },
  { id: 'yavalade', name: 'Yavalade', by: [NESTOR], year: 2012,
    blurb: 'Three players, each needing a neighbour’s colour.' },
  { id: 'cross', name: 'Cross', by: [CAMERON], year: 2011,
    blurb: 'Join three sides to win. Join two opposite sides and lose.' },
  { id: 'omega', name: 'Omega', by: [NESTOR], year: 2010,
    blurb: 'Place every colour. Multiply your group sizes.' },
  { id: 'manalath', name: 'Manalath', by: [DIETER, NESTOR], year: 2012,
    blurb: 'A group of five wins. A group of four loses.' },
  { id: 'odd', name: 'Odd', by: [NICK], year: 2007,
    blurb: 'One player wants an odd number of groups, the other even.' },
  { id: 'coffee', name: 'Coffee', by: [NESTOR], year: 2011,
    blurb: 'Each stone points to where the next must go.' },
  { id: 'ducks', name: 'Feed the Ducks', by: [NESTOR], year: 2011,
    blurb: 'Drop a crumb and gather your ducks into one flock.' },
  { id: 'susan', name: 'Susan', by: [STEPHEN], year: 1991,
    blurb: 'Place or slide to surround a single enemy stone.' },
  { id: 'taacoca', name: 'Taacoca', by: [VIKINGUR], year: 2009,
    blurb: 'March three stones at a time to the far home row.' },
  { id: 'quantum', name: 'Quantum Leap', by: [NESTOR], year: 2013,
    blurb: 'Leap as far as you have friends beside you.' },
  { id: 'playwin', name: 'Play Win', by: [ELANOR], year: 2011,
    blurb: 'Hunt with chains of short, bent leaps.' },
  { id: 'onager', name: 'Onager', by: [NESTOR], year: 2012,
    blurb: 'Catapult over your own pieces to the enemy’s back rank.' },
];
