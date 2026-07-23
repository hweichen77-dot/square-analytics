export const ALL_CATEGORY_NAMES = [
  'Beer', 'Wine', 'Spirits', 'Tobacco', 'Vape', 'Lottery',
  'Food', 'Drinks', 'Ice Cream', 'Ramen/Hot Food', 'Grocery', 'Merch', 'Other',
] as const
export type Category = typeof ALL_CATEGORY_NAMES[number]

const BEER_KEYWORDS = [
  'beer', 'lager', 'ipa', 'ale', 'pilsner', 'stout', 'porter', 'malt liquor',
  'modelo', 'corona', 'budweiser', 'bud light', 'coors', 'miller', 'heineken',
  'stella', 'pacifico', 'tecate', 'michelob', 'busch', 'natural light', 'natty',
  'pabst', 'pbr', 'blue moon', 'guinness', 'dos equis', 'white claw', 'truly',
  'seltzer', 'hard seltzer', 'twisted tea', 'cider', 'hard cider', 'four loko',
  'high noon', 'mike', 'six pack', '12 pack', '18 pack', '24 pack',
]

const WINE_KEYWORDS = [
  'wine', 'cabernet', 'merlot', 'chardonnay', 'pinot', 'sauvignon', 'riesling',
  'moscato', 'rose', 'zinfandel', 'malbec', 'prosecco', 'champagne', 'sparkling wine',
  'sangria', 'barefoot', 'yellow tail', 'sutter home', 'josh cellars', 'apothic',
  'franzia', 'chianti', 'port wine', 'sake', 'vermouth',
]

const SPIRITS_KEYWORDS = [
  'vodka', 'whiskey', 'whisky', 'bourbon', 'tequila', 'rum', 'gin', 'brandy',
  'cognac', 'scotch', 'liqueur', 'schnapps', 'mezcal', 'cointreau', 'triple sec',
  'jack daniel', 'jameson', 'hennessy', 'crown royal', 'jose cuervo', 'patron',
  'bacardi', 'captain morgan', 'smirnoff', 'titos', 'grey goose', 'absolut',
  'jagermeister', 'fireball', 'malibu', 'svedka', 'new amsterdam', 'don julio',
  'moonshine', 'everclear', 'aperol', 'campari', 'kahlua', 'baileys',
]

const TOBACCO_KEYWORDS = [
  'cigarette', 'cigarettes', 'cigar', 'cigarillo', 'marlboro', 'newport', 'camel',
  'pall mall', 'winston', 'american spirit', 'kool', 'lucky strike', 'black mild',
  'swisher', 'backwoods', 'dutch master', 'game leaf', 'rolling paper', 'papers',
  'chewing tobacco', 'dip', 'snus', 'copenhagen', 'skoal', 'grizzly', 'zyn', 'lighter',
]

const VAPE_KEYWORDS = [
  'vape', 'vapor', 'e-cig', 'ecig', 'e-liquid', 'e-juice', 'vape juice', 'disposable',
  'juul', 'pod', 'elf bar', 'esco bar', 'lost mary', 'geek bar', 'breeze', 'flum',
  'puff bar', 'hyde', 'nicotine', 'nic salt', 'mod', 'coil', 'cartridge',
]

const LOTTERY_KEYWORDS = [
  'lottery', 'lotto', 'scratcher', 'scratch off', 'scratch-off', 'powerball',
  'mega millions', 'megamillions', 'quick pick', 'ticket', 'pull tab', 'keno',
]

const GROCERY_KEYWORDS = [
  'bread', 'eggs', 'butter', 'cheese', 'yogurt', 'cereal', 'pasta', 'rice',
  'flour', 'sugar', 'salt', 'oil', 'ketchup', 'mustard', 'mayo', 'sauce',
  'canned', 'soup can', 'beans', 'tuna', 'peanut butter', 'jelly', 'honey',
  'detergent', 'soap', 'shampoo', 'toilet paper', 'paper towel', 'napkin',
  'diaper', 'battery', 'batteries', 'toothpaste', 'deodorant', 'aspirin',
  'ibuprofen', 'tylenol', 'bandage', 'condom', 'pet food', 'dog food', 'cat food',
]

const FOOD_KEYWORDS = [
  'takis', 'chips', 'doritos', 'cheetos', 'lays', 'pretzels', 'popcorn',
  'candy', 'gummy', 'chocolate', 'snickers', 'kitkat', 'reeses', 'skittles',
  'starburst', 'jolly rancher', 'nerds', 'haribo', 'cookie', 'brownie',
  'muffin', 'cracker', 'goldfish', 'oreo', 'rice crispy', 'granola', 'bar',
  'trail mix', 'beef jerky', 'jerky', 'slim jim', 'hot pocket', 'sandwich',
  'wrap', 'salad', 'fruit', 'apple', 'banana', 'orange', 'snack',
]

const DRINKS_KEYWORDS = [
  'water', 'gatorade', 'powerade', 'juice', 'lemonade', 'tea', 'coffee',
  'monster', 'redbull', 'red bull', 'bang', 'celsius', 'bodyarmor', 'body armor',
  'snapple', 'arizona', 'vitamin water', 'vitaminwater', 'sparkling', 'soda',
  'coke', 'pepsi', 'sprite', 'fanta', 'dr pepper', 'mountain dew', 'dew',
  'drink', 'beverage', 'smoothie', 'shake', 'milk', 'chocolate milk',
]

const ICE_CREAM_KEYWORDS = [
  'ice cream', 'popsicle', 'freeze pop', 'drumstick', 'klondike',
  'fudge bar', 'creamsicle', 'sorbet', 'gelato', 'frozen yogurt', 'froyo',
  'dippin dots', 'ice pop',
]

const RAMEN_KEYWORDS = [
  'ramen', 'noodle', 'instant noodle', 'cup noodle', 'maruchan',
  'nissin', 'top ramen', 'soup', 'hot food', 'nachos', 'pretzel dog',
  'hot dog', 'pizza', 'quesadilla', 'mac', 'macaroni',
]

export const MERCH_KEYWORDS = [
  'shirt', 't-shirt', 'hoodie', 'sweatshirt', 'jacket', 'hat', 'cap', 'beanie',
  'bag', 'backpack', 'lanyard', 'keychain', 'sticker', 'pen', 'pencil',
  'notebook', 'binder', 'folder', 'merch', 'merchandise', 'apparel', 'gear',
  'bracelet', 'wristband', 'pin', 'button', 'magnet', 'poster', 'flag',
]

const kwCache = new Map<string, RegExp>()
function hasKeyword(lower: string, keywords: string[]): boolean {
  return keywords.some(k => {
    let re = kwCache.get(k)
    if (!re) {
      re = new RegExp('\\b' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b')
      kwCache.set(k, re)
    }
    return re.test(lower)
  })
}

export function classifyProduct(name: string, overrides: Record<string, string> = {}): string {
  if (overrides[name]) return overrides[name]
  const lower = String(name ?? '').toLowerCase()
  if (hasKeyword(lower, LOTTERY_KEYWORDS)) return 'Lottery'
  if (hasKeyword(lower, VAPE_KEYWORDS)) return 'Vape'
  if (hasKeyword(lower, TOBACCO_KEYWORDS)) return 'Tobacco'
  if (hasKeyword(lower, WINE_KEYWORDS)) return 'Wine'
  if (hasKeyword(lower, SPIRITS_KEYWORDS)) return 'Spirits'
  if (/\broot beer\b/.test(lower)) return 'Drinks'
  if (hasKeyword(lower, BEER_KEYWORDS)) return 'Beer'
  if (hasKeyword(lower, ICE_CREAM_KEYWORDS)) return 'Ice Cream'
  if (hasKeyword(lower, RAMEN_KEYWORDS)) return 'Ramen/Hot Food'
  if (hasKeyword(lower, DRINKS_KEYWORDS)) return 'Drinks'
  if (hasKeyword(lower, FOOD_KEYWORDS)) return 'Food'
  if (hasKeyword(lower, GROCERY_KEYWORDS)) return 'Grocery'
  if (hasKeyword(lower, MERCH_KEYWORDS)) return 'Merch'
  return 'Other'
}

export const AGE_RESTRICTED_CATEGORIES = new Set(['Beer', 'Wine', 'Spirits', 'Tobacco', 'Vape'])

export function isAgeRestricted(category: string): boolean {
  return AGE_RESTRICTED_CATEGORIES.has(category)
}
